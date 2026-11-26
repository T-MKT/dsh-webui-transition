# v1.2.0：设置改为插件详情页内嵌（并入单一插件）：代码结构与开发进度

> 本文档是本次编码的真源：确定后直接照着它编码；节点编号在编码期间保持不变（提交信息用它指明完成到哪）。
> 状态：`- [ ]` 未完成 / `- [x]` 已完成。一个最小节点完成 = 其下全部要点已勾选，且「完成判据」成立。
> 版本/分支：`v1.2.0` / `feat/v1.2.0`；基线 dsh `0.2.2-rc.1`（宿主事实按 0.2.2-rc.1 与 0.2.3-alpha.2 的 client 产物核对）。

## 1 需求与范围

**需求**：设置表单不再出现在 Settings 侧栏，只作为**插件管理里 `@tak1208/dsh-webui-transition` 详情页的内嵌配置区**（`plugins.bundle.config`，key = 包名）。同时废弃独立的 `@tak1208/dsh-webui-transition-settings` 包与其插件行：设置页实现并入根包唯一的 client 插件，仓库回到单包。

**不做的事**：

- 不改设置契约：key 仍是 `dsh.webui-transition.settings.v1`，字段、清洗、clamp、优先级、`storage` 与 Cordis 事件同步方式全部不变。
- 不改动画语义（原点感知、退场幽灵、伪元素玻璃、门卫、reduced-motion、`data-dsh-transition="off"`）。
- 不注册 `settings.section` / `settings.section.icon`；不做设置页的只读态、禁用态或权限控制。
- 不为旧设置包提供兼容层：不保留第二行 patch、不保留 `packages/` 骨架、不做 localStorage 迁移（key 未变，无需迁移）。
- 不改设置面板中心原点打标（`data-dsh-transition-origin="center"`）行为，只搬家。
- 不重设计设置页内部布局（标题 / 说明 / 控件沿用现有实现）。
- 不修改 dsh 源码；不抬高 `engines.dsh`。
- 不做发布动作（只到提交，不 push、不 publish）。

**关键假设**（与事实不符时先改本节）：

- `plugins.bundle.config` 是 keyed slot，key 必须等于插件管理里列出的 bundle 包名；条目只在 bundle 详情页渲染，`view` 恒为 `page`。
- dsh `0.2.2-rc.1` 的 plugin-manager 产物已包含 `plugins.bundle.config` 的 key 集合与渲染（已用 npm tarball 核对），因此本改动不改变兼容下限。
- slot 注册的 `locale` 选项会向组件注入 `t`（原 `settings.section` 与 dsh 官方 Timeline 都依赖它）；页面仍保留 `props.t` 缺失时的恒等兜底。
- 产物改成 cjs + `__ModuleLoader__.load({ factory: (require) => … })` 包装后，shell 仍能解析 `react` 与 `@deepseek-ai/dsh-client-ui-primitives`（原设置包产物即此形态，属 baseline 共享模块）。
- 本机 profile `web` 以 `link:` 方式安装本仓库根包；`pnpm build` 后刷新 GUI 页面即可验证，无需重新安装。

## 2 代码结构

### 2.1 目录树（改后）

```text
dsh-webui-transition/
├── src/                                      # ESM 源码（esbuild 入口：src/browser.js）
│   ├── defs.js / utils.js / policy.js / tracker.js / gate.js / origin.js / frames.js / runtime.js   # 不变
│   ├── settings.js                           # 不变：设置契约（唯一实现，跨包防漂移测试随之删除）
│   ├── settings-page.js                      # 新增（迁移自设置包）：createSettingsPage 组件
│   ├── settings-locale.js                    # 新增（迁移自设置包 locale.js）：NS + zh/en 字典
│   ├── panel-marker.js                       # 新增（迁移自设置包）：设置面板中心原点打标
│   ├── marker.js                             # 不变：标记属性与中心几何
│   └── browser.js                            # 修改：唯一 client 入口（运行时 + 设置页注册 + 打标）
├── scripts/build.mjs                         # 修改：单产物构建（cjs + factory 包装）
├── test/
│   ├── helpers/env.mjs                       # 不变
│   ├── settings.test.mjs                     # 不变
│   ├── settings-page.test.mjs                # 修改：import 指向 src/
│   ├── panel-marker.test.mjs                 # 新增：源级打标行为
│   ├── bundle.test.mjs                       # 修改：单产物 + apply 装配断言
│   ├── contract.test.mjs                     # 删除（跨包防漂移已无对象）
│   ├── nav-icon.test.mjs                     # 删除（导航图标不再存在）
│   └── settings-plugin.test.mjs              # 删除（并入 bundle.test.mjs / panel-marker.test.mjs）
├── packages/                                 # 整个删除
├── assets/icons/logo.png                     # 不变：插件清单图标
├── locale/zh.json / locale/en.json           # 修改：描述说明设置入口在插件管理
├── cordis.patch.yml                          # 修改：只 insert 主插件一行
├── pnpm-workspace.yaml                       # 修改：去掉 packages glob，保留 allowBuilds
├── .github/workflows/ci.yml                  # 修改：产物一致性只校验 client.js
├── package.json                              # 修改：1.2.0；移除 workspace 依赖
├── pnpm-lock.yaml                            # 修改：pnpm install 重算
├── client.js                                 # 构建产物（重建，不手改）
├── README.md / README.en.md / AGENTS.md      # 修改：单包形态与设置入口
└── COMPATIBLE_VERSION                        # 不变
```

### 2.2 文件职责

| 文件 | 新增/修改 | 职责 |
| --- | --- | --- |
| `src/settings-page.js` | 新增（迁移） | `createSettingsPage({ readSettings, writeSettings, emit })` 返回 React 组件：回退方式 `SegmentedControl` + 目标 `SegmentedTabs` + 三个 `SettingsValueField`；依赖从 `./contract.js` 改为 `./settings.js`。 |
| `src/settings-locale.js` | 新增（迁移） | `NS = "webui-transition"` 与 `zh` / `en` 扁平字典；删除只服务于 Settings 侧栏标签的 `nav` 键。 |
| `src/panel-marker.js` | 新增（迁移） | `startPanelMarker(options)`：观察 `document.body`，给 `[role="dialog"][data-shortcut-modal="settings"]` 打中心原点标记；常量改从 `./marker.js` 取。 |
| `src/browser.js` | 修改 | 唯一 client 入口：`export const inject = ["slots", "locale"]`；`apply` 内四个 effect（运行时 / 字典 / `plugins.bundle.config` 注册 / 打标）；导出既有冻结签名。 |
| `scripts/build.mjs` | 修改 | 单入口 `src/browser.js` → esbuild cjs（external：`react`、`@deepseek-ai/dsh-client-ui-primitives`）→ 包进 `__ModuleLoader__.load({ id, factory })` 写 `client.js`；删除 nav-icon 生成步骤。 |
| `scripts/generate-nav-icon.mjs` | 删除 | 生成 `settings.section.icon` 组件，随 section 一起废弃。 |
| `packages/dsh-webui-transition-settings/` | 删除 | 设置插件包整体移除（产物、src、locale、README、图标、`outline.svg`）。 |
| `cordis.patch.yml` | 修改 | 只保留 `id: dsh-webui-transition` 一行。 |
| `package.json` | 修改 | `version` → `1.2.0`；删除 `dependencies`（原 `@tak1208/dsh-webui-transition-settings`）。`dsh.bundle.patch` / `dsh.client` 不变。 |
| `pnpm-workspace.yaml` | 修改 | 保留 `allowBuilds: esbuild`，去掉 `packages` glob。 |
| `.github/workflows/ci.yml` | 修改 | 产物一致性检查只针对 `client.js`。 |
| `test/settings-page.test.mjs` | 修改 | import 改为 `../src/settings.js` 与 `../src/settings-page.js`；用例内容不变。 |
| `test/panel-marker.test.mjs` | 新增 | 源级：插入设置面板打标 / 非设置面板不打标 / `stop()` 后不再打标。 |
| `test/bundle.test.mjs` | 修改 | 单产物冒烟：`id`、`inject`、导出清单、`require` 形式取 baseline 模块、`apply` 装配（4 个 effect 名称、locale 字典键集合、`plugins.bundle.config` 注册 options、清理可执行）、顶层无 import/export。 |
| `test/contract.test.mjs`、`test/nav-icon.test.mjs`、`test/settings-plugin.test.mjs` | 删除 | 防漂移 / 导航图标 / 旧设置插件产物契约已无对象。 |
| `README.md` / `README.en.md` | 修改 | 设置入口、安装（单包）、架构、发布、CI 段落。 |
| `AGENTS.md` | 修改 | 常用命令、发布、项目地图。 |
| `locale/zh.json` / `locale/en.json` | 修改 | meta.description 说明设置入口在插件管理。 |

### 2.3 冻结的签名与数据流

```js
// 产物契约（scripts/build.mjs 生成，client.js）
window.__ModuleLoader__.load({
  id: "@tak1208/dsh-webui-transition",
  factory: (require) => exports,   // require 只解析 react / @deepseek-ai/dsh-client-ui-primitives
});

// exports（顺序无关，名称不变）
export const inject = ["slots", "locale"];
export function apply(ctx) {}
export { createPolicy, createSurfaceTracker, createGate, createTransitionRuntime,
         keyframesFor, exitKeyframesFor, fadeKeyframesFor, animationSpecsFor };

// apply 内四个 effect（名称即测试断言值）
// "dsh-webui-transition: runtime"                    —— tracker + runtime + 设置事件/storage 订阅
// "dsh-webui-transition: settings dictionaries"      —— ctx.locale.register(NS, { zh, en })
// "dsh-webui-transition: settings page"              —— ctx.slots.inject("plugins.bundle.config", …)
// "dsh-webui-transition: settings panel origin marker" —— startPanelMarker()

// 设置页注册（唯一入口）
ctx.slots.register({
  name: "plugins.bundle.config",
  key: "@tak1208/dsh-webui-transition",
  locale: "webui-transition",
}, SettingsPage);

// 设置页组件签名不变
createSettingsPage({ readSettings, writeSettings, emit }) => React 组件（读 props.t，缺失时恒等）
```

数据流：设置页组件读 `localStorage[SETTINGS_KEY]`（经 `src/settings.js` 的 `readSettings`）→ 用户改动时 `writeSettings` 写回 → `ctx.emit(SETTINGS_EVENT, next)` 通知同一 Cordis 上下文里的运行时 effect → 运行时只更新 `settings` 闭包，`policy.timing(kind)` 每次读取最新值；跨标签页仍由 `window` 的 `storage` 事件兜底。注册入口由 Settings 侧栏改为插件管理 → bundle 详情页，读取与写入路径不变。

## 3 开发进度

### 3.1 源码并入根包

#### 3.1.1 迁移三个源文件到 `src/`

- [ ] 新建 `src/settings-page.js`：整份迁移原 `packages/.../src/settings-page.js`；`import … from "./contract.js"` 改为 `./settings.js`；文件头注释改为 `src/` 路径并注明依据本 plan §2.2。
- [ ] 新建 `src/settings-locale.js`：整份迁移原 `locale.js`；删除 `zh.nav` 与 `en.nav`；注释改为 `src/` 路径。
- [ ] 新建 `src/panel-marker.js`：整份迁移原 `panel-marker.js`；`import { ORIGIN_MARKER_ATTRIBUTE, ORIGIN_MARKER_CENTER } from "./contract.js"` 改为 `./marker.js`；注释改为 `src/` 路径。
- **完成判据**：`node -e "import('./src/settings-locale.js')"` 与 `node -e "import('./src/panel-marker.js')"` 均成功；`grep -n "contract.js" src/settings-page.js src/panel-marker.js` 无输出（`settings-page.js` 的模块解析由 3.2.1 的 primitives 桩覆盖）。

#### 3.1.2 入口与构建改为单产物

- [ ] `src/browser.js`：删除文件末尾的 `window.__ModuleLoader__.load(...)` 调用；改为 `export const inject = ["slots", "locale"]`、`export function apply(ctx)`（保留现有运行时 effect 内容）与既有 8 个导出；在 `apply` 内按 §2.3 增加字典、`plugins.bundle.config`、打标三个 effect，effect 名称逐字按 §2.3。
- [ ] `scripts/build.mjs` 重写：删掉 `generateNavIcon` 引入与调用、删掉设置包产物分支；单入口 `src/browser.js` 走 esbuild `format: "cjs"` + `external: ["react", "@deepseek-ai/dsh-client-ui-primitives"]`，再用与设置包相同的 `factory: (require) => { … }` 模板包成 classic 产物写 `client.js`。
- [ ] `git rm scripts/generate-nav-icon.mjs`。
- **完成判据**：`pnpm build` 成功；`grep -c '__ModuleLoader__' client.js` ≥ 1、`grep -c 'require("react")' client.js` ≥ 1、`grep -c 'plugins.bundle.config' client.js` ≥ 1、`grep -c 'settings.section' client.js` 为 0。

#### 3.1.3 删除设置包与工作区残留

- [ ] `git rm -r packages/dsh-webui-transition-settings`（含 `client.js`、`src/`、`locale/`、`README*.md`、`assets/icons/outline.svg`、`package.json`、`index.js`）。
- [ ] `cordis.patch.yml`：只保留 `id: dsh-webui-transition` 一行 insert。
- [ ] `pnpm-workspace.yaml`：删除 `packages: ["packages/*"]`，保留 `allowBuilds: esbuild`。
- [ ] `package.json`：`version` 改 `1.2.0`，删除整个 `dependencies` 块。
- [ ] 跑 `pnpm install` 让 `pnpm-lock.yaml` 与新形态一致。
- **完成判据**：`test ! -d packages && pnpm install --frozen-lockfile && pnpm build` 全部成功。

### 3.2 测试

#### 3.2.1 源级测试（可并行）

- [ ] **Agent A**：`test/settings-page.test.mjs` — 两处 import 改为 `../src/settings.js`、`../src/settings-page.js`；其余用例与断言不变。（依赖：§2.3 冻结签名）
- [ ] **Agent B**：`test/panel-marker.test.mjs` — 新文件：直接调用 `startPanelMarker()`，断言插入 `buildSettingsOverlay()` 后 panel 带 `data-dsh-transition-origin="center"`、插入 `buildGlassPanel()` 不打标、`stop()` 后不再打标；装备复用 `test/helpers/env.mjs` 的 jsdom 与 fixtures。（依赖：`src/panel-marker.js`）
- [ ] **Agent C**：删除 `test/contract.test.mjs`、`test/nav-icon.test.mjs`、`test/settings-plugin.test.mjs`（`git rm`）。（依赖：无）
- **完成判据**：`node --test test/settings-page.test.mjs test/panel-marker.test.mjs` 通过，`test/` 下无上述三个已删文件。

#### 3.2.2 产物冒烟重写

- [ ] `test/bundle.test.mjs`：改为单产物加载（`materializeBundle(registration, requireStub)`，桩提供 `react` 与 primitives 三个组件）；断言 `id`、`inject`、导出清单、产物以 `require("react")` / `require("@deepseek-ai/dsh-client-ui-primitives")` 取依赖且未内联 React。
- [ ] `test/bundle.test.mjs` 的 `apply` 用例：fake ctx 增加 `slots`（`inject`/`register` 记录）与 `locale`（`bind`/`register` 记录）；断言四个 effect 名称、locale 字典键集合（已去 `nav`）、`plugins.bundle.config` 的 `key` 与 `locale`、全部清理函数可执行并退订事件。
- **完成判据**：`pnpm test` 全绿（先 `pnpm build`）。

### 3.3 文档与产物

#### 3.3.1 文档与 CI

- [ ] `README.md` / `README.en.md`：设置入口改为 插件管理 → `@tak1208/dsh-webui-transition` → 详情页内嵌表单（Settings 不再有该页）；安装段改单包（无 workspace 协议说明、发布顺序说明删除）；架构段改为单包单插件并列出 `settings-page.js` / `settings-locale.js` / `panel-marker.js`；CI 段改单产物。
- [ ] `AGENTS.md`：常用命令（`pnpm build` 只产一个 `client.js`）、发布（单包）、项目地图（删 `packages/`、`nav-icon`、`generate-nav-icon.mjs`、三个已删测试；增三个迁移文件）。
- [ ] `locale/zh.json` / `locale/en.json`：`meta.description` 说明设置入口在插件管理。
- [ ] `.github/workflows/ci.yml`：产物一致性检查只保留 `client.js`。
- **完成判据**：`grep -rn "dsh-webui-transition-settings\|settings\.section\|nav-icon\|generate-nav-icon" AGENTS.md README.md README.en.md locale .github package.json cordis.patch.yml scripts src test` 无输出（`.agents/plan/` 历史文档除外）。

#### 3.3.2 产物重建与验证

- [ ] `pnpm build && pnpm test`。
- [ ] `git diff --exit-code -- client.js`（重新构建后与提交一致，确认确定性）。
- [ ] `npm pack --dry-run` 确认 tarball 只含根包产物，无 `packages/` 残留。
- **完成判据**：三条命令全部通过。

#### 3.3.3 GUI 验证（人工）

- [ ] 刷新 `http://127.0.0.1:3080`，打开 插件管理（侧栏 Plugins）→ `@tak1208/dsh-webui-transition` 详情页，确认描述下方出现过渡动画表单，改一项后立即生效。
- [ ] 打开 Settings，确认侧栏既无「过渡动画」行，也无空白项。
- **完成判据**：两处现象符合预期；若表单未出现，先查 `git diff client.js` 与 bundle 详情页是否有 `data-plugin-config` 段。

### 3.4 提交

- [ ] 分两次提交：先 `docs(plan): v1.2.0 设置改为插件详情页内嵌`，再 `feat(v1.2.0): 设置并入单一插件并改为插件详情页配置（完成 plan §3.1-3.3）`；不 push。
- **完成判据**：`git status` 干净，`git log --oneline -2` 显示上述两条。
