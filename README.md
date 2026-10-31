# dsh-webui-transition

为 DSH（DeepSeek Harness）Web GUI 补上两处开合过渡动画的第三方客户端插件：各级下拉菜单与设置面板。它是一个 dsh bundle，纯浏览器半区运行，不注册 slot、不修改 dsh 源码、无第三方运行时依赖。

## 效果范围

只接管宿主本来没有动效的两处表面，入场与退场都做：

| 表面 | 语义选择器 | 入场 | 退场 |
| --- | --- | --- | --- |
| 各级下拉菜单（含设置内的模型菜单等） | `role="menu"` | 淡入 + 上浮（`-4px`）+ 轻微缩放（`.98`），默认约 150ms | 镜像退场 |
| 设置面板与 `role="dialog"` 弹出面板（如 Agent Team 看板、上下文用量面板） | `role="dialog"`（可带遮罩 mask） | mask 淡入（约 180ms）；面板淡入 + 上浮（`12px`，约 220ms） | 镜像退场 |

- 时长与缓动优先读宿主 token（`--ds-transition-duration`、`--ds-transition-duration-fast`、`--ds-ease-in-out`），并做区间 clamp；缺省值即上表。
- 关闭时宿主会把节点瞬时卸载，因此退场使用「幽灵副本」：克隆一份 `inert` 的副本插回原位，播完即删，不拦截交互、也不进入无障碍树。
- 每个元素同帧只播一次入场，避免重复触发。

## 调研结论

- 没有找到可直接安装、恰好满足需求的现成插件。
- 运行时架构借鉴 `bilbillm/dsh-motion`（语义分类 + `MutationObserver` + WAAPI + 成对退场幽灵，MIT）。
- 动效参数取自 `dsh-motion-complete` 已定稿的数值。
- 本仓库源码为 `src/` 下的 ESM 模块，按职责拆分；入口 `src/browser.js` 经 esbuild 打包为 dsh 客户端契约要求的 classic `client.js`。运行时无第三方依赖（esbuild 仅为开发期构建工具）。

## 安装

本仓库形态为 dsh bundle：`package.json` 声明 `dsh.bundle.patch`（Loader 插入一行插件）与 `dsh.client`（浏览器半区，指向构建产物 `client.js`，classic script）。兼容 dsh `0.2.2-alpha.2`（`engines.dsh: ">=0.2.2-alpha.2 <0.3.0"`）。

**开发期（本仓库未发布时）**：用 dsh 的 `plugin_manager` 工具安装，`target` 取本仓库绝对路径：

```json
{ "action": "install_bundle", "target": "/absolute/path/to/dsh-webui-transition" }
```

- 0.2.1-alpha.2 起 dsh 不允许直接覆盖安装已安装的包（会返回 `already-installed`）；重装请先 `action: "remove_bundle"`，再 `install_bundle`。
- 安装成功后插件会出现在 Settings → 内置插件清单里。

**发布到 npm 之后**：

```bash
dsh plugin --profile web add @tak1208/dsh-webui-transition
```

卸载：`dsh plugin --profile web remove @tak1208/dsh-webui-transition`（或用 `plugin_manager` 的 `remove_bundle`）。

## 退出开关

在任意界面元素或其祖先上设置 `data-dsh-transition="off"`，该子树整体不被接管（不播入场、不生成退场幽灵）：

```html
<div data-dsh-transition="off">
  <div role="menu">…</div>
</div>
```

也可以在运行时动态添加/移除该属性。其机制与 `dsh-motion` 的 `data-dsh-motion="off"` 相同。

## 减少动态效果

系统开启「减少动态效果」（`prefers-reduced-motion: reduce`）时，不播放任何动画、不生成幽灵节点。运行中开启会立即取消正在播放的动画并清除退场幽灵；此后新动画自动保持不播，关闭该设置后新动画恢复播放。

## 与其它动效插件共存

- 与 `dsh-reduce-effects`、`dsh-theme-studio` 等动效相关插件共存：本插件只补宿主本身没有的两处表面，不覆盖宿主已有动画——元素已有未完成的 WAAPI 动画或 CSS `animation-name` 非 `none` 时一律跳过（`canAnimate` 门卫）。
- 不做消息入场、流式渲染、平滑滚动，不与 `dsh-smooth-stream` 等插件的领地重叠。
- 若想连本插件一起关掉：使用上面的 `data-dsh-transition="off"`，或开启系统「减少动态效果」。

## 已知边界

- 只做两类语义表面：各级下拉菜单与 `role="dialog"` 面板（设置面板、Agent Team 看板等）。不做消息入场/流式渲染/平滑滚动，不做设置面板内 tab 切换、开关与指示条，不做菜单翻页。
- 不注册 slot、不渲染组件；纯观察 + WAAPI。
- 不修改宿主卸载时序（退场全部走幽灵副本，不使用延迟卸载补丁）。
- 不修改 dsh 源码，不往 profile 写入 `package.json` / `cordis.patch.yml`。
- 版本基线为 dsh `0.2.2-alpha.2`；dsh 升级（尤其 0.3.0 及以上）后需重新检查语义选择器与客户端契约。
- 覆盖范围依赖宿主语义 DOM（`role="menu"`、`role="dialog"` + `[data-shortcut-modal="settings"]`）；宿主改动语义结构会影响覆盖面。
- 玻璃表面的 `backdrop-filter`（如菜单的 `.material` 层）在过渡期间保持模糊：菜单的淡入淡出下沉到直接子级、退场幽灵不再剥离 `backdrop-filter`，因此入场/退场动画全程都在采样页面背景。
- 玻璃层在 `::before` / `::after` 伪元素上的表面（当前宿主里是 Agent Team 看板）：插件改为动画伪元素自身的 opacity、表面只做位移与阴影，因此动画期间模糊保持；浏览器不支持 WAAPI `pseudoElement` 选项时（Chrome/Edge 之外的旧实现），该玻璃层不参与淡入淡出，但模糊仍全程有效。玻璃层在元素自身上的面板（如上下文用量面板）维持原有的整体淡入。
- 菜单容器的 `box-shadow`（宿主 elevation 阴影）随动画同步淡入/淡出，不会先出现「只有阴影的轮廓」，也不会在内容淡完后残留阴影。
- 菜单的直接子元素若自带宿主 CSS animation，插件会短暂覆盖其 `opacity`（动画结束即释放填充态）；只影响宿主在子元素上已有 `opacity` 动画的极端情况。

## 实现架构与开发

源码是 `src/` 下的 ESM 模块，一个文件一个职责：`defs.js`（常量与 `SURFACE_DEFS` 表面描述符）、`utils.js`（通用小工具）、`policy.js`（token / reduced-motion / 时长策略）、`tracker.js`（表面状态机与 DOM 分类）、`gate.js`（WAAPI / CSS animation / CSS transition 冲突门卫）、`frames.js`（纯关键帧函数，含伪元素玻璃拆分）、`runtime.js`（观察、批量、入场与退场幽灵）、`browser.js`（浏览器入口，注册到 `window.__ModuleLoader__`）。入口经 esbuild 打包为根目录的 classic iife 产物 `client.js`：顶层只有 `window.__ModuleLoader__.load({ id, factory })`，不出现 `import`/`export`；运行时工厂定义在 factory 闭包内并经 `exports.*` 暴露冻结签名。

`client.js` 是构建产物，由 `pnpm build` 生成，**不要手改**；改实现请改 `src/` 后重新构建。

```bash
pnpm install
pnpm build   # src/browser.js → client.js（classic iife）
pnpm test    # pretest 先构建，再跑 node --test
```

测试用 Node 内置 `node --test` + `jsdom`：`test/helpers/env.mjs` 负责 jsdom 装配、fake `__ModuleLoader__` 与 fake `animate` 等，每个 `src/` 模块对应一个测试文件，另有 `bundle.test.mjs` 对构建产物做 classic 契约冒烟。

## 许可

[MIT](./LICENSE) © tak1208
