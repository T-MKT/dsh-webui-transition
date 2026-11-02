# v0.3.0：原点感知动效 + 独立设置插件 + CI：代码结构与开发进度

> 本文档是本次编码的真源：确定后直接照着它编码；节点编号在编码期间保持不变（提交信息用它指明完成到哪）。
> 状态：`- [ ]` 未完成 / `- [x]` 已完成。一个最小节点完成 = 其下全部要点已勾选，且「完成判据」成立。
> 分支：`feat/v0.3.0`（已确认，不在 main 上修改）。

## 1 需求与范围

**需求**：把现有「固定 `translate(-4px)` + `scale(.98)`」的弹层动画改为**原点感知**（origin-aware）动画：能推断触发元素时，以「触发元素离弹层最近的边/点」为 `transform-origin` 缩放，并让位移方向从触发点指向弹层；退场复用入场时缓存的 origin，朝触发点收回。猜不到触发源时按设置回退：**仅淡入**（默认）或**点击原点**。同时把设置 UI 拆成 bundle 内的独立插件 `@tak1208/dsh-webui-transition-settings`（Settings 弹窗新增「过渡动画」页），主插件在没有设置插件/没有保存过设置时以默认值正常运行。最后补 GitHub Actions CI（只做 install/build/test + 构建产物一致性校验）。

**不做的事**：

- 不做平台原生方案（CSS Anchor Positioning / View Transitions / clip-path 全 rect morph）、不做 FLIP、不做 iframe/Shadow DOM 内表面。
- 不暴露时长、缓动、scale 强度、总开关等更多设置；设置页只有「无锚点回退方式」一项。
- 不把配置写入宿主 settings（settings.yaml / 跨设备）；只用 localStorage。
- 不改 `prefers-reduced-motion`、`data-dsh-transition="off"`、现有玻璃/伪元素/幽灵架构的语义。
- 不修改 dsh 源码，不向 profile 写文件；不做 release/publish workflow。
- 不新增图标资源（插件行使用宿主默认插画）；不改 dsh 兼容基线（仍为 `0.2.2-alpha.2`）。

**关键假设**（与事实不符时先改本节）：

- 官方机制：一个 npm 包只能提供一个 client 插件（`dsh.client` → `exports["./client"]`，模块 id = 包名；浏览器半区只挂在 name 恰为包根的行上）。因此设置插件必须是**独立的第二个包**；由根 bundle 的 patch 插两行、根包以 dependency 带出设置包。
- 设置页注册用 `settings.section`（Settings 弹窗侧栏列表，第三方插件惯例：dsh-motion / dsh-custom-css 同款）；设置组件只在设置面板打开且该页 active 时挂载，主插件绝不能依赖它初始化。
- `@deepseek-ai/dsh-client-ui-primitives` 是 shell 的 baseline 共享模块（`__ModuleLoader__` 运行时解析），**不打包进产物、不声明 `dsh.client.external`**；设置页只用其原子组件（`SegmentedControl`）和 `--dsw-*` token。
- 回退语义：`仅淡入` = 该表面本次不做任何几何动画（菜单仍是「子级 opacity 淡入」，对话框/遮罩只做 opacity）；`点击原点` = 用最近一次指针位置作为原点；两者都无法取得时仍退化为仅淡入。
- 对话框（role=dialog）本期加入**方向感知位移 12px + 轻缩放 0.98**（原 `scaleFrom: 1` 改为 `0.98`）。
- 原点缓存以「元素 → 几何」WeakMap 保存；退场幽灵复用同一几何。表面尺寸为 0 时不猜，按回退处理。
- 设置契约固定为 localStorage key `dsh.webui-transition.settings.v1`，JSON `{ "fallback": "fade" | "pointer" }`；同标签页即时生效用 Cordis 事件，跨标签页用 `storage` 事件兜底。
- 设置页入口 label：中文 `过渡动画`（英文 `Transitions`），nav section id `webui-transition`，`order: 25`。

## 2 代码结构

### 2.1 目录树

```text
dsh-webui-transition/                         # 根包 = bundle + 主 client 插件
├── .agents/plan/origin-aware-and-settings.md # 本文档
├── .github/workflows/ci.yml                  # 新增：CI（install/build/test/产物一致性）
├── package.json                              # 修改：0.3.0、依赖 settings 包、packageManager、devDeps react*
├── cordis.patch.yml                          # 修改：insert 两行（main + settings）
├── pnpm-workspace.yaml                       # 修改：packages: ["packages/*"]
├── scripts/build.mjs                         # 修改：main(iife) + settings(cjs→factory 包装) 两个产物
├── index.js                                  # 不变：host 占位 apply()
├── client.js                                 # 构建产物（main）
├── locale/                                   # 新增（根包展示元信息，可选但统一做法）
│   ├── en.json                               #   {"meta":{"title":...,"description":...}}
│   └── zh.json
├── src/
│   ├── defs.js                               # 修改：dialog.scaleFrom=0.98
│   ├── settings.js                           # 新增：localStorage 契约（读/清洗/写）
│   ├── origin.js                             # 新增：交互捕获、触发源解析、origin 几何
│   ├── frames.js                             # 修改：几何帧接受 origin/方向
│   ├── runtime.js                            # 修改：origin 接线、回退、幽灵缓存
│   ├── browser.js                            # 修改：装配 tracker + settings + 事件
│   └── （policy/gate/tracker/utils 不变）
├── packages/dsh-webui-transition-settings/   # 新增：设置插件包（独立 client）
│   ├── package.json                          #   dsh.client / exports ./client / files
│   ├── index.js                              #   host 占位 apply()
│   ├── client.js                             #   构建产物
│   ├── README.md / README.en.md              #   包说明（中英同步）
│   ├── locale/en.json / locale/zh.json       #   meta.title/description（插件清单显示）
│   └── src/
│       ├── browser.js                        #   factory 入口：inject/apply + settings.section 注册
│       ├── settings-page.js                  #   React 页面（SegmentedControl）
│       ├── contract.js                       #   与主包重复的 key/event/default/modes + read/write
│       └── locale.js                         #   zh/en 运行时文案
├── test/                                     # 修改/新增（见 2.3）
└── README.md / README.en.md / AGENTS.md      # 修改：效果、设置、双包安装、密钥/风险
```

### 2.2 文件职责

| 文件 | 新增/修改 | 职责 |
| --- | --- | --- |
| `src/settings.js` | 新增 | 主包侧设置契约：`SETTINGS_KEY`/`SETTINGS_EVENT`/`FALLBACK_MODES`/`DEFAULT_SETTINGS`、`normalizeSettings`、`readSettings`、`writeSettings`；所有 localStorage 访问 try/catch。 |
| `src/origin.js` | 新增 | `createInteractionTracker`（window capture 记录 pointer/key，解析触发源）与 `geometryForSource`（源 → `{originX,originY,translateX,translateY}`）。 |
| `src/defs.js` | 修改 | `SURFACE_DEFS.dialog.scaleFrom: 0.98`；其余策略不变。 |
| `src/frames.js` | 修改 | `geometryKeyframesFor` 接受 geometry：写 `transformOrigin`/方向平移/缩放；geometry 为 null 时不出几何帧；非 splitFade 表面 geometry null 时只出 opacity。 |
| `src/runtime.js` | 修改 | 入场解析 source→geometry、按 `fallbackMode` 回退、写 geometry 缓存；退场幽灵复用/回退解析；dispose 清理。 |
| `src/browser.js` | 修改 | 构造 tracker、读取 settings、订阅 Cordis 事件与 `storage`；把 `origin`/`fallbackMode` 传给 runtime。 |
| `packages/.../package.json` | 新增 | 设置插件包 manifest：`name @tak1208/dsh-webui-transition-settings`、`exports {".","/client","./package.json","./locale/*.json"}`、`dsh.client {platform:"web"}`、`engines.dsh`、`files`。 |
| `packages/.../index.js` | 新增 | host 占位 `export function apply() {}`（只为占 Loader 行）。 |
| `packages/.../src/browser.js` | 新增 | client factory 入口：`import React`、primitives、`createSettingsPage`；`inject=["slots","locale"]`；`apply` 注册 locale 与 `settings.section`。 |
| `packages/.../src/settings-page.js` | 新增 | `createSettingsPage({readSettings,writeSettings,emit})`：标题/说明 + `SegmentedControl`；变更即写 localStorage + emit；监听 `storage` 同步。 |
| `packages/.../src/contract.js` | 新增 | 与主包相同的常量/清洗/读写实现（包独立，不跨包 import；由测试保证一致）。 |
| `packages/.../src/locale.js` | 新增 | zh/en 文案（nav/title/description/两个选项/hint）。 |
| `scripts/build.mjs` | 修改 | main：现有 esbuild iife（不变）；settings：esbuild cjs（external `react`/`react/jsx-runtime`/`react-dom`/`@deepseek-ai/dsh-client-ui-primitives`）后包进 `__ModuleLoader__.load({id,factory:(require)=>{...}})`。 |
| `cordis.patch.yml` | 修改 | `insert` 两行：`dsh-webui-transition`（根包）、`dsh-webui-transition-settings`（settings 包），均写显式 id。 |
| `package.json` | 修改 | 版本 0.3.0；`dependencies: {"@tak1208/dsh-webui-transition-settings": "workspace:^"}`；`packageManager: "pnpm@11.24.0"`；`files` 加 `locale/*.json`；devDeps 加 `react`/`react-dom`（仅测试渲染）；`exports` 加 `"./locale/*.json"`。 |
| `pnpm-workspace.yaml` | 修改 | `packages: ["packages/*"]`，保留 `allowBuilds.esbuild`。 |
| `.github/workflows/ci.yml` | 新增 | PR + push(main/feat/**)：pnpm install --frozen-lockfile → pnpm build → pnpm test → 校验两个 `client.js` 与提交一致。 |
| `locale/{en,zh}.json`（根） | 新增 | 根插件行/包展示元信息（title 过渡动画、description）。 |
| `test/*` | 修改/新增 | 见 2.3。 |
| `README*`、`AGENTS.md` | 修改 | 效果、设置插件、双包安装/本地联调、localStorage 风险、项目地图同步。 |

### 2.3 测试文件

| 文件 | 新增/修改 | 覆盖 |
| --- | --- | --- |
| `test/helpers/env.mjs` | 修改 | 多次 bundle 注册捕获、`materializeBundle(reg, requireFn)`、fake ctx（slots/locale/on/emit）、fake storage、jsdom 下 react-dom/client 渲染辅助。 |
| `test/settings.test.mjs` | 新增 | 默认值、坏 JSON、字段非法、storage 抛异常、写失败返回值。 |
| `test/origin.test.mjs` | 新增 | 解析优先级（DOM 邻接/子菜单→aria-controls→aria-expanded+邻接闸门→新鲜指针目标→键盘 activeElement）、邻接闸门拒绝远/无关元素、2.5s 新鲜度、geometry 的 clamp/方向/零尺寸返回 null、指针点模式。 |
| `test/frames.test.mjs` | 修改 | geometry 帧含 `transformOrigin` 与方向 translate；geometry null 时 menu 无表面几何帧、dialog 仅 opacity；dialog 0.98。 |
| `test/runtime.test.mjs` | 修改 | 入场 origin/回退模式；退场幽灵复用同一 origin；无 origin 时默认 fade；指针回退模式；dispose 清理。 |
| `test/settings-page.test.mjs` | 新增 | 从 `packages/.../src/settings-page.js`（或构建产物）用真实 React + stub primitives：渲染两选项、默认选中 fade、切换时写 localStorage 并 emit（jsdom click）。 |
| `test/settings-plugin.test.mjs` | 新增 | 构建产物注册 id、`inject`、`apply` 调 `slots.inject("settings.section")` + 注册 options（id/order/label/locale）、locale 注册。 |
| `test/contract.test.mjs` | 新增 | 主包 `src/settings.js` 与设置包 `src/contract.js` 的 key/event/default/modes 完全一致（防契约漂移）。 |
| `test/bundle.test.mjs` | 修改 | main + settings 两个 `client.js` 的 classic 契约；settings 产物内含 `require("@deepseek-ai/dsh-client-ui-primitives")` 且未内联 React/primitives 代码。 |

### 2.4 Web UI 约定（重要）

- 设置页 UI 必须使用 `@deepseek-ai/dsh-client-ui-primitives` 的官方原子组件：本期用 `SegmentedControl`（互斥模式切换，自带 tablist/键盘行为），不手写分段控件。布局样式只用 `--dsw-*` token。
- 该包是 shell 的 **baseline 共享模块**：运行时由 `__ModuleLoader__` 解析，**不要打包进自己的 bundle**，**不要**写进 `dsh.client.external`；构建时以 external + factory 的 `require` 形式出现。开发期如需类型提示，可把 `@deepseek-ai/dsh-client-ui-primitives@0.2.2-alpha.2` 装成 devDependency（仅类型，不参与产物）。
- 设置页不用 `dsh-client-store`，不 require 其它 Harness client 包；不注册 `plugins.item`（那是 host 配置列表）。
- 组件 render 抛错会被 renderer 静默退役该条目：设置页保持纯展示 + 受控 state，所有动作 try/catch。

### 2.5 触发源解析与几何（冻结行为）

**`createInteractionTracker({ window, document, now })`** 返回 `{ start, stop, resolve(surface), lastPointerPoint() }`，内部：

- `start()`：在 `window` capture 监听 `pointerdown`、`click`、`keydown`、`pointermove`（只记坐标/时间，不 preventDefault），在 `document` 记录 `activeElement` 快照；`stop()` 全部移除。
- 记录：指针类事件存 `{ kind:"element", rect, target, x, y, time }`（rect 在事件时刻读取，元素随后被卸载也不影响）；`pointermove` 只更新 `{x,y,time}`；`keydown` 存目标元素 rect + 时间。
- `resolve(surface)` 优先级（返回 `{kind:"element",rect}` / `{kind:"point",x,y}` / null）：
  1. **DOM 邻接**：子菜单（surface 祖先链里有 `[role=menu]`）→ 找到包含该 surface 的 `[role=menuitem]`/`[aria-haspopup]` 兄弟按钮；非 portal 菜单（surface 父级是同时包含 trigger 的 wrapper）→ 取 wrapper 内 trigger 型元素（`button,a[href],[role=button],[aria-haspopup]`，且不在 surface 内）。
  2. **aria 关联**：`surface.id` → `document.querySelector('[aria-controls~="<id>"]')`。
  3. **展开态扫描**：`[aria-expanded="true"][aria-haspopup]`（排除在 surface 内、排除 `[data-dsh-transition-ghost]`），通过**邻接闸门**：两矩形至少一轴投影重叠且间隙 ≤24px，或最近边距 ≤24px，且中心距离 ≤1400px；取最近者。
  4. **最近指针目标**：最近一次 pointerdown/click 记录，时间 ≤2500ms，rect 有效；target 仍连接时取当前 rect，否则用记录 rect。
  5. **键盘**：当前 `document.activeElement` 在 surface 外且是 trigger 型元素；否则最近 keydown 记录（≤2500ms）。
  6. 否则 null。
- `lastPointerPoint()`：最近 `pointerdown` 的坐标（没有则 `pointermove` 的坐标），≤2500ms 才返回。

**`geometryForSource(source, surfaceRect, distancePx)`**：

- `surfaceRect` 宽/高任一 ≤0 → `null`。
- `anchorPoint`：element 用 rect 中心；point 用坐标。
- `originX = clamp(anchorPoint.x - rect.left, 0, width)`，`originY = clamp(anchorPoint.y - rect.top, 0, height)`。
- `translate = unit(originPointLocal - surfaceCenterLocal) * distancePx`；零向量 → `{0,0}`。
- 返回 `{ originX, originY, translateX, translateY }`（像素，origin 可等于 0/width/height）。

### 2.6 设置契约（跨包冻结）

```js
// 主包 src/settings.js 与 设置包 src/contract.js 必须各自导出同值：
SETTINGS_KEY = "dsh.webui-transition.settings.v1"
SETTINGS_EVENT = "dsh-webui-transition/settings"
FALLBACK_MODES = ["fade", "pointer"]
DEFAULT_SETTINGS = { fallback: "fade" }
normalizeSettings(value) -> { fallback }       // 非对象/字段非法 → 默认
readSettings(storage?) -> { fallback }         // storage 默认懒取 globalThis.localStorage
writeSettings(settings, storage?) -> boolean   // 写成功 true；异常 false
```

数据流：设置页 `SegmentedControl` 变更 → `writeSettings()` → `ctx.emit(SETTINGS_EVENT, {fallback})`；主插件在 `browser.js` 里 `ctx.on(SETTINGS_EVENT, …)` 更新内存中的 fallback，并额外监听 `window` 的 `storage`（跨标签）；读不到/事件缺失时始终用默认 `fade`。

### 2.7 冻结签名

```js
// src/settings.js
export const SETTINGS_KEY = "dsh.webui-transition.settings.v1";
export const SETTINGS_EVENT = "dsh-webui-transition/settings";
export const FALLBACK_MODES = Object.freeze(["fade", "pointer"]);
export const DEFAULT_SETTINGS = Object.freeze({ fallback: "fade" });
export function normalizeSettings(value): { fallback: "fade" | "pointer" }
export function readSettings(storage = undefined): { fallback: "fade" | "pointer" }
export function writeSettings(settings, storage = undefined): boolean

// 设置包 src/contract.js：同上（独立实现，测试比对）

// src/origin.js
export function createInteractionTracker(options = {}): {
  start(): void,
  stop(): void,
  resolve(surface: Element): Source | null,      // Source = {kind:"element",rect}|{kind:"point",x,y}
  lastPointerPoint(): { x: number, y: number } | null,
}
export function geometryForSource(
  source, surfaceRect, distancePx
): { originX: number, originY: number, translateX: number, translateY: number } | null

// src/frames.js（修改后）
export function keyframesFor(kind, timing, independentTransforms, boxShadow = null, geometry = null)
export function exitKeyframesFor(kind, timing, independentTransforms, boxShadow = null, geometry = null)
export function animationSpecsFor(surface, kind, direction, independentTransforms, options = {})
// options = { computedStyle?, geometry?: Geometry | null }

// src/runtime.js（修改后）
createTransitionRuntime(options)
// options 新增：origin?: { resolve(el), lastPointerPoint() } | null
//             fallbackMode?: () => "fade" | "pointer"   // 默认 () => "fade"
// 返回仍是 { start, dispose, enqueue }

// 设置包 src/settings-page.js
export function createSettingsPage({ readSettings, writeSettings, emit }): React.ComponentType
// 设置包 src/browser.js 导出：inject = ["slots","locale"]; apply(ctx)
```

## 3 开发进度

### 3.1 双包骨架与构建

#### 3.1.1 建立 workspace、两个包与两行 patch

- [ ] 根 `package.json`：版本 `0.3.0`，加 `packageManager: "pnpm@11.24.0"`，加 `dependencies: {"@tak1208/dsh-webui-transition-settings": "workspace:^"}`，`files`/`exports` 补 `locale/*.json`。
- [ ] `pnpm-workspace.yaml` 加 `packages: ["packages/*"]`。
- [ ] 新建 `packages/dsh-webui-transition-settings/`：`package.json`（0.3.0、`exports`、`dsh.client {platform:"web"}`、`engines.dsh` 同根包、`files`）、`index.js`（空 apply）、`locale/en.json`、`locale/zh.json`（`meta.title/description`）。
- [ ] `cordis.patch.yml` 改为 insert 两行（id 显式）：`dsh-webui-transition`、`dsh-webui-transition-settings`。
- [ ] 根 `locale/en.json`、`locale/zh.json`（meta title/description）。
- **完成判据**：`pnpm install --frozen-lockfile` 成功、`pnpm build` 成功；`pnpm test`（现有用例）通过。

#### 3.1.2 构建脚本支持 settings client

- [ ] `scripts/build.mjs`：保留 main 的 iife 构建到 `client.js`；新增 settings 构建：esbuild `format:"cjs"`、`bundle`、`platform:"browser"`、`target:["es2020"]`、`external:["react","react/jsx-runtime","react-dom","@deepseek-ai/dsh-client-ui-primitives"]`，把输出包进 `window.__ModuleLoader__.load({ id:"@tak1208/dsh-webui-transition-settings", factory: (require) => { var module={exports:{}}; var exports=module.exports; <code>; return module.exports; } })`，写 `packages/.../client.js`。
- [ ] 设置包 `src/browser.js` 最小实现：`export const inject=["slots"]; export function apply(){}`（先只验证产物）。
- [ ] `test/helpers/env.mjs`：支持从同一页面脚本捕获多次 `load` 注册；`materializeBundle(registration, requireFn)`。
- [ ] `test/bundle.test.mjs`：新增 settings 产物契约（id、factory、`inject`、可 apply，产物顶层无 import/export）。
- **完成判据**：`pnpm build && node --test test/bundle.test.mjs` 通过；settings 产物里出现 `require("@deepseek-ai/dsh-client-ui-primitives")`，且不含 React/primitives 源码内联。

### 3.2 设置契约与原点基础

#### 3.2.1 并行实现配置契约、原点模块与测试

- [ ] **Agent A**：`src/settings.js` — 按 §2.7 实现 `SETTINGS_KEY/EVENT/FALLBACK_MODES/DEFAULT_SETTINGS/normalizeSettings/readSettings/writeSettings`，所有 storage 访问 try/catch（依赖：§2.7 冻结签名）。
- [ ] **Agent B**：`packages/dsh-webui-transition-settings/src/contract.js` — 同签名独立实现（依赖：§2.7 冻结签名）。
- [ ] **Agent C**：`src/origin.js` — `createInteractionTracker` + `geometryForSource`，按 §2.5 优先级与邻接闸门（依赖：§2.7 冻结签名）。
- [ ] **Agent D**：`test/settings.test.mjs`、`test/origin.test.mjs` — 只按冻结签名写测试，覆盖默认/坏数据/异常、解析优先级/闸门/新鲜度/clamp/零尺寸（依赖：§2.7 冻结签名）。
- [ ] **Agent E**：`test/contract.test.mjs` — 比对主包与设置包契约常量与行为一致（依赖：A、B 文件存在）。
- **完成判据**：五者收敛后 `node --test test/settings.test.mjs test/origin.test.mjs test/contract.test.mjs` 通过。

#### 3.2.2 设置页读取路径的最小接线

- [ ] `src/browser.js`：构造 `const settings = readSettings()` 与 `fallbackMode` getter（先只接到以后 runtime 的 options，行为不变）。
- [ ] `src/browser.js`：`ctx.on(SETTINGS_EVENT, …)` + `window.addEventListener("storage", …)`，更新内存 fallback；`ctx.effect` 返回清理。
- [ ] `test/bundle.test.mjs`：新增 apply 后 `ctx.on`/storage 监听可清理的断言（fake ctx/window）。
- **完成判据**：`node --test test/bundle.test.mjs` 通过。

### 3.3 帧算法 origin-aware

#### 3.3.1 修改 frames.js

- [ ] `geometryKeyframesFor(kind, timing, independentTransforms, boxShadow, out, geometry)`：geometry 非空时首/末帧加 `transformOrigin: "<x>px <y>px"`、`translate: "<tx>px <ty>px"`（末帧 `"0 0"`）、scale 从 `scaleFrom`；为空返回 `[]`。
- [ ] `keyframesFor/exitKeyframesFor(..., geometry = null)`：非 splitFade 表面 geometry 为空时只出 opacity 帧（无 translate）；boxShadow 只在 geometry 非空时动画。
- [ ] `animationSpecsFor(..., {geometry})`：splitFade 表面 geometry 为空时不出表面几何帧（子级 opacity 与伪元素 opacity 照旧）；非 splitFade 表面走 opacity-only。
- [ ] `defs.js`：`dialog.scaleFrom = 0.98`。
- [ ] `test/frames.test.mjs`：覆盖 geometry 帧、null geometry、dialog 0.98 与方向平移。
- **完成判据**：`node --test test/frames.test.mjs` 通过。

### 3.4 runtime 接线

#### 3.4.1 入场/退场使用 origin 与回退

- [ ] `runtime.js`：新增 `origin`、`fallbackMode` options；`geometryCache = new WeakMap()`。
- [ ] 入场：`source = origin?.resolve(element)` → `geometry = geometryForSource(source, rect, def.distancePx)`；为空且 `fallbackMode()==="pointer"` 且 `origin.lastPointerPoint()` → 用 point 生成；仍为空 → geometry null（仅淡入）；geometry 非空写缓存。
- [ ] 退场：优先 `geometryCache.get(surface.element)`；否则用当前 `document.activeElement`（在表面外且连接）作 element source，再退 pointer（按模式）；都没有 → null。
- [ ] 幽灵：`playGhost` 里每个 surface 用缓存/回退解析出的 geometry 播放退场；`resolveClone` 映射不变。
- [ ] `test/runtime.test.mjs`：更新 harness（注入 fake origin）；覆盖 origin 入场、fade 回退、pointer 回退、幽灵复用、无 origin 默认 fade、dispose 清理。
- **完成判据**：`node --test test/runtime.test.mjs` 通过。

### 3.5 主插件装配

#### 3.5.1 browser.js 接线与产物验证

- [ ] `src/browser.js`：`createInteractionTracker({window, document})`；`createTransitionRuntime({root: document, origin: tracker, fallbackMode})`；`ctx.effect` 启动/停止 tracker 与 runtime；保持现有导出 API 不变。
- [ ] 设置变更回调只更新内存值，不重建 runtime。
- [ ] `test/bundle.test.mjs`：apply 后 tracker/storage/ctx.on 均被启动且清理可执行。
- **完成判据**：`pnpm build && node --test test/bundle.test.mjs test/runtime.test.mjs` 通过。

### 3.6 设置插件 UI

#### 3.6.1 页面、locale 与 slot 注册

- [ ] `packages/.../src/locale.js`：zh/en（nav `过渡动画`/`Transitions`、title、description、`fallbackFade`、`fallbackPointer`、hint）。
- [ ] `packages/.../src/settings-page.js`：`createSettingsPage({readSettings,writeSettings,emit})`；`useState` 初值来自读取；`SegmentedControl`（id `dsh-webui-transition-fallback`、label、两 options）onChange 写 storage + emit；`useEffect` 监听 `storage` 同步；仅用 `--dsw-*` token 的内联样式，不手写分段控件。
- [ ] `packages/.../src/browser.js`：`inject=["slots","locale"]`；`ctx.locale.register(NS,{zh,en})`；`ctx.slots.inject("settings.section", () => ctx.slots.register({name:"settings.section", id:"webui-transition", order:25, label:()=>t("nav"), locale:NS}, Page))`；`emit` 走 `ctx.emit(SETTINGS_EVENT,…)`。
- [ ] `test/settings-page.test.mjs` + `test/settings-plugin.test.mjs`：渲染两选项/默认 fade/切换写 storage 并 emit；注册 options 的 id/order/label/locale 正确；产物 id/inject 正确。
- **完成判据**：`node --test test/settings-page.test.mjs test/settings-plugin.test.mjs test/bundle.test.mjs` 通过。

#### 3.6.2 设置包展示元信息与文档

- [ ] 设置包 `locale/{en,zh}.json` 补 `meta.title` / `meta.description`；`README.md`、`README.en.md`（用途、Settings 入口、key、默认值）。
- [ ] 根 `README*`：效果表新增 origin-aware、回退两种模式、设置入口、「没有设置插件也运行」、localStorage key 与清空风险。
- **完成判据**：`pnpm build && pnpm test` 通过；`git status` 中新增文档齐备。

### 3.7 全部验证与仓库收尾

#### 3.7.1 全量测试、双包产物、文档地图

- [ ] 更新 `test/helpers/env.mjs` 使 `pnpm test` 覆盖两包（node --test 自动发现）。
- [ ] `package.json` devDeps 补 `react`/`react-dom`（仅测试）；`pnpm install` 更新 lockfile。
- [ ] `AGENTS.md` 项目地图更新（`.agents/plan`、`packages/...`、`src/settings.js`、`src/origin.js`、`.github/workflows/ci.yml`、两个测试入口）；根 README 中英同步。
- [ ] `COMPATIBLE_VERSION` 不改（dsh 基线未变）。
- **完成判据**：`pnpm build && pnpm test` 全绿；`git diff --exit-code -- client.js packages/dsh-webui-transition-settings/client.js` 在重新 build 后无差异。

### 3.8 CI

#### 3.8.1 GitHub Actions 校验流水线

- [ ] 新增 `.github/workflows/ci.yml`：`on: pull_request` + `push: branches [main, "feat/**"]`；`permissions: contents: read`；`concurrency`；`ubuntu-latest` + Node 24 + pnpm（读 `packageManager`）。
- [ ] 步骤：`pnpm install --frozen-lockfile` → `pnpm build` → `pnpm test` → `git diff --exit-code -- client.js packages/dsh-webui-transition-settings/client.js`（构建产物与提交一致）。
- [ ] 不安装 dsh、不 publish、不写 secrets；测试只用 jsdom 与 fake loader。
- [ ] README 中英各加一行 CI 状态/说明（可选）。
- **完成判据**：本地按 CI 步骤顺序执行通过；YAML 语法自检（如 `node -e` 解析或 `actionlint` 可用则跑）。

## 4 风险与边界（实现时注意）

1. **localStorage 可被清**：浏览器“清除浏览数据/站点数据”、无痕关闭、换 origin（端口/host 变化）、换浏览器/profile、Safari 长期未访问、极端存储压力都会清；后果只是回退默认 `fade`，主插件仍工作。读取/写入一律 try/catch，key 带版本号。
2. **误配触发源**：必须保留 2.5s 新鲜度 + 24px 邻接闸门 + 1400px 距离上限；无法确认时宁可走回退，不猜。
3. **同一标签页 storage 事件不触发**：即时生效必须走 Cordis 事件；`storage` 仅跨标签兜底。
4. **双包安装（已确认选 A）**：根包以 `workspace:^` 依赖设置包（publish 时 pnpm 自动改写为 `^0.3.0`）。npm 用户一条命令装两个包；但**本地从仓库绝对路径 `install_bundle` 会因 workspace 协议失败**，开发期的联调方式改为：把两个包分别 link/安装进 profile（或先发布 settings 预发布版再装根包），并在 README 开发章节写清楚。发布顺序为先 settings 后根包。
5. **primitives 版本漂移**：只通过 baseline 模块使用 `SegmentedControl`；不内联、不复制其样式。若未来该组件 API 变化，设置页需按宿主版本适配（测试用 stub，不锁死实现细节）。
6. **玻璃/backdrop-filter**：不给表面祖先（overlay/mask）加 transform/opacity；本次只改表面自身 origin/translate/scale，保持现有 splitFade 与幽灵约束。
7. **dsh 升级**：语义选择器、`settings.section`、client 契约均需在 dsh 版本变化后重查（沿用 `plugin-compatible-check`）。
