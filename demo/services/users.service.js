"use strict";

/**
 * users 服务 — 基于 Express 的独立 HTTP 微服务
 * eBPF Agent 可捕获其 HTTP 请求/响应。
 */

const express = require("express");
const { chaosWrap, initChaos } = require("../lib/chaos-middleware");

const PORT = process.env.USERS_PORT || 3001;
const app = express();
app.use(express.json());

const USERS = {
	u1: { id: "u1", name: "张三", email: "zhangsan@example.com", vip: true },
	u2: { id: "u2", name: "李四", email: "lisi@example.com", vip: false },
	u3: { id: "u3", name: "王五", email: "wangwu@example.com", vip: false }
};

app.get("/api/users",
	chaosWrap("users", "list"),
	(req, res) => {
		res.json(Object.values(USERS));
	}
);

app.get("/api/users/:id",
	chaosWrap("users", "get"),
	(req, res) => {
		const user = USERS[req.params.id];
		if (!user) return res.status(404).json({ error: "User not found" });
		res.json(user);
	}
);

initChaos().then(() => {
	app.listen(PORT, () => {
		console.log(`[users] 服务运行在 :${PORT}`);
	});
});
