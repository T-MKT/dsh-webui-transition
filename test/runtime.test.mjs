/**
 * test/runtime.test.mjs — createTransitionRuntime 单测（§5.5）。
 *
 * 依据：.plan/v0.2.0/plan-b-rewrite.md §3.7（模块设计）、§4（冻结签名）、§5.5（runtime 测试要点）。
 *
 * 装配方式：
 * - jsdom / token / fake animate / fake matchMedia / 可控 rAF 全部来自 test/helpers/env.mjs；
 * - 依赖真实 tracker / gate / frames，只注入可控 requestFrame / cancelFrame / matchMedia /
 *   computedStyle，不依赖真实帧与定时器。
 */

import { after, afterEach, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  animateCalls,
  buildGlassPanel,
  buildMenu,
  computedStyle,
  createFrameScheduler,
  createMatchMediaMock,
  disposeEnvironment,
  document,
  fakeAnimations,
  flushAllFrames,
  nextTask,
  pseudoGlassComputedStyle,
  resetAnimationLog,
  resetEnvironment,
  settleAnimations,
} from "./helpers/env.mjs";
import { createGate } from "../src/gate.js";
import { createPolicy } from "../src/policy.js";
import { createTransitionRuntime } from "../src/runtime.js";
import { createSurfaceTracker } from "../src/tracker.js";

// ---------------------------------------------------------------------------
// 装配 / 清理
// ---------------------------------------------------------------------------

const activeHarnesses = [];

/**
 * 装配一个 runtime：真实 policy / tracker / gate，注入可控帧调度器与 matchMedia 桩。
 */
function createHarness(overrides = {}) {
  const scheduler = createFrameScheduler();
  const media = createMatchMediaMock(false);
  const style = typeof overrides.computedStyle === "function" ? overrides.computedStyle : computedStyle;
  const policy = createPolicy({ matchMedia: media.matchMedia, computedStyle: style });
  const tracker = createSurfaceTracker();
  const gate = createGate({ computedStyle: style });
  const runtime = createTransitionRuntime({
    root: document,
    policy,
    tracker,
    gate,
    computedStyle: style,
    animator: overrides.animator,
    requestFrame: scheduler.requestFrame,
    cancelFrame: scheduler.cancelFrame,
  });
  const harness = {
    scheduler,
    media,
    policy,
    tracker,
    gate,
    runtime,
    stop: runtime.start(),
    disposed: false,
  };
  activeHarnesses.push(harness);
  return harness;
}

function disposeHarness(harness) {
  if (harness.disposed) return;
  harness.disposed = true;
  harness.runtime.dispose();
}

function normalizeEasing(value) {
  return String(value ?? "").replace(/\s+/g, "");
}

function elementChildren(element) {
  return Array.from(element.childNodes).filter((node) => node.nodeType === 1);
}

beforeEach(() => {
  resetEnvironment();
});

afterEach(async () => {
  for (const harness of activeHarnesses.splice(0).reverse()) {
    try {
      disposeHarness(harness);
    } catch (error) {
      // dispose 的异常不影响其它用例的环境复位
    }
  }
  await settleAnimations();
  resetAnimationLog();
});

after(() => {
  disposeEnvironment();
});

// ---------------------------------------------------------------------------
// §5.5 初始扫描 / mount 动画 / fill 释放
// ---------------------------------------------------------------------------

describe("runtime：观察与入场", () => {
  test("初始扫描：start() 前已存在的 menu 不播入场，新增 menu 播入场", async () => {
    const existing = buildMenu();
    document.body.appendChild(existing);

    const harness = createHarness();
    assert.equal(animateCalls.length, 0, "启动前已存在的表面不应播入场");

    const added = buildMenu();
    document.body.appendChild(added);
    await nextTask();
    flushAllFrames(harness.scheduler);

    assert.equal(
      animateCalls.filter((call) => call.element === existing).length,
      0,
      "基线表面永远不播入场",
    );
    assert.ok(
      animateCalls.some((call) => call.element === added),
      "启动后新增的 menu 应播入场",
    );
  });

  test("mount 动画：表面几何 + 直接子级 opacity，duration/easing/fill 来自 policy", async () => {
    const harness = createHarness();
    const menu = buildMenu();
    document.body.appendChild(menu);
    await nextTask();
    flushAllFrames(harness.scheduler);

    const timing = harness.policy.timing("menu");
    assert.ok(timing.durationMs > 0, "测试环境应解析出正时长");

    const surfaceCalls = animateCalls.filter((call) => call.element === menu);
    assert.equal(surfaceCalls.length, 1, "menu 表面只产生一条几何动画");
    const surfaceCall = surfaceCalls[0];
    assert.equal(surfaceCall.options.duration, timing.durationMs, "duration 来自 policy.timing");
    assert.equal(
      normalizeEasing(surfaceCall.options.easing),
      normalizeEasing(timing.easing),
      "easing 来自 policy.timing",
    );
    assert.equal(surfaceCall.options.fill, "both", "动画期间用 fill:both 维持首尾帧");

    // 独立 transform 支持（jsdom CSS.supports 为 true）：上浮 -4px + 从 .98 放大。
    assert.equal(surfaceCall.keyframes[0].translate, "0 -4px", "表面从 -4px 上浮");
    assert.equal(Number(surfaceCall.keyframes[0].scale), 0.98, "表面从 .98 放大");
    for (const frame of surfaceCall.keyframes) {
      assert.equal(frame.opacity, undefined, "menu 表面不写 opacity（透明度下沉到子级）");
    }

    const children = elementChildren(menu);
    const childCalls = animateCalls.filter((call) => children.includes(call.element));
    assert.equal(childCalls.length, children.length, "每个直接元素子级各一条 opacity 动画");
    for (const call of childCalls) {
      assert.equal(Number(call.keyframes[0].opacity), 0, "子级从透明开始");
      assert.equal(Number(call.keyframes[call.keyframes.length - 1].opacity), 1, "子级回到自然值");
      assert.equal(call.options.duration, timing.durationMs, "子级与表面共用 timing");
      assert.equal(call.options.fill, "both", "子级同样 fill:both");
    }
  });

  test("入场动画 settle 后 cancel 释放 fill（避免长期充当 backdrop-root）", async () => {
    const harness = createHarness();
    const menu = buildMenu();
    document.body.appendChild(menu);
    await nextTask();
    flushAllFrames(harness.scheduler);

    const animatedElements = [menu, ...elementChildren(menu)];
    const animations = fakeAnimations.filter((animation) => animatedElements.includes(animation.element));
    assert.equal(animations.length, animatedElements.length, "表面与子级各一条动画");
    assert.equal(menu.getAnimations().length, 1, "动画进行中可观测到填充态动画");

    await settleAnimations();

    for (const animation of animations) {
      assert.equal(animation.playState, "idle", "settle 后动画应回到 idle");
      assert.equal(animation.cancelled, true, "settle 后应 cancel 释放填充态");
    }
    assert.deepEqual(menu.getAnimations(), [], "不残留 fill:both 动画");
  });
});

// ---------------------------------------------------------------------------
// §5.5 去重修正
// ---------------------------------------------------------------------------

describe("runtime：去重与门卫重试", () => {
  test("门卫拒绝后重试不被去重抑制：不可见 mount 被拒，恢复可见后仍能播入场", async () => {
    const harness = createHarness();
    const menu = buildMenu();
    menu.style.display = "none";
    document.body.appendChild(menu);
    await nextTask();
    flushAllFrames(harness.scheduler);
    assert.equal(animateCalls.length, 0, "display:none 时门卫应拒绝 mount 动画");

    // 恢复可见。style 不在 OBSERVED_ATTRIBUTES 内，直接由 tracker 生成 visibility intent。
    menu.style.display = "";
    const intents = harness.tracker.classifyAttributes(menu);
    assert.ok(
      intents.some(
        (intent) =>
          intent.element === menu && intent.trigger === "visibility" && intent.state === "visible",
      ),
      "tracker 应从 hidden → visible 发出入场意图",
    );
    for (const intent of intents) harness.runtime.enqueue(intent);
    flushAllFrames(harness.scheduler);

    assert.ok(
      animateCalls.some((call) => call.element === menu),
      "门卫拒绝不写 lastApplied，重试应能正常播入场",
    );
  });

  test("同帧去重：同一帧重复 enqueue 同一 intent 只产生一组动画", async () => {
    const harness = createHarness();
    const menu = buildMenu();
    document.body.appendChild(menu);
    // 等观察器把 mount intent 入队（帧尚未 flush）。
    await nextTask();

    const intent = { element: menu, kind: "menu", trigger: "mount", state: "mounted" };
    harness.runtime.enqueue(intent);
    harness.runtime.enqueue({ ...intent });
    harness.runtime.enqueue({ ...intent });
    flushAllFrames(harness.scheduler);

    assert.equal(
      animateCalls.filter((call) => call.element === menu).length,
      1,
      "同一帧同元素同 kind 只 animate 一次",
    );
    assert.equal(animateCalls.length, 1 + elementChildren(menu).length, "只产生一组表面 + 子级动画");

    // flush 后 lastApplied 生效：后续重复意图不再播动画。
    harness.runtime.enqueue({ ...intent });
    flushAllFrames(harness.scheduler);
    assert.equal(
      animateCalls.filter((call) => call.element === menu).length,
      1,
      "lastApplied 应抑制已成功播放的同一意图",
    );
  });
});

// ---------------------------------------------------------------------------
// §5.5 reduced-motion 热切换
// ---------------------------------------------------------------------------

describe("runtime：reduced-motion 热切换", () => {
  test("动画在播时媒体查询变 true：在播动画被 cancel、退场幽灵被移除", async () => {
    const harness = createHarness();
    const stage = document.createElement("div");
    document.body.appendChild(stage);
    const menu = buildMenu();
    stage.appendChild(menu);
    await nextTask();
    flushAllFrames(harness.scheduler);

    // 入场动画保持运行，再移除菜单以产生退场幽灵与退场动画。
    menu.remove();
    await nextTask();

    const ghost = document.querySelector("[data-dsh-transition-ghost]");
    assert.ok(ghost, "移除菜单应产生退场幽灵");
    const runningBefore = fakeAnimations.filter((animation) => animation.playState === "running");
    assert.ok(runningBefore.length > 0, "切换前应存在在播动画（入场 + 退场）");

    harness.media.setMatches(true);

    assert.equal(
      document.querySelectorAll("[data-dsh-transition-ghost]").length,
      0,
      "reduced === true 时立即移除全部幽灵",
    );
    for (const animation of runningBefore) {
      assert.equal(animation.playState, "idle", "在播动画应被 cancel");
    }

    // reduced === false 不动作：后续动画自动恢复。
    harness.media.setMatches(false);
    resetAnimationLog();
    const next = buildMenu();
    document.body.appendChild(next);
    await nextTask();
    flushAllFrames(harness.scheduler);
    assert.ok(
      animateCalls.some((call) => call.element === next),
      "关闭减少动态效果后新表面应恢复动画",
    );
  });
});

// ---------------------------------------------------------------------------
// §5.5 退场幽灵
// ---------------------------------------------------------------------------

describe("runtime：退场幽灵", () => {
  test("移除 menu 产生幽灵：克隆、退场动画、settle 后移除，且保留 backdrop-filter", async () => {
    const harness = createHarness();
    const stage = document.createElement("div");
    document.body.appendChild(stage);
    const menu = buildMenu();
    menu.id = "runtime-menu";
    menu.style.boxShadow = "0 8px 24px rgba(0, 0, 0, 0.2)";
    const material = menu.querySelector(".material");
    material.id = "runtime-material";
    material.style.setProperty("backdrop-filter", "blur(24px)");
    stage.appendChild(menu);
    await nextTask();
    flushAllFrames(harness.scheduler);
    await settleAnimations(); // 先结清入场动画
    resetAnimationLog();

    const naturalShadow = computedStyle(menu).boxShadow;
    menu.remove();
    await nextTask();

    const ghost = document.querySelector("[data-dsh-transition-ghost]");
    assert.ok(ghost, "退场应插入幽灵副本");
    assert.equal(ghost.parentElement, stage, "幽灵插回原位置（原父节点）");
    assert.equal(ghost.getAttribute("aria-hidden"), "true", "幽灵应 aria-hidden");
    assert.ok(ghost.hasAttribute("inert"), "幽灵应 inert");
    assert.equal(ghost.style.pointerEvents, "none", "幽灵应 pointer-events:none");
    assert.equal(ghost.style.animation, "none", "幽灵禁用宿主 CSS animation");
    assert.equal(ghost.style.transition, "none", "幽灵禁用宿主 CSS transition");
    assert.equal(ghost.hasAttribute("id"), false, "幽灵根不应带 id（避免重复 id）");

    const ghostMaterial = ghost.querySelector(".material");
    assert.ok(ghostMaterial, "克隆应保留子级结构");
    assert.equal(ghostMaterial.hasAttribute("id"), false, "幽灵子级也不应带 id");
    assert.equal(
      ghostMaterial.style.getPropertyValue("backdrop-filter"),
      "blur(24px)",
      "幽灵不得剥离 backdrop-filter（退场期间仍需采样背景）",
    );

    const surfaceCall = animateCalls.find((call) => call.element === ghost);
    assert.ok(surfaceCall, "幽灵根应播表面退场动画");
    for (const frame of surfaceCall.keyframes) {
      assert.equal(frame.opacity, undefined, "menu 幽灵根同样不写 opacity");
    }
    assert.equal(surfaceCall.keyframes[0].boxShadow, naturalShadow, "阴影从计算值开始淡出");

    const ghostChildren = elementChildren(ghost);
    const childCalls = animateCalls.filter((call) => ghostChildren.includes(call.element));
    assert.equal(childCalls.length, ghostChildren.length, "每个幽灵子级各一条淡出");
    for (const call of childCalls) {
      assert.equal(Number(call.keyframes[0].opacity), 1, "子级从自然值开始");
      assert.equal(Number(call.keyframes[call.keyframes.length - 1].opacity), 0, "子级淡出到 0");
    }

    await settleAnimations();
    assert.equal(
      document.querySelectorAll("[data-dsh-transition-ghost]").length,
      0,
      "全部动画 settle 后幽灵应被移除",
    );
  });
});

// ---------------------------------------------------------------------------
// §5.5 dispose 完整清理
// ---------------------------------------------------------------------------

describe("runtime：dispose", () => {
  test("dispose() 断开 observer、移除幽灵、清空动画，后续 mutation 不再动画", async () => {
    const harness = createHarness();
    const stage = document.createElement("div");
    document.body.appendChild(stage);
    const menu = buildMenu();
    stage.appendChild(menu);
    await nextTask();
    flushAllFrames(harness.scheduler);
    assert.ok(fakeAnimations.some((animation) => animation.playState === "running"));

    menu.remove();
    await nextTask();
    assert.ok(document.querySelector("[data-dsh-transition-ghost]"), "dispose 前应存在幽灵");

    harness.runtime.dispose();
    harness.runtime.dispose(); // 幂等

    assert.equal(
      document.querySelectorAll("[data-dsh-transition-ghost]").length,
      0,
      "dispose 应移除全部幽灵",
    );
    assert.equal(
      fakeAnimations.filter((animation) => animation.playState === "running").length,
      0,
      "dispose 应 cancel 全部 owned/exit 动画",
    );

    const callsBefore = animateCalls.length;
    const late = buildMenu();
    document.body.appendChild(late);
    await nextTask();
    flushAllFrames(harness.scheduler);
    assert.equal(animateCalls.length, callsBefore, "dispose 后 observer 已断开，不再产生动画");
  });
});

// ---------------------------------------------------------------------------
// v0.2.0 伪元素玻璃：表面不做 opacity，伪元素自身经 WAAPI pseudoElement 淡入淡出
// ---------------------------------------------------------------------------

const GLASS_SHADOW = "rgb(0, 0, 0) 0px 8px 24px";

describe("runtime：伪元素玻璃", () => {
  test("入场：表面几何 + 子级 opacity + 伪元素 pseudoElement 动画，表面无 opacity", async () => {
    const harness = createHarness({ computedStyle: pseudoGlassComputedStyle() });
    const panel = buildGlassPanel();
    panel.style.boxShadow = GLASS_SHADOW;
    document.body.appendChild(panel);
    await nextTask();
    flushAllFrames(harness.scheduler);

    const panelCalls = animateCalls.filter((call) => call.element === panel);
    assert.equal(panelCalls.length, 2, "表面几何一条 + 伪元素一条");

    const geometryCall = panelCalls.find((call) => !call.options.pseudoElement);
    assert.ok(geometryCall, "应有表面几何动画");
    assert.equal(geometryCall.keyframes[0].translate, "0 12px");
    assert.equal(geometryCall.keyframes[0].boxShadow, "none");
    for (const frame of geometryCall.keyframes) {
      assert.equal("opacity" in frame, false, "伪元素玻璃表面不得有 opacity 帧");
    }

    const pseudoCall = panelCalls.find((call) => call.options.pseudoElement === "::before");
    assert.ok(pseudoCall, "伪元素动画应带 pseudoElement 选项");
    assert.deepEqual(pseudoCall.keyframes, [{ opacity: 0 }, { opacity: 1 }]);
    assert.equal(
      pseudoCall.options.duration,
      harness.policy.timing("dialog").durationMs,
      "伪元素与表面共用 timing",
    );

    const children = Array.from(panel.children);
    const childCalls = animateCalls.filter((call) => children.includes(call.element));
    assert.equal(childCalls.length, children.length, "每个直接元素子级各一条 opacity 动画");
    for (const call of childCalls) {
      assert.deepEqual(call.keyframes, [{ opacity: 0 }, { opacity: 1 }]);
    }
  });

  test("伪元素动画不可用（浏览器忽略 pseudoElement）：落到宿主的动画被立即取消", async () => {
    // 模拟旧浏览器：pseudoElement 选项被忽略，动画落到宿主元素上（effect.pseudoElement 为空）。
    const ignoringAnimator = (element, keyframes, timing, pseudoElement) => {
      const animation = element.animate(keyframes, {
        duration: timing.durationMs,
        easing: timing.easing,
        fill: "both",
      });
      if (pseudoElement) animation.effect = { target: element, pseudoElement: null };
      return animation;
    };
    const harness = createHarness({
      computedStyle: pseudoGlassComputedStyle(),
      animator: ignoringAnimator,
    });
    const panel = buildGlassPanel();
    panel.style.boxShadow = GLASS_SHADOW;
    document.body.appendChild(panel);
    await nextTask();
    flushAllFrames(harness.scheduler);

    const dropped = fakeAnimations.filter(
      (animation) =>
        animation.element === panel &&
        animation.cancelled &&
        animation.keyframes.some((frame) => "opacity" in frame),
    );
    assert.equal(dropped.length, 1, "伪元素动画落到宿主后应被取消一次");
    assert.equal(dropped[0].playState, "idle", "取消后不得留存宿主 opacity 动画");

    // 表面几何与子级动画仍在（模糊保障优先于玻璃淡入）。
    const running = fakeAnimations.filter(
      (animation) => animation.element === panel && animation.playState === "running",
    );
    assert.equal(running.length, 1, "仅表面几何动画仍在运行");
    for (const frame of running[0].keyframes) {
      assert.equal("opacity" in frame, false);
    }
  });

  test("退场幽灵：克隆体的伪元素同样淡出，settle 后移除幽灵", async () => {
    const harness = createHarness({ computedStyle: pseudoGlassComputedStyle() });
    const stage = document.createElement("div");
    document.body.appendChild(stage);
    const panel = buildGlassPanel();
    panel.style.boxShadow = GLASS_SHADOW;
    stage.appendChild(panel);
    await nextTask();
    flushAllFrames(harness.scheduler);
    await settleAnimations(); // 结清入场
    resetAnimationLog();

    panel.remove();
    await nextTask();

    const ghost = document.querySelector("[data-dsh-transition-ghost]");
    assert.ok(ghost, "退场应插入幽灵副本");
    assert.equal(ghost.parentElement, stage, "幽灵插回原位置");

    const ghostCalls = animateCalls.filter(
      (call) => call.element === ghost || (ghost.contains && ghost.contains(call.element)),
    );
    const pseudoCall = ghostCalls.find((call) => call.options.pseudoElement === "::before");
    assert.ok(pseudoCall, "幽灵伪元素应播退场动画");
    assert.deepEqual(pseudoCall.keyframes, [{ opacity: 1 }, { opacity: 0 }]);

    const geometryCall = ghostCalls.find((call) => !call.options.pseudoElement);
    assert.ok(geometryCall, "幽灵表面应播几何/阴影退场动画");
    for (const frame of geometryCall.keyframes) {
      assert.equal("opacity" in frame, false, "幽灵宿主不得有 opacity 帧");
    }

    const ghostChildren = Array.from(ghost.children);
    const childCalls = animateCalls.filter((call) => ghostChildren.includes(call.element));
    assert.equal(childCalls.length, ghostChildren.length, "幽灵子级各一条淡出");
    assert.deepEqual(childCalls[0].keyframes, [{ opacity: 1 }, { opacity: 0 }]);

    await settleAnimations();
    assert.equal(
      document.querySelectorAll("[data-dsh-transition-ghost]").length,
      0,
      "全部动画 settle 后幽灵应被移除",
    );
  });
});
