/**
 * src/defs.js — 冻结常量与语义面描述符（`SURFACE_DEFS`）。
 *
 * 本文件是「数据」而不是「行为」：所有时长策略、拆分策略、阴影策略都从
 * `SURFACE_DEFS` 读取，其它模块不得再出现 `kind === "menu" || kind === "listbox"`
 * 这类硬编码分支（.plan/v0.2.0/plan-b-rewrite.md §3.1）。
 */

export const OBSERVED_ATTRIBUTES = [
  "hidden",
  "aria-hidden",
  "aria-expanded",
  "open",
  "role",
  "data-slot",
  "data-phase",
];

// 语义面硬排除（与 dsh-motion 一致，前缀改为 dsh-transition）。
export const HARD_EXCLUSION =
  '[data-dsh-transition="off"], [data-dsh-transition-ghost], [data-chat-flow],' +
  ' [data-chat-flow-key], [data-streaming], [data-trajectory-scroll], [data-trajectory-row-key],' +
  ' [role="tooltip"], [role="alert"]';

export const MOTION_MEDIA_QUERY = "(prefers-reduced-motion: reduce)";
export const DEFAULT_EASING = "cubic-bezier(.4, 0, .2, 1)";
export const DIALOG_EASING = "cubic-bezier(.22, 1, .36, 1)";

// tokens() 缺失时的 token 级 fallback；kind 级 fallback 见 SURFACE_DEFS。
export const TOKEN_FALLBACK = {
  easing: DEFAULT_EASING,
  fastMs: 100,
  normalMs: 200,
  slowMs: 300,
};

// 冻结的时长/几何策略表：kind → token / fallback / clamp / 入场几何 / 动画拆分方式。
export const SURFACE_DEFS = {
  menu: {
    role: "menu",
    property: "--ds-transition-duration-fast",
    fallbackMs: 150,
    minMs: 120,
    maxMs: 160,
    distancePx: -4,
    scaleFrom: 0.98,
    opacityFrom: 0,
    easing: null, // null = 用 --ds-ease-in-out
    splitFade: true, // 透明度下沉到直接元素子级
    animateShadow: true,
  },
  listbox: {
    role: "listbox",
    property: "--ds-transition-duration-fast",
    fallbackMs: 150,
    minMs: 120,
    maxMs: 160,
    distancePx: -4,
    scaleFrom: 0.98,
    opacityFrom: 0,
    easing: null,
    splitFade: true,
    animateShadow: true,
  },
  dialog: {
    role: "dialog",
    property: "--ds-transition-duration",
    fallbackMs: 220,
    minMs: 160,
    maxMs: 240,
    distancePx: 12,
    scaleFrom: 1,
    opacityFrom: 0,
    easing: DIALOG_EASING,
    splitFade: false,
    animateShadow: false,
  },
  mask: {
    role: null,
    property: "--ds-transition-duration",
    fallbackMs: 180,
    minMs: 140,
    maxMs: 220,
    distancePx: 0,
    scaleFrom: 1,
    opacityFrom: 0,
    easing: null,
    splitFade: false,
    animateShadow: false,
  },
};

export const SURFACE_SELECTOR = '[role="menu"], [role="listbox"], [role="dialog"]';
