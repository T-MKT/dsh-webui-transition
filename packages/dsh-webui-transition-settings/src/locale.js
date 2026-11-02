/**
 * packages/dsh-webui-transition-settings/src/locale.js — 设置页运行时文案。
 *
 * 扁平字典（key → 文案），由设置插件在 apply 时通过
 * `ctx.locale.register(NS, { zh, en })` 注册；设置页组件从 props.t 取文案。
 * 依据：.agents/plan/v0.3.0/origin-aware-and-settings.md §3.6.1。
 */

export const NS = "webui-transition";

export const zh = {
  nav: "过渡动画",
  title: "过渡动画",
  description: "无法推断触发元素时，弹层如何入场。",
  fallbackFade: "仅淡入",
  fallbackPointer: "点击原点",
  hint: "仅淡入：不做几何动画，只做透明度过渡。点击原点：以最近一次点击的位置作为缩放原点。",
};

export const en = {
  nav: "Transitions",
  title: "Transitions",
  description: "How overlays animate in when the trigger element cannot be inferred.",
  fallbackFade: "Fade only",
  fallbackPointer: "Pointer origin",
  hint: "Fade only: no geometric animation, opacity only. Pointer origin: scale from the most recent pointer position.",
};
