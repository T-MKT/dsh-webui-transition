/**
 * test/nav-icon.test.mjs — 设置导航图标组件（settings.section.icon，真实 React + jsdom）。
 *
 * 组件由 `pnpm build` 从 `assets/icons/outline.svg` 生成（pretest 已先构建），
 * 这里断言它交给外壳的渲染契约：尺寸跟随 size、矢量颜色继承 currentColor、
 * 纯装饰无文本。图形与 SVG 的一致性由 CI 的构建产物校验兜底，不在此重复比对。
 */

import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";

import React from "react";
import { createRoot } from "react-dom/client";

import { document, disposeEnvironment, resetEnvironment } from "./helpers/env.mjs";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const { NavIcon } = await import(
  "../packages/dsh-webui-transition-settings/src/nav-icon.js"
);

async function renderIcon(props = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await React.act(async () => {
    root.render(React.createElement(NavIcon, props));
  });
  return {
    svg: container.querySelector("svg"),
    async unmount() {
      await React.act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

beforeEach(() => {
  resetEnvironment();
});

after(() => {
  disposeEnvironment();
});

test("默认以 16px 渲染一个纯装饰 svg", async () => {
  const { svg, unmount } = await renderIcon();
  assert.ok(svg, "必须渲染 svg 元素");
  assert.ok(svg.getAttribute("viewBox"), "必须带 viewBox");
  assert.equal(svg.getAttribute("width"), "16");
  assert.equal(svg.getAttribute("height"), "16");
  assert.equal(svg.getAttribute("aria-hidden"), "true", "图标是装饰性的，对无障碍树隐藏");
  assert.equal(svg.textContent, "", "图标不得包含文本");
  assert.ok(svg.children.length > 0, "必须包含至少一个图形元素");
  await unmount();
});

test("size 控制方形边长", async () => {
  const { svg, unmount } = await renderIcon({ size: 20 });
  assert.equal(svg.getAttribute("width"), "20");
  assert.equal(svg.getAttribute("height"), "20");
  await unmount();
});

test("颜色只使用 currentColor / none，跟随外壳主题", async () => {
  const { svg, unmount } = await renderIcon();
  let inherited = 0;
  for (const element of svg.querySelectorAll("*")) {
    for (const name of ["fill", "stroke", "stop-color"]) {
      const value = element.getAttribute(name);
      if (value === null) continue;
      assert.ok(
        value === "currentColor" || value === "none",
        `${element.localName} 的 ${name} 必须是 currentColor 或 none，实际为 ${value}`,
      );
      if (value === "currentColor") inherited += 1;
    }
  }
  assert.ok(inherited > 0, "至少有一处使用 currentColor");
  await unmount();
});
