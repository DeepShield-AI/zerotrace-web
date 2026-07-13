"use strict";

/**
 * Moleculer Broker 全局配置文件
 * 被 moleculer-runner 自动加载（见各 npm script）
 *
 * 通过环境变量 TRANSPORTER 可以切换通信方式：
 *   - 未设置：使用内置 Fake transporter（仅同进程内可用，适合单进程调试）
 *   - "redis://localhost:6379"：使用 Redis 作为服务间通信总线（推荐，用于多进程/多容器场景）
 */
const createChaosMiddleware = require("./lib/chaos-middleware");

module.exports = {
	namespace: "chaos-demo",
	nodeID: undefined, // 由各服务自动生成，避免多进程冲突

	// 服务间通信方式。本地演示默认使用 Redis，可通过 TRANSPORTER 环境变量覆盖
	transporter: process.env.TRANSPORTER || "redis://localhost:6379",

	// 序列化协议
	serializer: "JSON",

	// 单次请求的默认超时时间（毫秒）。故障注入的延迟场景要小于此值才能观察到"慢响应"而非直接超时
	requestTimeout: 8 * 1000,

	retryPolicy: {
		enabled: false
	},

	// 关闭断路器，让故障注入的效果更直观（否则多次失败后 CircuitBreaker 会自动跳闸屏蔽后续调用）
	circuitBreaker: {
		enabled: false
	},

	// 关闭内置 bulkhead，避免并发限制干扰故障注入演示
	bulkhead: {
		enabled: false
	},

	// 全局注册故障注入中间件：自动包裹所有服务的 action handler
	middlewares: [createChaosMiddleware()],

	logger: {
		type: "Console",
		options: {
			colors: true,
			moduleColors: true,
			formatter: "short",
			objectPrinter: null,
			autoPadding: false
		}
	},
	logLevel: process.env.LOG_LEVEL || "info",

	metrics: {
		enabled: false
	},
	tracing: {
		enabled: false
	}
};
