# 设置面板中心缩放（表面级原点标记）：代码结构与开发进度

> 本文档是本次编码的真源：确定后直接照着它编码；节点编号在编码期间保持不变（提交信息用它指明完成到哪）。
> 状态：`- [ ]` 未完成 / `- [x]` 已完成。一个最小节点完成 = 其下全部要点已勾选，且「完成判据」成立。
> 版本/分支：`v1.0.0` / `feat/v1.0.0`；基线 dsh `0.2.2-rc.1`（宿主事实均按该版本 client 产物核对）。

## 1 需求与范围

**需求**：设置面板（宿主 Settings 弹窗里 `role="dialog"` 的面板）的开/闭动画改为以**面板正中心**为 `transform-origin` 的缩放（`.98 ↔ 1`）+ 透明度淡入淡出，并且**无条件**执行——不要求能解析到触发源（鼠标点开、快捷键打开都缩放）。

为远期可能的「特殊表面」预留通用机制：由**表面所属插件自己**在表面元素上打标记，主插件只识别标记。本计划中由设置插件在设置面板插入时打标记；主插件不认识任何宿主属性（`data-shortcut-modal`、`aria-modal` 等）。

当前行为（供对照）：`role="dialog"` 一律以「触发源最近点投影 + clamp 到面板」为 origin，设置面板实际落在左下角；且缩放的 `geometry` 依赖触发源解析成功，解析不到时不缩放。本计划只改带标记的这一块表面。

**不做的事**：

- 不删除方向位移（由 `.agents/plan/v1.0.0/remove-displacement.md` 单独处理；本计划执行时位移仍在，中心 origin 的位移向量天然为 0）。
- 不改其它表面的动画与回退语义：menu / listbox / 其它 `role="dialog"` 仍以触发源为 origin；无锚点仍按设置回退（默认纯淡入）。
- 不改时长、缓动、缩放强度（`.98`）与遮罩行为（mask 仍纯淡入淡出）。
- 不新增用户可见设置项；不改 localStorage 设置契约（`SETTINGS_KEY` / `SETTINGS_EVENT` / fallback 模式）。
- 不修改宿主 dsh 源码；不改写任何历史 plan 文档（`v0.1.0` / `v0.2.0` / `v0.3.0`）。
- 主插件侧不出现宿主属性识别（宿主耦合只允许出现在设置插件里）。

**关键假设**（已核对 dsh `0.2.2-rc.1`）：

- 宿主设置面板元素为 `[role="dialog"][data-shortcut-modal="settings"]`，由 portal 插到 `document.body`；面板每次打开都是新 DOM，关闭即卸载，因此标记不需要清理逻辑。
- 设置插件在启动时挂好 observer，面板出现远晚于此；MutationObserver 回调是微任务，先于主插件读取几何的 rAF flush，因此打标不会晚于入场动画的第一帧。
- 设置插件与主插件由同一 bundle 的 patch 两行加载；设置插件被禁用/未安装时没有标记，设置面板回到默认行为（本计划不引入主插件侧的识别兜底，符合「标记由插件自己打」的取舍）。
- 标记值是通用 opt-in 契约，未来其它插件可以给自己的表面打同一标记。

## 2 代码结构

```text
dsh-webui-transition/
├── src/
│   ├── marker.js                          # 新增：表面级原点标记契约 + 中心几何纯函数
│   └── runtime.js                         # 修改：入场/退场几何先识别标记
├── packages/dsh-webui-transition-settings/
│   └── src/
│       ├── contract.js                    # 修改：新增标记属性/取值常量（跨包独立实现）
│       ├── panel-marker.js                # 新增：观察 body，给设置面板打标记
│       └── browser.js                     # 修改：装配打标 effect
├── test/
│   ├── runtime.test.mjs                   # 修改：中心几何 / 无锚点 / 幽灵复用用例
│   ├── contract.test.mjs                  # 修改：标记常量防漂移
│   └── settings-plugin.test.mjs           # 修改：effect 数量与名称 + 打标行为
├── README.md / README.en.md               # 修改：效果表「设置面板」行 + 标记机制说明
├── packages/dsh-webui-transition-settings/README.md / README.en.md   # 修改：打标职责一句
└── AGENTS.md                              # 修改：项目地图补两个新文件
```

| 文件 | 新增/修改 | 职责 |
| --- | --- | --- |
| `src/marker.js` | 新增 | 冻结标记属性/取值；`isCenterOriginSurface` 判定；`centerGeometryFor` 中心几何纯函数 |
| `src/runtime.js` | 修改 | `entryGeometryFor` / `exitGeometryFor` 命中标记时返回中心几何并跳过触发源解析 |
| `packages/.../src/contract.js` | 修改 | 新增标记属性/取值常量（与主包同值，独立实现，contract 测试防漂移） |
| `packages/.../src/panel-marker.js` | 新增 | 监听 `document.body`，给插入的设置面板打标记 |
| `packages/.../src/browser.js` | 修改 | 新增第 4 个 `ctx.effect` 装配打标 |
| `test/runtime.test.mjs` | 修改 | 标记表面的入场/退场几何用例 |
| `test/contract.test.mjs` | 修改 | 两包标记常量一致 |
| `test/settings-plugin.test.mjs` | 修改 | effect 数量/名称；打标 / 不打标 / 清理后不打标 |
| `README.md`、`README.en.md` | 修改 | 效果表设置面板行；标记契约段落 |
| 设置包 `README.md`、`README.en.md` | 修改 | 「与主包的关系」补打标职责 |
| `AGENTS.md` | 修改 | 项目地图新增 `src/marker.js`、`packages/.../src/panel-marker.js` |

**关键接口与数据流**

- 打标：设置插件 `apply()` 里 `ctx.effect(() => startPanelMarker(...), "webui-transition-settings: settings panel origin marker")`；observer 监听 `document.body` 的 `childList + subtree`，对新增节点自身与后代匹配 `SETTINGS_PANEL_SELECTOR` 的面板 `setAttribute(ORIGIN_MARKER_ATTRIBUTE, ORIGIN_MARKER_CENTER)`。
- 消费：主插件在 `applyEntry` 的 rAF flush 中调用 `entryGeometryFor(element, kind)`；拿到面板矩形后若 `isCenterOriginSurface(element)` → 直接返回 `centerGeometryFor(rect)`，**不再**调用 `origin.resolve` / `lastPointerPoint`；其余表面完全走现有逻辑。
- 退场：`geometryCache` 命中同一份中心几何，幽灵克隆镜像；无缓存路径下 `exitGeometryFor` 对 `original` 或 `rectElement` 同样判定标记。
- 帧：frames 收到 `{ originX: w/2, originY: h/2, translateX: 0, translateY: 0 }` → `transformOrigin: "<cx>px <cy>px"`、`translate: "0px 0px" → "0 0"`（视觉无位移）、`scale: ".98" → "1"`；dialog 为整体帧，另含 `opacity: 0 → 1`。frames / gate / policy 不改。

**冻结的签名**（并行 Agent 按此写码，不得自行改动）

```js
// src/marker.js（新增，主包）
export const ORIGIN_MARKER_ATTRIBUTE = "data-dsh-transition-origin";
export const ORIGIN_MARKER_CENTER = "center";
export function isCenterOriginSurface(element) // → boolean；非元素 / 读取异常 → false
export function centerGeometryFor(rect)       // → { originX, originY, translateX: 0, translateY: 0 }
// rect: { width: number, height: number }；translate 字段本计划保留，形状与现有 geometry 一致

// packages/dsh-webui-transition-settings/src/panel-marker.js（新增）
export const SETTINGS_PANEL_SELECTOR = '[role="dialog"][data-shortcut-modal="settings"]';
export function startPanelMarker(options = {}) // → stop(): void
// options: { document?: Document, MutationObserver?: typeof MutationObserver }
// 缺省懒取 globalThis；不可用 → 返回空 stop（不抛错）

// packages/dsh-webui-transition-settings/src/contract.js（新增导出）
export const ORIGIN_MARKER_ATTRIBUTE = "data-dsh-transition-origin";
export const ORIGIN_MARKER_CENTER = "center";
```

effect 名称（测试断言用）：`"webui-transition-settings: settings panel origin marker"`。

## 3 开发进度

### 3.1 主插件：标记契约 + 中心几何（线性）

#### 3.1.1 新增 `src/marker.js` 并在 runtime 生效

- [ ] `src/marker.js`：按 §2 冻结签名实现 4 个导出；`isCenterOriginSurface` 用 `nodeType === 1` + `getAttribute` 判定，读取异常一律 `false`；`centerGeometryFor` 用 `rect.width / 2`、`rect.height / 2`，`-0` 归一为 `+0`。
- [ ] `src/runtime.js`：`entryGeometryFor` 在 `readSurfaceRect` 成功后先判标记 → 直接 `return centerGeometryFor(rect)`（跳过 `resolveSource` 与 `fallbackMode` 的指针回退）；`exitGeometryFor` 在缓存未命中的路径里对 `original` 与 `rectElement` 任一命中标记 → 返回中心几何；更新 `geometryCache` 形状注释。
- [ ] `test/runtime.test.mjs`：新增 3 条用例——① 标记面板 + 无触发源（`origin.resolve` 返回 `null`、`fallbackMode: () => "fade"`）仍产生表面几何动画，`transformOrigin` 为面板中心（`DIALOG_RECT` 400×300 → `"200px 150px"`），且 `origin.state.resolveCalls === 0`；② 标记面板 + 有触发源仍取中心（忽略触发源）；③ 标记面板退场幽灵复用中心 origin（复用现有「退场幽灵复用入场 origin」的装配）。装配方式：`buildSettingsOverlay()` + `stubRect(panel, DIALOG_RECT)` + `panel.setAttribute(...)`。
- **完成判据**：`node --test test/runtime.test.mjs` 通过。

### 3.2 设置插件：给设置面板打标记（节点内并行，依赖 §3.1 已完成）

#### 3.2.1 实现与测试并行

- [ ] **Agent A**：`packages/dsh-webui-transition-settings/src/contract.js` — 新增 §2 冻结的两个常量；`.../src/panel-marker.js` — 新增文件，按 §2 冻结签名实现 observer（`document.body` 上 `childList + subtree`；addedNodes 自身与后代匹配 `SETTINGS_PANEL_SELECTOR` 即打标；stop 断开 observer）；`.../src/browser.js` — 新增第 4 个 `ctx.effect`，名称按 §2。（依赖：§2 冻结签名）
- [ ] **Agent B**：`test/contract.test.mjs` — 新增两包标记常量一致断言；`test/settings-plugin.test.mjs` — effect 数量 3→4 与名称清单更新；新增打标用例：apply 后向 `document.body` 插入 `buildSettingsOverlay()` → panel 带标记；插入非设置 dialog（`buildGlassPanel()`）→ 不打标；执行全部 cleanup 后再插入设置面板 → 不打标。（依赖：§2 冻结签名与 effect 名称）
- **完成判据**：两人收敛后 `pnpm build && node --test test/contract.test.mjs test/settings-plugin.test.mjs` 通过（设置插件测试读取构建产物 `packages/.../client.js`）。

### 3.3 文档、构建产物与全量验证（线性）

#### 3.3.1 文档 + 构建 + 全量测试

- [ ] 根 `README.md` / `README.en.md`：效果表拆出「设置面板」行（正中心缩放、不依赖触发源、始终生效；其它 `role="dialog"` 行保留现状）；「原点感知」段补标记契约（表面所属插件可打 `data-dsh-transition-origin="center"`；主插件不认宿主属性）。
- [ ] 设置包 `README.md` / `README.en.md`：「与主包的关系」补一句打标职责（设置插件给设置面板打中心缩放标记；主插件不依赖本插件也能运行）。
- [ ] `AGENTS.md`：项目地图新增 `src/marker.js`、`packages/.../src/panel-marker.js`，测试说明补对应条目。
- [ ] `pnpm build` 重新生成两份 `client.js`（nav-icon 无变化），逐条确认产物差异只有预期内容。
- **完成判据**：`pnpm test` 全绿；`git status` 的改动文件 = §2 表格所列 + 两份 `client.js` 产物，无其它改动。

### 3.4 提交（线性）

#### 3.4.1 一次提交

- [ ] 只 `git add` §3.3 验证过的文件（含构建产物）；不带入工作区既有的 `COMPATIBLE_VERSION` 未提交改动；不提交本计划文档。
- [ ] 一次 Conventional Commits 提交，提交信息 body 注明完成本计划节点（如 `plan: v1.0.0/settings-center-origin.md §3.1–3.3`）；不 push。
- **完成判据**：`git log -1 --stat` 显示单次提交，文件清单与预期一致。
