# 技术栈决策：要不要迁移到 Next.js？

## 结论：**不迁移。保持 Vite + React。**

---

## 决策矩阵

| 维度 | Vite + React（现状）| Next.js（迁移后）| 谁赢 |
|---|---|---|---|
| **首页 SEO** | 需要 |  不需要（登录后台）| N/A |
| **首屏速度** | 快（Vite HMR < 100ms）| 慢（Next dev 冷启动 3-5s）| Vite |
| **构建产物** | 简单静态资源 | 需要 Node runtime 或复杂 static export | Vite |
| **API 路由需求** | 后端已经是 Rust/Axum，40+ endpoint | Next.js API 路由完全用不上 | Vite |
| **图片优化** | 手动或用 Vite 插件 | 内置 `<Image>` | Next |
| **SSR / RSC** | 无 | 内置 | Next |
| **路由** | React Router 已就位 | 需要重写全部路由到文件系统 | Vite |
| **迁移成本** | 0 | 7000+ 行 pages 全部改造 | Vite |

**关键判断**：`zerotrace-web` 是一个**登录后台观测平台**，不面向搜索引擎。SSR / RSC 带来的所有好处（SEO、首屏 HTML）**对本项目零价值**。而 Next.js 的成本（构建复杂度、文件系统路由、`'use client'` 边界、Server Components 陷阱）**全额支付**。

---

## 如果非要 Next.js 的成本清单

假设一个 agent 硬要迁移，需要做的事：

1. **路由重写**：`react-router-dom` 的 `<Route path="/apm/services/:serviceName" element={<ServiceDetailPage/>}/>` → `src/app/apm/services/[serviceName]/page.tsx`
   - 影响：`App.tsx` 100+ 行 Routes 全废
   - `<Navigate>` / `useNavigate` / `useSearchParams` API 全变

2. **Client 组件标记**：几乎所有组件都用了 `useState / useEffect`，需要顶部加 `'use client';`
   - 影响：30+ 组件 + 20+ 页面全部要加

3. **Auth Provider 上下文重构**：`AuthProvider` 里用了 `document.cookie`，需要判断 SSR 环境
   - 现有 `useAuth` hook 在服务端会崩

4. **Ant Design SSR 问题**：antd 官方有 `AntdRegistry` 用于 SSR，需要包一层
   - 影响：`main.tsx` → `app/layout.tsx` 完全重写

5. **echarts SSR 问题**：echarts 依赖 DOM，SSR 时会报错
   - 需要 dynamic import + `ssr: false`，30+ 处 chart 都要改

6. **i18next SSR 需要用 `i18next-fs-backend` 服务端加载**

**估算迁移工时**：40-80 小时（1-2 周专职），**并且中间应用不能正常运行**。

**收益**：0（用户看不到任何改变）。

---

## 什么情况下才应该迁移到 Next.js

以下**任意一条**成立时再考虑：

- 需要做**营销官网**（`zerotrace.io` 品牌页），需要 SEO
- 决定做 **BFF（Backend-for-Frontend）**，前端要写 API 路由做数据聚合
- 使用 Vercel / Netlify 部署，希望用其 Edge Functions

**推荐做法**：如果将来需要营销站，**再新开一个 Next.js 项目**（`zerotrace-marketing`），和 `zerotrace-web` 后台**分仓**部署。SEO 归 Next.js，后台归 Vite。两个技术栈解决两类问题。

---

## 需要注意的现代化改造（不用迁 Next 也能做）

以下是 Vite 项目**该做**的现代化，不需要迁 Next.js：

1. **Vite 5 → Vite 7**（现在是 5，最新是 7，性能提升 20%+）
2. **React 18 → React 19**（稳定版，兼容良好）
3. **TypeScript 5.3 → 5.6**（性能 + 严格模式增强）
4. **加 `vite-plugin-checker`**（并行跑 tsc + ESLint，不阻塞 HMR）
5. **加 Vitest**（比 Jest 快，配置更少，和 Vite 生态原生集成）
6. **加 `vite-plugin-inspect`**（调试插件链）

这些改造是**渐进的**，不影响业务代码。

---

## 关于 SPA 未来演化的建议

如果你的 dashboard 越来越大，SPA 首屏加载慢起来，**先做以下 3 步**再考虑 SSR：

1. **路由级代码分割**：`import()` 动态导入每个页面 → 首屏只加载登录页
2. **React Query 预取**：`useQuery` 用 `staleTime` + prefetch
3. **echarts 按需引入**：目前项目已经用了 `echarts/core`，做得对；继续保持

以上做完，SPA 首屏 < 2s 是完全可能的。
