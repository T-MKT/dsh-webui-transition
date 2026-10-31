/**
 * test/policy.test.mjs — src/policy.js 单测（.plan/v0.2.0/plan-b-rewrite.md §5.1）。
 */

import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";

import { createPolicy } from "../src/policy.js";
import {
  clearTokens,
  computedStyle,
  createMatchMediaMock,
  disposeEnvironment,
  injectTokens,
  resetEnvironment,
} from "./helpers/env.mjs";

const activePolicies = [];

function createPolicyHarness(options = {}) {
  const media = createMatchMediaMock(Boolean(options.reducedMotion));
  const policy = createPolicy({ matchMedia: media.matchMedia, computedStyle });
  activePolicies.push(policy);
  return { media, policy };
}

function normalizeEasing(value) {
  return String(value ?? "").replace(/\s+/g, "");
}

beforeEach(() => {
  for (const policy of activePolicies.splice(0)) policy.dispose();
  resetEnvironment();
});

after(() => {
  for (const policy of activePolicies.splice(0)) policy.dispose();
  disposeEnvironment();
});

describe("tokens：解析 --ds-transition-* 与缓动 token", () => {
  test("解析 s / ms 单位与缓动 token", () => {
    injectTokens({
      normal: ".25s",
      fast: "120ms",
      slow: ".4s",
      easing: "cubic-bezier(.1, .2, .3, 1)",
    });
    const { policy } = createPolicyHarness();
    const tokens = policy.tokens();
    assert.equal(tokens.normalMs, 250);
    assert.equal(tokens.fastMs, 120);
    assert.equal(tokens.slowMs, 400);
    assert.equal(normalizeEasing(tokens.easing), normalizeEasing("cubic-bezier(.1,.2,.3,1)"));
  });

  test("token 缺失时 tokens() 回退到已知值 100/200/300ms", () => {
    clearTokens();
    const { policy } = createPolicyHarness();
    const tokens = policy.tokens();
    assert.equal(tokens.fastMs, 100);
    assert.equal(tokens.normalMs, 200);
    assert.equal(tokens.slowMs, 300);
    assert.equal(normalizeEasing(tokens.easing), normalizeEasing("cubic-bezier(.4,0,.2,1)"));
  });
});

describe("timing：fallback / clamp / 几何起点", () => {
  test("token 缺失时使用 SURFACE_DEFS 的 kind 级 fallback 时长", () => {
    clearTokens();
    const { policy } = createPolicyHarness();
    assert.equal(policy.timing("menu").durationMs, 150);
    assert.equal(policy.timing("listbox").durationMs, 150);
    assert.equal(policy.timing("dialog").durationMs, 220);
    assert.equal(policy.timing("mask").durationMs, 180);
  });

  test("token 时长按 kind 的 min/max clamp（上限）", () => {
    injectTokens({ fast: ".2s", normal: ".5s" });
    const { policy } = createPolicyHarness();
    assert.equal(policy.timing("menu").durationMs, 160);
    assert.equal(policy.timing("listbox").durationMs, 160);
    assert.equal(policy.timing("dialog").durationMs, 240);
    assert.equal(policy.timing("mask").durationMs, 220);
  });

  test("token 时长按 kind 的 min/max clamp（下限）", () => {
    injectTokens({ fast: ".05s", normal: ".01s" });
    const { policy } = createPolicyHarness();
    assert.equal(policy.timing("menu").durationMs, 120);
    assert.equal(policy.timing("listbox").durationMs, 120);
    assert.equal(policy.timing("dialog").durationMs, 160);
    assert.equal(policy.timing("mask").durationMs, 140);
  });

  test("范围内 token 不被改写", () => {
    injectTokens({ fast: ".14s", normal: ".2s" });
    const { policy } = createPolicyHarness();
    assert.equal(policy.timing("menu").durationMs, 140);
    assert.equal(policy.timing("dialog").durationMs, 200);
    assert.equal(policy.timing("mask").durationMs, 200);
  });

  test("返回 SURFACE_DEFS 冻结的位移 / 缩放 / 透明度起点", () => {
    const { policy } = createPolicyHarness();
    const menu = policy.timing("menu");
    assert.equal(menu.distancePx, -4);
    assert.equal(menu.scaleFrom, 0.98);
    assert.equal(menu.opacityFrom, 0);
    assert.equal(policy.timing("listbox").distancePx, -4);
    const dialog = policy.timing("dialog");
    assert.equal(dialog.distancePx, 12);
    assert.equal(dialog.scaleFrom, 1);
    assert.equal(dialog.opacityFrom, 0);
    const mask = policy.timing("mask");
    assert.equal(mask.distancePx, 0);
    assert.equal(mask.opacityFrom, 0);
  });
});

describe("easing：白名单回退与 dialog 专用缓动", () => {
  test("非法缓动 token 回退到默认缓动", () => {
    injectTokens({ easing: "banana" });
    const { policy } = createPolicyHarness();
    assert.equal(
      normalizeEasing(policy.tokens().easing),
      normalizeEasing("cubic-bezier(.4,0,.2,1)")
    );
    assert.equal(
      normalizeEasing(policy.timing("menu").easing),
      normalizeEasing("cubic-bezier(.4,0,.2,1)")
    );
  });

  test("dialog 使用专用缓动，其余面沿用 token 缓动", () => {
    injectTokens({ easing: "cubic-bezier(.4, 0, .2, 1)" });
    const { policy } = createPolicyHarness();
    assert.equal(normalizeEasing(policy.timing("dialog").easing), normalizeEasing("cubic-bezier(.22,1,.36,1)"));
    assert.equal(normalizeEasing(policy.timing("menu").easing), normalizeEasing("cubic-bezier(.4,0,.2,1)"));
    assert.equal(normalizeEasing(policy.timing("mask").easing), normalizeEasing("cubic-bezier(.4,0,.2,1)"));
  });
});

describe("reduced-motion：归零与实时订阅", () => {
  test("reduced-motion 下 reducedMotion() 为真且 timing() 时长全零", () => {
    const { policy } = createPolicyHarness({ reducedMotion: true });
    assert.equal(policy.reducedMotion(), true);
    for (const kind of ["menu", "listbox", "dialog", "mask"]) {
      assert.equal(policy.timing(kind).durationMs, 0, `${kind} 的 durationMs 应归零`);
    }
  });

  test("prefers-reduced-motion live 切换通知 subscribe，取消订阅后停止", () => {
    const { media, policy } = createPolicyHarness();
    const observed = [];
    const unsubscribe = policy.subscribe((reduced) => observed.push(reduced));
    assert.equal(typeof unsubscribe, "function");

    media.setMatches(true);
    assert.equal(observed.at(-1), true);
    assert.equal(policy.reducedMotion(), true);

    media.setMatches(false);
    assert.equal(observed.at(-1), false);
    assert.equal(policy.reducedMotion(), false);

    const count = observed.length;
    unsubscribe();
    media.setMatches(true);
    assert.equal(observed.length, count);
  });

  test("dispose() 幂等且停止订阅通知", () => {
    const { media, policy } = createPolicyHarness();
    const observed = [];
    policy.subscribe((reduced) => observed.push(reduced));
    policy.dispose();
    assert.doesNotThrow(() => policy.dispose());

    media.setMatches(true);
    assert.deepEqual(observed, []);
    assert.equal(policy.reducedMotion(), false);
  });
});
