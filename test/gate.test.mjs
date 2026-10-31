/**
 * test/gate.test.mjs — createGate 四重门卫单测。
 *
 * 依据：.plan/v0.2.0/plan-b-rewrite.md §3.5（模块设计）、§4（冻结签名）、§5.3（测试要点）。
 * 装配：test/helpers/env.mjs（jsdom / computedStyle / fake animate / DOM fixture）。
 */

import { after, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";

import { createGate } from "../src/gate.js";
import {
  buildMenu,
  buildSettingsOverlay,
  computedStyle,
  disposeEnvironment,
  document,
  resetEnvironment,
} from "./helpers/env.mjs";

const gate = createGate({ computedStyle });

/**
 * 写内联 transition。
 *
 * 真浏览器会把 `transition` 简写展开成 transition-property / transition-duration 两条
 * computed 长属性；jsdom 的 cssstyle 不展开该简写，因此这里用等价的内联长属性表达
 * `transition: <property> <duration>`，门卫读取到的 computed 值与浏览器一致。
 */
function setInlineTransition(element, property, duration) {
  element.style.transitionProperty = property;
  element.style.transitionDuration = duration;
  return element;
}

function mount(element) {
  document.body.append(element);
  return element;
}

beforeEach(() => {
  resetEnvironment();
});

after(() => {
  disposeEnvironment();
});

// ---------------------------------------------------------------------------
// 门卫 1：排除区（isExcluded）
// ---------------------------------------------------------------------------

describe("门卫 1：排除区", () => {
  test('data-dsh-transition="off" 容器内的表面被拒绝', () => {
    const region = document.createElement("div");
    region.setAttribute("data-dsh-transition", "off");
    const menu = buildMenu();
    region.append(menu);
    mount(region);

    assert.equal(gate.canAnimate(menu, "menu"), false);
  });

  test("排除区外的同类表面照常放行（对照组）", () => {
    const menu = mount(buildMenu());

    assert.equal(gate.canAnimate(menu, "menu"), true);
  });
});

// ---------------------------------------------------------------------------
// 门卫 2：可见性（isAtLeastSelfVisible）
// ---------------------------------------------------------------------------

describe("门卫 2：不可见", () => {
  test("自身 hidden 被拒绝", () => {
    const menu = mount(buildMenu());
    menu.hidden = true;

    assert.equal(gate.canAnimate(menu, "menu"), false);
  });

  test('祖先 aria-hidden="true" 被拒绝', () => {
    const wrapper = document.createElement("div");
    wrapper.setAttribute("aria-hidden", "true");
    const menu = buildMenu();
    wrapper.append(menu);
    mount(wrapper);

    assert.equal(gate.canAnimate(menu, "menu"), false);
  });

  test("自身 display:none 被拒绝", () => {
    const menu = mount(buildMenu());
    menu.style.display = "none";

    assert.equal(gate.canAnimate(menu, "menu"), false);
  });

  test("祖先 display:none 被拒绝", () => {
    const wrapper = document.createElement("div");
    wrapper.style.display = "none";
    const menu = buildMenu();
    wrapper.append(menu);
    mount(wrapper);

    assert.equal(gate.canAnimate(menu, "menu"), false);
  });

  test("祖先 hidden 被拒绝", () => {
    const wrapper = document.createElement("div");
    wrapper.hidden = true;
    const menu = buildMenu();
    wrapper.append(menu);
    mount(wrapper);

    assert.equal(gate.canAnimate(menu, "menu"), false);
  });
});

// ---------------------------------------------------------------------------
// 门卫 3：宿主 WAAPI / CSS animation
// ---------------------------------------------------------------------------

describe("门卫 3：宿主动画", () => {
  test("宿主 WAAPI 动画在播时被拒绝", () => {
    const menu = mount(buildMenu());
    menu.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150 });

    assert.equal(gate.canAnimate(menu, "menu"), false);
    // ownedAnimations 缺省按空集处理：仍应拒绝。
    assert.equal(gate.canAnimate(menu, "menu", undefined), false);
  });

  test("把该动画放入 ownedAnimations 后放行", () => {
    const menu = mount(buildMenu());
    const animation = menu.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150 });

    assert.equal(gate.canAnimate(menu, "menu", new Set([animation])), true);
  });

  test("宿主 CSS animation-name 非 none 时被拒绝", () => {
    const menu = mount(buildMenu());
    menu.style.animationName = "pulse";

    assert.equal(gate.canAnimate(menu, "menu"), false);
  });
});

// ---------------------------------------------------------------------------
// 门卫 4：新增宿主 CSS transition 冲突（§3.5）
// ---------------------------------------------------------------------------

describe("门卫 4：宿主 CSS transition 冲突", () => {
  test("dialog 上内联 transition: opacity .2s 被拒绝", () => {
    const { panel } = buildSettingsOverlay();
    mount(panel);
    setInlineTransition(panel, "opacity", ".2s");

    assert.equal(gate.canAnimate(panel, "dialog"), false);
  });

  test("dialog 上内联 transition: color .2s 放行（不交叠）", () => {
    const { panel } = buildSettingsOverlay();
    mount(panel);
    setInlineTransition(panel, "color", ".2s");

    assert.equal(gate.canAnimate(panel, "dialog"), true);
  });

  test("dialog 上内联 transition: opacity 0s 放行（时长不为正）", () => {
    const { panel } = buildSettingsOverlay();
    mount(panel);
    setInlineTransition(panel, "opacity", "0s");

    assert.equal(gate.canAnimate(panel, "dialog"), true);
  });

  test("dialog 上 transition-property: all 且时长 > 0 被拒绝", () => {
    const { panel } = buildSettingsOverlay();
    mount(panel);
    setInlineTransition(panel, "all", "200ms");

    assert.equal(gate.canAnimate(panel, "dialog"), false);
  });

  test("duration 列表按属性索引取模循环", () => {
    const { panel } = buildSettingsOverlay();
    mount(panel);
    // 第 0 项 color 对应 .1s，第 1 项 opacity 对应 .2s → 命中正时长。
    setInlineTransition(panel, "color, opacity", ".1s, .2s");

    assert.equal(gate.canAnimate(panel, "dialog"), false);
  });

  test("menu 上内联 transition: box-shadow .2s 被拒绝", () => {
    const menu = mount(buildMenu());
    setInlineTransition(menu, "box-shadow", ".2s");

    assert.equal(gate.canAnimate(menu, "menu"), false);
  });

  test("menu 表面不写 opacity：内联 transition: opacity .2s 放行", () => {
    const menu = mount(buildMenu());
    setInlineTransition(menu, "opacity", ".2s");

    assert.equal(gate.canAnimate(menu, "menu"), true);
  });

  test("mask 上内联 transition: translate .2s 放行（mask 不动画 translate）", () => {
    const { mask } = buildSettingsOverlay();
    mount(mask);
    setInlineTransition(mask, "translate", ".2s");

    assert.equal(gate.canAnimate(mask, "mask"), true);
  });

  test("kind 决定属性集合；未知 kind 回退 SURFACE_DEFS.menu", () => {
    const menu = mount(buildMenu());
    setInlineTransition(menu, "box-shadow", ".2s");

    assert.equal(gate.canAnimate(menu, "mask"), true);
    assert.equal(gate.canAnimate(menu, "no-such-kind"), false);
  });
});

// ---------------------------------------------------------------------------
// 入参
// ---------------------------------------------------------------------------

describe("非元素入参", () => {
  test("null / undefined / 普通对象 / 文本节点返回 false", () => {
    const text = document.createTextNode("gate");

    assert.equal(gate.canAnimate(null, "menu"), false);
    assert.equal(gate.canAnimate(undefined, "menu"), false);
    assert.equal(gate.canAnimate({}, "menu"), false);
    assert.equal(gate.canAnimate(text, "menu"), false);
  });
});
