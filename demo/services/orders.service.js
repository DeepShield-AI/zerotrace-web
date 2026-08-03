"use strict";

const express = require("express");
const { chaosWrap, initChaos } = require("../lib/chaos-middleware");
const { getStressManager } = require("../lib/resource-stress");

const PORT = process.env.ORDERS_PORT || 3003;
const SERVICE_NAME = "orders";

const USERS_SRV = process.env.USERS_SRV || "http://localhost:3001";
const PRODUCTS_SRV = process.env.PRODUCTS_SRV || "http://localhost:3002";

const app = express();
app.use(express.json());

let orderSeq = 1000;
const ORDERS = new Map();

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: SERVICE_NAME,
    activeFaults: Object.keys(getStressManager().getActive()).length,
  });
});

app.get("/api/orders",
  chaosWrap("orders", "list"),
  (req, res) => res.json(Array.from(ORDERS.values()))
);

app.get("/api/orders/:id",
  chaosWrap("orders", "get"),
  (req, res) => {
    const order = ORDERS.get(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json(order);
  }
);

app.post("/api/orders",
  chaosWrap("orders", "createOrder"),
  async (req, res) => {
    try {
      const { userId, productId, quantity = 1 } = req.body;

      const userResp = await fetch(`${USERS_SRV}/api/users/${userId}`);
      if (!userResp.ok) {
        return res.status(400).json({ error: "User validation failed" });
      }
      const user = await userResp.json();

      const stockResp = await fetch(`${PRODUCTS_SRV}/api/products/${productId}/checkStock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity }),
      });
      if (!stockResp.ok) {
        return res.status(502).json({ error: "Stock check failed" });
      }
      const stockCheck = await stockResp.json();
      if (!stockCheck.available) {
        return res.status(409).json({ error: "Insufficient stock" });
      }

      const productResp = await fetch(`${PRODUCTS_SRV}/api/products/${productId}`);
      if (!productResp.ok) {
        return res.status(502).json({ error: "Product fetch failed" });
      }
      const product = await productResp.json();

      const id = `o${orderSeq++}`;
      const order = {
        id,
        userId,
        userName: user.name,
        productId,
        productName: product.name,
        quantity,
        totalPrice: product.price * quantity,
        createdAt: new Date().toISOString(),
      };
      ORDERS.set(id, order);
      res.status(201).json(order);
    } catch (err) {
      console.error(`[orders] createOrder 异常: ${err.message}`);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

initChaos(SERVICE_NAME).then(() => {
  app.listen(PORT, () => {
    console.log(`[orders] 服务运行在 :${PORT}`);
  });
});
