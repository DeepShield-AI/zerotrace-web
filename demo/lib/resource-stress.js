"use strict";

/**
 * 资源故障注入引擎 — Resource Stress Engine
 *
 * 在每个微服务进程内运行。通过 Redis Pub/Sub 接收故障指令，
 * 执行 CPU / 内存 / 网络 / 磁盘四类资源层面的压力注入。
 *
 * 故障类型：
 *   cpu     — 创建 Worker 线程执行计算密集型任务，占用 CPU
 *   memory  — 分配大块 Buffer 并长期持有，制造内存压力
 *   network — 对所有入站 HTTP 请求注入延迟
 *   disk    — 持续写入大文件，制造磁盘 I/O 压力
 */

const { Worker } = require("worker_threads");
const fs = require("fs");
const path = require("path");
const os = require("os");

// ─── CPU Stress ───────────────────────────────────────────

function startCpuStress(intensity = 2, durationMs = 30000) {
  const workers = [];
  console.warn(`[stress:cpu] 启动 CPU 压力: intensity=${intensity}, duration=${durationMs}ms`);

  for (let i = 0; i < intensity; i++) {
    const w = new Worker(
      `const { parentPort } = require("worker_threads");
let running = true;
parentPort.on("message", (msg) => { if (msg === "stop") running = false; });
while (running) { for (let k = 0; k < 100000; k++) Math.sqrt(Math.random() * 10000); }`,
      { eval: true }
    );
    workers.push(w);
  }

  const timer = setTimeout(() => stop(), durationMs);

  function stop() {
    clearTimeout(timer);
    workers.forEach((w) => {
      w.postMessage("stop");
      w.terminate().catch(() => {});
    });
    workers.length = 0;
    console.warn("[stress:cpu] CPU 压力已释放");
  }

  return { stop, type: "cpu", active: true };
}

// ─── Memory Stress ────────────────────────────────────────

function startMemoryStress(megabytes = 100, durationMs = 30000) {
  const allocated = [];
  const chunkMB = 10;
  const chunkSize = chunkMB * 1024 * 1024;
  const chunks = Math.ceil(megabytes / chunkMB);
  let totalAllocated = 0;

  console.warn(`[stress:memory] 启动内存压力: ${megabytes}MB, duration=${durationMs}ms`);

  try {
    for (let i = 0; i < chunks; i++) {
      allocated.push(Buffer.alloc(chunkSize, 0x5a));
      totalAllocated += chunkMB;
    }
  } catch (err) {
    console.error(`[stress:memory] 内存分配失败: ${err.message}`);
  }

  const timer = setTimeout(() => stop(), durationMs);

  function stop() {
    clearTimeout(timer);
    allocated.length = 0;
    if (global.gc) global.gc();
    console.warn("[stress:memory] 内存压力已释放");
  }

  return { stop, type: "memory", active: true, allocatedMB: totalAllocated };
}

// ─── Network Stress ───────────────────────────────────────

function createNetworkStressMiddleware(delayMs = 2000, jitterMs = 1000) {
  return function networkStressMiddleware(req, res, next) {
    const totalDelay = delayMs + Math.floor(Math.random() * jitterMs);
    setTimeout(() => next(), totalDelay);
  };
}

function startNetworkStress(delayMs = 2000, jitterMs = 1000, durationMs = 30000) {
  console.warn(`[stress:network] 网络延迟已激活: delay=${delayMs}ms, jitter=${jitterMs}ms`);

  const middleware = createNetworkStressMiddleware(delayMs, jitterMs);
  const timer = setTimeout(() => stop(), durationMs);

  function stop() {
    clearTimeout(timer);
    console.warn("[stress:network] 网络压力已释放");
  }

  return {
    stop,
    type: "network",
    active: true,
    expired: false,
    middleware,
    isExpired() { return this.expired; },
  };
}

// ─── Disk Stress ──────────────────────────────────────────

function startDiskStress(fileSizeMB = 200, durationMs = 30000) {
  const tmpDir = process.env.STRESS_TMP_DIR || os.tmpdir();
  const files = [];
  let running = true;

  console.warn(`[stress:disk] 启动磁盘压力: ${fileSizeMB}MB, tmp=${tmpDir}`);

  function writeOneRound() {
    if (!running) return;
    const filename = `stress-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.tmp`;
    const filepath = path.join(tmpDir, filename);
    try {
      const fd = fs.openSync(filepath, "w");
      const buf = Buffer.alloc(1024 * 1024, "D");
      const chunks = fileSizeMB;
      for (let i = 0; i < chunks && running; i++) {
        fs.writeSync(fd, buf);
      }
      fs.closeSync(fd);
      files.push(filepath);
    } catch (err) {
      console.error(`[stress:disk] 写入失败: ${err.message}`);
    }
    if (running) setTimeout(writeOneRound, 500);
  }

  writeOneRound();

  const timer = setTimeout(() => stop(), durationMs);

  function stop() {
    running = false;
    clearTimeout(timer);
    let cleaned = 0;
    files.forEach((f) => {
      try { fs.unlinkSync(f); cleaned++; } catch {}
    });
    files.length = 0;
    console.warn(`[stress:disk] 磁盘压力已释放，清理 ${cleaned} 个文件`);
  }

  return { stop, type: "disk", active: true };
}

// ─── Stress Manager ───────────────────────────────────────

class StressManager {
  constructor() {
    this.active = new Map(); // faultId -> task
  }

  start(faultId, type, opts = {}, durationMs = 30000) {
    if (this.active.has(faultId)) {
      this.stop(faultId);
    }

    let task;
    switch (type) {
      case "cpu":
        task = startCpuStress(opts.intensity || 2, durationMs);
        break;
      case "memory":
        task = startMemoryStress(opts.megabytes || 100, durationMs);
        break;
      case "network":
        task = startNetworkStress(opts.delayMs || 2000, opts.jitterMs || 1000, durationMs);
        break;
      case "disk":
        task = startDiskStress(opts.fileSizeMB || 200, durationMs);
        break;
      default:
        console.error(`[stress] 不支持的类型: ${type}`);
        return null;
    }

    task.createdAt = Date.now();
    task.expiresAt = Date.now() + durationMs;
    task.faultId = faultId;
    this.active.set(faultId, task);

    return { faultId, type, durationMs, status: "injected" };
  }

  stop(faultId) {
    const task = this.active.get(faultId);
    if (!task) return null;
    try { task.stop(); } catch (e) { console.error(`[stress] stop ${faultId}:`, e.message); }
    this.active.delete(faultId);
    return { faultId, status: "released" };
  }

  stopAll() {
    const ids = [...this.active.keys()];
    ids.forEach((id) => this.stop(id));
    return { released: ids.length };
  }

  getActive() {
    const result = {};
    for (const [id, task] of this.active.entries()) {
      result[id] = { type: task.type, createdAt: task.createdAt, expiresAt: task.expiresAt };
    }
    return result;
  }

  /** 获取当前生效的网络延迟中间件 */
  getNetworkMiddleware() {
    for (const task of this.active.values()) {
      if (task.type === "network" && task.middleware && !task.expired) {
        return task.middleware;
      }
    }
    return null;
  }
}

let instance = null;
function getStressManager() {
  if (!instance) instance = new StressManager();
  return instance;
}

module.exports = { getStressManager, StressManager };
