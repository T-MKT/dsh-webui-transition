# dsh-webui-transition v0.2.0：方案 B 推翻重做计划（ESM 源码 + esbuild 产物）

> 本文档是 v0.2.0 的**唯一开发真源**：确定后直接照着它编码；节点编号在编码期间保持不变（提交信息用它指明完成到哪）。
> 状态：`- [ ]` 未完成 / `- [x]` 已完成。一个最小节点完成 = 其下全部要点已勾选，且「完成判据」成立。
> 基线：dsh `0.2.2-alpha.2`。分支：`feat/v0.2.0`（不在 main；不 push，除非用户批准）。
> v0.1.0 三份计划（`.plan/v0.1.0/*.md`）视为历史真源，保留为验证证据，不再作为开发依据。

## 1 背景与决策

### 1.1 项目是什么

`dsh-webui-transition` 是一个 **DSH Web GUI 第三方客户端插件（dsh bundle，Client-only）**：给 DSH 网页端两处缺失过渡动画的表面补上开合动画——各级下拉菜单（`role="menu"` / `role="listbox"`）与设置面板（`role="dialog"` + 同级 mask）。实现机制为纯观察 DOM + WAAPI + 退场幽灵副本；不修改 dsh 源码、不注册 slot、不渲染组件、不延迟宿主卸载。

### 1.2 为什么选择方案 B

用户决策：**比起开发流程复杂度，更看重代码结构化清晰化程度与长远开发规划**。方案 B 用 ESM 源码模块 + esbuild 构建出 dsh 客户端契约要求的 classic `client.js`。代价是引入构建步骤，收益是每个职责一个文件、可独立单测、后续扩展不再膨胀单文件。

| 方案 | 源码形态 | 构建 | 可维护性 | 决策 |
| --- | --- | --- | --- | --- |
| A | 单文件 classic script | 无 | 中（注释分区） | 否 |
| **B** | **多文件 ESM（`src/`）** | **esbuild → `client.js`（classic）** | **高（真模块）** | **采用** |
| C | 纯 CSS 注入 | 无 | 低（无法 clamp/退场仍需 JS） | 否 |
| D | 小修补 | 无 | 低 | 否 |

### 1.3 与 v0.1.0 的行为不变契约

- 菜单/列表：淡入 + 上浮 `-4px` + 缩放 `.98`；菜单玻璃层过渡期间保持模糊（opacity 下沉到直接元素子级）；容器 `box-shadow` 与动画同步淡入/淡出。
- 设置面板：mask 淡入约 180ms；`role="dialog"` 面板淡入 + 上浮 `12px`，约 220ms；关闭时退场镜像。
- `--ds-transition-duration(-fast/-slow)` 与 `--ds-ease-in-out` 解析、clamp；`prefers-reduced-motion` 归零。
- `data-dsh-transition="off"` 硬排除；宿主已有 WAAPI / CSS animation 时跳过；新增 CSS transition 冲突门卫。
- 退场走 inert 幽灵副本：克隆 → 播退场 → 删除；幽灵不剥离 `backdrop-filter`。
- 不修改 dsh 源码；不注册 slot；不渲染组件；不延迟宿主卸载；无第三方运行时依赖。
- 产物形态仍是 dsh bundle：`package.json` / `cordis.patch.yml` / `index.js` / `client.js`。

## 2 目标文件结构

```text
dsh-webui-transition/
├── .plan/
│   ├── v0.1.0/                         # 历史真源（保留，只读）
│   └── v0.2.0/
│       └── plan-b-rewrite.md           # 本文档（唯一真源）
├── src/
│   ├── defs.js                         # 常量 + SURFACE_DEFS 描述符
│   ├── utils.js                        # 通用小工具（CSS 解析 / 默认依赖 / 语义工具）
│   ├── policy.js                       # createPolicy：token / reduced-motion / 时长
│   ├── tracker.js                      # createSurfaceTracker：表面状态机 + DOM 分类
│   ├── gate.js                         # createGate：兼容性门卫（WAAPI/CSS animation/CSS transition）
│   ├── frames.js                       # 纯帧函数：关键帧 + 动画规格拆分
│   ├── runtime.js                      # createTransitionRuntime：观察/批量/入场/幽灵/清理
│   └── browser.js                      # 浏览器入口：__ModuleLoader__.load 注册
├── scripts/
│   └── build.mjs                       # esbuild：src/browser.js → client.js（classic IIFE）
├── test/
│   ├── helpers/
│   │   └── env.mjs                     # jsdom 装配 / fake loader / fake animate
│   ├── policy.test.mjs
│   ├── tracker.test.mjs
│   ├── gate.test.mjs
│   ├── frames.test.mjs
│   ├── runtime.test.mjs
│   └── bundle.test.mjs                 # 构建产物冒烟：classic 契约 + 冻结签名
├── client.js                           # 构建产物（提交，dsh 直接加载）
├── package.json                        # 修改：version 0.2.0；scripts.build/pretest；devDep esbuild
├── pnpm-workspace.yaml                 # 新增：allowBuilds: { esbuild: true }
├── cordis.patch.yml / index.js / COMPATIBLE_VERSION  # 不变
├── README.md / README.en.md            # 修改：实现架构改为 src/ + build；行为说明不变
└── AGENTS.md                           # 修改：项目地图指向 v0.2.0 真源
```

## 3 模块设计

### 3.1 `src/defs.js`

```js
export const OBSERVED_ATTRIBUTES = ["hidden", "aria-hidden", "aria-expanded", "open", "role", "data-slot", "data-phase"];
export const HARD_EXCLUSION = '[data-dsh-transition="off"], [data-dsh-transition-ghost], [data-chat-flow], [data-chat-flow-key], [data-streaming], [data-trajectory-scroll], [data-trajectory-row-key], [role="tooltip"], [role="alert"]';
export const MOTION_MEDIA_QUERY = "(prefers-reduced-motion: reduce)";
export const DEFAULT_EASING = "cubic-bezier(.4, 0, .2, 1)";
export const DIALOG_EASING = "cubic-bezier(.22, 1, .36, 1)";
export const TOKEN_FALLBACK = { easing: DEFAULT_EASING, fastMs: 100, normalMs: 200, slowMs: 300 };

export const SURFACE_DEFS = {
  menu:    { role: "menu",    property: "--ds-transition-duration-fast", fallbackMs: 150, minMs: 120, maxMs: 160, distancePx: -4, scaleFrom: 0.98, opacityFrom: 0, easing: null, splitFade: true,  animateShadow: true },
  listbox: { role: "listbox", property: "--ds-transition-duration-fast", fallbackMs: 150, minMs: 120, maxMs: 160, distancePx: -4, scaleFrom: 0.98, opacityFrom: 0, easing: null, splitFade: true,  animateShadow: true },
  dialog:  { role: "dialog",  property: "--ds-transition-duration",      fallbackMs: 220, minMs: 160, maxMs: 240, distancePx: 12, scaleFrom: 1,    opacityFrom: 0, easing: DIALOG_EASING, splitFade: false, animateShadow: false },
  mask:    { role: null,      property: "--ds-transition-duration",      fallbackMs: 180, minMs: 140, maxMs: 220, distancePx: 0,  scaleFrom: 1,    opacityFrom: 0, easing: null, splitFade: false, animateShadow: false },
};
export const SURFACE_SELECTOR = '[role="menu"], [role="listbox"], [role="dialog"]';
```

后续所有时长策略、拆分策略、阴影策略只读 `SURFACE_DEFS`，不再出现 `if (kind === "menu" || kind === "listbox")` 这类硬编码。

### 3.2 `src/utils.js`

通用小工具，全部延迟访问 `document` / `window`：
`globalScope`、`isElement`、`clampNumber`、`parseCssDuration`、`parseEasing`、`defaultComputedStyle`、`defaultMatchMedia`、`defaultRootElement`、`readStyleProperty`、`supportsIndependentTransforms`、`roleKind`、`isExcluded`、`isElementConnected` 等。

### 3.3 `src/policy.js`

`createPolicy(options = {}) -> Policy`，语义与 v0.1.0 一致，但 `timing(kind)` 改为读 `SURFACE_DEFS[kind]`：

```js
// Policy = { reducedMotion(), tokens(), timing(kind), subscribe(fn), dispose() }
```

- token 缺失回退：`tokens()` 用 `TOKEN_FALLBACK`（100/200/300ms）；`timing(kind)` 再按 kind 的 `fallbackMs` / `minMs` / `maxMs` clamp。
- `subscribe` 保留；v0.2.0 起 runtime 必须接线（见 §3.7）。
- `dispose` 幂等。

### 3.4 `src/tracker.js`

`createSurfaceTracker(options = {}) -> SurfaceTracker`，替代 v0.1.0 的 `createClassifier`（旧名不保留）。

内部状态（WeakMap）：`element -> { kind, visibility: "visible" | "hidden" | "unknown" }`。

```js
// SurfaceTracker = {
//   scanRoot(root),                     // 启动基线：已存在表面只写状态，不发入场
//   classifyAdded(node): SurfaceIntent[],       // childList addedNodes → mount intents
//   classifyAttributes(target): SurfaceIntent[],// 仅 role 表面；hidden→visible 才发 intent
//   classifyRemoval(node): RemovalGroup[]       // childList removedNodes → 退场组
// }
```

- `scanRoot(root)`：扫描 `root` 内全部 `SURFACE_SELECTOR`，用 `isSurfaceVisible` 写状态机；**启动时已存在的表面不播入场**。
- `classifyAdded(node)`：新增子树中寻找 menu/listbox/dialog；dialog 自动配同级 mask；单独插入 mask（dialog 已在 DOM）时补 `mask` mount intent。对 role 表面记录状态。
- `classifyAttributes(target)`：仅 role 表面；计算可见性，**只有从 hidden/unknown → visible 才发入场 intent**；dialog 的 mask 同步发 intent；维持状态机避免重复。
- `classifyRemoval(node)`：在删除子树内定位 menu/listbox/dialog(+mask)；**新增覆盖**：单独删除 mask（无 role）且其 dialog 兄弟仍在 DOM 时，也产出 mask 退场组；同时清理被删表面的状态。
- 保留 v0.1.0 的语义工具：`isMaskElement`（`aria-hidden="true"` 且类名含 mask）、`findMask`、`findDialogSibling`、`collectSurfaces`、`isSurfaceVisible`。

### 3.5 `src/gate.js`

`createGate(options = {}) -> Gate`，替代 `createCompatibility`（旧名不保留）。`Gate = { canAnimate(element, kind, ownedAnimations): boolean }`。

四重门卫：

1. `isExcluded`：命中 `HARD_EXCLUSION` 跳过。
2. `isAtLeastSelfVisible`：自身/祖先 `hidden`、祖先 `aria-hidden`、任一祖先 `display:none` 跳过。
3. `hasHostAnimation`：`getAnimations()` 存在非 owned 且 `playState !== "finished"`，或计算样式 `animation-name` 非 `none` 跳过。
4. **新增 `hasHostTransitionConflict`**：计算样式的 `transition-property` / `transition-duration` 与我们将要动画的属性（opacity / translate / scale / box-shadow）相交且时长 > 0 时跳过；只读检测，失败放行。

### 3.6 `src/frames.js`

纯帧函数（只依赖 `SURFACE_DEFS` 与计算样式）：

```js
function keyframesFor(kind, timing, independentTransforms, boxShadow = null)
function exitKeyframesFor(kind, timing, independentTransforms, boxShadow = null)
function fadeKeyframesFor(direction, opacity)
function animationSpecsFor(surface, kind, direction, independentTransforms)
```

- `splitFade: true` 表面：表面只写几何（translate/scale）+ 可选 `boxShadow: none ↔ 计算值`，**不写 opacity**；每个直接元素子级一条 opacity（0 ↔ 自然值）。
- `splitFade: false` 表面：表面整体 `opacity + translate`（mask 只有 opacity）。
- 无直接元素子级时回退「表面整体」。
- `box-shadow` 计算值读取失败（none/空/异常）→ 阴影不参与动画，几何或 opacity 动画保留。
- 保留 `directElementChildren` / `naturalOpacity` / `naturalBoxShadow`。

### 3.7 `src/runtime.js`

`createTransitionRuntime(options = {}) -> { start(): stop, dispose(), enqueue(intent) }`，替代 `createMotionRuntime`（旧名不保留）。

流程：

```text
start()
  ├─ tracker.scanRoot(observationRoot)          // 基线状态
  ├─ policy.subscribe(handleReducedMotion)      // 热切换接线
  └─ MutationObserver.observe(subtree)

MutationObserver
  ├─ attributes   → tracker.classifyAttributes → enqueue
  ├─ addedNodes   → tracker.classifyAdded      → enqueue
  └─ removedNodes → tracker.classifyRemoval    → playGhost
```

- **去重修正**：`lastApplied` 只在动画真正创建后写入；`canAnimate` 拒绝时不写标记，允许后续重试。同帧去重使用 `batchKeys`（每次 flush 清空）。
- **reduced-motion 热切换**：`reduced === true` 时立即 `cancel` 所有 owned/exit 动画并移除全部幽灵；`reduced === false` 不动作，后续动画自动恢复。
- **入场**：`element.animate(keyframes, { duration, easing, fill:"both" })`；settle 后 `cancel()` 释放填充态（保留 v0.1.0 修复）。
- **退场幽灵**：`cloneNode(true)` → `prepareGhost`（aria-hidden/inert/pointer-events:none/剥 id 与 aria-* / 禁 animation/transition；**不剥 backdrop-filter**）→ 插回原位置 → 克隆上按 specs 播退场 → 全部 settle 后移除；无动画则立即移除。
- **清理 `dispose()`**：断 observer、取消 rAF、cancel 所有动画、移除所有幽灵、退订 policy 并 `policy.dispose()`。
- 默认依赖：`policy = options.policy || createPolicy()`，`tracker = options.tracker || createSurfaceTracker()`，`gate = options.gate || createGate()`。

### 3.8 `src/browser.js` 与构建产物

`src/browser.js` 是 esbuild 入口，把 `src/` 的 ESM 模块打包成一个 classic IIFE，产物为根目录 `client.js`。构建脚本 `scripts/build.mjs`：

```js
await build({
  entryPoints: ["src/browser.js"],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["es2020"],
  outfile: "client.js",
  minify: false,
  legalComments: "none",
});
```

产物内执行 `window.__ModuleLoader__.load({ id: "@tak1208/dsh-webui-transition", factory: () => { ... return module.exports; } })`；factory 内 `exports` 暴露冻结签名（见 §4）。**产物顶层不得出现 `import`/`export`**（0.2.2 classic 契约）。

## 4 冻结签名（测试按此写）

```js
// 描述符
const SURFACE_DEFS = { menu, listbox, dialog, mask };

// policy
function createPolicy(options = {}) -> Policy
// Policy = { reducedMotion(), tokens(), timing(kind), subscribe(fn), dispose() }

// tracker（替代 createClassifier）
function createSurfaceTracker(options = {}) -> SurfaceTracker
// SurfaceTracker = { scanRoot(root), classifyAdded(node), classifyAttributes(target), classifyRemoval(node) }

// gate（替代 createCompatibility）
function createGate(options = {}) -> Gate
// Gate = { canAnimate(element, kind, ownedAnimations): boolean }

// 纯帧函数
function keyframesFor(kind, timing, independentTransforms, boxShadow = null)
function exitKeyframesFor(kind, timing, independentTransforms, boxShadow = null)
function fadeKeyframesFor(direction, opacity)
function animationSpecsFor(surface, kind, direction, independentTransforms)

// runtime（替代 createMotionRuntime）
function createTransitionRuntime(options = {}) -> Runtime
// Runtime = { start(): stop, dispose(), enqueue(intent) }

// exports（构建产物 window.__ModuleLoader__ factory 返回）
exports.createPolicy = createPolicy;
exports.createSurfaceTracker = createSurfaceTracker;
exports.createGate = createGate;
exports.createTransitionRuntime = createTransitionRuntime;
exports.keyframesFor = keyframesFor;
exports.exitKeyframesFor = exitKeyframesFor;
exports.fadeKeyframesFor = fadeKeyframesFor;
exports.animationSpecsFor = animationSpecsFor;
exports.inject = [];
exports.apply = apply;
```

旧名 `createClassifier` / `createCompatibility` / `createMotionRuntime` **不保留**（AGENTS.md：不保留向后兼容性）。

## 5 测试策略

`node --test`（Node 内置）+ `jsdom`。每个模块一个测试文件，直接 `import` ESM 源码；另加 `bundle.test.mjs` 冒烟测试，确认 `scripts/build.mjs` 产物仍是 classic 契约并暴露冻结签名。

覆盖点：

1. **policy**：token 解析、clamp、非法缓动回退、reduced-motion 归零、subscribe 实时通知、dispose 幂等。
2. **tracker**：scanRoot 基线状态、新增子树分类、dialog+mask 配对、单独 mask 插入/移除、排除区、hidden→visible 状态机去重。
3. **gate**：排除区 / 不可见 / 宿主 WAAPI / 宿主 CSS animation / **宿主 CSS transition 冲突**。
4. **frames**：menu 表面无 opacity + 阴影帧；dialog/mask 整体帧；独立 transform 降级；splitFade 拆分、无子级回退、阴影缺失退化。
5. **runtime**：
   - 初始扫描：启动前已存在的表面不播入场；
   - mount 动画；settle 后释放 fill；
   - 门卫拒绝后重试不被去重抑制；
   - 同帧去重；
   - reduced-motion 热切换会 cancel 在播动画并清幽灵；
   - 退场幽灵清理与 `backdrop-filter` 不剥离；
   - `dispose()` 完整清理。
6. **bundle**：构建产物调用 `window.__ModuleLoader__.load`，factory 返回冻结签名，`inject=[]`，`apply` 可调。

验收命令：

```bash
node --check src/*.js scripts/build.mjs
node scripts/build.mjs
node --test
```

## 6 文档与元数据更新

- `package.json`：`version` → `0.2.0`；`scripts.build` / `pretest` / `test`；devDep 增 `esbuild`；移除误加的 pnpm 配置字段（`allowBuilds` 放 `pnpm-workspace.yaml`）。
- `pnpm-workspace.yaml`：新增 `allowBuilds: { esbuild: true }`（pnpm 11 要求，否则 esbuild postinstall 被忽略）。
- `AGENTS.md`：项目地图指向 `.plan/v0.2.0/plan-b-rewrite.md`，架构说明改为 `src/` ESM + esbuild。
- `README.md` / `README.en.md`：
  - 行为说明基本不变；
  - 「实现架构」改为 v0.2.0 的 `src/` + build；
  - 补「运行中开启减少动态效果会立即取消在播动画并清除幽灵」。
- `cordis.patch.yml` / `index.js` / `COMPATIBLE_VERSION` 不变。
- `.plan/v0.1.0/*.md` 头部加一行历史标记，保留证据。

## 7 分阶段执行计划

| 阶段 | 内容 | 验收标准 |
| --- | --- | --- |
| **P0** | 从当前 HEAD 新建分支 `feat/v0.2.0` | `git branch --show-current` 命中 |
| **P1** | 写入 `.plan/v0.2.0/plan-b-rewrite.md`，更新 AGENTS.md 项目地图，旧计划加历史标记 | `grep -n "v0.2.0" AGENTS.md` 命中；旧计划有历史标记 |
| **P2** | 安装 esbuild；新增 `pnpm-workspace.yaml`；更新 package.json scripts/version | `pnpm install` 退出码 0；`pnpm exec esbuild --version` 可用 |
| **P3** | 编写 `src/` 八个 ESM 模块与 `scripts/build.mjs` | `node --check` 通过；构建产物无 `import`/`export` |
| **P4** | 编写 `test/` 六个测试文件与共享 helper | `node --test` 全绿 |
| **P5** | 更新 README/README.en/AGENTS，回填本计划进度 | `grep` 旧架构词在 README/plan 中无残留 |
| **P6** | 安装到 web profile：`plugin_manager remove_bundle` → `install_bundle`；`cordis_inspect_query` 确认挂载 | `application: applied`；插件出现在设置 → 内置插件 |
| **P7** | 实机验证：设置面板开合、各处菜单开合、reduced-motion 热切换、玻璃模糊、阴影淡入淡出、console 干净、卸载还原 | 用户确认；无未捕获异常 |
| **P8** | 回填计划进度，提交；是否发布 npm 由用户决定 | 工作区干净；提交信息指向 `.plan/v0.2.0/plan-b-rewrite.md`；不 push（除非批准） |

## 8 风险与回滚

- **风险 1：transition 门卫误伤**。缓解：只对属性相交且 duration > 0 的 transition 跳过；实机验证若发现误伤，收紧/关闭该项。
- **风险 2：`splitFade` 只适用于「直接元素子级」**。当前 DSH 菜单 DOM 已核实 `.material` 为直接子级；若宿主升级后层级变化，退化为表面整体动画（但可能短暂失去模糊），需在 P7 实机重新核实。
- **风险 3：clone 计算样式读取失败**。`naturalOpacity` 回退 1，`naturalBoxShadow` 回退 null；测试覆盖。
- **风险 4：esbuild 构建产物与 classic 契约**。`bundle.test.mjs` 冒烟兜底；若 dsh 0.3.0 改变契约，重跑 `/plugin-compatible-check`。
- **回滚**：v0.1.0 实现位于 `refactor/261031`（tag `v0.1.0`），本分支失败可直接切回；所有新提交在独立分支，不 push 不覆盖 main。
