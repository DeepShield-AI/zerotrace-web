"use strict";

/**
 * 故障注入 Express 中间件
 *
 * chaosWrap(serviceName, actionName) 返回一个 Express 中间件函数，
 * 包裹业务 handler，在执行业务逻辑前检查是否命中故障规则：
 *   - latency：注入固定延迟 + 随机抖动
 *   - down：返回 503，模拟服务宕机
 *   - error：返回自定义状态码+错误信息
 *
 * 故障规则通过 ChaosStore（Redis 支撑）实时同步，无需重启服务。
 */
const { getChaosStore } = require("./chaos-store");

const store = getChaosStore();

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 初始化 ChaosStore（Redis 连接 + 规则缓存 + Pub/Sub 订阅）
 * 每个服务进程启动时调用一次。
 */
async function initChaos() {
	await store.init();
}

/**
 * 关闭 Redis 连接，清理资源。
 */
async function closeChaos() {
	await store.close();
}

/**
 * 返回 Express 中间件，为指定的服务+action 注入故障。
 *
 * 用法：
 *   app.get('/api/users/:id', chaosWrap('users', 'get'), handler);
 */
function chaosWrap(serviceName, actionName) {
	return async (req, res, next) => {
		try {
			const matched = store.resolveRule(serviceName, actionName);
			if (matched) {
				const { target, rule } = matched;
				const roll = Math.random();
				const willTrigger = roll < (rule.probability != null ? rule.probability : 1);

				if (willTrigger) {
					if (rule.type === "latency") {
						const base = rule.delayMs != null ? rule.delayMs : 2000;
						const jitter = rule.jitterMs ? Math.random() * rule.jitterMs : 0;
						const totalDelay = Math.round(base + jitter);
						console.warn(
							`[chaos] 注入延迟故障: ${serviceName}.${actionName} target=${target} delay=${totalDelay}ms`
						);
						await sleep(totalDelay);
					} else if (rule.type === "down") {
						console.error(
							`[chaos] 注入宕机故障: ${serviceName}.${actionName} target=${target}`
						);
						return res.status(rule.errorCode || 503).json({
							error: rule.errorType || "SERVICE_DOWN_CHAOS",
							message: rule.errorMessage || `Service is DOWN (chaos injected on '${target}')`,
							chaos: true,
							target,
							type: "down"
						});
					} else if (rule.type === "error") {
						console.error(
							`[chaos] 注入异常响应故障: ${serviceName}.${actionName} target=${target}`
						);
						return res.status(rule.errorCode || 500).json({
							error: rule.errorType || "CUSTOM_CHAOS_ERROR",
							message: rule.errorMessage || `Chaos injected error on '${target}'`,
							chaos: true,
							target,
							type: "error"
						});
					}
				}
			}
		} catch (err) {
			console.error(`[chaos] 中间件异常: ${err.message}`);
		}
		next();
	};
}

module.exports = { chaosWrap, initChaos, closeChaos };
