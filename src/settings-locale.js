/**
 * src/settings-locale.js — 配置页运行时文案。
 *
 * 扁平字典（key → 文案），由 src/browser.js 在 apply 时通过
 * `ctx.locale.register(NS, { zh, en })` 注册；配置页组件从 props.t 取文案。
 * 中英必须保持同一 key 集合（test/bundle.test.mjs 断言）。
 * 依据：.agents/plan/v0.3.0/origin-aware-and-settings.md §3.6.1；
 * 动画参数文案见 .agents/plan/v1.1.0/animation-params.md §2.5；
 * 迁入根包见 .agents/plan/v1.2.0/plugin-page-config.md §2.2（去掉只服务于侧栏的 nav 键）。
 */

export const NS = "webui-transition";

export const zh = {
  title: "过渡动画",
  description: "可调配动画时长、初始缩放与透明度起点。",
  fallbackTitle: "无锚点回退方式",
  fallbackFade: "仅淡入",
  fallbackPointer: "点击原点",
  hint: "仅淡入：不做几何动画，只做透明度过渡。点击原点：以最近一次点击的位置作为缩放原点。",
  paramsTitle: "动画参数",
  paramsHint:
    "全局默认 + 分表面覆盖；分表面留空即跟随全局，全局留空则自动（时长读宿主 token，缩放/透明度用内置默认）。",
  targetGlobal: "全局",
  targetMenu: "菜单与列表",
  targetDialog: "对话框",
  targetMask: "遮罩",
  duration: "动画时长（毫秒）",
  scale: "初始缩放",
  opacity: "透明度起点",
  durationHostHint: "留空时读取宿主动画时长 token。",
  durationGlobalHint: "留空时跟随全局；0 表示关闭该表面组的过渡动画。",
  scaleDefaultHint: "留空时使用内置默认（约 0.98）。",
  scaleGlobalHint: "留空时跟随全局缩放。",
  scaleMaskHint: "遮罩默认固定为 1（全局缩放不作用于遮罩），留空时跟随默认。",
  opacityDefaultHint: "留空时使用内置默认 0。",
  opacityGlobalHint: "留空时跟随全局透明度。",
  auto: "自动",
  custom: "已自定义",
  useAuto: "改为自动",
  invalidNumber: "请输入有效数字。",
};

export const en = {
  title: "Transitions",
  description: "Tune animation duration, initial scale, and opacity start.",
  fallbackTitle: "Fallback when no anchor",
  fallbackFade: "Fade only",
  fallbackPointer: "Pointer origin",
  hint: "Fade only: no geometric animation, opacity only. Pointer origin: scale from the most recent pointer position.",
  paramsTitle: "Animation parameters",
  paramsHint:
    "Global defaults with per-surface overrides. A surface field left empty follows the global value; a global field left empty is automatic (duration from the host token, scale/opacity from built-in defaults).",
  targetGlobal: "Global",
  targetMenu: "Menus & lists",
  targetDialog: "Dialogs",
  targetMask: "Masks",
  duration: "Duration (ms)",
  scale: "Initial scale",
  opacity: "Opacity start",
  durationHostHint: "Leave empty to read the host's animation duration token.",
  durationGlobalHint: "Leave empty to follow the global value; 0 disables the transition for this surface group.",
  scaleDefaultHint: "Leave empty to use the built-in default (about 0.98).",
  scaleGlobalHint: "Leave empty to follow the global scale.",
  scaleMaskHint:
    "Masks are fixed at 1 by default (the global scale does not apply to masks); leave empty to use that default.",
  opacityDefaultHint: "Leave empty to use the built-in default of 0.",
  opacityGlobalHint: "Leave empty to follow the global opacity.",
  auto: "Auto",
  custom: "Custom",
  useAuto: "Use auto",
  invalidNumber: "Enter a valid number.",
};
