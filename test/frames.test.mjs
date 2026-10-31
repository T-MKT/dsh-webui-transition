/**
 * test/frames.test.mjs — src/frames.js 纯净帧函数单测。
 *
 * 覆盖 .plan/v0.2.0/plan-b-rewrite.md §5.4：
 * menu 表面无 opacity + 阴影帧；dialog/mask 整体帧；独立 transform 降级；
 * splitFade 拆分、无子级回退、阴影缺失退化；fadeKeyframesFor 双向。
 */

import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";

import {
  animationSpecsFor,
  exitKeyframesFor,
  fadeKeyframesFor,
  keyframesFor,
} from "../src/frames.js";
import {
  buildMenu,
  buildSettingsOverlay,
  computedStyle,
  document,
  disposeEnvironment,
  resetEnvironment,
} from "./helpers/env.mjs";

const MENU_TIMING = { distancePx: -4, scaleFrom: 0.98, opacityFrom: 0 };
const DIALOG_TIMING = { distancePx: 12, scaleFrom: 1, opacityFrom: 0 };
const MASK_TIMING = { distancePx: 0, scaleFrom: 1, opacityFrom: 0 };

beforeEach(resetEnvironment);
after(disposeEnvironment);

test("menu：入场关键帧只含几何，不含 opacity", () => {
  const frames = keyframesFor("menu", MENU_TIMING, true);
  assert.deepEqual(frames, [
    { translate: "0 -4px", scale: "0.98" },
    { translate: "0 0", scale: "1" },
  ]);
  assert.equal("opacity" in frames[0], false);
  assert.equal("opacity" in frames[1], false);
});

test("menu：boxShadow 传入时首帧 none、末帧为计算值", () => {
  const shadow = "rgb(0, 0, 0) 0px 4px 8px";
  const frames = keyframesFor("menu", MENU_TIMING, true, shadow);
  assert.equal(frames[0].boxShadow, "none");
  assert.equal(frames[1].boxShadow, shadow);
  assert.equal(frames[0].translate, "0 -4px");
});

test("menu：退场关键帧是入场镜像（末帧阴影回到 none）", () => {
  const shadow = "rgb(0, 0, 0) 0px 4px 8px";
  assert.deepEqual(exitKeyframesFor("menu", MENU_TIMING, true, shadow), [
    { translate: "0 0", scale: "1", boxShadow: shadow },
    { translate: "0 -4px", scale: "0.98", boxShadow: "none" },
  ]);
});

test("timing 缺失或非有限数时回退 SURFACE_DEFS 的几何值", () => {
  assert.deepEqual(keyframesFor("menu", undefined, true), keyframesFor("menu", MENU_TIMING, true));
  assert.deepEqual(keyframesFor("menu", { distancePx: NaN }, true), keyframesFor("menu", MENU_TIMING, true));
  assert.deepEqual(keyframesFor("dialog", null, true), [
    { opacity: 0, translate: "0 12px" },
    { opacity: 1, translate: "0 0" },
  ]);
});

test("dialog：整体 opacity 帧 + translate 12px，退场镜像", () => {
  assert.deepEqual(keyframesFor("dialog", DIALOG_TIMING, true), [
    { opacity: 0, translate: "0 12px" },
    { opacity: 1, translate: "0 0" },
  ]);
  assert.deepEqual(exitKeyframesFor("dialog", DIALOG_TIMING, true), [
    { opacity: 1, translate: "0 0" },
    { opacity: 0, translate: "0 12px" },
  ]);
});

test("mask：只有 opacity，没有 translate", () => {
  const frames = keyframesFor("mask", MASK_TIMING, true);
  assert.deepEqual(frames, [{ opacity: 0 }, { opacity: 1 }]);
  assert.equal(frames.every((frame) => !("translate" in frame)), true);
  // timing 缺失时 distancePx 回退 SURFACE_DEFS.mask 的 0，同样没有 translate。
  assert.deepEqual(keyframesFor("mask", null, true), [{ opacity: 0 }, { opacity: 1 }]);
});

test("independentTransforms=false 降级：无阴影 menu 返回 []，dialog 仅 opacity 帧", () => {
  assert.deepEqual(keyframesFor("menu", MENU_TIMING, false), []);
  assert.deepEqual(exitKeyframesFor("menu", MENU_TIMING, false), []);
  assert.deepEqual(keyframesFor("dialog", DIALOG_TIMING, false), [{ opacity: 0 }, { opacity: 1 }]);
});

test("animationSpecsFor(menu)：表面 1 条 + 每个直接元素子级各 1 条 opacity", () => {
  const menu = buildMenu();
  document.body.append(menu);

  const specs = animationSpecsFor(menu, "menu", "in", true);
  assert.equal(specs.length, 3);
  assert.equal(specs[0].element, menu);
  assert.deepEqual(specs[0].keyframes, [
    { translate: "0 -4px", scale: "0.98" },
    { translate: "0 0", scale: "1" },
  ]);

  const [material, content] = Array.from(menu.children);
  assert.equal(specs[1].element, material);
  assert.equal(specs[2].element, content);
  assert.deepEqual(specs[1].keyframes, [{ opacity: 0 }, { opacity: 1 }]);
  assert.deepEqual(specs[2].keyframes, [{ opacity: 0 }, { opacity: 1 }]);
});

test("animationSpecsFor(menu)：子级自然 opacity 0.5 时 fade 终点回到 0.5", () => {
  const menu = buildMenu();
  const [material] = Array.from(menu.children);
  material.style.opacity = "0.5";
  document.body.append(menu);
  assert.equal(computedStyle(material).opacity, "0.5");

  const inSpecs = animationSpecsFor(menu, "menu", "in", true);
  const inMaterial = inSpecs.find((spec) => spec.element === material);
  assert.deepEqual(inMaterial.keyframes, [{ opacity: 0 }, { opacity: 0.5 }]);

  const outSpecs = animationSpecsFor(menu, "menu", "out", true);
  const outMaterial = outSpecs.find((spec) => spec.element === material);
  assert.deepEqual(outMaterial.keyframes, [{ opacity: 0.5 }, { opacity: 0 }]);
});

test("animationSpecsFor：无直接元素子级时回退为表面整体（opacity 并入表面帧）", () => {
  const menu = document.createElement("div");
  menu.setAttribute("role", "menu");
  document.body.append(menu);

  const specs = animationSpecsFor(menu, "menu", "in", true);
  assert.equal(specs.length, 1);
  assert.equal(specs[0].element, menu);
  assert.deepEqual(specs[0].keyframes, [
    { translate: "0 -4px", scale: "0.98", opacity: 0 },
    { translate: "0 0", scale: "1", opacity: 1 },
  ]);

  // 无几何帧时单独 opacity 帧。
  const degraded = animationSpecsFor(menu, "menu", "out", false);
  assert.deepEqual(degraded[0].keyframes, [{ opacity: 1 }, { opacity: 0 }]);
});

test("animationSpecsFor：阴影缺失退化仍保留几何；有阴影时阴影进入表面帧", () => {
  const menu = buildMenu();
  menu.style.boxShadow = "none";
  document.body.append(menu);

  const missingSpecs = animationSpecsFor(menu, "menu", "in", true);
  const missingFrames = missingSpecs[0].keyframes;
  assert.equal("boxShadow" in missingFrames[0], false);
  assert.equal(missingFrames[0].translate, "0 -4px");

  const shadow = "rgb(0, 0, 0) 0px 4px 8px";
  menu.style.boxShadow = shadow;
  assert.equal(computedStyle(menu).boxShadow, shadow);
  const shadowFrames = animationSpecsFor(menu, "menu", "in", true)[0].keyframes;
  assert.equal(shadowFrames[0].boxShadow, "none");
  assert.equal(shadowFrames[1].boxShadow, shadow);
});

test("animationSpecsFor(dialog/mask)：整体一条规格", () => {
  const { overlay, mask, panel } = buildSettingsOverlay();
  document.body.append(overlay);

  assert.deepEqual(animationSpecsFor(panel, "dialog", "in", true), [
    {
      element: panel,
      keyframes: [
        { opacity: 0, translate: "0 12px" },
        { opacity: 1, translate: "0 0" },
      ],
    },
  ]);
  assert.deepEqual(animationSpecsFor(mask, "mask", "in", true), [
    { element: mask, keyframes: [{ opacity: 0 }, { opacity: 1 }] },
  ]);
});

test("fadeKeyframesFor：'out' 从自然值到 0，其余从 0 到自然值", () => {
  assert.deepEqual(fadeKeyframesFor("in", 0.5), [{ opacity: 0 }, { opacity: 0.5 }]);
  assert.deepEqual(fadeKeyframesFor("out", 0.5), [{ opacity: 0.5 }, { opacity: 0 }]);
  // 非有限 opacity 回退 1（与 v0.1.0 一致）。
  assert.deepEqual(fadeKeyframesFor("in", NaN), [{ opacity: 0 }, { opacity: 1 }]);
  assert.deepEqual(fadeKeyframesFor("out", undefined), [{ opacity: 1 }, { opacity: 0 }]);
});

test("未知 kind 回退 SURFACE_DEFS.menu", () => {
  assert.deepEqual(keyframesFor("popover", MENU_TIMING, true), keyframesFor("menu", MENU_TIMING, true));
  assert.deepEqual(exitKeyframesFor("popover", MENU_TIMING, true), exitKeyframesFor("menu", MENU_TIMING, true));
});
