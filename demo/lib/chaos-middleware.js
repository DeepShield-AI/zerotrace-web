"use strict";

/**
 * 故障注入 Express 中间件
 *
 * 支持两层故障注入：
 *   1. 资源级：网络延迟中间件（CPU/内存/磁盘压力在后台运行，自然影响请求）
 *   2. 请求级：通过 Redis 规则的 latency/down/error（精确场景）
 *
 * 每个服务进程调用 initChaos(serviceName) 初始化：
 *   - 连接 Redis + 加载故障规则
 *   - 订阅 stress:commands 通道，执行资源压力指令
 */

const { getChaosStore } = require("./chaos-store");
const { getStressManager } = require("./resource-stress");
const { getClient, createSubscriber } = require("./redis-client");

const store = getChaosStore();
const stressMgr = getStressManager();

const STRESS_CHANNEL = "stress:commands";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 初始化：每个服务启动时调用一次
 * @param {string} serviceName 本服务名称 (gateway|users|products|orders|chaos)
 */
async function initChaos(serviceName) {
  // 1. 初始化故障规则存储（Redis 连接 + 规则缓存 + Pub/Sub）
  await store.init();

  // 2. 订阅资源压力指令通道
  const subscriber = createSubscriber();
  await subscriber.subscribe(STRESS_CHANNEL);
  subscriber.on("message", (_channel, message) => {
    try {
      const cmd = JSON.parse(message);

      // 目标匹配：仅当 target 匹配本服务时才执行
      if (cmd.target !== serviceName && cmd.target !== "*") return;

      if (cmd.action === "inject") {
        stressMgr.start(cmd.faultId, cmd.type, cmd.opts || {}, cmd.durationMs);
        console.warn(`[${serviceName}] 收到应力指令: type=${cmd.type} faultId=${cmd.faultId}`);
      } else if (cmd.action === "release") {
        stressMgr.stop(cmd.faultId);
        console.warn(`[${serviceName}] 释放应力: faultId=${cmd.faultId}`);
      } else if (cmd.action === "releaseAll") {
        const r = stressMgr.stopAll();
        console.warn(`[${serviceName}] 释放全部应力: ${r.released} 个`);
      }
    } catch {
      // 忽略解析错误
    }
  });

  // 保存引用，供 close 使用
  stressMgr._subscriber = subscriber;
}

async function closeChaos() {
  stressMgr.stopAll();
  if (stressMgr._subscriber) {
    await stressMgr._subscriber.quit().catch(() => {});
  }
  await store.close();
}

/**
 * 返回 Express 中间件
 */
function chaosWrap(serviceName, actionName) {
  return async (req, res, next) => {
    try {
      // ── 第1层：资源级网络延迟 ──────────────────────
      const networkMw = stressMgr.getNetworkMiddleware();
      if (networkMw) {
        await new Promise((resolve, reject) => {
          networkMw(req, res, (err) => (err ? reject(err) : resolve()));
        });
        if (res.headersSent) return;
      }

      // ── 第2层：请求级精确规则（兼容）──────────────
      const matched = store.resolveRule(serviceName, actionName);
      if (matched) {
        const { target, rule } = matched;

        if (rule.probability != null && Math.random() >= rule.probability) {
          return next();
        }

        if (rule.type === "latency") {
          const base = rule.delayMs != null ? rule.delayMs : 2000;
          const jitter = rule.jitterMs ? Math.random() * rule.jitterMs : 0;
          const totalDelay = Math.round(base + jitter);
          console.warn(`[chaos:rule] ${serviceName}.${actionName} latency=${totalDelay}ms`);
          await sleep(totalDelay);
        } else if (rule.type === "down") {
          console.error(`[chaos:rule] ${serviceName}.${actionName} DOWN`);
          return res.status(rule.errorCode || 503).json({
            error: "SERVICE_DOWN",
            message: rule.errorMessage || `Service DOWN on '${target}'`,
            chaos: true,
          });
        } else if (rule.type === "error") {
          console.error(`[chaos:rule] ${serviceName}.${actionName} ERROR`);
          return res.status(rule.errorCode || 500).json({
            error: rule.errorType || "CHAOS_ERROR",
            message: rule.errorMessage || `Chaos error on '${target}'`,
            chaos: true,
          });
        }
      }
    } catch (err) {
      console.error(`[chaos] 中间件异常: ${err.message}`);
    }
    next();
  };
}

module.exports = { chaosWrap, initChaos, closeChaos };
