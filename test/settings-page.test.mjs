/**
 * test/settings-page.test.mjs — 设置页渲染 / 目标切换 / 字段提交 / 跨标签同步（真实 React）。
 *
 * Node 直接 import 源码时解析不到 shell 的 baseline 共享模块
 * `@deepseek-ai/dsh-client-ui-primitives`，用 Node 24 的 module.registerHooks
 * 把该 specifier 重定向到内联的 data: 模块桩（SegmentedControl / SegmentedTabs /
 * SettingsValueField，按真实组件的 DOM 契约实现），不新增 helper 文件。
 *
 * 依据：.agents/plan/v0.3.0/origin-aware-and-settings.md §2.4 / §3.6.1；
 * 动画参数字段见 .agents/plan/v1.1.0/animation-params.md §2.5 / §3.3.1 Agent B。
 */

import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { after, beforeEach, describe, test } from "node:test";

import React from "react";

import { document, disposeEnvironment, resetEnvironment, window } from "./helpers/env.mjs";
// react-dom 必须在 jsdom 全局装配之后求值：它在模块初始化时探测 document 与 input 事件支持，
// 否则会退回 IE 的 propertychange 兼容路径（jsdom 没有 attachEvent，事件会抛错）。
import { createRoot } from "react-dom/client";

import { normalizeSettings } from "../packages/dsh-webui-transition-settings/src/contract.js";

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

export function SegmentedTabs({ items, value, onChange, label }) {
  return React.createElement(
    "div",
    { "data-testid": "segmented-tabs" },
    React.createElement(
      "div",
      { role: "tablist", "aria-label": label },
      (items || []).map((item) =>
        React.createElement(
          "button",
          {
            key: item.value,
            type: "button",
            role: "tab",
            id: item.id,
            "data-value": item.value,
            "aria-selected": item.value === value ? "true" : "false",
            "aria-controls": item.panelId,
            onClick: () => onChange(item.value),
          },
          item.label,
        ),
      ),
    ),
  );
}

export function SettingsValueField(props) {
  return React.createElement(
    "div",
    { "data-testid": "value-field", "data-id": props.id },
    React.createElement("label", { htmlFor: props.id }, props.label),
    React.createElement("input", {
      id: props.id,
      value: props.text,
      "aria-invalid": props.invalid ? true : undefined,
      onChange: (event) => props.onEdit(event.target.value),
    }),
    props.invalid
      ? React.createElement("p", { "data-testid": "invalid" }, props.invalidLabel)
      : props.hint
        ? React.createElement("p", { "data-testid": "hint" }, props.hint)
        : null,
    props.overridden
      ? React.createElement("span", { "data-testid": "overridden" }, props.overriddenLabel)
      : null,
    props.overridden
      ? React.createElement(
          "button",
          { type: "button", "data-testid": "reset", onClick: props.onReset },
          props.resetLabel,
        )
      : null,
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
const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;

function createHarness(initial = {}) {
  let settings = normalizeSettings(initial);
  const writes = [];
  const emits = [];
  const Page = createSettingsPage({
    readSettings: () => normalizeSettings(settings),
    writeSettings: (next) => {
      const normalized = normalizeSettings(next);
      writes.push(normalized);
      settings = normalized;
      return true;
    },
    emit: (payload) => {
      emits.push(normalizeSettings(payload));
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
    stored: () => settings,
    setStored(next) {
      settings = normalizeSettings(next);
    },
  };
}

const translate = (key) => key;

async function renderPage(harness, props = { t: translate }) {
  await act(async () => {
    harness.root.render(React.createElement(harness.Page, props));
  });
  return harness.container;
}

async function unmount(harness) {
  await act(async () => {
    harness.root.unmount();
  });
  harness.container.remove();
}

function field(harness, id) {
  const input = harness.container.querySelector("#" + id);
  assert.ok(input, `找不到字段 #${id}`);
  return input;
}

function openTarget(harness, target) {
  return harness.container.querySelector("#dsh-webui-transition-target-" + target);
}

async function clickTarget(harness, target) {
  await act(async () => {
    openTarget(harness, target).click();
  });
}

async function changeValue(input, text) {
  await act(async () => {
    valueSetter.call(input, text);
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
}

// React 的 onBlur 由冒泡的 focusout 触发（组件的提交 wrapper 依赖这一点）。
async function blur(input) {
  await act(async () => {
    input.dispatchEvent(new window.FocusEvent("focusout", { bubbles: true }));
  });
}

async function pressEnter(input) {
  await act(async () => {
    input.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });
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

describe("createSettingsPage：结构", () => {
  test("渲染回退方式与四个目标 tab（默认全局），三个字段默认为空串", async () => {
    const harness = createHarness();
    try {
      await renderPage(harness);

      const fallbackTabs = harness.container.querySelectorAll(
        '[data-testid="segmented-control"] [role="tab"]',
      );
      assert.equal(fallbackTabs.length, 2, "回退方式仍是两个选项");
      assert.equal(fallbackTabs[0].getAttribute("aria-selected"), "true");

      const tabs = harness.container.querySelectorAll('[data-testid="segmented-tabs"] [role="tab"]');
      assert.equal(tabs.length, 4);
      assert.deepEqual(
        [...tabs].map((tab) => tab.getAttribute("data-value")),
        ["global", "menu", "dialog", "mask"],
      );
      assert.deepEqual(
        [...tabs].map((tab) => tab.getAttribute("aria-selected")),
        ["true", "false", "false", "false"],
      );
      assert.deepEqual(
        [...tabs].map((tab) => tab.textContent),
        ["targetGlobal", "targetMenu", "targetDialog", "targetMask"],
      );

      const panel = harness.container.querySelector('[role="tabpanel"]');
      assert.equal(panel.id, "dsh-webui-transition-panel-global");
      assert.equal(panel.getAttribute("aria-labelledby"), "dsh-webui-transition-target-global");

      for (const param of ["durationMs", "scaleFrom", "opacityFrom"]) {
        const input = field(harness, "dsh-webui-transition-global-" + param);
        assert.equal(input.value, "", `${param} 默认应为自动（空串）`);
      }
      assert.equal(
        harness.container.querySelectorAll('[data-testid="value-field"]').length,
        3,
        "当前目标显示三个字段",
      );
    } finally {
      await unmount(harness);
    }
  });

  test("缺 t 时用 key 兜底，不抛错", async () => {
    const harness = createHarness();
    try {
      await renderPage(harness, {});
      const tabs = harness.container.querySelectorAll('[data-testid="segmented-tabs"] [role="tab"]');
      assert.equal(tabs[0].textContent, "targetGlobal");
      assert.equal(field(harness, "dsh-webui-transition-global-durationMs").value, "");
    } finally {
      await unmount(harness);
    }
  });
});

describe("createSettingsPage：已存值与目标切换", () => {
  test("按已存值渲染全局与分表面字段；切换目标不写 storage", async () => {
    const harness = createHarness({
      durationMs: 120,
      surfaces: { menu: { scaleFrom: 0.96 }, mask: { opacityFrom: 0.5 } },
    });
    try {
      await renderPage(harness);
      assert.equal(field(harness, "dsh-webui-transition-global-durationMs").value, "120");
      assert.equal(field(harness, "dsh-webui-transition-global-scaleFrom").value, "");

      await clickTarget(harness, "menu");
      assert.equal(field(harness, "dsh-webui-transition-menu-durationMs").value, "");
      assert.equal(field(harness, "dsh-webui-transition-menu-scaleFrom").value, "0.96");
      assert.equal(
        harness.container.querySelector('[role="tabpanel"]').id,
        "dsh-webui-transition-panel-menu",
      );

      await clickTarget(harness, "mask");
      assert.equal(field(harness, "dsh-webui-transition-mask-opacityFrom").value, "0.5");

      assert.deepEqual(harness.writes, [], "切换目标不应写设置");
      assert.deepEqual(harness.emits, [], "切换目标不应广播设置");
    } finally {
      await unmount(harness);
    }
  });

  test("回退方式切换写入完整设置并 emit", async () => {
    const harness = createHarness();
    try {
      await renderPage(harness);
      const fallbackTabs = harness.container.querySelectorAll(
        '[data-testid="segmented-control"] [role="tab"]',
      );
      await act(async () => {
        fallbackTabs[1].click();
      });

      assert.equal(harness.writes.length, 1);
      assert.equal(harness.writes[0].fallback, "pointer");
      assert.deepEqual(harness.emits[0], harness.writes[0]);
      assert.equal(harness.stored().fallback, "pointer");
    } finally {
      await unmount(harness);
    }
  });
});

describe("createSettingsPage：字段提交", () => {
  test("失焦提交：写入完整设置对象并规范化输入框", async () => {
    const harness = createHarness();
    try {
      await renderPage(harness);
      const input = field(harness, "dsh-webui-transition-global-durationMs");
      await changeValue(input, "240");
      await blur(input);

      assert.equal(harness.writes.length, 1);
      assert.equal(harness.writes[0].durationMs, 240);
      assert.equal(harness.writes[0].fallback, "fade");
      assert.equal(harness.writes[0].scaleFrom, null);
      assert.deepEqual(harness.emits[0], harness.writes[0]);
      assert.equal(field(harness, "dsh-webui-transition-global-durationMs").value, "240");
      assert.ok(
        harness.container.querySelector('[data-testid="overridden"]'),
        "有值时显示「已自定义」徽标",
      );
    } finally {
      await unmount(harness);
    }
  });

  test("Enter 提交：分表面字段写入对应 surfaces 组", async () => {
    const harness = createHarness();
    try {
      await renderPage(harness);
      await clickTarget(harness, "menu");
      const input = field(harness, "dsh-webui-transition-menu-scaleFrom");
      await changeValue(input, "0.91");
      await pressEnter(input);

      assert.equal(harness.writes.length, 1);
      assert.equal(harness.writes[0].surfaces.menu.scaleFrom, 0.91);
      assert.equal(field(harness, "dsh-webui-transition-menu-scaleFrom").value, "0.91");
    } finally {
      await unmount(harness);
    }
  });

  test("值未变化时提交不写 storage、不 emit", async () => {
    const harness = createHarness({ durationMs: 120 });
    try {
      await renderPage(harness);
      const input = field(harness, "dsh-webui-transition-global-durationMs");
      await changeValue(input, "120");
      await blur(input);
      assert.deepEqual(harness.writes, []);
      assert.deepEqual(harness.emits, []);
    } finally {
      await unmount(harness);
    }
  });

  test("有限数按 SETTINGS_RANGES 四舍五入并 clamp", async () => {
    const harness = createHarness();
    try {
      await renderPage(harness);

      const duration = field(harness, "dsh-webui-transition-global-durationMs");
      await changeValue(duration, "5000");
      await blur(duration);
      assert.equal(harness.writes.at(-1).durationMs, 1000);

      const scale = field(harness, "dsh-webui-transition-global-scaleFrom");
      await changeValue(scale, "0.1");
      await blur(scale);
      assert.equal(harness.writes.at(-1).scaleFrom, 0.5);

      const rounded = field(harness, "dsh-webui-transition-global-opacityFrom");
      await changeValue(rounded, "0.456");
      await blur(rounded);
      assert.equal(harness.writes.at(-1).opacityFrom, 0.46);
    } finally {
      await unmount(harness);
    }
  });

  test("非有限数：显示 invalid、不写、失焦回退到已存值", async () => {
    const harness = createHarness({ durationMs: 120 });
    try {
      await renderPage(harness);
      const input = field(harness, "dsh-webui-transition-global-durationMs");
      await changeValue(input, "abc");
      assert.ok(
        harness.container.querySelector('[data-testid="invalid"]'),
        "输入非数字时显示 invalid 提示",
      );
      await blur(input);

      assert.deepEqual(harness.writes, [], "非法值不得写入");
      assert.equal(field(harness, "dsh-webui-transition-global-durationMs").value, "120");
      assert.equal(
        harness.container.querySelector('[data-testid="invalid"]'),
        null,
        "回退后 invalid 提示消失",
      );
    } finally {
      await unmount(harness);
    }
  });

  test("空串提交为自动（null），徽标消失", async () => {
    const harness = createHarness({ durationMs: 120 });
    try {
      await renderPage(harness);
      assert.ok(harness.container.querySelector('[data-testid="overridden"]'));

      const input = field(harness, "dsh-webui-transition-global-durationMs");
      await changeValue(input, "");
      await blur(input);

      assert.equal(harness.writes.length, 1);
      assert.equal(harness.writes[0].durationMs, null);
      assert.equal(
        harness.container.querySelector('[data-testid="overridden"]'),
        null,
        "自动值不再显示徽标",
      );
    } finally {
      await unmount(harness);
    }
  });

  test("重置按钮把字段改为自动（null）", async () => {
    const harness = createHarness({ durationMs: 120 });
    try {
      await renderPage(harness);
      const reset = harness.container.querySelector('[data-testid="reset"]');
      assert.ok(reset, "有值时显示重置按钮");
      await act(async () => {
        reset.click();
      });

      assert.equal(harness.writes.at(-1).durationMs, null);
      assert.equal(harness.stored().durationMs, null);
      assert.equal(
        harness.container.querySelector('[data-testid="reset"]'),
        null,
        "重置后按钮消失",
      );
    } finally {
      await unmount(harness);
    }
  });
});

describe("createSettingsPage：跨标签同步", () => {
  test("storage 事件（key 为 SETTINGS_KEY 或 null）刷新字段，其它 key 忽略", async () => {
    const harness = createHarness();
    try {
      await renderPage(harness);

      harness.setStored({ durationMs: 300 });
      await dispatchStorage(SETTINGS_KEY);
      assert.equal(field(harness, "dsh-webui-transition-global-durationMs").value, "300");

      harness.setStored({ durationMs: 50 });
      await dispatchStorage("some.other.key");
      assert.equal(
        field(harness, "dsh-webui-transition-global-durationMs").value,
        "300",
        "其它 key 不应刷新",
      );

      await dispatchStorage(null);
      assert.equal(
        field(harness, "dsh-webui-transition-global-durationMs").value,
        "50",
        "key 为 null（clear）时也刷新",
      );
    } finally {
      await unmount(harness);
    }
  });

  test("storage 同步会清理正在编辑的草稿", async () => {
    const harness = createHarness({ durationMs: 120 });
    try {
      await renderPage(harness);
      await changeValue(field(harness, "dsh-webui-transition-global-durationMs"), "900");
      harness.setStored({ durationMs: 400 });
      await dispatchStorage(SETTINGS_KEY);
      assert.equal(field(harness, "dsh-webui-transition-global-durationMs").value, "400");
    } finally {
      await unmount(harness);
    }
  });
});
