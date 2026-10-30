# dsh-webui-transition：设置面板与菜单开合过渡动画 — 代码结构与开发进度

> 本文档是本次编码的真源：确定后直接照着它编码；节点编号在编码期间保持不变（提交信息用它指明完成到哪）。
> 状态：`- [ ]` 未完成 / `- [x]` 已完成。一个最小节点完成 = 其下全部要点已勾选，且「完成判据」成立。
> 分支：`feat/prepare`（不在 main）。新项目，git 已初始化，未 push。

## 1 需求与范围

**调研结论**（前置调研已定稿，详见对话历史）：无现成可装插件；**借鉴 `bilbillm/dsh-motion` 的运行时架构**（语义分类 + MutationObserver + WAAPI + 成对退场幽灵，MIT），**动效参数借用 `dsh-motion-complete` 里已定稿的数值**（菜单 150ms/`-4px`/`scale(.98)`，对话框 220ms/`12px`，mask 180ms）。`dsh-settings-beautify` 经用户决定不再借鉴。

**需求**：为 DSH Web UI（本机 `0.2.2-alpha.2`）补上两处缺失的过渡动画：

1. **各级下拉菜单**（`role="menu"`，包括设置内的模型菜单等）的开合动画：入场淡入 + 上浮，关闭退场镜像。
2. **设置面板**（右上设置入口打开的 `role="dialog"` + mask）的开合动画：mask 淡入、面板淡入上浮；关闭时退场镜像。

实现形态：一个**持久化 Client-only bundle**（四文件手写：`package.json` / `cordis.patch.yml` / `index.js` / `client.js`；无构建工具、无第三方运行时依赖），通过 `window.__ModuleLoader__` 注册一个语义动效运行时。

**不做的事**：

- 不做消息入场 / 流式渲染 / 平滑滚动动效（那是 dsh-smooth-stream 等插件的地盘）。
- 不做设置面板内 tab 切换、开关、标签页滑动指示条、工作区折叠等其它表面（dsh-motion 的完整面被有意收窄到「菜单 + 对话框」两处用户点名的地方）。
- 不加设置页、强度滑杆、开关 UI（v1 零配置；唯一退出开关是 `data-dsh-transition="off"` 标记，与 dsh-motion 的 `data-dsh-motion="off"` 同机制）。
- 不修改宿主卸载时序（不学 motion-complete 的 `setTimeout` 延迟卸载补丁）；退场全部走**幽灵副本**。
- 不覆盖宿主已有动画（`canAnimate` 门卫：宿主在播的动画一律跳过）。
- 不修改 dsh 源码、不往 profile 手写 package.json / cordis.patch.yml（安装走 `plugin_manager install_bundle`）。

**关键假设**（已逐条对 0.2.2-alpha.2 安装产物核实，与事实不符时先改本节）：

- A1. 菜单语义面：`role="menu"` 位于菜单卡片根元素（`.list`；关闭是 `open && <Menu>` 条件渲染，瞬时卸载；是否 portal 到 `document.body` 取决于菜单的 portal 模式）；`role="menuitem"` 为条目；`_list_`/`_submenu_` 类无任何 transition/animation（宿主仍无菜单动效）。已核：`dsh-web-frontend/dist/assets/index--TtJvO-i.js`（`_list_li7ht_7`）。
- A2. 设置面板语义面：0.2.2 由 `dsh-client-ui-settings-general` 自有 overlay 渲染——`div.overlay[role="presentation"]`（portal 到 body）> `div.mask[aria-hidden="true"]` + `div.panel[role="dialog"][aria-modal="true"][data-shortcut-modal="settings"]`；当前完全无入/退场动画（不复用通用 Modal 的 `modalEnter` 入场）；内容区由 `renderSlot("settings.section")` 渲染（`[data-slot="settings.section"]`）。已核：`dsh-client-ui-settings-general/lib/client.js`（`SettingsRoot_module_css`）。0.2.2 起面板内部 `.content` 包裹层移除、`.panel` 改 grid；动画只挂外层 overlay/mask/panel，不受影响。设置面板关闭同样是瞬时卸载。
- A3. 动效 token 存在：`--ds-transition-duration: .2s` / `-fast: .1s` / `-slow: .3s`、`--ds-ease-in-out: cubic-bezier(.4,0,.2,1)`，定义于 `dsh-client-ui-theme` 的 base.css 并挂在 `:root`（0.2.2 仍在 `:root`，值未变）。
- A4. 菜单/对话框关闭时宿主先卸载、观察者后收到记录 → 退场**必须**用 inert 幽灵副本（克隆 + 播完即删），这正是 dsh-motion 已验证的机制。
- A5. 0.2.x 客户端契约与 0.1.x 同构：`window.__ModuleLoader__.load({ id, factory })`，`apply(ctx)` 内用 `ctx.effect(fn, label)` 注册、返回值做清理。已核：官方包 `dsh-client-modules/lib/client.js`（`__ModuleLoader__.load` 入口）、`dsh-client-ui-theme/lib/client.js`（`exports.inject/apply`、`ctx.effect(fn, label)`）；旁证：本 profile 已装第三方 `dsh-ui-appearance@0.1.17` 的 `ctx.effect` 用法。
- A6. 本插件不注册任何 slot、不渲染组件——「给宿主菜单加动画」没有可承载的 slot；纯观察 + WAAPI 是生态先例（dsh-motion、dsh-reduce-effects、dsh-force-motion 同形态）。所有资源（observer、style、listener）都在 `ctx.effect` 内注册并随卸载清理。

**0.2.2 宿主动效现状**（0.2.2-alpha.2 安装产物实核）：菜单无动效；宿主自有 WAAPI 动画仅用于 chunked-list FLIP（带 `prefers-reduced-motion` 守卫）；`@starting-style` 已用于 hover preview 与右栏首开（`dsh-client-ui-sidebar-right` 的 `[data-sidebar-right-opening]` + `--ds-transition-duration-slow`）；`role="listbox"` 与硬排除属性（`data-chat-flow` / `data-streaming` / `data-trajectory-*` / `role=tooltip|alert`）仍在。

## 2 代码结构

```text
dsh-webui-transition/
├── .plan/
│   └── webui-transition.md            # 本文档
├── AGENTS.md                          # 项目指南（补全项目地图）
├── .gitignore                         # 忽略 node_modules、AGENTS.local.md 等
├── LICENSE                            # MIT
├── COMPATIBLE_VERSION                 # 待插件代码落地时创建（第一行：0.2.2-alpha.2；第二行：检查日期），本轮不创建
├── README.md / README.en.md           # 中英文说明（安装、效果、退出开关、已知边界）
├── package.json                       # bundle manifest + dsh.client（浏览器半区声明）
├── cordis.patch.yml                   # Loader 补丁：insert 一行 dsh-webui-transition
├── index.js                           # Host 半区：空 apply()（占位，满足 bundle 行）
├── client.js                          # Client 半区：语义动效运行时（唯一浏览器产物，分区实现）
└── test/
    └── runtime.test.mjs               # jsdom 单测：按 §2 冻结签名测试运行时行为
```

| 文件 | 新增/修改 | 职责 |
| --- | --- | --- |
| `package.json` | 新增 | `@tak1208/dsh-webui-transition`；`dsh.bundle.patch` + `dsh.client{ platform:"web", immediately:true, inject:[] }`；`exports` 出 `.` 与 `./client`（指向 classic script）；`engines.dsh: ">=0.2.2-alpha.2 <0.3.0"` |
| `cordis.patch.yml` | 新增 | `- insert: - id: dsh-webui-transition, name: '@tak1208/dsh-webui-transition'` |
| `index.js` | 新增 | Host 半区 `export function apply() {}` |
| `client.js` | 新增 | 浏览器半区，classic script：文件顶层只有 `window.__ModuleLoader__.load({ id, factory })`，不得出现 `import`/`export`；运行时工厂在 factory 闭包内定义、经 `exports.*` 暴露，单测经 fake `window.__ModuleLoader__` 捕获 factory 后取 `exports`。单文件按 5 个 region 分区：`region policy`（token/reduced-motion/时长策略）、`region classifier`（DOM→意图）、`region compatibility`（门卫）、`region runtime`（观察/批量/入场/退场幽灵/清理）、`region register`（`__ModuleLoader__.load` + `apply(ctx)`） |
| `test/runtime.test.mjs` | 新增 | jsdom 单测（`node --test` 内置跑器），只依赖 §2 冻结签名 |
| `README.md` / `README.en.md` | 新增 | 中文为主 + 英文；安装方式、效果范围、`data-dsh-transition="off"`、与 dsh-reduce-effects/dsh-theme-studio 的共存说明 |
| `AGENTS.md` | 修改 | 补全「项目地图」小节 |
| `.gitignore`、`LICENSE`、`COMPATIBLE_VERSION` | 新增 | 仓库脚手架 |

**关键接口与数据流**：

> 产物形态：`exports["./client"]` 由宿主按 **classic script** 原样拼进 combo（`buildComboScript` 逐文件 `${source};\n` 拼接），无转译、无强制 sourcemap；顶层 `import`/`export` 会让整段 combo 语法错误（同批其它插件一起失效）。

```
MutationObserver(document.body, { subtree, childList, attributes, attributeOldValue,
  attributeFilter: OBSERVED_ATTRIBUTES })
  │  mutation 记录（子节点插入 = 入场；移除 = 退场候选）
  ▼
classifier.classifyMutation / classifySubtree / classifyRemoval
  │  SurfaceIntent { element, kind, trigger, state }
  ▼
runtime.enqueue → 同帧去重（lastApplied[element][kind] = "trigger:state"）→ rAF 批量 flush
  ▼
compatibility.canAnimate（排除区 / 不可见 / 宿主已有动画 / data-dsh-transition="off"）
  ▼
policy.timing(kind)（读 --ds-transition-* token + clamp + reduced-motion 归零）
  ▼
WAAPI element.animate(keyframesFor(kind, timing, independent), { duration, easing, fill:"both" })
  · 入场 settle 后 cancel() 释放填充态：fill:"both" 若长期生效，会让带 opacity 动画的表面持续充当
    backdrop-root，其内部玻璃层（菜单 .material 的 backdrop-filter）将永久无法采样页面背景
  · 退场：classifyRemoval 定位被删的 dialog(+mask)/menu → cloneNode(true) 幽灵 → prepareGhost
    （aria-hidden + inert + pointer-events:none + 剥 id/aria-* 引用 + tabindex=-1 + backdrop-filter:none）
    → 插回原位置播 exitKeyframesFor → 全部 settle 后移除幽灵
  · 清理：ctx.effect 返回值 → dispose()（断 observer、取消 rAF、cancel 全部动画、删幽灵、删注入样式、还原状态标记）
```

**冻结的签名**（并行 Agent 按此写码，不得自行改动；类型均为普通 JS 对象；所有工厂都在 `client.js` 的 factory 闭包内定义、尾部经 `exports.*` 暴露，文件顶层不得出现 `import`/`export`，函数签名本身不变）：

```js
// 常量
const OBSERVED_ATTRIBUTES = ['hidden','aria-hidden','aria-expanded','open','role','data-slot','data-phase'];
// 语义面（与 dsh-motion 一致的硬排除，前缀改为 dsh-transition）
const HARD_EXCLUSION = '[data-dsh-transition="off"], [data-dsh-transition-ghost], [data-chat-flow],'
  + ' [data-chat-flow-key], [data-streaming], [data-trajectory-scroll], [data-trajectory-row-key],'
  + ' [role="tooltip"], [role="alert"]';
// MotionKind = 'menu' | 'listbox' | 'dialog' | 'mask'
// MotionTrigger = 'mount' | 'visibility'
// SurfaceIntent = { element: HTMLElement, kind: MotionKind, trigger: MotionTrigger, state: string }
// MotionTiming = { durationMs: number, easing: string, distancePx: number, scaleFrom: number, opacityFrom: number }
// MotionTokenSnapshot = { easing: string, fastMs: number, normalMs: number, slowMs: number }

// region policy
function createPolicy(options = {}) // { tokenSource, matchMedia, computedStyle }
  // → { reducedMotion(): boolean, tokens(): MotionTokenSnapshot, timing(kind): MotionTiming,
  //     subscribe(listener: (reduced: boolean) => void): () => void, dispose(): void }

// region classifier
function createClassifier()
  // → { classifyMutation(record: MutationRecord): SurfaceIntent[],
  //     classifySubtree(node: Node): SurfaceIntent[],
  //     classifyRemoval(node: Node): RemovalSurface[] }        // RemovalSurface = { root, surfaces: [{element, kind}] }

// region compatibility
function createCompatibility(options = {}) // { computedStyle }
  // → { canAnimate(el: HTMLElement, kind: MotionKind, ownedAnimations?: ReadonlySet): boolean }

// region runtime
function createMotionRuntime(options = {})
  // options: { root = document, policy, classifier, compatibility, animator, requestFrame, cancelFrame }
  // → { start(): () => void, dispose(): void, enqueue(intent: SurfaceIntent): void }
function keyframesFor(kind, timing, independentTransforms)      // → Keyframe[]（入场）
function exitKeyframesFor(kind, timing, independentTransforms)   // → Keyframe[]（退场镜像）
// 暴露：exports.createPolicy / createClassifier / createCompatibility / createMotionRuntime / keyframesFor / exitKeyframesFor
```

**冻结的时长策略**（取自 motion-complete 定稿值，token 读取 + clamp）：

| kind | token | fallback | clamp | 入场 from |
| --- | --- | --- | --- | --- |
| menu / listbox | `--ds-transition-duration-fast` | 150ms | 120–160ms | opacity 0、`translate 0 -4px`、`scale .98` |
| dialog | `--ds-transition-duration` | 220ms | 160–240ms | opacity 0、`translate 0 12px` |
| mask | `--ds-transition-duration` | 180ms | 140–220ms | opacity 0 |
| （reduced-motion） | — | — | 全部 `durationMs=0` | 跳过动画与幽灵 |

`MotionTiming.distancePx` 取**带符号**的入场位移：menu/listbox `-4`、dialog `12`、mask `0`。`keyframesFor` 直接写入 `translate`，`exitKeyframesFor` 镜像到同一值（实现与单测按此约定）。

缓动：`--ds-ease-in-out`（缺失时 `cubic-bezier(.4,0,.2,1)`）；dialog 用 `cubic-bezier(.22,1,.36,1)`。独立 transform：`CSS.supports('translate','0 1px') && CSS.supports('scale','.98')` 才写 `translate`/`scale` 关键帧，否则退化为 opacity-only；**绝不写 `transform`**（宿主定位属性）。

## 3 开发进度

### 3.1 仓库脚手架与双半区骨架

#### 3.1.1 清单与占位文件

- [x] `package.json`：name `@tak1208/dsh-webui-transition`、version `0.1.0`、`type: module`、`exports`（`.` / `./client` / `./package.json`）、`files`、`description`、`license: MIT`、`dsh.bundle.patch`、`dsh.client{ platform:"web", immediately:true, inject:[] }`、`engines.dsh: ">=0.2.2-alpha.2 <0.3.0"`
- [x] `cordis.patch.yml`：insert 一行 `id: dsh-webui-transition, name: '@tak1208/dsh-webui-transition'`
- [x] `index.js`：`export function apply() {}`
- [x] `.gitignore`（node_modules、AGENTS.local.md、.DS_Store 等）、`LICENSE`（MIT）、`COMPATIBLE_VERSION`（`0.2.2-alpha.2` / 当日日期；待插件代码落地时创建，本轮不创建）
- [x] `AGENTS.md` 补全项目地图（照 dsh 插件仓库常见格式）
- **完成判据**：`node --check index.js` 通过；`pnpm install --ignore-scripts` 无报错（pnpm-lock 生成）；`git commit -m "chore(scaffold): 完成 .plan/webui-transition.md §3.1"`

### 3.2 客户端动效运行时（三路并行，用 Agent Teams：Lead 建 3 个 teammate + 共享任务板，写入范围互不重叠）

#### 3.2.1 Agent A：`client.js` 全量运行时

- [x] region policy：`createPolicy`——读 `--ds-transition-duration(-fast/-slow)` 与 `--ds-ease-in-out`（`getComputedStyle(document.documentElement)`）、`parseCssDuration` + clamp、缓动白名单校验、live `prefers-reduced-motion`（subscribe）
- [x] region classifier：`createClassifier`——mount 分类（`role=menu/listbox/dialog`、dialog 配 mask）、`classifyRemoval`（在删除子树中定位 dialog(+mask)/menu/listbox，按 §2 `RemovalSurface` 输出）、硬排除 + `OBSERVED_ATTRIBUTES`
- [x] region compatibility：`createCompatibility`——排除区/可见性（hidden、aria-hidden 祖先、display:none）/宿主已有动画（`getAnimations()` 未 finished 或 `animation-name` 非 none）三重门卫
- [x] region runtime：`createMotionRuntime`——MutationObserver（attributeOldValue + attributeFilter）、同帧去重、rAF flush、入场 `element.animate(keyframesFor(...), { duration, easing, fill:'both' })`、退场幽灵（clone → `prepareGhost` → 插回原位置 → `exitKeyframesFor` → settle 后移除）、`supportsIndependentTransforms` 降级、`dispose()` 完整清理
- [x] region register：`window.__ModuleLoader__.load({ id: '@tak1208/dsh-webui-transition', factory })`，`factory` 返回 `{ inject: [], apply(ctx) { ctx.effect(() => runtime.start(), 'dsh-webui-transition: runtime') } }`；顶层直接注册（不写「无 window 时跳过注册」分支）；Node 单测先注入 fake `window.__ModuleLoader__`，再动态 import 该文件、从捕获的 factory 取 `exports`
- [x] 注入一张 `<style data-dsh-transition-style>`：仅承载「状态色过渡」等静态规则（可无），随 dispose 移除（宿主不兜底清理插件注入的样式：0.2.1-alpha.1 起只认领 factory 执行期间新增的无主 style，因此 `dispose()` 内 `remove()` 是唯一清理路径）
- **完成判据**：`node --check client.js` 通过；用 fake `window.__ModuleLoader__` 捕获 factory 后取出 `exports`，断言 `createPolicy/createClassifier/createCompatibility/createMotionRuntime/keyframesFor/exitKeyframesFor` 六个函数齐全（不依赖 ESM 具名导出）

#### 3.2.2 Agent B：`test/runtime.test.mjs`

- [x] jsdom 环境装配：`window.__ModuleLoader__` fake（`load: (rec) => { captured = rec }`）、`document.documentElement` 注入 `--ds-transition-duration*` 变量（`style.setProperty`）、`Element.prototype.animate` fake（记录调用并返回可 settle 的假 animation）；单测先注入该 fake，再动态 import `client.js`，从 `captured.factory(...)` 的返回值取 `exports` 断言（不直接取具名导出）
- [x] policy 测试：token 解析与 clamp、非法缓动回退、reduced-motion 下 `timing()` 全零、live 切换触发 subscribe
- [x] classifier 测试：`role=menu` 插入产生 mount intent；dialog+mask 成对；`classifyRemoval` 定位 dialog/mask/menu；排除区（`data-dsh-transition="off"`、`[role="tooltip"]`）不产出
- [x] runtime 测试：同帧去重（同一元素同 kind 只 animate 一次）、退场幽灵 `aria-hidden`/`inert`/`pointer-events:none` 且在 settle 后移除、`dispose()` 后观察器断开且不再 animate、独立 transform 不支持时降级 opacity-only
- [x] 依赖：§2 冻结签名 + Agent A 的 `client.js` 文件名（集成时合并，写码时不读对方文件内容）
- **完成判据**：`node --test` 全绿（Node v24.19 不接受 positional 目录参数，`node --test` 自动发现 `test/*.test.mjs`；jsdom 作为 devDependency 加入 package.json，选当前稳定版并锁定；测试经 fake loader 材料化取 `exports`，不依赖 ESM 具名导出）

#### 3.2.3 Agent C：文档与说明

- [x] `README.md`：调研结论摘要、安装（`plugin_manager install_bundle` 路径 / 发布后 `dsh plugin add @tak1208/dsh-webui-transition`）、效果范围（菜单 + 设置面板）、退出开关 `data-dsh-transition="off"`、reduced-motion 行为、与 dsh-reduce-effects / dsh-theme-studio 共存说明、已知边界（不覆盖宿主已有动画）
- [x] `README.en.md`：英文镜像
- [x] 核对 `README` 与 §1「不做的事」一致，不夸大覆盖面
- **完成判据**：两份 README 齐备、链接有效（相对路径）、`LICENSE` 作者行与 package.json author 一致

### 3.3 集成、测试与首个提交

#### 3.3.1 三路收敛

- [x] 合并 3.2 三个 Agent 的产物；按 §2 签名核对 fake loader 取出的 `exports` 与测试引用一致
- [x] 修复集成差异（先改 plan 再改代码，若有）
- [x] `node --check client.js && node --check index.js && node --test` 全绿
- **完成判据**：全部命令通过；`git commit -m "feat(webui-transition): 实现菜单与设置面板开合动画运行时（.plan/webui-transition.md §3.2–3.3）"`

### 3.4 安装到 web profile 并实机验证

#### 3.4.1 安装 bundle

- [ ] 重装流程：先 `plugin_manager` `action: remove_bundle`，再 `action: install_bundle`，target 为本仓库绝对路径；读返回的 `application` / `warnings` 字段判定结果（不靠日志/进程）——0.2.1-alpha.2 起对已安装包直接安装会返回 `application: "failed"`、`error.code: "already-installed"`，故必须走 remove → install
- [ ] `cordis_inspect_query` 确认插件行已挂载（Config/插件目录可见 `dsh-webui-transition`）
- **完成判据**：`application: applied`，无致命 warning；插件出现在 Settings → 内置插件 清单

#### 3.4.2 实机验证与缺陷修复

- [ ] 用户在 127.0.0.1:3080 的 GUI 中验证：右上设置入口开合有过渡（mask 淡入 + 面板上浮 + 关闭退场）；各处 `role="menu"` 下拉菜单开合有过渡
- [ ] 左栏 / 会话视图 / 右栏「更多」菜单各抽一次开合（0.2.1-rc.3 新增挂载点，同一 Menu 原语，分类器应自然覆盖）
- [ ] 验证 reduced-motion（系统开启「减少动态效果」）下无动画、无残留幽灵节点
- [ ] 控制台无插件报错（无 slot entry crash、无未捕获异常）
- [ ] 发现缺陷即在本插件内修复（不扩大范围）；修复后重新安装验证
- [x] 缺陷修复（2026-10-30，实机检查发现）：入场动画 `fill:"both"` 结束后未释放填充态，`[role="menu"]`（`[data-menu-material]` 表面，即 `.material` 的父级）长期充当 backdrop-root，导致全部 `.material` 的 `--dsw-menu-backdrop-filter` 失效（菜单半透明、模糊消失）。
  - 修复：`applyEntry` 入场动画 settle 时 `cancel()` 释放填充态（对齐 dsh-motion 的 settle 语义）；新增单测「入场动画 settle 后释放填充态，不残留 fill:both 动画」。
  - 验证：无头 Chromium + CDP 连 127.0.0.1:3080 的 0.2.2-alpha.2 GUI —— 修复前菜单区域高清条纹清晰可见（无模糊、红色/蓝色像素各 ~48%），修复后完全模糊（红/蓝 0%）；菜单入场动画正常播放后释放、退场幽灵正常出现并移除、设置面板 mask+panel 动画正常释放，console 无插件异常。
  - 已知边界：受 CSS backdrop-root 约束，带 opacity 的入场动画进行中（约 120–160ms）玻璃层无法采样背景，动画结束后立即恢复；插件不在动画结束后残留任何影响宿主渲染的动画态。
- **完成判据**：用户确认两处动画符合预期；console 干净；卸载（`remove_bundle` 或停用）后界面还原为官方行为

### 3.5 收尾

#### 3.5.1 定稿提交

- [ ] 回填本文档所有勾选框；`git commit -m "docs(webui-transition): 实机验证通过，回填 .plan 进度（§3.4–3.5）"`
- [ ] 视用户需要发布到 npm（`@tak1208` scope）；未获要求则只保留本地仓库
- **完成判据**：工作区干净、plan 全绿、不 push
