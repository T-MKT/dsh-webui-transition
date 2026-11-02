# dsh-webui-transition：计划基线迁移到 dsh 0.2.2-alpha.2

> **历史标记**：本文档属于 v0.1.0 计划（dsh 版本基线迁移记录），仅作为版本基线证据保留，不再作为开发依据；v0.2.0 起的唯一开发真源是 `.plan/v0.2.0/plan-b-rewrite.md`（基线仍为 dsh `0.2.2-alpha.2`）。

> 本文档是 `/plugin-compatible-check` 的产出：只修正「计划文档对 dsh 的事实描述与契约」，不写插件代码。
> 执行完本文档后，`.plan/webui-transition.md` 即视为基于 `0.2.2-alpha.2` 编写，可照原 §3 开工。
> 状态：`- [ ]` 未完成 / `- [x]` 已完成；节点编号在本次迁移内保持不变。
> 分支：`dsh-e80307a0-6652`（git worktree，非 main；不 push）。

## 1 需求与范围

**需求**：检查对象是 `.plan/webui-transition.md`（仓库尚无任何插件代码）。该计划写于 `dsh 0.2.0-rc.2`，
当前安装已升到 `dsh 0.2.2-alpha.2`。本迁移把计划里所有「按 0.2.0-rc.2 已核实」的版本基线、证据路径与
一处会直接导致插件不生效的产物形态缺陷，修正到 0.2.2-alpha.2 的事实上。

**不做的事**：

- 不写、不改插件代码（`client.js`、`package.json` 等尚不存在；本文件 §2 只冻结写法约束，供编码时遵守）。
- 不修改 `dsh` 源码；不安装 plugin；不实机验证（留到原计划 §3.4）。
- 不创建 `COMPATIBLE_VERSION`（用户决定：等插件代码落地、原计划 §3.1.1 执行时再建）。
- 不改动原计划的功能范围、动效参数（时长/位移/缓动）与 §3 节点划分，只改事实与契约描述。

**关键假设**（与事实不符时先改本节）：

- 当前安装 = `0.2.2-alpha.2`（`$D/package.json`，`$D = <npm 全局>/@deepseek-ai/dsh`）；记录基线 `0.2.0-rc.2`
  只出现在计划文档与 `AGENTS.md` 中（仓库无 `COMPATIBLE_VERSION` 文件，无法机器比对）。
- 0.3.0 之前客户端契约不再变；dsh 再升级需重跑 `/plugin-compatible-check`。
- 本迁移只保证「计划里的契约与事实正确」；动画是否被宿主已有动效覆盖，由原计划 §3.4 实机验证判定。

## 2 代码结构（本次只改文档）

```text
dsh-webui-transition/（worktree 根）
├── .plan/
│   ├── webui-transition.md            # 修改：版本基线、证据、产物形态、安装流程、裁剪
│   └── compatible-with-0.2.2-alpha.2.md  # 新增：本文档
├── AGENTS.md                          # 修改：兼容 dsh 版本行
└── （其余文件均为原计划 §3.1 之后才新增，本次不动）
```

| 文件 | 新增/修改 | 职责 |
| --- | --- | --- |
| `.plan/compatible-with-0.2.2-alpha.2.md` | 新增 | 本迁移计划 |
| `.plan/webui-transition.md` | 修改 | 按 §3.1–§3.5 逐条改 |
| `AGENTS.md` | 修改 | 第 6 行版本号 |

**关键接口与数据流**（本检查的结论，编码时是前提）：

- 客户端插件注册：`window.__ModuleLoader__.load({ id, factory })`，factory 返回的 `exports` 提供 `inject`/`apply`，
  `apply(ctx)` 内用 `ctx.effect(fn, label)` 注册清理。**0.2.2-alpha.2 未变**。
- 产物形态：每个 client 包的 `exports["./client"]` 原样作为 **classic script** 被拼进 combo 脚本
  （`buildComboScript`：逐文件 `${source};\n` 拼接，无转译；`host-webserver` 的 `script-src` = classic script）。
  **顶层 `import`/`export` 会让整段 combo 语法错误（同批其它插件一起失效）**。
- 清单：`dsh.bundle.patch`（string|string[]）、`dsh.client{platform, inject?, immediately?, external?}` 未变；
  `exports["./client"]` 必须存在且指向 classic 文件；无 `.map` 也可运行。
- 宿主稳定面（0.2.2 均仍在）：`role="menu"`/`menuitem`、`role="dialog"`+`[data-shortcut-modal="settings"]`、
  `:root` 的 `--ds-transition-duration{,-fast,-slow}` 与 `--ds-ease-in-out`、`modalSelector` 同款选择器。

**冻结的写法约束（§3.2 编码时按此，不得再改回 ESM 顶层导出）**：

- `client.js` 是 classic script：顶层只允许 `window.__ModuleLoader__.load({ id, factory: (require) => { …; return module.exports } })`；
  运行时工厂函数定义在 factory 闭包内，用 `exports.createPolicy = …` 等暴露；文件顶层不得出现 `import`/`export`。
- 单测：先 `globalThis.window = { __ModuleLoader__: { load: (rec) => captured = rec } }`，再 `await import('./client.js')`，
  从 `captured.factory` 取出 exports 断言；不再直接 `import` 文件的具名导出。
- `package.json`：`dsh.bundle.patch` 为字符串、`dsh.client{platform:"web", immediately:true, inject:[]}`、
  `exports["./client"]` 指向该 classic 文件、新增 `engines.dsh: ">=0.2.2-alpha.2 <0.3.0"`。
  （`dsh-app-boot` 用 `semver.satisfies(runtime, range, { includePrerelease: true })`；声明了 `engines.dsh`
  就只按它判定、忽略 `peerDependencies`。范围写成上述形式可覆盖 0.2.x 的预发布版。）

## 3 开发进度

### 3.1 版本基线：计划文档与 AGENTS.md 从 0.2.0-rc.2 → 0.2.2-alpha.2

#### 3.1.1 改掉四处版本号与 COMPATIBLE_VERSION 注释

- [x] `.plan/webui-transition.md:11`（「本机 `0.2.0-rc.2`」）
- [x] `.plan/webui-transition.md:27`（「已逐条对 0.2.0-rc.2 安装产物核实」）
- [x] `.plan/webui-transition.md:45`（文件树注释：第一行 `0.2.2-alpha.2`；加一句「文件待代码落地时创建」）
- [x] `.plan/webui-transition.md:148`（§3.1.1 清单项：`0.2.2-alpha.2` / 当日日期，但本轮不创建文件）
- [x] `AGENTS.md:6`（`当前项目兼容 dsh 版本：0.2.2-alpha.2`）
- **完成判据**：`grep -n '0\.2\.0-rc\.2' .plan/webui-transition.md AGENTS.md` 无输出。

### 3.2 客户端产物形态修正（阻断性：不改则插件不生效）

#### 3.2.1 计划 §2/§3.2 改为 classic script 产物

- [x] §2 文件职责 `client.js`：删「同时 `export` 运行时工厂供 Node 单测导入」，改为
      「classic script；工厂内定义、`exports.*` 暴露；单测经 fake `window.__ModuleLoader__` 捕获 factory」
- [x] §2 冻结签名：所有 `export function` 改为 factory 闭包内函数 + `exports.*`（函数签名本身不变）
- [x] §2 数据流：注明「client 产物由宿主按 classic script 拼进 combo（`${source};\n`），无转译、无强制 sourcemap」
- [x] §3.2.1 `region register` 要点：删「Node 环境（无 window）跳过注册但仍导出工厂」，改为
      「顶层直接注册；Node 单测先注入 fake `window` 再 import 该文件」
- [x] §3.2.1 完成判据：`node --check client.js` + fake loader 捕获 factory 后断言
      `createPolicy/createClassifier/createCompatibility/createMotionRuntime/keyframesFor/exitKeyframesFor` 齐全
- [x] §3.2.2 测试装配/完成判据：删 `import('./client.js')` 直接取具名导出的写法，改 fake-loader 材料化
- [x] §3.3.1 验证命令同步（`node --check` 保留，去掉依赖 ESM 导出的断言）
- **完成判据**：`grep -n "export function createPolicy\|import('./client.js')" .plan/webui-transition.md` 无输出；
      §2/§3.2 不再要求 ESM 顶层导出。

### 3.3 宿主事实与证据更新（对应计划 §1 A1–A5）

#### 3.3.1 A1 菜单证据更新

- [x] 证据文件 `index-5SrrfWpU.js` → `dsh-web-frontend/dist/assets/index--TtJvO-i.js`
- [x] 补「menu 根 `role="menu"` + `_list_li7ht_7`；关闭是 `open && <Menu>` 条件渲染（瞬时卸载）；
      portal 与否取决菜单 portal 模式；`_list_/._submenu_` 无任何 transition/animation（宿主仍无菜单动效）」

#### 3.3.2 A2 设置面板证据更新

- [x] 补「0.2.2 设置面板由 `dsh-client-ui-settings-general` 自有 overlay 渲染：
      `.overlay[role="presentation"]` > `.mask[aria-hidden="true"]` + `.panel[data-shortcut-modal="settings"][role="dialog"][aria-modal="true"]`；
      **当前完全无入/退场动画**（不复用通用 Modal 的 `modalEnter` 入场），内容区 `renderSlot("settings.section")`」
- [x] 补「0.2.2 起面板内部 `.content` 包裹层移除、`.panel` 改 grid；动画只挂外层 overlay/mask/panel，不受影响」

#### 3.3.3 A3/A5 与宿主现状补全

- [x] A3 补「0.2.2 token 仍在 `:root`（`dsh-client-ui-theme` base.css），值未变」
- [x] A5 证据改为官方包：`dsh-client-modules/lib/client.js`（`__ModuleLoader__.load` 入口）+
      `dsh-client-ui-theme/lib/client.js`（`exports.inject/apply`、`ctx.effect(fn, label)`）；
      保留本 profile 已装第三方 `dsh-ui-appearance@0.1.17` 的 `ctx.effect` 用法作旁证；
      删掉对已不存在仓库 `dsh-webui-notification-sound` 的引用
- [x] 新增「0.2.2 宿主动效现状」一段：菜单无动效；宿主 WAAPI 仅 chunked-list FLIP（带 reduced-motion 守卫）；
      `@starting-style` 已用于 hover preview 与右栏首开（`dsh-client-ui-sidebar-right` 的
      `[data-sidebar-right-opening]` + `--ds-transition-duration-slow`）；`role="listbox"` 与硬排除属性
      （`data-chat-flow`/`data-streaming`/`data-trajectory-*`/`role=tooltip|alert`）仍在
- **完成判据**：`grep -n 'index-5SrrfWpU\|dsh-webui-notification-sound' .plan/webui-transition.md` 无输出；
      §1 每条 A1–A5 都能指到 0.2.2 安装产物。

### 3.4 安装流程与兼容声明（用户已选纳入）

#### 3.4.1 重装流程、engines.dsh、样式自清理

- [x] §3.4.1：重装改为 `remove_bundle` → `install_bundle`（0.2.1-alpha.2 起对已安装包直接安装返回
      `application: "failed"`、`error.code: "already-installed"`）
- [x] §3.4.2 实机验证清单加一项：左栏/会话视图/右栏「更多」菜单各抽一次开合（0.2.1-rc.3 新增挂载点，
      同一 Menu 原语，分类器应自然覆盖）
- [x] §3.1.1 `package.json` 清单与 §2 文件职责：加入 `engines.dsh: ">=0.2.2-alpha.2 <0.3.0"`
- [x] §3.2.1 注入 `<style>` 条款补理由：宿主不兜底清理插件注入的样式（0.2.1-alpha.1 起只认领 factory 执行期间
      新增的无主 style），因此 `dispose()` 内 `remove()` 是唯一清理路径（原计划已是此设计，只补依据）
- **完成判据**：`grep -n 'engines.dsh\|already-installed\|remove_bundle' .plan/webui-transition.md` 均有命中。

### 3.5 计划裁剪（用户已定）

#### 3.5.1 删除 isMenuContentSurface（需求外实现）

- [x] §2 冻结签名删除 `isMenuContentSurface(el: HTMLElement): boolean`
- [x] §3.2.1 `region classifier` 要点删除对应实现要求
- [x] §3.2.2 测试要点确认无引用（本无）
- **完成判据**：`grep -n 'isMenuContentSurface' .plan/webui-transition.md` 无输出（本迁移文档自身需记录「删除该函数」，不参与该判据）。

### 3.6 收尾

#### 3.6.1 一致性复核与提交

- [x] 重跑 4 条关键证据命令，确认结论仍成立：dsh 版本、`:root` token、settings overlay DOM、classic 脚本拼接
- [x] `git add .plan AGENTS.md && git commit -m "docs(compatible): 计划基线迁移到 dsh 0.2.2-alpha.2（.plan/compatible-with-0.2.2-alpha.2.md §3.1–3.5）"`
- **完成判据**：工作区干净，`git log -1` 命中；计划文档无 0.2.0-rc.2 残留、无 ESM 导出要求。

## 4 检查证据（本机 0.2.2-alpha.2，供复核）

`$D = /home/axkj/.nvm/versions/node/v24.19.0/lib/node_modules/@deepseek-ai/dsh`

| 结论 | 证据 |
| --- | --- |
| 客户端注册契约未变 | `$D/node_modules/@deepseek-ai/dsh-client-modules/lib/client.js`（`window.__ModuleLoader__.load({ id, factory })`）；`…/dsh-client-ui-theme/lib/client.js`（`exports.inject/apply`、`ctx.effect(…)`） |
| factory 返回 exports | `…/dsh-client-ui-theme/lib/client.js` 尾部 `exports.apply = apply; exports.inject = inject; return module.exports` |
| client 产物 = classic script | `…/dsh-host-webserver/lib/types/injections.d.ts`（`script-src`「External classic script」）；`…/dsh-host-webserver/lib/index.js`（渲染 `<script src="…">`，无 `type`）；`…/dsh-client-modules/lib/index.js` 的 `buildComboScript()`（`source += \`${prepareSource(r).source};\n\``） |
| `dsh.bundle.patch`/`dsh.client` 未变 | `…/dsh-app-boot/lib/index.js` `bundlePatchFiles()`；`…/dsh-package-manifest/lib/types/types.d.ts`（`DshBundleManifest`/`DshClientManifest`）；先例 `~/.dsh/profiles/web/node_modules/dsh-custom-css/package.json` |
| `engines.dsh` 规则 | `…/dsh-app-boot/lib/index.js` `unmetRequirements()`/`evaluatePluginCompatibility()`：own `engines.dsh` 单独判定、`includePrerelease: true` |
| 已安装包不可重复安装 | `…/dsh-plugin-manager/lib/types/tools.js` `ERROR_STEPS['already-installed']`：先 `remove_bundle` 再 `install_bundle` |
| A3 token | `…/dsh-client-ui-theme/lib/client.js`：`:root{…--ds-ease-in-out:cubic-bezier(.4, 0, .2, 1);--ds-transition-duration:.2s;--ds-transition-duration-fast:.1s;--ds-transition-duration-slow:.3s…}` |
| A2 设置面板 | `…/dsh-client-ui-settings-general/lib/client.js`：`{open && jsx(SettingsPanel…)}`、`createPortal(…, document.body)`、`overlay[role="presentation"]`/`mask[aria-hidden]`/`panel[data-shortcut-modal="settings"][role="dialog"][aria-modal="true"]`、`renderSlot("settings.section")`；CSS `VOzbGW_panel` 无 animation/transition |
| A1 菜单 | `$D/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/index--TtJvO-i.js`：`Z1` 菜单面板 `role:"menu"`、`De.list`、关闭 `e && …`、`g ? createPortal(Z, document.body) : Z`；`index-Jtzf36XE.css` 的 `_list_li7ht_7`/`_submenu_li7ht_8` 无 transition |
| 宿主现状 | 同上 CSS：`_dialog_14mp3_33{animation:_modalEnter_14mp3_1 …}`；`.animate(` 仅 2 处（chunked-list，`prefers-reduced-motion` 守卫）；`dsh-client-ui-sidebar-right/lib/client.js` 的 `@starting-style`/`[data-sidebar-right-opening]` |

**建议的验证**（原计划开工后）：

1. `node --check client.js` 通过；单测经 fake loader 材料化后 6 个工厂齐全。
2. `plugin_manager install_bundle` 后返回 `application: "applied"`（或按 `restartReason` 重启）。
3. GUI 实测：设置面板开合、各处 `role="menu"`（含新增「更多」菜单）开合、reduced-motion 下无动画无幽灵残留、
   console 干净；`remove_bundle`/停用后界面还原。
