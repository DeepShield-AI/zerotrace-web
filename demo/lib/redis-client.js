"use strict";

/**
 * 共享 Redis 客户端封装
 *
 * - getClient()      获取用于普通读写命令的共享连接（单例）
 * - createSubscriber() 创建一个专用于 pub/sub 订阅的独立连接（ioredis 要求订阅连接不能再执行普通命令）
 */
const Redis = require("ioredis");

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

let sharedClient = null;

function getClient() {
	if (!sharedClient) {
		sharedClient = new Redis(REDIS_URL, {
			retryStrategy: times => Math.min(times * 200, 2000),
			maxRetriesPerRequest: 3
		});
		sharedClient.on("error", err => {
			// eslint-disable-next-line no-console
			console.error("[redis-client] connection error:", err.message);
		});
	}
	return sharedClient;
}

function createSubscriber() {
	const sub = new Redis(REDIS_URL, {
		retryStrategy: times => Math.min(times * 200, 2000)
	});
	sub.on("error", err => {
		// eslint-disable-next-line no-console
		console.error("[redis-client:subscriber] connection error:", err.message);
	});
	return sub;
}

module.exports = { REDIS_URL, getClient, createSubscriber };
