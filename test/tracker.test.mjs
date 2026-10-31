/**
 * test/tracker.test.mjs — createSurfaceTracker 单元测试。
 *
 * 覆盖 .plan/v0.2.0/plan-b-rewrite.md §5.2：
 * scanRoot 基线状态、新增子树分类、dialog+mask 配对、单独 mask 插入/移除、
 * 排除区、hidden→visible 状态机去重。
 */

import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";

import { createSurfaceTracker } from "../src/tracker.js";
import {
  buildMenu,
  buildSettingsOverlay,
  disposeEnvironment,
  document,
  resetEnvironment,
} from "./helpers/env.mjs";

beforeEach(() => {
  resetEnvironment();
});

after(() => {
  disposeEnvironment();
});

// 断言用摘要：只取 kind/trigger/state，元素身份单独用 strictEqual 断言。
function summary(intents) {
  return intents.map((intent) => ({
    kind: intent.kind,
    trigger: intent.trigger,
    state: intent.state,
  }));
}

function surfaceKinds(group) {
  return group.surfaces.map((surface) => surface.kind);
}

describe("scanRoot：启动基线", () => {
  test("已存在的可见表面：扫描后 classifyAttributes 返回空，不播入场", () => {
    const tracker = createSurfaceTracker();
    const menu = buildMenu();
    document.body.append(menu);

    assert.equal(tracker.scanRoot(document.body), undefined);
    assert.deepEqual(tracker.classifyAttributes(menu), []);
  });

  test("扫描时隐藏的菜单：显示后 classifyAttributes 发一次入场 intent", () => {
    const tracker = createSurfaceTracker();
    const menu = buildMenu();
    menu.hidden = true;
    document.body.append(menu);
    tracker.scanRoot(document.body);

    // 仍隐藏：状态只写 hidden，不产出 intent。
    assert.deepEqual(tracker.classifyAttributes(menu), []);

    menu.hidden = false;
    assert.deepEqual(summary(tracker.classifyAttributes(menu)), [
      { kind: "menu", trigger: "visibility", state: "visible" },
    ]);
  });

  test("扫描时隐藏的 dialog：显示后 dialog 与 mask 各发一次，第二次去重", () => {
    const tracker = createSurfaceTracker();
    const { overlay, mask, panel } = buildSettingsOverlay();
    overlay.hidden = true;
    document.body.append(overlay);
    tracker.scanRoot(document.body);

    overlay.hidden = false;
    const intents = tracker.classifyAttributes(panel);
    assert.deepEqual(summary(intents), [
      { kind: "dialog", trigger: "visibility", state: "visible" },
      { kind: "mask", trigger: "visibility", state: "visible" },
    ]);
    assert.equal(intents[0].element, panel);
    assert.equal(intents[1].element, mask);

    // 状态机去重：已 visible 不再发 intent。
    assert.deepEqual(tracker.classifyAttributes(panel), []);
  });

  test("scanRoot 非元素安全：不抛错且无返回值", () => {
    const tracker = createSurfaceTracker();
    assert.equal(tracker.scanRoot(null), undefined);
    assert.deepEqual(tracker.classifyAttributes(null), []);
  });
});

describe("classifyAdded：新增子树分类", () => {
  test("新增 menu 自身：单个 mount intent", () => {
    const tracker = createSurfaceTracker();
    const menu = buildMenu();
    document.body.append(menu);

    const intents = tracker.classifyAdded(menu);
    assert.deepEqual(summary(intents), [
      { kind: "menu", trigger: "mount", state: "mounted" },
    ]);
    assert.equal(intents[0].element, menu);
  });

  test("新增容器含 menu + listbox：两个 mount intent", () => {
    const tracker = createSurfaceTracker();
    const container = document.createElement("div");
    const menu = buildMenu();
    const listbox = document.createElement("div");
    listbox.setAttribute("role", "listbox");
    container.append(menu, listbox);
    document.body.append(container);

    assert.deepEqual(summary(tracker.classifyAdded(container)), [
      { kind: "menu", trigger: "mount", state: "mounted" },
      { kind: "listbox", trigger: "mount", state: "mounted" },
    ]);
  });

  test("新增 overlay（dialog + mask）：dialog 与 mask 各一个 mount intent", () => {
    const tracker = createSurfaceTracker();
    const { overlay, mask, panel } = buildSettingsOverlay();
    document.body.append(overlay);

    const intents = tracker.classifyAdded(overlay);
    assert.deepEqual(summary(intents), [
      { kind: "dialog", trigger: "mount", state: "mounted" },
      { kind: "mask", trigger: "mount", state: "mounted" },
    ]);
    assert.equal(intents[0].element, panel);
    assert.equal(intents[1].element, mask);
  });

  test("dialog 的 mask 在新增子树之外（overlay 同级结构）：仍配对并产出 mask intent", () => {
    const tracker = createSurfaceTracker();
    const { overlay, mask, panel } = buildSettingsOverlay();
    // overlay 先带 mask 入 DOM，panel 单独插入：mask 不在 panel 子树内。
    overlay.removeChild(panel);
    document.body.append(overlay);
    overlay.append(panel);

    const intents = tracker.classifyAdded(panel);
    assert.deepEqual(summary(intents), [
      { kind: "dialog", trigger: "mount", state: "mounted" },
      { kind: "mask", trigger: "mount", state: "mounted" },
    ]);
    assert.equal(intents[1].element, mask);
  });

  test("单独插入 mask（dialog 已在 DOM）：单个 mask mount intent，并记下配对", () => {
    const tracker = createSurfaceTracker();
    const { overlay, mask } = buildSettingsOverlay();
    overlay.removeChild(mask);
    document.body.append(overlay);
    overlay.append(mask);

    const intents = tracker.classifyAdded(mask);
    assert.deepEqual(summary(intents), [
      { kind: "mask", trigger: "mount", state: "mounted" },
    ]);
    assert.equal(intents[0].element, mask);

    // 配对生效：删除该 mask 时能回查到仍在 DOM 的 dialog。
    overlay.removeChild(mask);
    const groups = tracker.classifyRemoval(mask);
    assert.equal(groups.length, 1);
    assert.deepEqual(surfaceKinds(groups[0]), ["mask"]);
  });

  test("非元素与排除区：返回空数组", () => {
    const tracker = createSurfaceTracker();
    const excludedMenu = buildMenu();
    excludedMenu.setAttribute("data-dsh-transition", "off");
    document.body.append(excludedMenu);

    assert.deepEqual(tracker.classifyAdded(null), []);
    assert.deepEqual(tracker.classifyAdded(document.createTextNode("x")), []);
    assert.deepEqual(tracker.classifyAdded(excludedMenu), []);
  });
});

describe("classifyAttributes：可见性状态机", () => {
  test("未扫描（unknown）的可见表面：发入场 intent", () => {
    const tracker = createSurfaceTracker();
    const menu = buildMenu();
    document.body.append(menu);

    assert.deepEqual(summary(tracker.classifyAttributes(menu)), [
      { kind: "menu", trigger: "visibility", state: "visible" },
    ]);
  });

  test("hidden → visible 只在切换时发一次；visible → hidden 不发退场 intent", () => {
    const tracker = createSurfaceTracker();
    const menu = buildMenu();
    document.body.append(menu);

    // unknown → visible
    assert.equal(tracker.classifyAttributes(menu).length, 1);
    // visible → visible：去重
    assert.deepEqual(tracker.classifyAttributes(menu), []);
    // visible → hidden：只更新状态
    menu.hidden = true;
    assert.deepEqual(tracker.classifyAttributes(menu), []);
    // hidden → visible：发一次
    menu.hidden = false;
    assert.deepEqual(summary(tracker.classifyAttributes(menu)), [
      { kind: "menu", trigger: "visibility", state: "visible" },
    ]);
    // 再去重
    assert.deepEqual(tracker.classifyAttributes(menu), []);
  });

  test("非 role 表面（mask）与非元素：返回空数组", () => {
    const tracker = createSurfaceTracker();
    const { mask } = buildSettingsOverlay();

    assert.deepEqual(tracker.classifyAttributes(mask), []);
    assert.deepEqual(tracker.classifyAttributes(null), []);
    assert.deepEqual(tracker.classifyAttributes(document.createTextNode("x")), []);
  });

  test("排除区：不产出 intent", () => {
    const tracker = createSurfaceTracker();
    const menu = buildMenu();
    menu.setAttribute("role", "menu");
    menu.setAttribute("data-dsh-transition", "off");
    document.body.append(menu);

    assert.deepEqual(tracker.classifyAttributes(menu), []);
  });
});

describe("classifyRemoval：退场组与状态清理", () => {
  test("删除 menu：产出退场组，并清理状态（重挂载后可再次入场）", () => {
    const tracker = createSurfaceTracker();
    const menu = buildMenu();
    document.body.append(menu);
    // 先让 tracker 记下 visible 状态。
    assert.equal(tracker.classifyAttributes(menu).length, 1);

    menu.remove();
    const groups = tracker.classifyRemoval(menu);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].root, menu);
    assert.deepEqual(surfaceKinds(groups[0]), ["menu"]);
    assert.equal(groups[0].surfaces[0].element, menu);
    assert.deepEqual(Object.keys(groups[0].surfaces[0]).sort(), ["element", "kind"]);

    // 状态已清理：重挂载后 unknown → visible，仍会发入场。
    document.body.append(menu);
    assert.deepEqual(summary(tracker.classifyAttributes(menu)), [
      { kind: "menu", trigger: "visibility", state: "visible" },
    ]);
  });

  test("删除 overlay 容器：退场组含 dialog 与 mask", () => {
    const tracker = createSurfaceTracker();
    const { overlay, mask, panel } = buildSettingsOverlay();
    document.body.append(overlay);
    tracker.scanRoot(document.body);

    overlay.remove();
    const groups = tracker.classifyRemoval(overlay);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].root, overlay);
    assert.deepEqual(surfaceKinds(groups[0]), ["dialog", "mask"]);
    assert.equal(groups[0].surfaces[0].element, panel);
    assert.equal(groups[0].surfaces[1].element, mask);
  });

  test("单独删除 dialog：node.contains 裁剪，退场组只有 dialog", () => {
    const tracker = createSurfaceTracker();
    const { overlay, mask, panel } = buildSettingsOverlay();
    document.body.append(overlay);
    tracker.scanRoot(document.body);

    panel.remove();
    const groups = tracker.classifyRemoval(panel);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].root, panel);
    assert.deepEqual(surfaceKinds(groups[0]), ["dialog"]);
    // dialog 已删除时 mask 仍在 DOM；仅 dialog 进组。
    assert.equal(mask.isConnected, true);
  });

  test("单独删除 mask（先 scanRoot）：用配对记录产出 mask 退场组", () => {
    const tracker = createSurfaceTracker();
    const { overlay, mask } = buildSettingsOverlay();
    document.body.append(overlay);
    tracker.scanRoot(document.body);

    overlay.removeChild(mask);
    // MutationObserver 回调时 mask.parentNode 已为 null：必须靠配对记录。
    assert.equal(mask.parentNode, null);
    const groups = tracker.classifyRemoval(mask);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].root, mask);
    assert.deepEqual(surfaceKinds(groups[0]), ["mask"]);
    assert.equal(groups[0].surfaces[0].element, mask);
  });

  test("单独删除 mask（无配对记录）：返回空数组", () => {
    const tracker = createSurfaceTracker();
    const { overlay, mask } = buildSettingsOverlay();
    document.body.append(overlay);

    overlay.removeChild(mask);
    assert.deepEqual(tracker.classifyRemoval(mask), []);
  });

  test("mask 退场后清理配对：重挂载再删不会重复退场", () => {
    const tracker = createSurfaceTracker();
    const { overlay, mask } = buildSettingsOverlay();
    document.body.append(overlay);
    tracker.scanRoot(document.body);

    overlay.removeChild(mask);
    assert.equal(tracker.classifyRemoval(mask).length, 1);

    // 配对已被清理，且删除时已脱离 DOM，findDialogSibling 回退也拿不到。
    overlay.append(mask);
    overlay.removeChild(mask);
    assert.deepEqual(tracker.classifyRemoval(mask), []);
  });

  test("排除区与非元素：返回空数组", () => {
    const tracker = createSurfaceTracker();
    const wrapper = document.createElement("div");
    wrapper.setAttribute("data-dsh-transition", "off");
    const menu = buildMenu();
    wrapper.append(menu);
    document.body.append(wrapper);
    wrapper.remove();

    assert.deepEqual(tracker.classifyRemoval(menu), []);
    assert.deepEqual(tracker.classifyRemoval(null), []);
    assert.deepEqual(tracker.classifyRemoval(document.createTextNode("x")), []);
  });
});
