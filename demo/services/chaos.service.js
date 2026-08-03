"use strict";

/**
 * chaos 服务 — 资源故障注入控制面
 *
 * 提供 REST 接口来动态注入/停止/查看资源故障（CPU/内存/网络/磁盘）。
 * 通过 Redis Pub/Sub 将指令广播到目标服务的 StressManager。
 *
 * POST /api/chaos/inject
 *   { target, type, duration, intensity?, megabytes?, delayMs?, jitterMs?, fileSizeMB? }
 *
 * POST /api/chaos/release    — 释放指定故障
 * POST /api/chaos/release-all — 释放所有故障
 * GET  /api/chaos/status     — 查看活跃资源故障
 * GET  /api/chaos/rules      — 请求级规则（旧版兼容）
 * POST /api/chaos/rule/set   — 设置请求级规则
 * POST /api/chaos/rule/reset — 重置请求级规则
 */

const express = require("express");
const { getChaosStore } = require("../lib/chaos-store");
const { getStressManager } = require("../lib/resource-stress");
const { getClient } = require("../lib/redis-client");
const { initChaos } = require("../lib/chaos-middleware");

const PORT = process.env.CHAOS_PORT || 3004;
const SERVICE_NAME = "chaos";
const STRESS_CHANNEL = "stress:commands";

const store = getChaosStore();
const stressMgr = getStressManager();
const redis = getClient();

// ─── 工具函数 ──────────────────────────────────────────────

function faultId(target, type) {
  return `${target}:${type}:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`;
}

async function broadcast(payload) {
  await redis.publish(STRESS_CHANNEL, JSON.stringify(payload));
}

// ─── Express App ──────────────────────────────────────────

const app = express();
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: SERVICE_NAME,
    activeFaults: Object.keys(stressMgr.getActive()).length,
  });
});

// ── 资源级故障 API ────────────────────────────────────────

/** 查看所有活跃的资源故障 */
app.get("/api/chaos/status", (req, res) => {
  res.json({
    service: "chaos",
    activeFaults: stressMgr.getActive(),
    count: Object.keys(stressMgr.getActive()).length,
  });
});

/** 注入资源级故障 */
app.post("/api/chaos/inject", async (req, res) => {
  try {
    const {
      target,
      type,
      duration = 30,
      intensity = 2,
      megabytes = 100,
      delayMs = 2000,
      jitterMs = 1000,
      fileSizeMB = 200,
    } = req.body;

    if (!target) return res.status(400).json({ error: "缺少 target" });
    if (!type || !["cpu", "memory", "network", "disk"].includes(type)) {
      return res.status(400).json({ error: "type 必须是 cpu|memory|network|disk" });
    }
    if (duration < 5) return res.status(400).json({ error: "duration 最少 5 秒" });

    const id = faultId(target, type);
    const durationMs = duration * 1000;
    const opts = { intensity, megabytes, delayMs, jitterMs, fileSizeMB };

    const cmd = { action: "inject", faultId: id, type, opts, durationMs, target };
    await broadcast(cmd);

    // 如果目标是 chaos 自身，也本地执行
    if (target === "chaos" || target === "*") {
      stressMgr.start(id, type, opts, durationMs);
    }

    console.warn(
      `[chaos] 故障已注入: target=${target} type=${type} faultId=${id} duration=${duration}s`
    );

    res.json({
      success: true,
      faultId: id,
      target,
      type,
      duration,
      opts,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** 释放指定故障或目标服务的全部故障 */
app.post("/api/chaos/release", async (req, res) => {
  try {
    const { faultId, target } = req.body;

    if (faultId) {
      await broadcast({ action: "release", faultId, target: target || "*" });
      return res.json({ success: true, faultId, action: "released" });
    }
    if (target) {
      await broadcast({ action: "releaseAll", target });
      return res.json({ success: true, target, action: "releaseAll" });
    }
    return res.status(400).json({ error: "需要 faultId 或 target" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** 释放所有活跃故障 */
app.post("/api/chaos/release-all", async (req, res) => {
  try {
    stressMgr.stopAll();
    await broadcast({ action: "releaseAll", target: "*" });
    res.json({ success: true, action: "releaseAll" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 请求级规则 API（兼容）─────────────────────────────────

app.get("/api/chaos/rules", (req, res) => {
  res.json(store.listRules());
});

app.post("/api/chaos/rule/set", async (req, res) => {
  try {
    const { target, ...rule } = req.body;
    if (!target) return res.status(400).json({ error: "缺少 target" });
    const saved = await store.setRule(target, rule);
    res.json({ success: true, rule: saved });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/chaos/rule/clear", async (req, res) => {
  try {
    const { target } = req.body;
    if (!target) return res.status(400).json({ error: "缺少 target" });
    await store.deleteRule(target);
    res.json({ success: true, target });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/chaos/rule/reset", async (req, res) => {
  try {
    await store.resetAll();
    res.json({ reset: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── 启动 ─────────────────────────────────────────────────

initChaos(SERVICE_NAME).then(() => {
  app.listen(PORT, () => {
    console.log(`[chaos] 资源故障控制面运行在 :${PORT}`);
    console.log(`[chaos] 支持: cpu | memory | network | disk`);
  });
});
