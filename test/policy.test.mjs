/**
 * test/policy.test.mjs — src/policy.js 单测（.plan/v0.2.0/plan-b-rewrite.md §5.1；
 * 动画参数见 .agents/plan/v1.1.0/animation-params.md §3.2.1）。
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
  const policy = createPolicy({
    matchMedia: media.matchMedia,
    computedStyle,
    settings: options.settings,
  });
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

  test("返回 SURFACE_DEFS 冻结的缩放 / 透明度起点", () => {
    const { policy } = createPolicyHarness();
    const menu = policy.timing("menu");
    assert.equal(menu.scaleFrom, 0.98);
    assert.equal(menu.opacityFrom, 0);
    const dialog = policy.timing("dialog");
    assert.equal(dialog.scaleFrom, 0.98);
    assert.equal(dialog.opacityFrom, 0);
    const mask = policy.timing("mask");
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

// ---------------------------------------------------------------------------
// v1.1.0 可调配动画参数：设置 → 最终 timing 的唯一收口
// ---------------------------------------------------------------------------

const KINDS = ["menu", "listbox", "dialog", "mask"];

describe("timing：设置优先级与实时读取", () => {
  test("无设置 / 空设置时行为与 v1.0.0 完全一致", () => {
    const baseline = createPolicyHarness();
    const empty = createPolicyHarness({ settings: {} });
    for (const kind of KINDS) {
      assert.deepEqual(empty.policy.timing(kind), baseline.policy.timing(kind), kind);
    }
  });

  test("全局时长覆盖全部四类表面，且绕过 kind 的 min/max clamp", () => {
    const { policy } = createPolicyHarness({ settings: { durationMs: 300 } });
    for (const kind of KINDS) {
      assert.equal(policy.timing(kind).durationMs, 300, kind);
    }
  });

  test("分表面覆盖优先于全局；listbox 跟随 menu 组", () => {
    const { policy } = createPolicyHarness({
      settings: { durationMs: 300, surfaces: { menu: { durationMs: 90 }, mask: { durationMs: 40 } } },
    });
    assert.equal(policy.timing("menu").durationMs, 90);
    assert.equal(policy.timing("listbox").durationMs, 90);
    assert.equal(policy.timing("dialog").durationMs, 300);
    assert.equal(policy.timing("mask").durationMs, 40);
  });

  test("只有分表面值、无全局值时，其余表面仍读 token", () => {
    clearTokens();
    const { policy } = createPolicyHarness({
      settings: { surfaces: { menu: { durationMs: 90 } } },
    });
    assert.equal(policy.timing("menu").durationMs, 90);
    assert.equal(policy.timing("dialog").durationMs, 220);
    assert.equal(policy.timing("mask").durationMs, 180);
  });

  test("全局缩放不作用于遮罩；遮罩显式分表面缩放才生效", () => {
    const global = createPolicyHarness({ settings: { scaleFrom: 0.9 } });
    assert.equal(global.policy.timing("menu").scaleFrom, 0.9);
    assert.equal(global.policy.timing("listbox").scaleFrom, 0.9);
    assert.equal(global.policy.timing("dialog").scaleFrom, 0.9);
    assert.equal(global.policy.timing("mask").scaleFrom, 1, "全局缩放不得让遮罩露出页面边缘");

    const overridden = createPolicyHarness({
      settings: { scaleFrom: 0.9, surfaces: { mask: { scaleFrom: 0.96 } } },
    });
    assert.equal(overridden.policy.timing("mask").scaleFrom, 0.96);
  });

  test("透明度两层：分表面优先，其余跟随全局", () => {
    const { policy } = createPolicyHarness({
      settings: { opacityFrom: 0.2, surfaces: { dialog: { opacityFrom: 0.5 } } },
    });
    assert.equal(policy.timing("menu").opacityFrom, 0.2);
    assert.equal(policy.timing("listbox").opacityFrom, 0.2);
    assert.equal(policy.timing("dialog").opacityFrom, 0.5);
    assert.equal(policy.timing("mask").opacityFrom, 0.2);
  });

  test("时长为 0 表示关闭该表面组的过渡动画（不再退回 token）", () => {
    const { policy } = createPolicyHarness({
      settings: { durationMs: 0, surfaces: { dialog: { durationMs: 0 } } },
    });
    for (const kind of KINDS) {
      assert.equal(policy.timing(kind).durationMs, 0, kind);
    }
  });

  test("reduced-motion 高于设置：时长归零，几何参数仍取设置", () => {
    const { policy } = createPolicyHarness({
      reducedMotion: true,
      settings: { durationMs: 300, scaleFrom: 0.9, opacityFrom: 0.4 },
    });
    for (const kind of KINDS) {
      const timing = policy.timing(kind);
      assert.equal(timing.durationMs, 0, kind);
      assert.equal(timing.scaleFrom, kind === "mask" ? 1 : 0.9, kind);
      assert.equal(timing.opacityFrom, 0.4, kind);
    }
  });

  test("settings 为函数时实时读取最新快照（无需重建 policy）", () => {
    let settings = { durationMs: 300, scaleFrom: 0.9 };
    const { policy } = createPolicyHarness({ settings: () => settings });
    assert.equal(policy.timing("menu").durationMs, 300);
    assert.equal(policy.timing("menu").scaleFrom, 0.9);

    settings = { durationMs: 120, surfaces: { menu: { scaleFrom: 0.96 } } };
    assert.equal(policy.timing("menu").durationMs, 120);
    assert.equal(policy.timing("menu").scaleFrom, 0.96);
    assert.equal(policy.timing("dialog").scaleFrom, 0.98, "撤回全局缩放后回到内置默认");
  });

  test("settings getter 抛错 → 按无设置处理，不向调用方抛出", () => {
    clearTokens();
    const { policy } = createPolicyHarness({
      settings: () => {
        throw new Error("boom");
      },
    });
    assert.equal(policy.timing("menu").durationMs, 150);
    assert.equal(policy.timing("menu").scaleFrom, 0.98);
    assert.equal(policy.timing("mask").scaleFrom, 1);
  });

  test("设置里的非法值被清洗：非有限数回退，越界值 clamp", () => {
    clearTokens();
    const { policy } = createPolicyHarness({
      settings: {
        durationMs: "300",
        scaleFrom: NaN,
        opacityFrom: Infinity,
        surfaces: { menu: { durationMs: 5000, scaleFrom: 2, opacityFrom: -1 } },
      },
    });
    assert.equal(policy.timing("dialog").durationMs, 220, "字符串时长按自动处理");
    assert.equal(policy.timing("menu").durationMs, 1000, "越界时长被 clamp");
    assert.equal(policy.timing("menu").scaleFrom, 1, "越界缩放被 clamp");
    assert.equal(policy.timing("menu").opacityFrom, 0, "越界透明度被 clamp");
    assert.equal(policy.timing("dialog").scaleFrom, 0.98);
    assert.equal(policy.timing("dialog").opacityFrom, 0);
  });
});
