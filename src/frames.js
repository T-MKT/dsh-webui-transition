/**
 * src/frames.js — 纯帧函数：关键帧构造 + 动画规格拆分。
 *
 * 只依赖 `SURFACE_DEFS` 与计算样式，不写 DOM、不创建动画、不做门卫。
 * `splitFade` / `animateShadow` / `distancePx` 等策略一律读 `SURFACE_DEFS[kind]`，
 * 不再出现 `kind === "menu" || kind === "listbox"` 这类硬编码分支
 * （.plan/v0.2.0/plan-b-rewrite.md §3.6，冻结签名见 §4）。
 *
 * v0.2.0 追加「伪元素玻璃」模式（.plan/v0.2.0/pseudo-glass-blur.md）：
 * 表面自身无 backdrop-filter、但 ::before/::after 带 backdrop-filter 时，表面不能做
 * opacity 动画（会成为 backdrop-root，使伪元素无法采样页面背景）；改为表面几何/阴影 +
 * 直接子级 opacity + 伪元素自身 opacity（后者由 runtime 用 WAAPI pseudoElement 播放）。
 */

import { SURFACE_DEFS } from "./defs.js";
import { defaultComputedStyle, isElement, readBackdropFilter } from "./utils.js";

// 未知 kind 回退到 menu 描述符（§3.6）。
function surfaceDefFor(kind) {
  return SURFACE_DEFS[kind] || SURFACE_DEFS.menu;
}

// timing 快照里的几何参数缺失/非有限数时，回退到该 kind 的 SURFACE_DEFS 值；
// 不再硬编码 0 / 1（§3.6）。
function geometryFor(def, timing) {
  const source = timing && typeof timing === "object" ? timing : {};
  return {
    distancePx: Number.isFinite(source.distancePx) ? source.distancePx : def.distancePx,
    scaleFrom: Number.isFinite(source.scaleFrom) ? source.scaleFrom : def.scaleFrom,
    opacityFrom: Number.isFinite(source.opacityFrom) ? source.opacityFrom : def.opacityFrom,
  };
}

// 表面级几何帧（translate/scale + 可选 boxShadow），不含 opacity：
// splitFade 表面与伪元素玻璃表面共用。direction 为 "out" 时是入场帧的镜像。
function geometryKeyframesFor(kind, timing, independentTransforms, boxShadow, out) {
  const def = surfaceDefFor(kind);
  const geometry = geometryFor(def, timing);
  const first = {};
  const last = {};
  if (independentTransforms) {
    if (geometry.distancePx !== 0) {
      first.translate = out ? "0 0" : "0 " + geometry.distancePx + "px";
      last.translate = out ? "0 " + geometry.distancePx + "px" : "0 0";
    }
    if (geometry.scaleFrom !== 1) {
      first.scale = out ? "1" : String(geometry.scaleFrom);
      last.scale = out ? String(geometry.scaleFrom) : "1";
    }
  }
  if (boxShadow) {
    first.boxShadow = out ? boxShadow : "none";
    last.boxShadow = out ? "none" : boxShadow;
  }
  return Object.keys(first).length > 0 ? [first, last] : [];
}

// 直接元素子级（只含 nodeType===1）。splitFade 语义把透明度下沉到这一层：
// 透明度动画若落在玻璃层的祖先上，祖先会成为 backdrop-root，子级 backdrop-filter
// 便只能在该 root 内采样（空背景）→ 过渡期间模糊失效。
function directElementChildren(element) {
  if (!isElement(element) || !element.childNodes) return [];
  const children = [];
  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType === 1) children.push(child);
  }
  return children;
}

// 判断伪元素是否真的生成（content 非 none/normal 等）：只有生成的伪元素才可能是玻璃层。
function isGeneratedPseudoElement(style) {
  if (!style) return false;
  let content = "";
  try {
    content = style.content || "";
  } catch (error) {
    content = "";
  }
  const trimmed = String(content).trim().toLowerCase();
  return (
    trimmed !== "" &&
    trimmed !== "none" &&
    trimmed !== "normal" &&
    trimmed !== "initial" &&
    trimmed !== "inherit" &&
    trimmed !== "unset"
  );
}

// 伪元素玻璃检测：表面自身即玻璃层时返回 null（自身 opacity 动画不阻断自身
// backdrop-filter，见 .plan/v0.1.0/blur-during-transition.md A2）；
// 否则返回第一个生成且带 backdrop-filter 的伪元素选择器（"::before" / "::after"）。
function pseudoGlassFor(surface, computedStyle) {
  try {
    if (readBackdropFilter(computedStyle(surface))) return null;
    for (const pseudo of ["::before", "::after"]) {
      const style = computedStyle(surface, pseudo);
      if (isGeneratedPseudoElement(style) && readBackdropFilter(style)) return pseudo;
    }
  } catch (error) {
    return null;
  }
  return null;
}

// 元素的自然 opacity（读取失败/非数 → 1）；动画收尾回到元素自然态，而非硬编码 1。
function naturalOpacity(element, pseudoElement = null, computedStyle = defaultComputedStyle) {
  const style = computedStyle(element, pseudoElement || null);
  if (!style) return 1;
  let value = NaN;
  try {
    value = parseFloat(style.opacity);
  } catch (error) {
    value = NaN;
  }
  return Number.isFinite(value) ? value : 1;
}

// 元素的自然 box-shadow（none/空/读取失败 → null，表示阴影不参与动画）。
function naturalBoxShadow(element, computedStyle = defaultComputedStyle) {
  const style = computedStyle(element);
  if (!style) return null;
  let value = "";
  try {
    value = style.boxShadow || "";
  } catch (error) {
    return null;
  }
  const trimmed = String(value).trim();
  if (!trimmed || trimmed.toLowerCase() === "none") return null;
  return trimmed;
}

// 淡入 / 淡出关键帧：'out' 从自然值到 0，其余从 0 到自然值（与 v0.1.0 一致）。
export function fadeKeyframesFor(direction, opacity) {
  const value = Number.isFinite(opacity) ? opacity : 1;
  if (direction === "out") return [{ opacity: value }, { opacity: 0 }];
  return [{ opacity: 0 }, { opacity: value }];
}

// 入场关键帧（§3.6）：
// - splitFade 表面只写几何（translate/scale）+ 可选阴影淡入，不写 opacity；
// - 非 splitFade 表面维持整体关键帧（opacity [+translate]；mask 的 distancePx 为 0，
//   自然没有 translate）。
export function keyframesFor(kind, timing, independentTransforms, boxShadow = null) {
  const def = surfaceDefFor(kind);
  if (def.splitFade) {
    return geometryKeyframesFor(kind, timing, independentTransforms, boxShadow, false);
  }

  const geometry = geometryFor(def, timing);
  const first = { opacity: geometry.opacityFrom };
  const last = { opacity: 1 };
  if (independentTransforms && geometry.distancePx !== 0) {
    first.translate = "0 " + geometry.distancePx + "px";
    last.translate = "0 0";
  }
  return [first, last];
}

// 退场关键帧 = 入场镜像（splitFade 表面同样不含 opacity，末帧阴影回到 "none"）。
export function exitKeyframesFor(kind, timing, independentTransforms, boxShadow = null) {
  const def = surfaceDefFor(kind);
  if (def.splitFade) {
    return geometryKeyframesFor(kind, timing, independentTransforms, boxShadow, true);
  }

  const geometry = geometryFor(def, timing);
  const first = { opacity: 1 };
  const last = { opacity: geometry.opacityFrom };
  if (independentTransforms && geometry.distancePx !== 0) {
    first.translate = "0 0";
    last.translate = "0 " + geometry.distancePx + "px";
  }
  return [first, last];
}

// 把一个表面拆成若干条 WAAPI 动画规格（§3.6 + v0.2.0 伪元素玻璃）：
// - splitFade 表面：表面几何/阴影一条（若表面帧非空）+ 每个直接元素子级一条
//   opacity（0 ↔ 自然值）；无直接元素子级时回退为「表面整体」（opacity 0↔1
//   并入表面帧；无几何帧时单独 opacity 帧）。
// - 伪元素玻璃表面（非 splitFade 且玻璃在 ::before/::after）：同 splitFade 的拆分，
//   另加伪元素自身 opacity 规格（带 pseudoElement 字段，由 runtime 播放）。
// - 非 splitFade 表面（玻璃在自身或不是玻璃）：仅表面整体一条。
// 只有 animateShadow 为 true 的表面（或伪元素玻璃表面）才读取并传入 naturalBoxShadow，
// 使阴影与玻璃/内容同步淡入淡出，避免「先出现只有阴影的轮廓」。
export function animationSpecsFor(surface, kind, direction, independentTransforms, options = {}) {
  if (!isElement(surface)) return [];
  const def = surfaceDefFor(kind);
  const out = direction === "out";
  const computedStyle =
    options && typeof options.computedStyle === "function" ? options.computedStyle : defaultComputedStyle;
  const timing = {
    distancePx: def.distancePx,
    scaleFrom: def.scaleFrom,
    opacityFrom: def.opacityFrom,
  };
  // 只有「整体 opacity 动画」的表面才需要伪元素玻璃检测（splitFade 表面本就不动画自身 opacity）。
  const pseudoGlass = def.splitFade ? null : pseudoGlassFor(surface, computedStyle);
  const boxShadow =
    def.animateShadow || pseudoGlass !== null ? naturalBoxShadow(surface, computedStyle) : null;

  if (!def.splitFade && pseudoGlass === null) {
    const surfaceFrames = out
      ? exitKeyframesFor(kind, timing, independentTransforms, boxShadow)
      : keyframesFor(kind, timing, independentTransforms, boxShadow);
    return surfaceFrames.length > 0 ? [{ element: surface, keyframes: surfaceFrames }] : [];
  }

  const surfaceFrames = geometryKeyframesFor(kind, timing, independentTransforms, boxShadow, out);
  const children = directElementChildren(surface);
  const specs = [];
  if (surfaceFrames.length > 0) specs.push({ element: surface, keyframes: surfaceFrames });
  for (const child of children) {
    specs.push({
      element: child,
      keyframes: fadeKeyframesFor(direction, naturalOpacity(child, null, computedStyle)),
    });
  }
  if (pseudoGlass !== null) {
    specs.push({
      element: surface,
      pseudoElement: pseudoGlass,
      keyframes: fadeKeyframesFor(direction, naturalOpacity(surface, pseudoGlass, computedStyle)),
    });
  }
  if (children.length > 0 || pseudoGlass !== null) return specs;

  // 无直接元素子级：没有可下沉的层级，淡入淡出回到表面自身。
  const from = out ? 1 : 0;
  const to = out ? 0 : 1;
  if (surfaceFrames.length === 0) {
    return [{ element: surface, keyframes: [{ opacity: from }, { opacity: to }] }];
  }
  const frames = surfaceFrames.map((frame) => Object.assign({}, frame));
  frames[0].opacity = from;
  frames[frames.length - 1].opacity = to;
  return [{ element: surface, keyframes: frames }];
}
