<div align="center">
<img src="assets/icons/logo.png" alt="dsh-webui-transition logo" width="96" height="96" />
<h1>dsh-webui-transition</h1>
</div>

<div align="center">

[![npm version](https://img.shields.io/npm/v/@tak1208/dsh-webui-transition)](https://www.npmjs.com/package/@tak1208/dsh-webui-transition)
[![CI](https://github.com/T-MKT/dsh-webui-transition/actions/workflows/ci.yml/badge.svg)](https://github.com/T-MKT/dsh-webui-transition/actions/workflows/ci.yml)

</div>

为 DSH（DeepSeek Harness）Web GUI 补上两处开合过渡动画的第三方客户端插件：各级下拉菜单与设置面板。它是一个 dsh bundle，纯浏览器半区运行，不修改 dsh 源码、无第三方运行时依赖。

v0.3.0 起动画改为**原点感知**（origin-aware）：能推断触发元素时，以**触发元素离弹层最近的边/点**为 `transform-origin` 缩放；退场复用入场缓存的 origin。猜不到触发源时按设置回退：**仅淡入**（默认）或**点击原点**。

v1.0.0 起设置面板改为**正中心缩放**：面板以自身正中心为 `transform-origin` 缩放 + 淡入，不依赖触发源（由插件自身在面板上打 `data-dsh-transition-origin="center"` 标记，动画逻辑只识别标记）。

v1.1.0 起动画**时长、初始缩放、透明度起点**均可调配（全局默认 + 按表面组覆盖，修改即时生效）。

v2.0.0 起设置表单内嵌在**插件管理**：打开左侧栏“插件”页 → `@tak1208/dsh-webui-transition` 详情页即可配置。

## 效果范围

只接管宿主本来没有动效的两处表面，入场与退场都做：

| 表面 | 语义选择器 | 入场 | 退场 |
| --- | --- | --- | --- |
| 各级下拉菜单（含设置内的模型菜单等） | `role="menu"` | 以触发源最近边/点为原点缩放（`.98`）+ 淡入，默认约 150ms，可配 | 复用入场 origin，镜像退场 |
| 设置面板 | `role="dialog"` + `data-dsh-transition-origin="center"`（由本插件打标） | 以面板正中心为原点缩放（`.98`）+ 淡入（默认约 220ms，可配），不依赖触发源、始终生效 | 镜像退场 |
| 其它 `role="dialog"` 弹出面板（如 Agent Team 看板、上下文用量面板） | `role="dialog"`（可带遮罩 mask） | mask 淡入（默认约 180ms，可配）；面板以触发源为原点缩放（`.98`）+ 淡入（默认约 220ms，可配） | 镜像退场 |

- **原点感知**：触发源按优先级推断——DOM 邻接（子菜单 / 非 portal wrapper）→ `aria-controls` → `[aria-expanded="true"][aria-haspopup]`（24px 邻接闸门 + 1400px 距离上限）→ 最近指针目标（2.5s 内）→ 键盘焦点。推断不到时按设置回退。
- **表面级原点标记**：表面所属插件可在表面元素上打 `data-dsh-transition-origin="center"`，动画逻辑对该表面**无条件**以自身正中心为 `transform-origin`，跳过触发源推断与回退。当前由本插件给设置面板打该标记（标记由插件自己打；动画逻辑不识别 `data-shortcut-modal`、`aria-modal` 等宿主属性）。
- **回退模式**：`仅淡入`（默认，不做任何几何动画）或 `点击原点`（以最近一次指针位置为缩放原点）；两者都取不到时仍退化为仅淡入。
- 时长与缓动优先读宿主 token（`--ds-transition-duration`、`--ds-transition-duration-fast`、`--ds-ease-in-out`），并做区间 clamp；缺省值即上表。动画参数可在设置页覆盖（见下节）。
- 关闭时宿主会把节点瞬时卸载，因此退场使用「幽灵副本」：克隆一份 `inert` 的副本插回原位，播完即删，不拦截交互、也不进入无障碍树。
- 每个元素同帧只播一次入场，避免重复触发。

## 设置

配置表单内嵌在插件管理：**插件管理（侧栏 Plugins）→ `@tak1208/dsh-webui-transition` → 详情页**，位于描述与行列表之间。设置项分「无锚点回退方式」与「动画参数」两组：

| 设置 | 取值 | 默认 | 含义 |
| --- | --- | --- | --- |
| 无锚点回退方式 | `仅淡入` / `点击原点` | `仅淡入` | 推断不到触发元素时，弹层如何入场 |
| 动画时长 | 0–1000 毫秒整数 | 自动 | 过渡时长；`0` 表示关闭该表面组的过渡动画 |
| 初始缩放 | 0.5–1.0（两位小数） | 自动 | 入场缩放的起点；`1` 表示不做缩放 |
| 透明度起点 | 0–1.0（两位小数） | 自动 | 入场透明度的起点；`0` 表示从完全透明开始 |

动画参数分两层：**全局**与**分表面组**（菜单与列表 / 对话框 / 遮罩；「菜单与列表」同时作用于 `role="menu"` 与 `role="listbox"`）。

- **优先级**：分表面值 → 全局值 → 内置默认。分表面留空即跟随全局；全局留空则沿用原有行为：时长读宿主 token（`--ds-transition-duration` / `--ds-transition-duration-fast`）并按各表面区间 clamp，缩放/透明度用内置默认（菜单与对话框 0.98、遮罩 1；透明度均从 0 开始）。
- 用户显式设置的时长按 0–1000ms 校验，**不套用**各表面原有的 120–240ms 区间 clamp；`0` 表示该表面组入场与退场都不播过渡。
- **遮罩例外**：全屏遮罩从 `scale(<1)` 入场会露出页面边缘，因此全局缩放不作用于遮罩（遮罩默认固定 1）；只有显式设置「遮罩」的缩放才生效。
- 字段留空 = 自动；失焦或回车提交；非数字输入不写入并在失焦时回退；「改为自动」按钮把单项恢复为自动。
- `prefers-reduced-motion` 优先级高于设置：开启时所有过渡时长归零。
- 存储：`localStorage` key `dsh.webui-transition.settings.v1`，JSON 形如：

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

- 同标签页即时生效走 Cordis 事件；跨标签页用 `storage` 事件兜底；设置修改无需重启。
- **从未保存过设置时，插件以默认自动参数正常运行**；配置表单只是可选的 UI 入口。
- 浏览器「清除浏览数据 / 站点数据」、无痕关闭、换 origin（端口/host 变化）、换浏览器/profile 都会清掉该设置；后果只是回退默认自动参数，插件仍工作。
- 旧版本插件（v1.0.0 及更早）写回设置时会丢掉新字段；这是已知且接受的降级行为（key 仍为 `…v1`，不做迁移）。

## 安装

本仓库形态为 dsh bundle：根包 `package.json` 声明 `dsh.bundle.patch`（Loader 插入一行插件）与 `dsh.client`（浏览器半区，指向构建产物 `client.js`，classic script）。仓库为单包，无 workspace 依赖。
兼容 dsh `0.2.3-alpha.1` 及以上版本。

**通过 npm 安装（推荐）**：

```bash
dsh plugin --profile web add @tak1208/dsh-webui-transition
```


卸载：`dsh plugin --profile web remove @tak1208/dsh-webui-transition`。

**从源码安装（开发期）**：本仓库是单包（无 workspace 依赖），可直接把仓库绝对路径装进 profile：

1. 先 `pnpm install && pnpm build` 生成 `client.js`；
2. `dsh plugin --profile web add link:/path/to/dsh-webui-transition`；
3. 刷新 GUI 页面即可生效。

## 退出开关

在任意界面元素或其祖先上设置 `data-dsh-transition="off"`，该子树整体不被接管（不播入场、不生成退场幽灵）：

```html
<div data-dsh-transition="off">
  <div role="menu">…</div>
</div>
```

也可以在运行时动态添加/移除该属性。

## 减少动态效果

系统开启“减少动态效果”（`prefers-reduced-motion: reduce`）时，不播放任何动画、不生成幽灵节点。运行中开启会立即取消正在播放的动画并清除退场幽灵；此后新动画自动保持不播，关闭该设置后新动画恢复播放。

## 已知边界

- 只做两类语义表面：各级下拉菜单与 `role="dialog"` 面板（设置面板、Agent Team 看板等）。不做设置面板内 tab 切换、开关与指示条，不做菜单翻页。
- 不做平台原生方案（CSS Anchor Positioning / View Transitions / clip-path 全 rect morph）、不做 FLIP、不处理 iframe / Shadow DOM 内的表面。
- 除插件详情页配置表单（`plugins.bundle.config`）外，不注册其它 slot；动画部分纯观察 + WAAPI。
- 覆盖范围依赖宿主语义 DOM（`role="menu"`、`role="dialog"` + `[data-shortcut-modal="settings"]`）；宿主改动语义结构会影响覆盖面。
- 触发源推断是启发式的：保留 2.5s 新鲜度、24px 邻接闸门与 1400px 距离上限；无法确认时宁可走回退，不猜。
- 玻璃表面的 `backdrop-filter`（如菜单的 `.material` 层）在过渡期间保持模糊：菜单的淡入淡出下沉到直接子级、退场幽灵不再剥离 `backdrop-filter`，因此入场/退场动画全程都在采样页面背景。
- 玻璃层在 `::before` / `::after` 伪元素上的表面（当前宿主里是 Agent Team 看板）：插件改为动画伪元素自身的 opacity、表面只做缩放与阴影，因此动画期间模糊保持；浏览器不支持 WAAPI `pseudoElement` 选项时（Chrome/Edge 之外的旧实现），该玻璃层不参与淡入淡出，但模糊仍全程有效。玻璃层在元素自身上的面板（如上下文用量面板）维持原有的整体淡入。
- 菜单容器的 `box-shadow`（宿主 elevation 阴影）随动画同步淡入/淡出，不会先出现「只有阴影的轮廓」，也不会在内容淡完后残留阴影。
- 菜单的直接子元素若自带宿主 CSS animation，插件会短暂覆盖其 `opacity`（动画结束即释放填充态）；只影响宿主在子元素上已有 `opacity` 动画的极端情况。

## 实现架构与开发

仓库是单包，一个 dsh bundle + 一个 client 插件。源码是 `src/` 下的 ESM 模块，一个文件一个职责：

- `defs.js`（常量与 `SURFACE_DEFS` 表面描述符）
- `utils.js`（通用小工具）
- `policy.js`（createPolicy：token / reduced-motion / 读取设置计算最终时长与几何参数）
- `tracker.js`（表面状态机与 DOM 分类）
- `gate.js`（WAAPI / CSS animation / CSS transition 冲突门卫）
- `settings.js`（localStorage 设置契约：回退方式 + 三个可调参数 + 分表面组，逐字段清洗与 clamp）
- `settings-page.js`（React 配置页：`SegmentedControl` 回退方式 + `SegmentedTabs` 全局 / 分表面目标 + `SettingsValueField` 三个数字字段）
- `settings-locale.js`（配置页 zh/en 文案）
- `panel-marker.js`（观察 `document.body` 给设置面板打中心原点标记）
- `origin.js`（交互捕获、触发源解析与 origin 几何）
- `marker.js`（表面级中心原点标记契约与中心几何）
- `frames.js`（纯关键帧函数，含原点感知几何、伪元素玻璃拆分与 timing 覆盖）
- `runtime.js`（观察、批量、入场与退场幽灵）
`browser.js`（唯一入口：运行时 + 配置页注册 + 打标）。入口经 esbuild 打成 cjs，再包进 `__ModuleLoader__.load({ id, factory })`，产出根目录的 classic script `client.js`。

`client.js` 是构建产物，由 `pnpm build` 生成，**不要手改**；改实现请改 `src/` 后重新构建。

```bash
pnpm install
pnpm build   # 唯一产物 client.js
pnpm test    # pretest 先构建，再跑 node --test
```

测试用 Node 内置 `node --test` + `jsdom`：`test/helpers/env.mjs` 负责 jsdom 装配、fake `__ModuleLoader__`、fake `animate`、fake storage 等，每个 `src/` 模块对应一个测试文件；`bundle.test.mjs` 对构建产物做 classic 契约冒烟与 `apply` 装配断言，`panel-marker.test.mjs` 覆盖设置面板打标，`settings-page.test.mjs` 覆盖配置页渲染、字段提交与跨标签同步。

## 发布

单包发布：直接 `pnpm publish`；需要 npm 的 2FA 网页认证时可 `pnpm pack` 生成 tarball 后 `npm publish <tarball>`。发布前确认 `client.js` 已重建且与提交一致。

## CI

GitHub Actions（`.github/workflows/ci.yml`）在 PR 与 `main` / `feat/**` push 上执行：`pnpm install --frozen-lockfile` → `pnpm build` → `pnpm test` → 校验 `client.js` 与提交一致。不安装 dsh、不 publish、不写 secrets。

## 许可

[MIT](./LICENSE) © tak1208
