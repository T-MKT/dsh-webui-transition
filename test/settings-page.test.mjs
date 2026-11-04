/**
 * test/settings-page.test.mjs — 设置页渲染 / 切换 / 跨标签同步（真实 React）。
 *
 * Node 直接 import 源码时解析不到 shell 的 baseline 共享模块
 * `@deepseek-ai/dsh-client-ui-primitives`，用 Node 24 的 module.registerHooks
 * 把该 specifier 重定向到内联的 data: 模块桩（SegmentedControl →
 * role="tablist" + 两个 role="tab" 按钮），不新增 helper 文件。
 *
 * 依据：.agents/plan/v0.3.0/origin-aware-and-settings.md §2.4 / §3.6.1。
 */

import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { after, beforeEach, describe, test } from "node:test";

import React from "react";
import { createRoot } from "react-dom/client";

import { document, disposeEnvironment, resetEnvironment, window } from "./helpers/env.mjs";

const PRIMITIVES = "@deepseek-ai/dsh-client-ui-primitives";
const SETTINGS_KEY = "dsh.webui-transition.settings.v1";

// 桩用 globalThis 上的 React（由本测试注入），避免 data: 模块解析 bare specifier。
const STUB_SOURCE = `
const React = globalThis.__DSH_SETTINGS_TEST_REACT__;

export function SegmentedControl({ id, label, value, options, onChange }) {
  return React.createElement(
    "div",
    { "data-testid": "segmented-control", "data-id": id },
    React.createElement("span", { "data-testid": "segmented-label" }, label),
    React.createElement(
      "div",
      { role: "tablist", "aria-label": label },
      (options || []).map((option) =>
        React.createElement(
          "button",
          {
            key: option.value,
            type: "button",
            role: "tab",
            "data-value": option.value,
            "aria-selected": option.value === value ? "true" : "false",
            onClick: () => onChange(option.value),
          },
          option.label,
        ),
      ),
    ),
  );
}
`;

const STUB_URL = `data:text/javascript;base64,${Buffer.from(STUB_SOURCE).toString("base64")}`;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === PRIMITIVES) return { url: STUB_URL, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});

globalThis.__DSH_SETTINGS_TEST_REACT__ = React;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// 必须在 registerHooks 之后动态 import，源码里的 primitives 依赖才会命中桩。
const { createSettingsPage } = await import(
  "../packages/dsh-webui-transition-settings/src/settings-page.js"
);

const act = React.act;

function createHarness(initial = "fade") {
  let settings = { fallback: initial };
  const writes = [];
  const emits = [];
  const Page = createSettingsPage({
    readSettings: () => ({ fallback: settings.fallback }),
    writeSettings: (next) => {
      writes.push(next);
      settings = { fallback: next.fallback };
      return true;
    },
    emit: (payload) => {
      emits.push(payload);
    },
  });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  return {
    Page,
    container,
    root,
    writes,
    emits,
    setSettings(next) {
      settings = { fallback: next.fallback };
    },
  };
}

const translate = (key) => key;

async function renderPage(harness, props = { t: translate }) {
  await act(async () => {
    harness.root.render(React.createElement(harness.Page, props));
  });
  return harness.container.querySelectorAll('[role="tab"]');
}

async function unmount(harness) {
  await act(async () => {
    harness.root.unmount();
  });
  harness.container.remove();
}

async function dispatchStorage(key) {
  await act(async () => {
    window.dispatchEvent(new window.StorageEvent("storage", { key }));
  });
}

beforeEach(() => {
  resetEnvironment();
});

after(() => {
  disposeEnvironment();
});

describe("createSettingsPage", () => {
  test("渲染两个回退选项，默认选中 fade", async () => {
    const harness = createHarness("fade");
    try {
      const tabs = await renderPage(harness);
      assert.equal(tabs.length, 2, "SegmentedControl 应渲染两个选项");
      assert.equal(tabs[0].textContent, "fallbackFade");
      assert.equal(tabs[1].textContent, "fallbackPointer");
      assert.equal(tabs[0].getAttribute("aria-selected"), "true");
      assert.equal(tabs[1].getAttribute("aria-selected"), "false");

      const control = harness.container.querySelector('[data-testid="segmented-control"]');
      assert.equal(control.getAttribute("data-id"), "dsh-webui-transition-fallback");
      assert.equal(
        harness.container.querySelector('[data-testid="segmented-label"]').textContent,
        "title",
      );
    } finally {
      await unmount(harness);
    }
  });

  test("读取已保存的 pointer 设置作为默认选中项", async () => {
    const harness = createHarness("pointer");
    try {
      const tabs = await renderPage(harness);
      assert.equal(tabs[0].getAttribute("aria-selected"), "false");
      assert.equal(tabs[1].getAttribute("aria-selected"), "true");
    } finally {
      await unmount(harness);
    }
  });

  test("点击 pointer 写设置、emit 事件并切换选中态", async () => {
    const harness = createHarness("fade");
    try {
      let tabs = await renderPage(harness);
      await act(async () => {
        tabs[1].click();
      });

      assert.deepEqual(harness.writes, [{ fallback: "pointer" }]);
      assert.deepEqual(harness.emits, [{ fallback: "pointer" }]);

      tabs = harness.container.querySelectorAll('[role="tab"]');
      assert.equal(tabs[0].getAttribute("aria-selected"), "false");
      assert.equal(tabs[1].getAttribute("aria-selected"), "true");
    } finally {
      await unmount(harness);
    }
  });

  test("storage 事件同步跨标签页变更（key 为 SETTINGS_KEY 或 null）", async () => {
    const harness = createHarness("fade");
    try {
      let tabs = await renderPage(harness);

      harness.setSettings({ fallback: "pointer" });
      await dispatchStorage(SETTINGS_KEY);
      tabs = harness.container.querySelectorAll('[role="tab"]');
      assert.equal(tabs[1].getAttribute("aria-selected"), "true", "应同步为 pointer");

      harness.setSettings({ fallback: "fade" });
      await dispatchStorage(null);
      assert.equal(
        harness.container.querySelectorAll('[role="tab"]')[0].getAttribute("aria-selected"),
        "true",
        "key 为 null（clear）时也同步",
      );
    } finally {
      await unmount(harness);
    }
  });

  test("storage 事件忽略其它 key", async () => {
    const harness = createHarness("fade");
    try {
      await renderPage(harness);
      harness.setSettings({ fallback: "pointer" });
      await dispatchStorage("some.other.key");
      assert.deepEqual(
        [...harness.container.querySelectorAll('[role="tab"]')].map((tab) =>
          tab.getAttribute("aria-selected"),
        ),
        ["true", "false"],
      );
    } finally {
      await unmount(harness);
    }
  });

  test("缺少 t 时用 key 兜底，不抛错", async () => {
    const harness = createHarness("fade");
    try {
      const tabs = await renderPage(harness, {});
      assert.equal(tabs[0].textContent, "fallbackFade");
      assert.equal(
        harness.container.querySelector('[data-testid="segmented-label"]').textContent,
        "title",
      );
    } finally {
      await unmount(harness);
    }
  });
});
