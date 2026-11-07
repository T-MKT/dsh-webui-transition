/**
 * packages/dsh-webui-transition-settings/src/nav-icon.js — 设置导航图标。
 *
 * `settings.section.icon` 贡献：外壳在设置弹窗侧栏的导航行里以 16px、
 * `aria-hidden` 的装饰容器渲染它；文字与无障碍名仍来自 `settings.section`
 * 的 label，颜色继承 `.navCell` 的 currentColor，因此这里不需要文案、locale
 * 或尺寸以外的配置（外壳传入 `{ size, active }`，`active` 与宿主内置图标一样
 * 不参与绘制）。
 *
 * 图形与插件页图标同源（`assets/icons/logo.svg`）：同一份 logo 在两处消费，
 * 改动时需同步；`test/nav-icon.test.mjs` 比对两者防漂移。
 * 用 React.createElement 而非 JSX，使本文件可被 Node 直接 import 做渲染测试。
 */

import React from "react";

/**
 * @param {{ size?: number }} props - 外壳传入的方形边长（px），默认 16。
 */
export function NavIcon({ size = 16 }) {
  return React.createElement(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 16 16",
      fill: "none",
      "aria-hidden": "true",
    },
    React.createElement("path", {
      d: "M 7.2 12.64 L 4.1 14.21 L 4.78 9.89 L 1.69 6.8 L 6.01 6.11 L 8 2.22 L 9.99 6.11 L 14.31 6.8 L 13.3 7.81",
      stroke: "currentColor",
      strokeWidth: 1,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    }),
    React.createElement("path", {
      d: "M 11.12 9.47 H 14.35 M 9.15 11.43 H 12.4 M 10.47 13.38 H 13.69",
      stroke: "currentColor",
      strokeWidth: 0.75,
      strokeLinecap: "round",
    }),
  );
}
