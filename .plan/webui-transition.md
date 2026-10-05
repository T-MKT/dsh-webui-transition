# dsh-webui-transition：设置面板与菜单开合过渡动画 — 代码结构与开发进度

> 本文档是本次编码的真源：确定后直接照着它编码；节点编号在编码期间保持不变（提交信息用它指明完成到哪）。
> 状态：`- [ ]` 未完成 / `- [x]` 已完成。一个最小节点完成 = 其下全部要点已勾选，且「完成判据」成立。
> 分支：`feat/prepare`（不在 main）。新项目，git 已初始化，未 push。

## 1 需求与范围

**调研结论**（前置调研已定稿，详见对话历史）：无现成可装插件；**借鉴 `bilbillm/dsh-motion` 的运行时架构**（语义分类 + MutationObserver + WAAPI + 成对退场幽灵，MIT），**动效参数借用 `dsh-motion-complete` 里已定稿的数值**（菜单 150ms/`-4px`/`scale(.98)`，对话框 220ms/`12px`，mask 180ms）。`dsh-settings-beautify` 经用户决定不再借鉴。

**需求**：为 DSH Web UI（本机 `0.2.0-rc.2`）补上两处缺失的过渡动画：

1. **各级下拉菜单**（`role="menu"`，包括设置内的模型菜单等）的开合动画：入场淡入 + 上浮，关闭退场镜像。
2. **设置面板**（右上设置入口打开的 `role="dialog"` + mask）的开合动画：mask 淡入、面板淡入上浮；关闭时退场镜像。

实现形态：一个**持久化 Client-only bundle**（与 `dsh-webui-notification-sound` 同构：四文件手写、无构建工具、无第三方运行时依赖），通过 `window.__ModuleLoader__` 注册一个语义动效运行时。

**不做的事**：

- 不做消息入场 / 流式渲染 / 平滑滚动动效（那是 dsh-smooth-stream 等插件的地盘）。
- 不做设置面板内 tab 切换、开关、标签页滑动指示条、工作区折叠等其它表面（dsh-motion 的完整面被有意收窄到「菜单 + 对话框」两处用户点名的地方）。
- 不加设置页、强度滑杆、开关 UI（v1 零配置；唯一退出开关是 `data-dsh-transition="off"` 标记，与 dsh-motion 的 `data-dsh-motion="off"` 同机制）。
- 不修改宿主卸载时序（不学 motion-complete 的 `setTimeout` 延迟卸载补丁）；退场全部走**幽灵副本**。
- 不覆盖宿主已有动画（`canAnimate` 门卫：宿主在播的动画一律跳过）。
- 不修改 dsh 源码、不往 profile 手写 package.json / cordis.patch.yml（安装走 `plugin_manager install_bundle`）。

**关键假设**（已逐条对 0.2.0-rc.2 安装产物核实，与事实不符时先改本节）：

- A1. 菜单语义面：`role="menu"` 位于菜单卡片根元素（`.list`，portal 到 `document.body`，关闭即瞬时卸载）；`role="menuitem"` 为条目。已核：`dsh-web-frontend/dist/assets/index-5SrrfWpU.js`。
- A2. 设置面板语义面：`div[role="presentation"]`（portal 到 body）> `div.mask[aria-hidden="true"]` + `div.panel[role="dialog"][aria-modal="true"][data-shortcut-modal="settings"]`；内容区是 `[data-slot="settings.section"]`。已核：`dsh-client-ui-settings-general/lib/client.js`（`SettingsRoot_module_css`）。设置面板关闭同样是瞬时卸载。
- A3. 动效 token 存在：`--ds-transition-duration: .2s` / `-fast: .1s` / `-slow: .3s`、`--ds-ease-in-out: cubic-bezier(.4,0,.2,1)`，定义于 `dsh-client-ui-theme/lib/client.js`，挂在 `document.documentElement`。
- A4. 菜单/对话框关闭时宿主先卸载、观察者后收到记录 → 退场**必须**用 inert 幽灵副本（克隆 + 播完即删），这正是 dsh-motion 已验证的机制。
- A5. 0.2.x 客户端契约与 0.1.x 同构：`window.__ModuleLoader__.load({ id, factory })`，`apply(ctx)` 内用 `ctx.effect(fn, label)` 注册、返回值做清理。已核：本机已装 `dsh-ui-appearance` / `@dingyi222666/dsh-session-notification` 的 `lib/client.js`。
- A6. 本插件不注册任何 slot、不渲染组件——「给宿主菜单加动画」没有可承载的 slot；纯观察 + WAAPI 是生态先例（dsh-motion、dsh-reduce-effects、dsh-force-motion 同形态）。所有资源（observer、style、listener）都在 `ctx.effect` 内注册并随卸载清理。

## 2 代码结构

```text
dsh-webui-transition/
├── .plan/
│   └── webui-transition.md            # 本文档
├── AGENTS.md                          # 项目指南（补全项目地图）
├── .gitignore                         # 忽略 node_modules、AGENTS.local.md 等
├── LICENSE                            # MIT
├── COMPATIBLE_VERSION                 # 第一行：0.2.0-rc.2；第二行：检查日期
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
| `package.json` | 新增 | `@tak1208/dsh-webui-transition`；`dsh.bundle.patch` + `dsh.client{ platform:"web", immediately:true, inject:[] }`；`exports` 出 `.` 与 `./client` |
| `cordis.patch.yml` | 新增 | `- insert: - id: dsh-webui-transition, name: '@tak1208/dsh-webui-transition'` |
| `index.js` | 新增 | Host 半区 `export function apply() {}` |
| `client.js` | 新增 | 浏览器半区，单文件按 5 个 region 分区：`region policy`（token/reduced-motion/时长策略）、`region classifier`（DOM→意图）、`region compatibility`（门卫）、`region runtime`（观察/批量/入场/退场幽灵/清理）、`region register`（`__ModuleLoader__.load` + `apply(ctx)`）；同时 `export` 运行时工厂供 Node 单测导入 |
| `test/runtime.test.mjs` | 新增 | jsdom 单测（`node --test` 内置跑器），只依赖 §2 冻结签名 |
| `README.md` / `README.en.md` | 新增 | 中文为主 + 英文；安装方式、效果范围、`data-dsh-transition="off"`、与 dsh-reduce-effects/dsh-theme-studio 的共存说明 |
| `AGENTS.md` | 修改 | 补全「项目地图」小节 |
| `.gitignore`、`LICENSE`、`COMPATIBLE_VERSION` | 新增 | 仓库脚手架 |

**关键接口与数据流**：

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
  · 退场：classifyRemoval 定位被删的 dialog(+mask)/menu → cloneNode(true) 幽灵 → prepareGhost
    （aria-hidden + inert + pointer-events:none + 剥 id/aria-* 引用 + tabindex=-1 + backdrop-filter:none）
    → 插回原位置播 exitKeyframesFor → 全部 settle 后移除幽灵
  · 清理：ctx.effect 返回值 → dispose()（断 observer、取消 rAF、cancel 全部动画、删幽灵、删注入样式、还原状态标记）
```

**冻结的签名**（并行 Agent 按此写码，不得自行改动；类型均为普通 JS 对象）：

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
export function createPolicy(options = {}) // { tokenSource, matchMedia, computedStyle }
  // → { reducedMotion(): boolean, tokens(): MotionTokenSnapshot, timing(kind): MotionTiming,
  //     subscribe(listener: (reduced: boolean) => void): () => void, dispose(): void }

// region classifier
export function createClassifier()
  // → { classifyMutation(record: MutationRecord): SurfaceIntent[],
  //     classifySubtree(node: Node): SurfaceIntent[],
  //     classifyRemoval(node: Node): RemovalSurface[],        // RemovalSurface = { root, surfaces: [{element, kind}] }
  //     isMenuContentSurface(el: HTMLElement): boolean }

// region compatibility
export function createCompatibility(options = {}) // { computedStyle }
  // → { canAnimate(el: HTMLElement, kind: MotionKind, ownedAnimations?: ReadonlySet): boolean }

// region runtime
export function createMotionRuntime(options = {})
  // options: { root = document, policy, classifier, compatibility, animator, requestFrame, cancelFrame }
  // → { start(): () => void, dispose(): void, enqueue(intent: SurfaceIntent): void }
export function keyframesFor(kind, timing, independentTransforms)      // → Keyframe[]（入场）
export function exitKeyframesFor(kind, timing, independentTransforms)   // → Keyframe[]（退场镜像）
```

**冻结的时长策略**（取自 motion-complete 定稿值，token 读取 + clamp）：

| kind | token | fallback | clamp | 入场 from |
| --- | --- | --- | --- | --- |
| menu / listbox | `--ds-transition-duration-fast` | 150ms | 120–160ms | opacity 0、`translate 0 -4px`、`scale .98` |
| dialog | `--ds-transition-duration` | 220ms | 160–240ms | opacity 0、`translate 0 12px` |
| mask | `--ds-transition-duration` | 180ms | 140–220ms | opacity 0 |
| （reduced-motion） | — | — | 全部 `durationMs=0` | 跳过动画与幽灵 |

缓动：`--ds-ease-in-out`（缺失时 `cubic-bezier(.4,0,.2,1)`）；dialog 用 `cubic-bezier(.22,1,.36,1)`。独立 transform：`CSS.supports('translate','0 1px') && CSS.supports('scale','.98')` 才写 `translate`/`scale` 关键帧，否则退化为 opacity-only；**绝不写 `transform`**（宿主定位属性）。

## 3 开发进度

### 3.1 仓库脚手架与双半区骨架

#### 3.1.1 清单与占位文件

- [ ] `package.json`：name `@tak1208/dsh-webui-transition`、version `0.1.0`、`type: module`、`exports`（`.` / `./client` / `./package.json`）、`files`、`description`、`license: MIT`、`dsh.bundle.patch`、`dsh.client{ platform:"web", immediately:true, inject:[] }`
- [ ] `cordis.patch.yml`：insert 一行 `id: dsh-webui-transition, name: '@tak1208/dsh-webui-transition'`
- [ ] `index.js`：`export function apply() {}`
- [ ] `.gitignore`（node_modules、AGENTS.local.md、.DS_Store 等）、`LICENSE`（MIT）、`COMPATIBLE_VERSION`（`0.2.0-rc.2` / 当日日期）
- [ ] `AGENTS.md` 补全项目地图（照兄弟仓库 `dsh-webui-notification-sound/AGENTS.md` 格式）
- **完成判据**：`node --check index.js` 通过；`pnpm install --ignore-scripts` 无报错（pnpm-lock 生成）；`git commit -m "chore(scaffold): 完成 .plan/webui-transition.md §3.1"`

### 3.2 客户端动效运行时（三路并行，用 Agent Teams：Lead 建 3 个 teammate + 共享任务板，写入范围互不重叠）

#### 3.2.1 Agent A：`client.js` 全量运行时

- [ ] region policy：`createPolicy`——读 `--ds-transition-duration(-fast/-slow)` 与 `--ds-ease-in-out`（`getComputedStyle(document.documentElement)`）、`parseCssDuration` + clamp、缓动白名单校验、live `prefers-reduced-motion`（subscribe）
- [ ] region classifier：`createClassifier`——mount 分类（`role=menu/listbox/dialog`、dialog 配 mask）、`classifyRemoval`（在删除子树中定位 dialog(+mask)/menu/listbox，按 §2 `RemovalSurface` 输出）、`isMenuContentSurface`、硬排除 + `OBSERVED_ATTRIBUTES`
- [ ] region compatibility：`createCompatibility`——排除区/可见性（hidden、aria-hidden 祖先、display:none）/宿主已有动画（`getAnimations()` 未 finished 或 `animation-name` 非 none）三重门卫
- [ ] region runtime：`createMotionRuntime`——MutationObserver（attributeOldValue + attributeFilter）、同帧去重、rAF flush、入场 `element.animate(keyframesFor(...), { duration, easing, fill:'both' })`、退场幽灵（clone → `prepareGhost` → 插回原位置 → `exitKeyframesFor` → settle 后移除）、`supportsIndependentTransforms` 降级、`dispose()` 完整清理
- [ ] region register：`window.__ModuleLoader__.load({ id: '@tak1208/dsh-webui-transition', factory })`，`factory` 返回 `{ inject: [], apply(ctx) { ctx.effect(() => runtime.start(), 'dsh-webui-transition: runtime') } }`；Node 环境（无 window）跳过注册但仍导出工厂
- [ ] 注入一张 `<style data-dsh-transition-style>`：仅承载「状态色过渡」等静态规则（可无），随 dispose 移除
- **完成判据**：`node --check client.js` 通过；`node -e "import('./client.js').then(m => { ['createPolicy','createClassifier','createCompatibility','createMotionRuntime','keyframesFor','exitKeyframesFor'].forEach(k => { if (typeof m[k] !== 'function') throw new Error(k) }) })"` 通过（§2 冻结签名齐全）

#### 3.2.2 Agent B：`test/runtime.test.mjs`

- [ ] jsdom 环境装配：`window.__ModuleLoader__` fake、`document.documentElement` 注入 `--ds-transition-duration*` 变量（`style.setProperty`）、`Element.prototype.animate` fake（记录调用并返回可 settle 的假 animation）
- [ ] policy 测试：token 解析与 clamp、非法缓动回退、reduced-motion 下 `timing()` 全零、live 切换触发 subscribe
- [ ] classifier 测试：`role=menu` 插入产生 mount intent；dialog+mask 成对；`classifyRemoval` 定位 dialog/mask/menu；排除区（`data-dsh-transition="off"`、`[role="tooltip"]`）不产出
- [ ] runtime 测试：同帧去重（同一元素同 kind 只 animate 一次）、退场幽灵 `aria-hidden`/`inert`/`pointer-events:none` 且在 settle 后移除、`dispose()` 后观察器断开且不再 animate、独立 transform 不支持时降级 opacity-only
- [ ] 依赖：§2 冻结签名 + Agent A 的 `client.js` 文件名（集成时合并，写码时不读对方文件内容）
- **完成判据**：`node --test test/` 全绿（jsdom 作为 devDependency 加入 package.json，版本与兄弟仓库一致）

#### 3.2.3 Agent C：文档与说明

- [ ] `README.md`：调研结论摘要、安装（`plugin_manager install_bundle` 路径 / 发布后 `dsh plugin add @tak1208/dsh-webui-transition`）、效果范围（菜单 + 设置面板）、退出开关 `data-dsh-transition="off"`、reduced-motion 行为、与 dsh-reduce-effects / dsh-theme-studio 共存说明、已知边界（不覆盖宿主已有动画）
- [ ] `README.en.md`：英文镜像
- [ ] 核对 `README` 与 §1「不做的事」一致，不夸大覆盖面
- **完成判据**：两份 README 齐备、链接有效（相对路径）、`LICENSE` 作者行与 package.json author 一致

### 3.3 集成、测试与首个提交

#### 3.3.1 三路收敛

- [ ] 合并 3.2 三个 Agent 的产物；按 §2 签名核对 `client.js` 导出与测试引用一致
- [ ] 修复集成差异（先改 plan 再改代码，若有）
- [ ] `node --check client.js && node --check index.js && node --test` 全绿
- **完成判据**：全部命令通过；`git commit -m "feat(webui-transition): 实现菜单与设置面板开合动画运行时（.plan/webui-transition.md §3.2–3.3）"`

### 3.4 安装到 web profile 并实机验证

#### 3.4.1 安装 bundle

- [ ] `plugin_manager` `action: install_bundle`，target 为本仓库绝对路径；读返回的 `application` / `warnings` 字段判定结果（不靠日志/进程）
- [ ] `cordis_inspect_query` 确认插件行已挂载（Config/插件目录可见 `dsh-webui-transition`）
- **完成判据**：`application: applied`，无致命 warning；插件出现在 Settings → 内置插件 清单

#### 3.4.2 实机验证与缺陷修复

- [ ] 用户在 127.0.0.1:3080 的 GUI 中验证：右上设置入口开合有过渡（mask 淡入 + 面板上浮 + 关闭退场）；各处 `role="menu"` 下拉菜单开合有过渡
- [ ] 验证 reduced-motion（系统开启「减少动态效果」）下无动画、无残留幽灵节点
- [ ] 控制台无插件报错（无 slot entry crash、无未捕获异常）
- [ ] 发现缺陷即在本插件内修复（不扩大范围）；修复后重新安装验证
- **完成判据**：用户确认两处动画符合预期；console 干净；卸载（`remove_bundle` 或停用）后界面还原为官方行为

### 3.5 收尾

#### 3.5.1 定稿提交

- [ ] 回填本文档所有勾选框；`git commit -m "docs(webui-transition): 实机验证通过，回填 .plan 进度（§3.4–3.5）"`
- [ ] 视用户需要发布到 npm（`@tak1208` scope）；未获要求则只保留本地仓库
- **完成判据**：工作区干净、plan 全绿、不 push
