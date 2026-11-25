<h1 align="center">dsh-webui-transition-settings</h1>

<div align="center">

[![npm version](https://img.shields.io/npm/v/@tak1208/dsh-webui-transition-settings)](https://www.npmjs.com/package/@tak1208/dsh-webui-transition-settings)

</div>

`@tak1208/dsh-webui-transition` 的可选设置插件：在 DSH（DeepSeek Harness）Web GUI 的 Settings 弹窗中新增「过渡动画」页，用于选择主插件在**无法推断触发元素**时的回退入场方式，并调配**动画时长、初始缩放与透明度起点**（全局默认 + 分表面组覆盖）。

## 入口

**Settings → 过渡动画**（英文界面为 `Transitions`）。侧栏导航行显示线稿图标（`settings.section.icon`，源文件 `assets/icons/outline.svg`，组件由 `pnpm build` 生成；该 slot 由 dsh 0.2.2-alpha.3 起提供，更旧版本回落外壳默认齿轮）。

## 设置项

| 设置 | 取值 | 默认 | 含义 |
| --- | --- | --- | --- |
| 无锚点回退方式 | `仅淡入` / `点击原点` | `仅淡入` | 推断不到触发元素时，弹层如何入场 |
| 动画时长 | 0–1000 毫秒整数 | 自动 | 过渡时长；`0` 表示关闭该表面组的过渡动画 |
| 初始缩放 | 0.5–1.0（两位小数） | 自动 | 入场缩放的起点；`1` 表示不做缩放 |
| 透明度起点 | 0–1.0（两位小数） | 自动 | 入场透明度的起点；`0` 表示从完全透明开始 |

- **仅淡入**（`fade`）：本次不播放任何几何动画，只做透明度过渡。
- **点击原点**（`pointer`）：以最近一次指针位置作为缩放原点；取不到指针位置时仍退化为仅淡入。
- **两层参数**：全局默认 + 分表面组（菜单与列表 / 对话框 / 遮罩；「菜单与列表」同时作用于 `role="menu"` 与 `role="listbox"`）。优先级为分表面值 → 全局值 → 内置默认；分表面留空即跟随全局，全局留空即自动。
- **遮罩缩放例外**：全局缩放不作用于遮罩（全屏遮罩从 `scale(<1)` 入场会露出页面边缘），遮罩默认固定 1，只有显式设置「遮罩」的缩放才生效。
- 字段留空 = 自动；失焦或回车提交；非数字输入不写入；「改为自动」恢复单项自动。
- `prefers-reduced-motion` 优先级高于设置：开启时所有过渡时长归零。

## 存储

- `localStorage` key：`dsh.webui-transition.settings.v1`
- 值：完整 JSON，数字字段 `null` 表示自动，默认全部为 `null`：

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

- 同一标签页内即时生效（Cordis 事件）；跨标签页由 `storage` 事件同步；设置修改无需重启。
- 浏览器「清除浏览数据 / 站点数据」、无痕关闭、换 origin（端口/host 变化）、换浏览器/profile 都会清空该值；后果只是回退默认自动参数，主插件仍正常工作。
- 旧版本插件（v1.0.0 及更早）写回设置时会丢掉新字段；key 仍为 `…v1`，不做迁移。

## 与主包的关系

一个 npm 包只能提供一个 client 插件，因此本设置插件是独立包。根包 `@tak1208/dsh-webui-transition` 以 `workspace:^` 依赖本包，安装根包时会一并装好；发布顺序为先本包、后根包。

**主插件不依赖本插件**：没有安装设置插件、或从未保存过设置时，主插件始终以默认自动参数（`fade` + 内置时长/缩放/透明度）正常运行。本插件只提供 UI 入口与设置面板的中心缩放标记（`data-dsh-transition-origin="center"`：主插件只识别该标记，不识别宿主属性），不实现动画本身。没有本插件时设置面板回落为主插件的默认原点感知行为。

## 实现

- `src/browser.js`：client 半区入口，`inject = ["slots", "locale"]`；注册 `settings.section` 设置页、`settings.section.icon` 导航图标与中英文文案。
- `src/nav-icon.js`：`settings.section.icon` 的图标组件，**由 `pnpm build` 从 `assets/icons/outline.svg` 生成，不手改**；生成器只支持白名单元素/属性（超出即构建失败），尺寸由外壳传入、颜色继承 `currentColor`。
- `src/settings-page.js`：`createSettingsPage`，用 shell 的 baseline 共享模块 `@deepseek-ai/dsh-client-ui-primitives` 的 `SegmentedControl`（回退方式）、`SegmentedTabs`（目标）与 `SettingsValueField`（数字字段）渲染（不手写分段控件，布局只用 `--dsw-*` token）；字段在 Enter / 失焦时提交，空值即自动。
- `src/panel-marker.js`：观察 `document.body`，给插入的设置面板（`[role="dialog"][data-shortcut-modal="settings"]`）打中心缩放标记 `data-dsh-transition-origin="center"`；标记值是与主插件的通用 opt-in 契约。
- `src/contract.js`：与主包 `src/settings.js` 各自独立实现的同一份设置契约（回退方式 + 三个参数 + 分表面组 + 范围常量，由根仓库测试防漂移）；另含跨包同值的中心原点标记常量。
- `client.js`：构建产物（根仓库 `pnpm build` 生成，不手改）。

## License

MIT
