"use strict";

const http = require("http");
const url = require("url");
const express = require("express");
const { chaosWrap, initChaos } = require("../lib/chaos-middleware");

const PORT = process.env.GATEWAY_PORT || 3000;

const USERS_SRV = process.env.USERS_SRV || "http://localhost:3001";
const PRODUCTS_SRV = process.env.PRODUCTS_SRV || "http://localhost:3002";
const ORDERS_SRV = process.env.ORDERS_SRV || "http://localhost:3003";
const CHAOS_SRV = process.env.CHAOS_SRV || "http://localhost:3004";

const SERVICE_NAME = "gateway";

const app = express();

function createProxy(targetUrl) {
  const target = url.parse(targetUrl);

  return (req, res) => {
    const options = {
      hostname: target.hostname,
      port: target.port,
      path: req.originalUrl || req.url,
      method: req.method,
      headers: { ...req.headers, host: target.host },
    };
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

app.use("/api/users", createProxy(USERS_SRV));
app.use("/api/products", createProxy(PRODUCTS_SRV));
app.use("/api/orders", createProxy(ORDERS_SRV));
app.use("/api/chaos", createProxy(CHAOS_SRV));

app.get("/health", (req, res) => {
  const stressMgr = require("../lib/resource-stress").getStressManager();
  res.json({
    status: "ok",
    service: SERVICE_NAME,
    activeFaults: Object.keys(stressMgr.getActive()).length,
  });
});

initChaos(SERVICE_NAME).then(() => {
  app.listen(PORT, () => {
    console.log(`[gateway] API Gateway 运行在 :${PORT}`);
  });
});
