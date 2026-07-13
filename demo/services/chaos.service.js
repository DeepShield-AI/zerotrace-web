"use strict";

/**
 * chaos 服务 — 故障注入控制面（基于 Express）
 *
 * 提供 REST 接口动态设置/清除/查看故障规则。
 * 规则变更通过 ChaosStore 的 Redis Pub/Sub 实时广播到所有服务进程。
 */

const express = require("express");
const { initChaos } = require("../lib/chaos-middleware");
const { getChaosStore } = require("../lib/chaos-store");

const PORT = process.env.CHAOS_PORT || 3004;
const app = express();
app.use(express.json());

const store = getChaosStore();

// 获取所有当前生效的故障规则
app.get("/api/chaos/list", (req, res) => {
	res.json(store.listRules());
});

// 设置/更新故障规则
app.post("/api/chaos/set", async (req, res) => {
	try {
		const { target, ...rule } = req.body;
		if (!target) return res.status(400).json({ error: "缺少 target" });
		const saved = await store.setRule(target, rule);
		res.json({ success: true, rule: saved });
	} catch (err) {
		res.status(400).json({ error: err.message });
	}
});

// 清除某个 target 的故障规则
app.post("/api/chaos/clear", async (req, res) => {
	try {
		const { target } = req.body;
		if (!target) return res.status(400).json({ error: "缺少 target" });
		await store.deleteRule(target);
		res.json({ success: true, target, action: "cleared" });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// 一键重置所有故障规则
app.post("/api/chaos/reset", async (req, res) => {
	try {
		await store.resetAll();
		res.json({ reset: true });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

initChaos().then(() => {
	app.listen(PORT, () => {
		console.log(`[chaos] 控制面运行在 :${PORT}`);
	});
});
