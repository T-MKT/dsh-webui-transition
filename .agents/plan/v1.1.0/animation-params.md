# v1.1.0：可调配动画参数（时长 / 初始缩放 / 透明度起点）：代码结构与开发进度

> 本文档是本次编码的真源：确定后直接照着它编码；节点编号在编码期间保持不变（提交信息用它指明完成到哪）。
> 状态：`- [ ]` 未完成 / `- [x]` 已完成。一个最小节点完成 = 其下全部要点已勾选，且「完成判据」成立。
> 版本/分支：`v1.1.0` / `feat/v1.1.0`；基线 dsh `0.2.2-rc.1`（宿主事实按该版本 client 产物核对）。

## 1 需求与范围

**需求**：在设置页新增三个可调配的动画参数——**动画时长（绝对毫秒）**、**初始缩放**、**透明度起点**。每个参数都支持两层：全局默认值 + 按表面组覆盖（菜单与列表 / 对话框 / 遮罩）；分表面有值时优先用局部值，否则跟随全局，全局留空则沿用现有行为（时长读宿主 token，缩放/透明度用 `SURFACE_DEFS` 内置默认）。设置修改即时生效，无需重启；`prefers-reduced-motion`、`data-dsh-transition="off"`、退场幽灵、伪元素玻璃等既有语义全部保持不变。

**不做的事**：

- 不新增缓动曲线、总开关、入场/退场分别设置；本期只做上述三个参数。
- 不修改 `SURFACE_DEFS` 的内置默认值（menu/listbox 150ms、dialog 220ms、mask 180ms、scale 0.98/1、opacity 0）。
- 不拆分菜单与列表：设置里的「菜单与列表」同时作用于内部 `menu` 与 `listbox` 两个 kind。
- 不改动画架构（触发源解析、origin 缓存、退场幽灵、伪元素玻璃、门卫、tracker）。
- 不修改宿主 dsh 源码，不把配置写进宿主 settings（仍是 localStorage）。
- 不做设置 key 版本迁移或旧数据兼容层：key 仍为 `dsh.webui-transition.settings.v1`，新字段缺省即「自动」；旧版本插件写回时会丢掉新字段，这是已知且接受的降级行为。
- 不改 reduced-motion 与 `data-dsh-transition="off"` 的语义。
- 不新增依赖、图标资源或新的源文件；只改现有文件与构建产物。

**关键假设**（与事实不符时先改本节）：

- `@deepseek-ai/dsh-client-ui-primitives` 的 `SegmentedTabs` 与 `SettingsValueField` 在 dsh `0.2.2-alpha.2` 起即存在（已用 npm tarball 的 `lib/types/index.d.ts` 核对 alpha.2 与 rc.2），因此不需要抬高 `engines.dsh`。
- `SettingsValueField` 只透传 `onEdit`（没有 `onBlur` / `onKeyDown`），因此数字输入在组件外层 wrapper 上捕获 blur 与 Enter 再提交。
- 时长 `0` 表示关闭该表面组的过渡动画：runtime 已有 `timing.durationMs > 0` 的门槛，不另加开关。
- 全屏遮罩从 `scale(<1)` 入场会露出页面边缘，因此**全局缩放不作用于遮罩**；遮罩只有显式设置分表面缩放时才缩放（默认固定 1）。
- 设置页每次打开从 localStorage 读取；同标签页靠 Cordis 事件、跨标签页靠 `storage` 事件同步；主插件不需要重建 runtime，policy 在每次 `timing()` 时读取最新设置闭包。
- 两包契约继续各自独立实现、由 `test/contract.test.mjs` 防漂移；设置包不得从根包 `src/` 跨包 import。

## 2 代码结构

### 2.1 目录树

```text
dsh-webui-transition/
├── src/
│   ├── settings.js                          # 修改：契约扩展（三参数 + surfaces + ranges）
│   ├── policy.js                            # 修改：读取设置，计算最终 duration/scale/opacity
│   ├── frames.js                            # 修改：animationSpecsFor 接受 options.timing
│   ├── runtime.js                           # 修改：把 policy.timing 透传给 frames
│   ├── browser.js                           # 修改：createPolicy({ settings }) 并交给 runtime
│   └── defs.js                              # 不变：内置默认值仍是最终兜底
├── packages/dsh-webui-transition-settings/
│   └── src/
│       ├── contract.js                      # 修改：与主包 settings.js 同步
│       ├── settings-page.js                 # 修改：目标 tabs + 三个数字字段
│       └── locale.js                        # 修改：新增文案
├── test/
│   ├── settings.test.mjs                    # 修改：新契约与 clamp
│   ├── contract.test.mjs                    # 修改：两包新契约防漂移
│   ├── policy.test.mjs                      # 修改：覆盖优先级与实时读取
│   ├── frames.test.mjs                      # 修改：options.timing 覆盖
│   ├── runtime.test.mjs                     # 修改：timing 透传到关键帧/动画器
│   ├── settings-page.test.mjs               # 修改：字段交互与同步
│   ├── settings-plugin.test.mjs             # 修改：locale key 清单 + primitives 桩
│   └── bundle.test.mjs                      # 修改：设置产物 require 桩补新组件
├── README.md / README.en.md                 # 修改：设置表、优先级、存储示例
├── packages/dsh-webui-transition-settings/README.md / README.en.md   # 修改：设置项说明
├── locale/{en,zh}.json                      # 修改：插件清单描述
├── packages/dsh-webui-transition-settings/locale/{en,zh}.json        # 修改：插件清单描述
├── AGENTS.md                                # 修改：项目地图中相关文件职责
├── package.json / packages/.../package.json # 修改：版本 1.1.0、描述
├── pnpm-lock.yaml                           # 视 pnpm install 结果而定（版本号变化通常不改 importer）
├── client.js                                # 构建产物（pnpm build 重新生成）
└── packages/dsh-webui-transition-settings/client.js                  # 构建产物
```

### 2.2 文件职责

| 文件 | 新增/修改 | 职责 |
| --- | --- | --- |
| `src/settings.js` | 修改 | 扩展契约：`SURFACE_SETTING_KEYS`、`SETTINGS_RANGES`、新的 `DEFAULT_SETTINGS`、`normalizeSettings` 的逐字段清洗与 clamp、`readSettings` / `writeSettings` 保持原职责。 |
| `src/policy.js` | 修改 | `createPolicy({ settings })`：每次 `timing(kind)` 读取设置快照，按「分表面 → 全局 → token/内置默认」算出 `durationMs` / `scaleFrom` / `opacityFrom`；reduced-motion 仍归零。 |
| `src/frames.js` | 修改 | `animationSpecsFor` 接受 `options.timing`；提供时用它驱动缩放/透明度关键帧，缺省时回退 `SURFACE_DEFS`（现有调用与测试不变）。 |
| `src/runtime.js` | 修改 | `specsFor(element, kind, direction, geometry, timing)`；入场与退场幽灵都把同一个 `policy.timing(kind)` 传给 frames。 |
| `src/browser.js` | 修改 | 用 `createPolicy({ settings: () => settings })` 构造 policy 并传给 runtime；设置事件只更新闭包，不重建 runtime。 |
| `packages/.../src/contract.js` | 修改 | 与 `src/settings.js` 同值、同行为的独立实现（常量、ranges、normalize/read/write）。 |
| `packages/.../src/settings-page.js` | 修改 | 页面结构：回退方式分段控件 + 目标 `SegmentedTabs`（全局/菜单与列表/对话框/遮罩）+ 每个目标三个 `SettingsValueField` 数字字段；留空=自动、失焦/回车提交、重置为自动。 |
| `packages/.../src/locale.js` | 修改 | 新增目标、字段、提示、校验文案（中英同步）。 |
| `test/settings.test.mjs` | 修改 | 新默认形状、逐字段清洗、范围 clamp、坏数据与 storage 异常。 |
| `test/contract.test.mjs` | 修改 | 两包常量、ranges、normalize/read/write 的 deepEqual 与 canonical JSON。 |
| `test/policy.test.mjs` | 修改 | 无设置时行为不变；全局覆盖、分表面覆盖、遮罩缩放例外、0 时长、reduced-motion、settings 函数实时读取。 |
| `test/frames.test.mjs` | 修改 | `options.timing` 覆盖 scale/opacity；缺省时仍读 `SURFACE_DEFS`。 |
| `test/runtime.test.mjs` | 修改 | policy 的 scale/opacity/duration 透传到动画器与关键帧。 |
| `test/settings-page.test.mjs` | 修改 | 目标切换、字段提交/重置/非法值、跨标签同步、缺 `t` 兜底。 |
| `test/settings-plugin.test.mjs` | 修改 | primitives 桩补 `SegmentedTabs` / `SettingsValueField`；locale key 清单更新。 |
| `test/bundle.test.mjs` | 修改 | 设置产物 require 桩补两个新组件；主产物冒烟保持。 |
| `README.md`、`README.en.md` | 修改 | 设置表新增三参数、优先级、范围、遮罩缩放例外、存储 JSON 示例；效果表时长改为「默认约 Xms，可配」。 |
| 设置包 `README.md`、`README.en.md` | 修改 | 设置项表与存储示例同步。 |
| 根/设置包 `locale/{en,zh}.json` | 修改 | 插件清单描述补「可调配动画参数」。 |
| `AGENTS.md` | 修改 | 项目地图中 settings/policy/frames/runtime/browser/settings-page 及测试的职责描述。 |
| `package.json`（两包） | 修改 | 版本 `1.1.0`；描述补参数能力。 |
| `pnpm-lock.yaml` | 可能修改 | 仅当 pnpm 因版本变化更新 lockfile 时提交。 |

### 2.3 数据流

```text
设置页点击/失焦
  → normalizeSettings(next) → localStorage（writeSettings）
  → ctx.emit(SETTINGS_EVENT, next)
  → browser.js 的 settings 闭包更新（storage 事件走 readSettings）
  → 下一次动画：runtime.timingFor(kind) → policy.timing(kind)
      ├─ durationMs / easing → runtime 创建 WAAPI 动画
      └─ scaleFrom / opacityFrom → specsFor → frames.animationSpecsFor(options.timing) → 关键帧
```

- 主插件启动时 `settings = readSettings()`；没有设置插件或没有保存过设置时，`normalizeSettings` 返回全自动默认，行为与 v1.0.0 完全一致。
- `policy.timing(kind)` 是「设置 → 最终参数」的唯一收口；frames 不再直接读设置，只接收 timing。
- 退场幽灵复用入场时的 `timingFor(kind)` 结果；两者天然一致。

### 2.4 冻结的契约与签名

两包各自独立实现以下内容，取值与行为必须完全一致：

```js
export const SETTINGS_KEY = "dsh.webui-transition.settings.v1";
export const SETTINGS_EVENT = "dsh-webui-transition/settings";
export const FALLBACK_MODES = Object.freeze(["fade", "pointer"]);
export const SURFACE_SETTING_KEYS = Object.freeze(["menu", "dialog", "mask"]);

export const SETTINGS_RANGES = Object.freeze({
  durationMs: Object.freeze({ min: 0, max: 1000, decimals: 0 }),
  scaleFrom: Object.freeze({ min: 0.5, max: 1, decimals: 2 }),
  opacityFrom: Object.freeze({ min: 0, max: 1, decimals: 2 }),
});

export const DEFAULT_SETTINGS = Object.freeze({
  fallback: "fade",
  durationMs: null,
  scaleFrom: null,
  opacityFrom: null,
  surfaces: Object.freeze({
    menu: Object.freeze({ durationMs: null, scaleFrom: null, opacityFrom: null }),
    dialog: Object.freeze({ durationMs: null, scaleFrom: null, opacityFrom: null }),
    mask: Object.freeze({ durationMs: null, scaleFrom: null, opacityFrom: null }),
  }),
});

// 始终返回新的完整对象；数字按 ranges 四舍五入并 clamp；非有限数 → null。
export function normalizeSettings(value)
export function readSettings(storage = undefined)
export function writeSettings(settings, storage = undefined)
```

- `normalizeSettings` 逐字段清洗：`fallback` 非法 → `"fade"`；数字字段非法 → `null`；`surfaces` 非对象 → 三组全 `null`；未知表面 key 丢弃。**不因为一个字段非法而清空其它字段。**
- `writeSettings` 写入 `normalizeSettings(settings)` 后的完整 JSON（包含 null 字段），保证两包 canonical JSON 一致。
- 存储形状示例：

```json
{
  "fallback": "fade",
  "durationMs": null,
  "scaleFrom": 0.96,
  "opacityFrom": null,
  "surfaces": {
    "menu": { "durationMs": 120, "scaleFrom": null, "opacityFrom": null },
    "dialog": { "durationMs": null, "scaleFrom": null, "opacityFrom": null },
    "mask": { "durationMs": null, "scaleFrom": null, "opacityFrom": null }
  }
}
```

`src/policy.js`：

```js
export function createPolicy(options = {})
// 新增 option：options.settings —— 对象或返回对象的函数；缺省/异常按无设置处理。
// timing(kind) 返回形状不变：
// { durationMs, easing, scaleFrom, opacityFrom }
//
// 优先级：
// durationMs = surface.durationMs ?? global.durationMs ?? clamp(tokenForKind, def.minMs, def.maxMs)
// scaleFrom  = surface.scaleFrom ?? (def.scaleFrom === 1 ? 1 : global.scaleFrom ?? def.scaleFrom)
// opacityFrom= surface.opacityFrom ?? global.opacityFrom ?? def.opacityFrom
// 用户显式时长不再套用 kind 的 min/max（否则 120–160ms 的 clamp 会让设置失效），
// 只按 SETTINGS_RANGES 的 0–1000ms 校验；reduced-motion 仍在最后把 durationMs 置 0。
// kind 为 listbox 时 surface 组取 menu。
```

`src/frames.js`：

```js
export function animationSpecsFor(surface, kind, direction, independentTransforms, options = {})
// options.computedStyle / options.geometry 保持不变；
// 新增 options.timing：提供时用它作为缩放/透明度起点，缺省回退 SURFACE_DEFS。
```

`src/runtime.js` 内部：

```js
function specsFor(element, kind, direction, geometry, timing)
// animationSpecsFor(..., { ...specOptions, geometry, timing })
```

设置页签名不变：

```js
export function createSettingsPage({ readSettings, writeSettings, emit })
```

### 2.5 设置页 UI 契约（并行前提）

- 目标切换用 `SegmentedTabs`，`value` 取值固定为 `"global" | "menu" | "dialog" | "mask"`；顺序即展示顺序。
- 目标 tab 的 `id = "dsh-webui-transition-target-<value>"`，`panelId = "dsh-webui-transition-panel-<value>"`；面板为 `role="tabpanel"`，`aria-labelledby` 指向对应 tab。
- 字段 `id = "dsh-webui-transition-<target>-<param>"`，`param` 取值 `durationMs` / `scaleFrom` / `opacityFrom`。
- 每个目标显示三个字段；遮罩也显示三个字段（缩放字段的 hint 说明默认 1、全局缩放不作用于遮罩）。
- 字段行为：空字符串 = `null`（自动）；非有限数 → `invalid`、不写、失焦时回退到已存值；有限数 → 按 `SETTINGS_RANGES` 四舍五入并 clamp 后写入；`overridden = value !== null`，显示「已自定义」徽标与「改为自动」重置按钮；Enter 与失焦提交。
- 页面动作全部 try/catch；render 不抛错。
- 新增 locale key（中英同 key 集合）：`nav`、`title`、`description`、`fallbackTitle`、`fallbackFade`、`fallbackPointer`、`hint`、`paramsTitle`、`paramsHint`、`targetGlobal`、`targetMenu`、`targetDialog`、`targetMask`、`duration`、`scale`、`opacity`、`durationHostHint`、`durationGlobalHint`、`scaleDefaultHint`、`scaleGlobalHint`、`scaleMaskHint`、`opacityDefaultHint`、`opacityGlobalHint`、`auto`、`custom`、`useAuto`、`invalidNumber`。
- 字段 hint 映射：全局时长 `durationHostHint`；分表面时长 `durationGlobalHint`；全局缩放 `scaleDefaultHint`；分表面缩放（非遮罩）`scaleGlobalHint`；遮罩缩放 `scaleMaskHint`；全局透明度 `opacityDefaultHint`；分表面透明度 `opacityGlobalHint`。

## 3 开发进度

### 3.0 计划文档入仓（实现前，线性）

#### 3.0.1 单独提交 plan 文档

- [ ] 只 `git add .agents/plan/v1.1.0/animation-params.md`，提交 `docs(plan): v1.1.0 可调配动画参数`；不 push。
- **完成判据**：`git log -1 --name-only` 只显示该文件。

### 3.1 设置契约（线性主干）

#### 3.1.1 扩展两包设置契约

- [ ] `src/settings.js`：新增 `SURFACE_SETTING_KEYS` / `SETTINGS_RANGES`；重写 `DEFAULT_SETTINGS` 与 `defaults()`；`normalizeSettings` 逐字段清洗、四舍五入、clamp；`readSettings` / `writeSettings` 保持原错误兜底。
- [ ] `packages/dsh-webui-transition-settings/src/contract.js`：与主包同值、同行为独立实现，不跨包 import。
- [ ] `test/settings.test.mjs`：更新默认形状与冻结断言；新增 clamp（-50→0、5000→1000、0.9123→0.91、2→1、-1→0）、逐字段恢复（`fallback` 非法但 `durationMs` 合法时保留后者）、`surfaces` 非法/未知 key、canonical JSON。
- [ ] `test/contract.test.mjs`：新增 `SURFACE_SETTING_KEYS` / `SETTINGS_RANGES` 一致断言；normalize/read/write 用例覆盖新字段并验证两包 JSON 文本完全一致。
- **完成判据**：`node --test test/settings.test.mjs test/contract.test.mjs` 通过。

### 3.2 动画参数生效（线性主干）

#### 3.2.1 policy 读取设置并计算最终 timing

- [ ] `src/policy.js`：新增 `options.settings`（对象或函数）；`timing(kind)` 内先 `normalizeSettings` 当前快照；按 §2.4 优先级计算 duration/scale/opacity；`listbox` 映射到 `menu` 组；用户时长绕过 kind clamp；reduced-motion 仍归零。
- [ ] `test/policy.test.mjs`：新增「无设置时行为不变」「全局时长覆盖四类表面」「分表面覆盖优先」「全局缩放不作用于遮罩、遮罩显式覆盖生效」「透明度两层」「0 时长」「reduced-motion 高于设置」「settings 函数实时读取」「非法值回退」用例。
- **完成判据**：`node --test test/policy.test.mjs` 通过。

#### 3.2.2 frames / runtime 透传 timing

- [ ] `src/frames.js`：`animationSpecsFor` 读取 `options.timing`，用其 `scaleFrom` / `opacityFrom` 构造表面帧与子级透明帧；未提供时回退 `SURFACE_DEFS`。
- [ ] `src/runtime.js`：`specsFor` 增加 `timing` 参数；`applyEntry` 与 `playGhost` 把同一个 `timingFor(kind)` 传给 frames。
- [ ] `test/frames.test.mjs`：新增 `options.timing` 覆盖缩放/透明度用例；保留现有默认行为用例。
- [ ] `test/runtime.test.mjs`：新增「policy 的 scale/opacity/duration 透传到动画器与关键帧」用例（装配带 settings 的 policy）。
- **完成判据**：`node --test test/frames.test.mjs test/runtime.test.mjs` 通过。

#### 3.2.3 browser 接线与即时生效

- [ ] `src/browser.js`：`settings` 闭包 + `createPolicy({ settings: () => settings })`；把 policy 传给 `createTransitionRuntime`；事件与 `storage` 监听只更新闭包。
- [ ] `test/bundle.test.mjs`：确认主产物冒烟仍通过（apply / effect 名称 / 事件订阅不变）。
- **完成判据**：`pnpm build && node --test test/bundle.test.mjs` 通过。

### 3.3 设置页 UI（节点内并行，依赖 §3.1 契约与 §2.5 UI 契约）

#### 3.3.1 UI 与测试并行

- [ ] **Agent A**：`packages/dsh-webui-transition-settings/src/settings-page.js` — 按 §2.5 实现目标 tabs、三个数字字段、空值/提交/重置/非法值行为；`.../src/locale.js` — 按 §2.5 的 key 集合补齐中英文案。（依赖：§2.4 契约常量、§2.5 UI 契约）
- [ ] **Agent B**：`test/settings-page.test.mjs` — 更新 primitives 桩（`SegmentedTabs` / `SettingsValueField`），覆盖渲染、目标切换、失焦/Enter 提交、clamp、非法值、重置、跨标签同步、缺 `t`；`test/settings-plugin.test.mjs` — locale key 清单更新、primitives require 桩补齐；`test/bundle.test.mjs` — 设置产物 require 桩补齐。（依赖：§2.5 UI 契约与 locale key 集合）
- **完成判据**：两人收敛后 `pnpm build && node --test test/settings-page.test.mjs test/settings-plugin.test.mjs test/bundle.test.mjs` 通过。

### 3.4 文档、版本与构建产物（线性主干）

#### 3.4.1 文档 + 版本 + 构建 + 全量验证

- [ ] 根 `README.md` / `README.en.md`：设置表新增三参数（范围、默认、含义）；补「全局 + 分表面覆盖、局部优先、留空=自动」；补遮罩缩放例外、0 时长含义、存储 JSON 示例；效果表时长改为「默认约 Xms，可配」。
- [ ] 设置包 `README.md` / `README.en.md`：同步设置项表、优先级与存储示例。
- [ ] 根/设置包 `locale/{en,zh}.json`：插件清单描述补「可调配动画参数」。
- [ ] `AGENTS.md`：项目地图中 `settings.js` / `policy.js` / `frames.js` / `runtime.js` / `browser.js` / `settings-page.js` 与对应测试的职责描述同步。
- [ ] 两包 `package.json`：版本 `1.1.0`、描述补参数能力；根 README 的发布依赖说明改为 `^1.1.0`。
- [ ] 如 `pnpm install` 更新了 `pnpm-lock.yaml`，一并提交。
- [ ] `pnpm build` 重新生成两份 `client.js`；逐条确认产物差异只有预期内容。
- **完成判据**：`pnpm test` 全绿；`git status` 的改动文件 = §2.1 所列文件 + 两份 `client.js`，无其它改动。

### 3.5 提交（线性主干）

#### 3.5.1 一次提交

- [ ] 只 `git add` §3.4 验证过的文件（含构建产物；plan 文档已在 §3.0 单独提交，不混入本次提交）。
- [ ] 一次 Conventional Commits 提交，提交信息 body 注明完成本计划节点（如 `plan: v1.1.0/animation-params.md §3.1–3.4`）；不 push。
- **完成判据**：`git log -1 --stat` 显示单次提交，文件清单与预期一致。
