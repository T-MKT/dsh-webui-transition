/**
 * test/origin.test.mjs — src/origin.js 单测。
 *
 * 依据：.agents/plan/v0.3.0/origin-aware-and-settings.md §2.5（冻结行为）/
 * §2.7（冻结签名）/ §2.3（测试覆盖：解析优先级、邻接闸门、2.5s 新鲜度、
 * geometry 的 clamp/方向/零尺寸、指针点模式）。
 *
 * jsdom 的 getBoundingClientRect 全 0，因此每个参与布局断言的元素都显式 stub；
 * 指针事件用 MouseEvent 派发到元素并冒泡到 window 的 capture 监听（与真实浏览器一致）。
 * 时间由注入的 `now` 控制，避免依赖真实计时器。
 */

import assert from "node:assert/strict";
import { after, afterEach, beforeEach, describe, test } from "node:test";

import { createInteractionTracker, geometryForSource } from "../src/origin.js";
import {
  disposeEnvironment,
  document,
  resetEnvironment,
  window,
} from "./helpers/env.mjs";

const FRESH_MS = 2500;
const trackers = [];

// ---------------------------------------------------------------------------
// 测试装配
// ---------------------------------------------------------------------------

function createElement(tagName, attributes = {}) {
  const element = document.createElement(tagName);
  for (const [name, value] of Object.entries(attributes)) {
    if (value === true) element.setAttribute(name, "");
    else if (value !== undefined && value !== null && value !== false) {
      element.setAttribute(name, String(value));
    }
  }
  return element;
}

/** 矩形字面量：与浏览器 DOMRect 同形，避免被测模块走 width 推导分支。 */
function makeRect(left, top, width, height) {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
  };
}

/** jsdom 不布局：显式 stub 元素的 getBoundingClientRect。 */
function stubRect(element, left, top, width, height) {
  const rect = makeRect(left, top, width, height);
  element.getBoundingClientRect = () => rect;
  return element;
}

function appendToBody(...elements) {
  document.body.append(...elements);
  return elements.length === 1 ? elements[0] : elements;
}

/** 注入可控 now 的 tracker；afterEach 统一 stop，避免监听器跨用例残留。 */
function createTracker() {
  const time = { now: 0 };
  const tracker = createInteractionTracker({ window, document, now: () => time.now });
  trackers.push(tracker);
  return { tracker, time };
}

function firePointer(target, type, { clientX = 0, clientY = 0 } = {}) {
  target.dispatchEvent(
    new window.MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY }),
  );
}

function fireKeydown(target) {
  target.dispatchEvent(new window.KeyboardEvent("keydown", { bubbles: true, cancelable: true }));
}

function assertClose(actual, expected, label) {
  assert.ok(
    Math.abs(actual - expected) <= 1e-9,
    `${label}: 期望 ${expected}，实际 ${actual}`,
  );
}

beforeEach(() => {
  resetEnvironment();
});

afterEach(() => {
  for (const tracker of trackers.splice(0)) tracker.stop();
});

after(() => {
  disposeEnvironment();
});

// ---------------------------------------------------------------------------
// 1. DOM 邻接（优先级 1）
// ---------------------------------------------------------------------------

describe("resolve：DOM 邻接优先于 aria / 指针 / 键盘", () => {
  test("子菜单：surface 是 menuitem 后代时取该 menuitem", () => {
    const { tracker } = createTracker();
    tracker.start();

    const menu = createElement("div", { role: "menu" });
    const trigger = createElement("div", { role: "menuitem", "aria-haspopup": "true" });
    const surface = createElement("div", { role: "menu" });
    trigger.append(surface);
    appendToBody(menu);
    menu.append(trigger);

    stubRect(trigger, 100, 100, 80, 20);
    stubRect(surface, 180, 120, 120, 80);

    assert.deepEqual(tracker.resolve(surface), {
      kind: "element",
      rect: makeRect(100, 100, 80, 20),
    });
  });

  test("子菜单：trigger 与 submenu 是父级 role=menu 下的兄弟时取该 menuitem", () => {
    const { tracker } = createTracker();
    tracker.start();

    const menu = createElement("div", { role: "menu" });
    const trigger = createElement("div", { role: "menuitem", "aria-haspopup": "true" });
    const surface = createElement("div", { role: "menu" });
    menu.append(trigger, surface);
    appendToBody(menu);

    stubRect(trigger, 200, 200, 90, 24);
    stubRect(surface, 290, 200, 140, 120);

    assert.deepEqual(tracker.resolve(surface), {
      kind: "element",
      rect: makeRect(200, 200, 90, 24),
    });
  });

  test("非 portal wrapper：取 wrapper 内不在 surface 中的 trigger", () => {
    const { tracker } = createTracker();
    tracker.start();

    const wrapper = createElement("div", { class: "wrapper" });
    const trigger = createElement("button", { "aria-haspopup": "true" });
    const surface = createElement("div", { role: "menu" });
    wrapper.append(trigger, surface);
    appendToBody(wrapper);

    stubRect(trigger, 50, 50, 120, 32);
    stubRect(surface, 50, 82, 200, 100);

    assert.deepEqual(tracker.resolve(surface), {
      kind: "element",
      rect: makeRect(50, 50, 120, 32),
    });
  });

  test("wrapper 内多个 trigger 时取与 surface 中心最近者", () => {
    const { tracker } = createTracker();
    tracker.start();

    const wrapper = createElement("div", { class: "wrapper" });
    const far = createElement("button", { class: "far" });
    const near = createElement("button", { class: "near" });
    const surface = createElement("div", { role: "menu" });
    wrapper.append(far, near, surface);
    appendToBody(wrapper);

    stubRect(far, 0, 0, 20, 20);
    stubRect(near, 240, 100, 20, 20);
    stubRect(surface, 260, 0, 100, 100);

    assert.deepEqual(tracker.resolve(surface), {
      kind: "element",
      rect: makeRect(240, 100, 20, 20),
    });
  });

  test("surface 直接挂在 body 时 body 不算 wrapper，不误取页面内 trigger", () => {
    const { tracker } = createTracker();
    tracker.start();

    const trigger = createElement("button", { "aria-haspopup": "true" });
    const surface = createElement("div", { role: "menu" });
    appendToBody(trigger, surface);

    stubRect(trigger, 0, 0, 40, 20);
    stubRect(surface, 0, 30, 100, 100);

    assert.equal(tracker.resolve(surface), null);
  });

  test("DOM 邻接优先于 aria-controls", () => {
    const { tracker } = createTracker();
    tracker.start();

    const wrapper = createElement("div", { class: "wrapper" });
    const adjacentTrigger = createElement("button", { class: "adjacent" });
    const surface = createElement("div", { role: "menu", id: "menu-panel" });
    wrapper.append(adjacentTrigger, surface);
    appendToBody(wrapper);

    const ariaTrigger = createElement("button", { "aria-controls": "menu-panel" });
    appendToBody(ariaTrigger);

    stubRect(adjacentTrigger, 10, 10, 60, 24);
    stubRect(ariaTrigger, 500, 500, 60, 24);
    stubRect(surface, 10, 34, 120, 80);

    assert.deepEqual(tracker.resolve(surface), {
      kind: "element",
      rect: makeRect(10, 10, 60, 24),
    });
  });
});

// ---------------------------------------------------------------------------
// 2. aria-controls（优先级 2）
// ---------------------------------------------------------------------------

describe("resolve：aria-controls 关联", () => {
  test("surface.id → [aria-controls~='id'] 控制器", () => {
    const { tracker } = createTracker();
    tracker.start();

    const trigger = createElement("button", { "aria-controls": "menu-panel" });
    const surface = createElement("div", { role: "menu", id: "menu-panel" });
    appendToBody(trigger, surface);

    stubRect(trigger, 100, 100, 80, 24);
    stubRect(surface, 100, 124, 200, 120);

    assert.deepEqual(tracker.resolve(surface), {
      kind: "element",
      rect: makeRect(100, 100, 80, 24),
    });
    // aria-controls 允许 token 列表，~= 需按词匹配。
    trigger.setAttribute("aria-controls", "other menu-panel");
    assert.deepEqual(tracker.resolve(surface), {
      kind: "element",
      rect: makeRect(100, 100, 80, 24),
    });
  });

  test("aria-controls 优先于展开态邻接扫描", () => {
    const { tracker } = createTracker();
    tracker.start();

    const ariaTrigger = createElement("button", { "aria-controls": "menu-panel" });
    const expandedTrigger = createElement("button", {
      "aria-expanded": "true",
      "aria-haspopup": "true",
    });
    const surface = createElement("div", { role: "menu", id: "menu-panel" });
    appendToBody(ariaTrigger, expandedTrigger, surface);

    stubRect(ariaTrigger, 0, 0, 40, 20);
    stubRect(expandedTrigger, 100, 100, 60, 20);
    stubRect(surface, 100, 120, 160, 80);

    assert.deepEqual(tracker.resolve(surface), {
      kind: "element",
      rect: makeRect(0, 0, 40, 20),
    });
  });
});

// ---------------------------------------------------------------------------
// 3. 展开态扫描 + 邻接闸门（优先级 3）
// ---------------------------------------------------------------------------

describe("resolve：aria-expanded 展开态扫描与邻接闸门", () => {
  test("相邻 trigger（投影重叠、间隙 0）通过闸门", () => {
    const { tracker } = createTracker();
    tracker.start();

    const surface = createElement("div", { role: "menu" });
    const trigger = createElement("button", {
      "aria-expanded": "true",
      "aria-haspopup": "true",
    });
    appendToBody(surface, trigger);

    stubRect(surface, 100, 200, 200, 150);
    stubRect(trigger, 100, 170, 80, 30);

    assert.deepEqual(tracker.resolve(surface), {
      kind: "element",
      rect: makeRect(100, 170, 80, 30),
    });
  });

  test("间隙 >24px 的远离元素被闸门拒绝", () => {
    const { tracker } = createTracker();
    tracker.start();

    const surface = createElement("div", { role: "menu" });
    const trigger = createElement("button", {
      "aria-expanded": "true",
      "aria-haspopup": "true",
    });
    appendToBody(surface, trigger);

    stubRect(surface, 100, 300, 200, 100);
    stubRect(trigger, 100, 100, 80, 30); // 垂直间隙 170px

    assert.equal(tracker.resolve(surface), null);
  });

  test("中心距 >1400px 的元素被闸门拒绝（即使边缘间隙只有 24px）", () => {
    const { tracker } = createTracker();
    tracker.start();

    const surface = createElement("div", { role: "menu" });
    const trigger = createElement("button", {
      "aria-expanded": "true",
      "aria-haspopup": "true",
    });
    appendToBody(surface, trigger);

    stubRect(surface, 0, 0, 3000, 3000); // 中心 (1500, 1500)
    stubRect(trigger, 0, 3024, 3000, 600); // 中心 (1500, 3324)，距 1824px

    assert.equal(tracker.resolve(surface), null);
  });

  test("无轴投影重叠但最近边距 ≤24px 时通过闸门", () => {
    const { tracker } = createTracker();
    tracker.start();

    const surface = createElement("div", { role: "menu" });
    const trigger = createElement("button", {
      "aria-expanded": "true",
      "aria-haspopup": "true",
    });
    appendToBody(surface, trigger);

    stubRect(surface, 0, 0, 100, 100);
    stubRect(trigger, 110, 110, 20, 20); // dx=10, dy=10，最近边距 ≈14.1px

    assert.deepEqual(tracker.resolve(surface), {
      kind: "element",
      rect: makeRect(110, 110, 20, 20),
    });
  });

  test("多个通过闸门的候选取中心距离最近者", () => {
    const { tracker } = createTracker();
    tracker.start();

    const surface = createElement("div", { role: "menu" });
    const near = createElement("button", { "aria-expanded": "true", "aria-haspopup": "true" });
    const far = createElement("button", { "aria-expanded": "true", "aria-haspopup": "true" });
    appendToBody(surface, near, far);

    stubRect(surface, 0, 0, 100, 100);
    stubRect(near, 0, 110, 100, 20); // 间隙 10px
    stubRect(far, 0, 124, 100, 20); // 间隙 24px，仍在闸门内但更远

    assert.deepEqual(tracker.resolve(surface), {
      kind: "element",
      rect: makeRect(0, 110, 100, 20),
    });
  });

  test("排除 surface 内部元素与 transition ghost", () => {
    const { tracker } = createTracker();
    tracker.start();

    const surface = createElement("div", { role: "menu" });
    const inside = createElement("button", {
      "aria-expanded": "true",
      "aria-haspopup": "true",
    });
    const ghost = createElement("button", {
      "aria-expanded": "true",
      "aria-haspopup": "true",
      "data-dsh-transition-ghost": "",
    });
    surface.append(inside);
    appendToBody(surface, ghost);

    stubRect(surface, 0, 0, 100, 100);
    stubRect(inside, 105, 0, 20, 20);
    stubRect(ghost, 125, 0, 20, 20);

    assert.equal(tracker.resolve(surface), null);
  });
});

// ---------------------------------------------------------------------------
// 4. 最近指针目标（优先级 4）
// ---------------------------------------------------------------------------

describe("resolve：最近指针目标与 2.5s 新鲜度", () => {
  test("pointerdown 后返回事件目标的矩形", () => {
    const { tracker, time } = createTracker();
    tracker.start();

    const surface = createElement("div", { role: "menu" });
    const button = createElement("button");
    appendToBody(surface, button);
    stubRect(surface, 0, 0, 100, 100);
    stubRect(button, 300, 300, 40, 40);

    time.now = 100;
    firePointer(button, "pointerdown", { clientX: 310, clientY: 310 });
    time.now = 200;

    assert.deepEqual(tracker.resolve(surface), {
      kind: "element",
      rect: makeRect(300, 300, 40, 40),
    });
  });

  test("记录在 2500ms 内有效，超过后失效", () => {
    const { tracker, time } = createTracker();
    tracker.start();

    const surface = createElement("div", { role: "menu" });
    const button = createElement("button");
    appendToBody(surface, button);
    stubRect(surface, 0, 0, 100, 100);
    stubRect(button, 300, 300, 40, 40);

    time.now = 0;
    firePointer(button, "pointerdown", { clientX: 1, clientY: 1 });

    time.now = FRESH_MS;
    assert.deepEqual(tracker.resolve(surface), {
      kind: "element",
      rect: makeRect(300, 300, 40, 40),
    });

    time.now = FRESH_MS + 1;
    assert.equal(tracker.resolve(surface), null);
  });

  test("目标仍连接时取当前矩形", () => {
    const { tracker, time } = createTracker();
    tracker.start();

    const surface = createElement("div", { role: "menu" });
    const button = createElement("button");
    appendToBody(surface, button);
    stubRect(surface, 0, 0, 100, 100);
    stubRect(button, 300, 300, 40, 40);

    time.now = 0;
    firePointer(button, "pointerdown");
    stubRect(button, 500, 500, 40, 40);
    time.now = 100;

    assert.deepEqual(tracker.resolve(surface), {
      kind: "element",
      rect: makeRect(500, 500, 40, 40),
    });
  });

  test("目标卸载后使用事件时刻记录的矩形", () => {
    const { tracker, time } = createTracker();
    tracker.start();

    const surface = createElement("div", { role: "menu" });
    const button = createElement("button");
    appendToBody(surface, button);
    stubRect(surface, 0, 0, 100, 100);
    stubRect(button, 300, 300, 40, 40);

    time.now = 0;
    firePointer(button, "pointerdown");
    button.remove();
    time.now = 100;

    assert.deepEqual(tracker.resolve(surface), {
      kind: "element",
      rect: makeRect(300, 300, 40, 40),
    });
  });

  test("click 与 pointerdown 共用最近指针记录（后发生者覆盖）", () => {
    const { tracker, time } = createTracker();
    tracker.start();

    const surface = createElement("div", { role: "menu" });
    const first = createElement("button");
    const second = createElement("button");
    appendToBody(surface, first, second);
    stubRect(surface, 0, 0, 100, 100);
    stubRect(first, 100, 100, 40, 20);
    stubRect(second, 200, 200, 40, 20);

    time.now = 0;
    firePointer(first, "pointerdown");
    time.now = 100;
    firePointer(second, "click");
    time.now = 200;

    assert.deepEqual(tracker.resolve(surface), {
      kind: "element",
      rect: makeRect(200, 200, 40, 20),
    });
  });
});

// ---------------------------------------------------------------------------
// 5. 键盘（优先级 5）
// ---------------------------------------------------------------------------

describe("resolve：键盘 activeElement 与 keydown 记录", () => {
  test("当前 activeElement 是 surface 外的 trigger 型元素时取它", () => {
    const { tracker } = createTracker();
    tracker.start();

    const surface = createElement("div", { role: "menu" });
    const button = createElement("button");
    appendToBody(surface, button);
    stubRect(surface, 0, 0, 100, 100);
    stubRect(button, 400, 400, 60, 30);

    button.focus();
    assert.equal(document.activeElement, button);

    assert.deepEqual(tracker.resolve(surface), {
      kind: "element",
      rect: makeRect(400, 400, 60, 30),
    });
  });

  test("activeElement 在 surface 内时忽略，回退最近 keydown 记录", () => {
    const { tracker, time } = createTracker();
    tracker.start();

    const surface = createElement("div", { role: "menu" });
    const inside = createElement("button");
    const outside = createElement("button");
    surface.append(inside);
    appendToBody(surface, outside);
    stubRect(surface, 0, 0, 100, 100);
    stubRect(inside, 10, 10, 20, 20);
    stubRect(outside, 400, 400, 60, 30);

    inside.focus();
    time.now = 0;
    fireKeydown(outside);
    time.now = 100;

    assert.deepEqual(tracker.resolve(surface), {
      kind: "element",
      rect: makeRect(400, 400, 60, 30),
    });
  });

  test("keydown 记录超过 2.5s 后失效", () => {
    const { tracker, time } = createTracker();
    tracker.start();

    const surface = createElement("div", { role: "menu" });
    const button = createElement("button");
    appendToBody(surface, button);
    stubRect(surface, 0, 0, 100, 100);
    stubRect(button, 400, 400, 60, 30);

    time.now = 0;
    fireKeydown(button);
    time.now = FRESH_MS + 1;

    assert.equal(tracker.resolve(surface), null);
  });
});

// ---------------------------------------------------------------------------
// 6. lastPointerPoint
// ---------------------------------------------------------------------------

describe("lastPointerPoint：坐标与新鲜度", () => {
  test("没有指针交互时返回 null", () => {
    const { tracker } = createTracker();
    assert.equal(tracker.lastPointerPoint(), null);
  });

  test("只有 pointermove 时返回最近 move 坐标，2.5s 后失效", () => {
    const { tracker, time } = createTracker();
    tracker.start();

    time.now = 100;
    firePointer(document.body, "pointermove", { clientX: 12, clientY: 34 });
    assert.deepEqual(tracker.lastPointerPoint(), { x: 12, y: 34 });

    time.now = 100 + FRESH_MS;
    assert.deepEqual(tracker.lastPointerPoint(), { x: 12, y: 34 });

    time.now = 100 + FRESH_MS + 1;
    assert.equal(tracker.lastPointerPoint(), null);
  });

  test("pointerdown 坐标优先于之后发生的 pointermove", () => {
    const { tracker, time } = createTracker();
    tracker.start();

    time.now = 0;
    firePointer(document.body, "pointerdown", { clientX: 10, clientY: 20 });
    time.now = 100;
    firePointer(document.body, "pointermove", { clientX: 100, clientY: 200 });
    time.now = 200;

    assert.deepEqual(tracker.lastPointerPoint(), { x: 10, y: 20 });
  });
});

// ---------------------------------------------------------------------------
// 7. geometryForSource
// ---------------------------------------------------------------------------

describe("geometryForSource：原点 clamp 与平移方向", () => {
  const surfaceRect = { left: 100, top: 100, width: 200, height: 100 };
  const center = { x: 200, y: 150 };

  test("surface 宽或高 ≤0 → null", () => {
    assert.equal(geometryForSource({ kind: "point", x: 0, y: 0 }, { left: 0, top: 0, width: 0, height: 100 }, 12), null);
    assert.equal(geometryForSource({ kind: "point", x: 0, y: 0 }, { left: 0, top: 0, width: 100, height: 0 }, 12), null);
    assert.equal(geometryForSource({ kind: "point", x: 0, y: 0 }, { left: 0, top: 0, width: -10, height: 100 }, 12), null);
  });

  test("source 非法 → null", () => {
    assert.equal(geometryForSource(null, surfaceRect, 12), null);
    assert.equal(geometryForSource({ kind: "weird" }, surfaceRect, 12), null);
  });

  test("指针点在表面左侧 → originX=0，平移朝向左侧", () => {
    const geometry = geometryForSource({ kind: "point", x: 0, y: 150 }, surfaceRect, 20);
    assert.deepEqual(geometry, { originX: 0, originY: 50, translateX: -20, translateY: 0 });
  });

  test("指针点在表面右侧 → originX=width，平移朝向右侧", () => {
    const geometry = geometryForSource({ kind: "point", x: 1000, y: 150 }, surfaceRect, 20);
    assert.deepEqual(geometry, { originX: 200, originY: 50, translateX: 20, translateY: 0 });
  });

  test("指针点在表面上方 → originY=0，平移朝向上方", () => {
    const geometry = geometryForSource({ kind: "point", x: 200, y: 0 }, surfaceRect, 20);
    assert.deepEqual(geometry, { originX: 100, originY: 0, translateX: 0, translateY: -20 });
  });

  test("指针点在表面下方 → originY=height，平移朝向下方", () => {
    const geometry = geometryForSource({ kind: "point", x: 200, y: 1000 }, surfaceRect, 20);
    assert.deepEqual(geometry, { originX: 100, originY: 100, translateX: 0, translateY: 20 });
  });

  test("指针点在对角 clamp 到右下角，平移按单位向量缩放", () => {
    const geometry = geometryForSource({ kind: "point", x: 1000, y: 1000 }, surfaceRect, 20);
    assert.equal(geometry.originX, 200);
    assert.equal(geometry.originY, 100);
    assertClose(geometry.translateX, 17.88854381999832, "translateX");
    assertClose(geometry.translateY, 8.94427190999916, "translateY");
  });

  test("element 源用矩形中心作锚点", () => {
    const geometry = geometryForSource(
      { kind: "element", rect: makeRect(100, 0, 20, 20) },
      surfaceRect,
      12,
    );
    assert.equal(geometry.originX, 10);
    assert.equal(geometry.originY, 0);
    assertClose(geometry.translateX, -10.489887313458453, "translateX");
    assertClose(geometry.translateY, -5.827715174143584, "translateY");
  });

  test("锚点与表面中心重合 → 零平移且归一 +0", () => {
    assert.deepEqual(geometryForSource({ kind: "point", x: center.x, y: center.y }, surfaceRect, 20), {
      originX: 100,
      originY: 50,
      translateX: 0,
      translateY: 0,
    });
  });
});
