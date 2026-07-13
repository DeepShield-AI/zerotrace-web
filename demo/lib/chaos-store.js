"use strict";

/**
 * 故障规则存储（基于 Redis）
 *
 * 所有微服务进程共享同一份故障配置，通过 Redis Hash 持久化，并通过 Pub/Sub
 * 实时广播变更，使得"开关一次故障，所有服务进程立即生效"（无需重启任何进程）。
 *
 * 规则的匹配对象（target）支持三种粒度，优先级从高到低：
 *   1. "<service>.<action>"  精确到某个 action，例如 "orders.createOrder"
 *   2. "<service>"           整个服务级别，例如 "orders"
 *   3. "*"                   全局兜底规则
 *
 * 规则（rule）结构：
 * {
 *   type: "latency" | "error" | "down" | "none",
 *   enabled: true,
 *   probability: 1,        // 0~1，触发概率，默认 1（每次必触发）
 *   delayMs: 3000,         // type=latency 时的固定延迟
 *   jitterMs: 500,         // type=latency 时附加的随机抖动（0~jitterMs）
 *   errorCode: 500,        // type=error 时返回的 HTTP 状态码
 *   errorType: "CUSTOM_CHAOS_ERROR", // type=error 时的错误类型标识
 *   errorMessage: "...",   // type=error 时的错误信息
 *   updatedAt: 169xxxx     // 最近更新时间戳
 * }
 */
const EventEmitter = require("events");
const { getClient, createSubscriber } = require("./redis-client");

const RULES_KEY = "chaos:rules";
const CHANNEL = "chaos:events";

const VALID_TYPES = ["latency", "error", "down", "none"];

class ChaosStore extends EventEmitter {
	constructor() {
		super();
		this.redis = getClient();
		this.cache = new Map(); // target -> rule
		this.cacheLoaded = false;
		this.subscriber = null;
	}

	/**
	 * 初始化：加载一次全量规则到本地缓存，并订阅变更广播
	 */
	async init() {
		await this.reloadAll();

		this.subscriber = createSubscriber();
		await this.subscriber.subscribe(CHANNEL);
		this.subscriber.on("message", async (_channel, message) => {
			try {
				const evt = JSON.parse(message);
				if (evt.action === "reset") {
					this.cache.clear();
				} else if (evt.action === "delete") {
					this.cache.delete(evt.target);
				} else if (evt.action === "update") {
					this.cache.set(evt.target, evt.rule);
				}
				this.emit("change", evt);
			} catch {
				// ignore malformed message, 下次 reloadAll 兜底
			}
		});

		// 兜底：每 10 秒做一次全量同步，避免个别消息丢失导致缓存长期不一致
		this._pollTimer = setInterval(() => {
			this.reloadAll().catch(() => {});
		}, 10000);
		if (this._pollTimer.unref) this._pollTimer.unref();
	}

	async reloadAll() {
		const raw = await this.redis.hgetall(RULES_KEY);
		this.cache.clear();
		Object.entries(raw).forEach(([target, json]) => {
			try {
				this.cache.set(target, JSON.parse(json));
			} catch {
				// skip corrupt entry
			}
		});
		this.cacheLoaded = true;
	}

	validateRule(rule) {
		if (!rule || typeof rule !== "object") throw new Error("rule 必须是对象");
		if (!VALID_TYPES.includes(rule.type)) {
			throw new Error(`rule.type 必须是 ${VALID_TYPES.join(" | ")} 之一`);
		}
		if (rule.probability != null && (rule.probability < 0 || rule.probability > 1)) {
			throw new Error("probability 必须在 0~1 之间");
		}
		return true;
	}

	/**
	 * 设置/更新某个 target 的故障规则
	 */
	async setRule(target, rule) {
		this.validateRule(rule);
		const finalRule = Object.assign(
			{
				enabled: true,
				probability: 1
			},
			rule,
			{ updatedAt: Date.now() }
		);

		await this.redis.hset(RULES_KEY, target, JSON.stringify(finalRule));
		await this.redis.publish(CHANNEL, JSON.stringify({ action: "update", target, rule: finalRule }));

		this.cache.set(target, finalRule);
		return finalRule;
	}

	async deleteRule(target) {
		await this.redis.hdel(RULES_KEY, target);
		await this.redis.publish(CHANNEL, JSON.stringify({ action: "delete", target }));
		this.cache.delete(target);
	}

	async resetAll() {
		await this.redis.del(RULES_KEY);
		await this.redis.publish(CHANNEL, JSON.stringify({ action: "reset" }));
		this.cache.clear();
	}

	/**
	 * 列出当前所有规则（从本地缓存读取，读取速度极快，不阻塞业务调用）
	 */
	listRules() {
		const result = {};
		for (const [target, rule] of this.cache.entries()) {
			result[target] = rule;
		}
		return result;
	}

	/**
	 * 根据 service 全名 + action 全名，解析出当前应生效的规则（若无匹配则返回 null）
	 * 优先级：action 级 > service 级 > 全局 "*"
	 */
	resolveRule(serviceName, actionName) {
		const candidates = [actionName, serviceName, "*"];
		for (const key of candidates) {
			const rule = this.cache.get(key);
			if (rule && rule.enabled && rule.type !== "none") {
				return { target: key, rule };
			}
		}
		return null;
	}

	async close() {
		if (this._pollTimer) clearInterval(this._pollTimer);
		if (this.subscriber) await this.subscriber.quit().catch(() => {});
	}
}

// 每个进程内单例，保证同一进程内所有服务共享同一份缓存与订阅连接
let instance = null;
function getChaosStore() {
	if (!instance) instance = new ChaosStore();
	return instance;
}

module.exports = { getChaosStore, VALID_TYPES, RULES_KEY, CHANNEL };
