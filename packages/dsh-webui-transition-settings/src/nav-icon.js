/**
 * packages/dsh-webui-transition-settings/src/nav-icon.js — 设置导航图标（生成文件，勿手改）。
 *
 * 由 scripts/generate-nav-icon.mjs 从
 * packages/dsh-webui-transition-settings/assets/icons/outline.svg 生成；
 * pnpm build 会重写本文件，CI 校验它与 SVG 一致。
 *
 * settings.section.icon 贡献：外壳在设置弹窗侧栏以 16px、aria-hidden 的装饰容器渲染它，
 * 颜色继承 .navCell 的 currentColor，文字与无障碍名来自 settings.section 的 label。
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
    React.createElement("path", { stroke: "currentColor", strokeWidth: 1.3, strokeLinejoin: "round", strokeLinecap: "round", d: "M7.2 12.32L4.1 13.89L4.78 9.57L1.69 6.48L6.01 5.79L8 1.9L9.99 5.79L14.31 6.48L13.3 7.49" }),
    React.createElement("path", { stroke: "currentColor", strokeWidth: 1, strokeLinecap: "round", d: "M11.12 9.47L14.35 9.47M9.15 11.43L12.4 11.43M10.47 13.38L13.69 13.38" }),
  );
}
