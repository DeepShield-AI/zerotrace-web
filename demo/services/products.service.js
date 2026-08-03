"use strict";

const express = require("express");
const { chaosWrap, initChaos } = require("../lib/chaos-middleware");
const { getStressManager } = require("../lib/resource-stress");

const PORT = process.env.PRODUCTS_PORT || 3002;
const SERVICE_NAME = "products";

const app = express();
app.use(express.json());

const PRODUCTS = {
  p1: { id: "p1", name: "机械键盘", price: 399, stock: 120 },
  p2: { id: "p2", name: "无线鼠标", price: 129, stock: 300 },
  p3: { id: "p3", name: "4K 显示器", price: 1599, stock: 45 },
};

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: SERVICE_NAME,
    activeFaults: Object.keys(getStressManager().getActive()).length,
  });
});

app.get("/api/products",
  chaosWrap("products", "list"),
  (req, res) => res.json(Object.values(PRODUCTS))
);

app.get("/api/products/:id",
  chaosWrap("products", "get"),
  (req, res) => {
    const product = PRODUCTS[req.params.id];
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(product);
  }
);

app.post("/api/products/:id/checkStock",
  chaosWrap("products", "checkStock"),
  (req, res) => {
    const product = PRODUCTS[req.params.id];
    if (!product) return res.status(404).json({ error: "Product not found" });
    const quantity = req.body.quantity || 1;
    res.json({
      id: product.id,
      available: product.stock >= quantity,
      stock: product.stock,
    });
  }
);

initChaos(SERVICE_NAME).then(() => {
  app.listen(PORT, () => {
    console.log(`[products] 服务运行在 :${PORT}`);
  });
});
