"use strict";

/**
 * gateway 服务 — 基于 Express 的 API 反向代理
 *
 * 将外部请求转发到对应的后端微服务（HTTP 直连），
 * 使得 eBPF Agent 可在每台主机上捕获到完整的 HTTP 调用链。
 *
 * 路由映射：
 *   /api/users/*     → http://users:3001/api/users/*
 *   /api/products/*  → http://products:3002/api/products/*
 *   /api/orders/*    → http://orders:3003/api/orders/*
 *   /api/chaos/*     → http://chaos:3004/api/chaos/*
 */

const http = require("http");
const url = require("url");
const express = require("express");
const { initChaos } = require("../lib/chaos-middleware");

const PORT = process.env.GATEWAY_PORT || 3000;

// 后端服务地址（Docker Compose 中用服务名，本地开发用 localhost）
const USERS_SRV = process.env.USERS_SRV || "http://localhost:3001";
const PRODUCTS_SRV = process.env.PRODUCTS_SRV || "http://localhost:3002";
const ORDERS_SRV = process.env.ORDERS_SRV || "http://localhost:3003";
const CHAOS_SRV = process.env.CHAOS_SRV || "http://localhost:3004";

const app = express();
// 不解析 body — 纯代理，直接 pipe 原始数据
// 注意：禁用 express.json() 以避免 body 被消耗后无法 pipe 给上游

/**
 * 创建反向代理中间件。
 * 使用 Node.js 内置 http.request 实现，无需额外依赖。
 */
function createProxy(targetUrl) {
	const target = url.parse(targetUrl);

	return (req, res) => {
		const options = {
			hostname: target.hostname,
			port: target.port,
			path: req.originalUrl || req.url,
			method: req.method,
			headers: { ...req.headers, host: target.host }
		};
		// 删除代理不该透传的 header
		delete options.headers["transfer-encoding"];

		const proxyReq = http.request(options, (proxyRes) => {
			res.writeHead(proxyRes.statusCode, proxyRes.headers);
			proxyRes.pipe(res);
		});

		proxyReq.on("error", (err) => {
			console.error(`[gateway] 代理到 ${targetUrl} 失败: ${err.message}`);
			if (!res.headersSent) {
				res.status(502).json({ error: "上游服务不可达" });
			}
		});

		req.pipe(proxyReq);
	};
}

// 路由转发
app.use("/api/users", createProxy(USERS_SRV));
app.use("/api/products", createProxy(PRODUCTS_SRV));
app.use("/api/orders", createProxy(ORDERS_SRV));
app.use("/api/chaos", createProxy(CHAOS_SRV));

// 健康检查
app.get("/health", (req, res) => {
	res.json({ status: "ok", service: "gateway", time: Date.now() });
});

initChaos().then(() => {
	app.listen(PORT, () => {
		console.log(`[gateway] API Gateway 运行在 :${PORT}`);
	});
});
