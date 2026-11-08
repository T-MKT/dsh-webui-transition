<h1 align="center">dsh-webui-transition-settings</h1>

<div align="center">

[![npm version](https://img.shields.io/npm/v/@tak1208/dsh-webui-transition-settings)](https://www.npmjs.com/package/@tak1208/dsh-webui-transition-settings)

</div>

`@tak1208/dsh-webui-transition` 的可选设置插件：在 DSH（DeepSeek Harness）Web GUI 的 Settings 弹窗中新增「过渡动画」页，用于选择主插件在**无法推断触发元素**时的回退入场方式。

## 入口

**Settings → 过渡动画**（英文界面为 `Transitions`）。侧栏导航行显示线稿图标（`settings.section.icon`，源文件 `assets/icons/outline.svg`，组件由 `pnpm build` 生成；该 slot 由 dsh 0.2.2-alpha.3 起提供，更旧版本回落外壳默认齿轮）。

## 设置项

| 设置 | 取值 | 默认 | 含义 |
| --- | --- | --- | --- |
| 无锚点回退方式 | `仅淡入` / `点击原点` | `仅淡入` | 推断不到触发元素时，弹层如何入场 |

- **仅淡入**（`fade`）：本次不播放任何几何动画，只做透明度过渡。
- **点击原点**（`pointer`）：以最近一次指针位置作为缩放原点，朝点击位置做方向位移；取不到指针位置时仍退化为仅淡入。

## 存储

- `localStorage` key：`dsh.webui-transition.settings.v1`
- 值：JSON `{ "fallback": "fade" | "pointer" }`，默认 `{ "fallback": "fade" }`
- 同一标签页内即时生效（Cordis 事件）；跨标签页由 `storage` 事件同步。
- 浏览器「清除浏览数据 / 站点数据」、无痕关闭、换 origin（端口/host 变化）、换浏览器/profile 都会清空该值；后果只是回退默认 `fade`，主插件仍正常工作。

## 与主包的关系

一个 npm 包只能提供一个 client 插件，因此本设置插件是独立包。根包 `@tak1208/dsh-webui-transition` 以 `workspace:^` 依赖本包，安装根包时会一并装好；发布顺序为先本包、后根包。

**主插件不依赖本插件**：没有安装设置插件、或从未保存过设置时，主插件始终以默认 `fade` 正常运行。本插件只提供 UI 入口，不实现动画本身。

## 实现

- `src/browser.js`：client 半区入口，`inject = ["slots", "locale"]`；注册 `settings.section` 设置页、`settings.section.icon` 导航图标与中英文文案。
- `src/nav-icon.js`：`settings.section.icon` 的图标组件，**由 `pnpm build` 从 `assets/icons/outline.svg` 生成，不手改**；生成器只支持白名单元素/属性（超出即构建失败），尺寸由外壳传入、颜色继承 `currentColor`。
- `src/settings-page.js`：`createSettingsPage`，用 shell 的 baseline 共享模块 `@deepseek-ai/dsh-client-ui-primitives` 的 `SegmentedControl` 渲染（不手写分段控件，布局只用 `--dsw-*` token）。
- `src/contract.js`：与主包 `src/settings.js` 各自独立实现的同一份设置契约（由根仓库测试防漂移）。
- `client.js`：构建产物（根仓库 `pnpm build` 生成，不手改）。

## License

MIT
