/**
 * test/nav-icon.test.mjs — 设置导航图标组件（settings.section.icon，真实 React + jsdom）。
 *
 * 断言组件交给外壳的渲染契约：16px 方形、currentColor 描边、纯装饰无文本；
 * 并与设置包内插件页 logo（`assets/icons/logo.svg`）比对路径数据——同一份
 * logo 在两处消费，任何一侧改动都会让本测试失败，避免视觉漂移。
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, beforeEach, test } from "node:test";

import React from "react";
import { createRoot } from "react-dom/client";

import { document, disposeEnvironment, resetEnvironment, window } from "./helpers/env.mjs";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const { NavIcon } = await import(
  "../packages/dsh-webui-transition-settings/src/nav-icon.js"
);

const LOGO_URL = new URL(
  "../packages/dsh-webui-transition-settings/assets/icons/logo.svg",
  import.meta.url,
);

/** XML 属性值里的换行/缩进归一，便于跨 DOM 与源文件比对。 */
function normalize(value) {
  return value.trim().replace(/\s+/g, " ");
}

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
  assert.equal(svg.getAttribute("viewBox"), "0 0 16 16");
  assert.equal(svg.getAttribute("width"), "16");
  assert.equal(svg.getAttribute("height"), "16");
  assert.equal(svg.getAttribute("fill"), "none");
  assert.equal(svg.getAttribute("aria-hidden"), "true", "图标是装饰性的，对无障碍树隐藏");
  assert.equal(svg.textContent, "", "图标不得包含文本");
  await unmount();
});

test("size 控制方形边长", async () => {
  const { svg, unmount } = await renderIcon({ size: 20 });
  assert.equal(svg.getAttribute("width"), "20");
  assert.equal(svg.getAttribute("height"), "20");
  await unmount();
});

test("路径数据与插件页 logo 一致", async () => {
  const { svg, unmount } = await renderIcon();
  const source = await readFile(LOGO_URL, "utf8");
  const parsed = new window.DOMParser().parseFromString(source, "image/svg+xml");
  const expected = [...parsed.querySelectorAll("path")];
  const actual = [...svg.querySelectorAll("path")];

  assert.equal(actual.length, expected.length, "path 数量必须与 assets/icons/logo.svg 一致");
  for (const [index, path] of actual.entries()) {
    for (const name of ["d", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin"]) {
      assert.equal(
        normalize(path.getAttribute(name) ?? ""),
        normalize(expected[index].getAttribute(name) ?? ""),
        `第 ${index + 1} 条 path 的 ${name} 必须与 assets/icons/logo.svg 一致`,
      );
    }
  }
  await unmount();
});
