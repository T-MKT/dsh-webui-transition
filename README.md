<h1 align="center">dsh-webui-transition</h1>

<div align="center">

[![npm version](https://img.shields.io/npm/v/@tak1208/dsh-webui-transition)](https://www.npmjs.com/package/@tak1208/dsh-webui-transition)
[![CI](https://github.com/T-MKT/dsh-webui-transition/actions/workflows/ci.yml/badge.svg)](https://github.com/T-MKT/dsh-webui-transition/actions/workflows/ci.yml)

</div>

为 DSH（DeepSeek Harness）Web GUI 补上两处开合过渡动画的第三方客户端插件：各级下拉菜单与设置面板。它是一个 dsh bundle，纯浏览器半区运行，不修改 dsh 源码、无第三方运行时依赖。

v0.3.0 起动画改为**原点感知**（origin-aware）：能推断触发元素时，以「触发元素离弹层最近的边/点」为 `transform-origin` 缩放，并让位移方向从触发点指向弹层；退场复用入场缓存的 origin，朝触发点收回。猜不到触发源时按设置回退：**仅淡入**（默认）或**点击原点**。设置 UI 由同 bundle 内的独立插件 `@tak1208/dsh-webui-transition-settings` 提供（Settings → 过渡动画）。

## 效果范围

只接管宿主本来没有动效的两处表面，入场与退场都做：

| 表面 | 语义选择器 | 入场 | 退场 |
| --- | --- | --- | --- |
| 各级下拉菜单（含设置内的模型菜单等） | `role="menu"` | 以触发源最近边/点为原点缩放（`.98`）+ 从触发侧起步 `4px`，默认约 150ms | 复用入场 origin，朝触发点收回 |
| 设置面板与 `role="dialog"` 弹出面板（如 Agent Team 看板、上下文用量面板） | `role="dialog"`（可带遮罩 mask） | mask 淡入（约 180ms）；面板以触发源为原点缩放（`.98`）+ 方向位移 `12px`（约 220ms） | 镜像退场 |

- **原点感知**：触发源按优先级推断——DOM 邻接（子菜单 / 非 portal wrapper）→ `aria-controls` → `[aria-expanded="true"][aria-haspopup]`（24px 邻接闸门 + 1400px 距离上限）→ 最近指针目标（2.5s 内）→ 键盘焦点。推断不到时按设置回退。
- **回退模式**：`仅淡入`（默认，不做任何几何动画）或 `点击原点`（以最近一次指针位置为缩放原点）；两者都取不到时仍退化为仅淡入。
- 时长与缓动优先读宿主 token（`--ds-transition-duration`、`--ds-transition-duration-fast`、`--ds-ease-in-out`），并做区间 clamp；缺省值即上表。
- 关闭时宿主会把节点瞬时卸载，因此退场使用「幽灵副本」：克隆一份 `inert` 的副本插回原位，播完即删，不拦截交互、也不进入无障碍树。
- 每个元素同帧只播一次入场，避免重复触发。

## 设置

设置页由独立插件 `@tak1208/dsh-webui-transition-settings` 提供，入口为 **Settings → 过渡动画**（英文 `Transitions`），侧栏导航行显示线稿图标。目前只有一项：

| 设置 | 取值 | 默认 | 含义 |
| --- | --- | --- | --- |
| 无锚点回退方式 | `仅淡入` / `点击原点` | `仅淡入` | 推断不到触发元素时，弹层如何入场 |

- 存储：`localStorage` key `dsh.webui-transition.settings.v1`，JSON `{ "fallback": "fade" | "pointer" }`。
- 同标签页即时生效走 Cordis 事件；跨标签页用 `storage` 事件兜底。
- **没有设置插件、或从未保存过设置时，主插件以默认 `fade` 正常运行**；设置插件只是可选的 UI 入口。
- 浏览器「清除浏览数据 / 站点数据」、无痕关闭、换 origin（端口/host 变化）、换浏览器/profile 都会清掉该设置；后果只是回退默认 `fade`，主插件仍工作。

## 安装

本仓库形态为 dsh bundle：根包 `package.json` 声明 `dsh.bundle.patch`（Loader 插入两行插件：主插件 + 设置插件）与 `dsh.client`（浏览器半区，指向构建产物 `client.js`，classic script）。根包以 `workspace:^` 依赖设置包，发布时 pnpm 自动改写为 `^1.0.0`。
基于 dsh `0.2.2-rc.1` 开发，兼容 dsh `0.2.2-alpha.2` 及以上版本。（`engines.dsh: ">=0.2.2-alpha.2 <0.3.0"`）。

**通过 npm 安装（推荐）**：

```bash
dsh plugin --profile web add @tak1208/dsh-webui-transition
```

一条命令会同时装好根包与它依赖的设置包。也可以让 dsh 的 `plugin_manager` 工具直接安装 npm 包：

```json
{ "action": "install_bundle", "target": "@tak1208/dsh-webui-transition" }
```

- 0.2.1-alpha.2 起 dsh 不允许直接覆盖安装已安装的包（会返回 `already-installed`）；重装请先 `action: "remove_bundle"`，再 `install_bundle`。
- 安装成功后插件会出现在 Settings → 内置插件清单里。
- 卸载：`dsh plugin --profile web remove @tak1208/dsh-webui-transition`（或用 `plugin_manager` 的 `remove_bundle`）。

**从源码安装（开发期 / 未发布时）**：本仓库是 pnpm workspace（根包 + `packages/dsh-webui-transition-settings`）。由于根包用 `workspace:^` 依赖设置包，**直接对仓库绝对路径执行 `install_bundle` 会因 workspace 协议失败**。开发期联调方式：

1. 先 `pnpm install && pnpm build` 生成两个 `client.js`；
2. 把两个包分别 link / 安装进 profile（或先发布设置包的预发布版，再装根包）；
3. 发布顺序：先 `dsh-webui-transition-settings`，后 `dsh-webui-transition`。

## 退出开关

在任意界面元素或其祖先上设置 `data-dsh-transition="off"`，该子树整体不被接管（不播入场、不生成退场幽灵）：

```html
<div data-dsh-transition="off">
  <div role="menu">…</div>
</div>
```

也可以在运行时动态添加/移除该属性。

## 减少动态效果

系统开启「减少动态效果」（`prefers-reduced-motion: reduce`）时，不播放任何动画、不生成幽灵节点。运行中开启会立即取消正在播放的动画并清除退场幽灵；此后新动画自动保持不播，关闭该设置后新动画恢复播放。

## 已知边界

- 只做两类语义表面：各级下拉菜单与 `role="dialog"` 面板（设置面板、Agent Team 看板等）。不做消息入场/流式渲染/平滑滚动，不做设置面板内 tab 切换、开关与指示条，不做菜单翻页。
- 不做平台原生方案（CSS Anchor Positioning / View Transitions / clip-path 全 rect morph）、不做 FLIP、不处理 iframe / Shadow DOM 内的表面。
- 不注册 slot、不渲染组件（设置插件除外）；主插件纯观察 + WAAPI。
- 不修改宿主卸载时序（退场全部走幽灵副本，不使用延迟卸载补丁）。
- 不修改 dsh 源码，不往 profile 写入 `package.json` / `cordis.patch.yml`。
- 版本基线为 dsh `0.2.2-alpha.2`；暂不支持更旧的 dsh 版本。dsh 升级（尤其 0.3.0 及以上）后需重新检查语义选择器、`settings.section` 与客户端契约。
- 覆盖范围依赖宿主语义 DOM（`role="menu"`、`role="dialog"` + `[data-shortcut-modal="settings"]`）；宿主改动语义结构会影响覆盖面。
- 触发源推断是启发式的：保留 2.5s 新鲜度、24px 邻接闸门与 1400px 距离上限；无法确认时宁可走回退，不猜。
- 玻璃表面的 `backdrop-filter`（如菜单的 `.material` 层）在过渡期间保持模糊：菜单的淡入淡出下沉到直接子级、退场幽灵不再剥离 `backdrop-filter`，因此入场/退场动画全程都在采样页面背景。
- 玻璃层在 `::before` / `::after` 伪元素上的表面（当前宿主里是 Agent Team 看板）：插件改为动画伪元素自身的 opacity、表面只做位移与阴影，因此动画期间模糊保持；浏览器不支持 WAAPI `pseudoElement` 选项时（Chrome/Edge 之外的旧实现），该玻璃层不参与淡入淡出，但模糊仍全程有效。玻璃层在元素自身上的面板（如上下文用量面板）维持原有的整体淡入。
- 菜单容器的 `box-shadow`（宿主 elevation 阴影）随动画同步淡入/淡出，不会先出现「只有阴影的轮廓」，也不会在内容淡完后残留阴影。
- 菜单的直接子元素若自带宿主 CSS animation，插件会短暂覆盖其 `opacity`（动画结束即释放填充态）；只影响宿主在子元素上已有 `opacity` 动画的极端情况。

## 实现架构与开发

仓库是 pnpm workspace，两个包：

- 根包 `@tak1208/dsh-webui-transition`：bundle + 主 client 插件。源码是 `src/` 下的 ESM 模块，一个文件一个职责：`defs.js`（常量与 `SURFACE_DEFS` 表面描述符）、`utils.js`（通用小工具）、`policy.js`（token / reduced-motion / 时长策略）、`tracker.js`（表面状态机与 DOM 分类）、`gate.js`（WAAPI / CSS animation / CSS transition 冲突门卫）、`settings.js`（localStorage 设置契约）、`origin.js`（交互捕获、触发源解析与 origin 几何）、`frames.js`（纯关键帧函数，含原点感知几何与伪元素玻璃拆分）、`runtime.js`（观察、批量、入场与退场幽灵）、`browser.js`（浏览器入口，注册到 `window.__ModuleLoader__`）。入口经 esbuild 打包为根目录的 classic iife 产物 `client.js`。
- 设置包 `packages/dsh-webui-transition-settings`：独立 client 插件，`src/browser.js` 注册 `settings.section` 设置页与 `settings.section.icon` 导航图标（组件由 `pnpm build` 从 `assets/icons/outline.svg` 生成 `src/nav-icon.js`），`src/settings-page.js` 用 `@deepseek-ai/dsh-client-ui-primitives` 的 `SegmentedControl` 渲染，`src/contract.js` 与主包 `src/settings.js` 各自独立实现同一份设置契约（由 `test/contract.test.mjs` 防漂移）。构建产物是该包的 `client.js`（esbuild cjs 包进 `__ModuleLoader__.load` factory）。

两个 `client.js` 都是构建产物，由 `pnpm build` 生成，**不要手改**；改实现请改 `src/` 后重新构建。

```bash
pnpm install
pnpm build   # 主插件 iife + 设置插件 factory 两个产物
pnpm test    # pretest 先构建，再跑 node --test
```

测试用 Node 内置 `node --test` + `jsdom`：`test/helpers/env.mjs` 负责 jsdom 装配、fake `__ModuleLoader__`、fake `animate`、fake storage 等，每个 `src/` 模块对应一个测试文件；`bundle.test.mjs` 对两个构建产物做 classic 契约冒烟，`contract.test.mjs` 比对两包设置契约，`settings-page.test.mjs` / `settings-plugin.test.mjs` 覆盖设置页与 slot 注册。

## CI

GitHub Actions（`.github/workflows/ci.yml`）在 PR 与 `main` / `feat/**` push 上执行：`pnpm install --frozen-lockfile` → `pnpm build` → `pnpm test` → 校验两个 `client.js` 与提交一致。不安装 dsh、不 publish、不写 secrets。

## 许可

[MIT](./LICENSE) © tak1208
