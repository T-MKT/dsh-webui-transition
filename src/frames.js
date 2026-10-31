/**
 * src/frames.js — 纯帧函数：关键帧构造 + 动画规格拆分。
 *
 * 只依赖 `SURFACE_DEFS` 与计算样式，不写 DOM、不创建动画、不做门卫。
 * `splitFade` / `animateShadow` / `distancePx` 等策略一律读 `SURFACE_DEFS[kind]`，
 * 不再出现 `kind === "menu" || kind === "listbox"` 这类硬编码分支
 * （.plan/v0.2.0/plan-b-rewrite.md §3.6，冻结签名见 §4）。
 */

import { SURFACE_DEFS } from "./defs.js";
import { defaultComputedStyle, isElement } from "./utils.js";

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

// 直接元素子级（只含 nodeType===1）。splitFade 表面把透明度下沉到这一层：
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

// 元素的自然 opacity（读取失败/非数 → 1）；动画收尾回到元素自然态，而非硬编码 1。
function naturalOpacity(element) {
  const style = defaultComputedStyle(element);
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
function naturalBoxShadow(element) {
  const style = defaultComputedStyle(element);
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
  const geometry = geometryFor(def, timing);

  if (def.splitFade) {
    const first = {};
    const last = {};
    if (independentTransforms && geometry.distancePx !== 0) {
      first.translate = "0 " + geometry.distancePx + "px";
      last.translate = "0 0";
      first.scale = String(geometry.scaleFrom);
      last.scale = "1";
    }
    if (boxShadow) {
      first.boxShadow = "none";
      last.boxShadow = boxShadow;
    }
    return Object.keys(first).length > 0 ? [first, last] : [];
  }

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
  const geometry = geometryFor(def, timing);

  if (def.splitFade) {
    const first = {};
    const last = {};
    if (independentTransforms && geometry.distancePx !== 0) {
      first.translate = "0 0";
      last.translate = "0 " + geometry.distancePx + "px";
      first.scale = "1";
      last.scale = String(geometry.scaleFrom);
    }
    if (boxShadow) {
      first.boxShadow = boxShadow;
      last.boxShadow = "none";
    }
    return Object.keys(first).length > 0 ? [first, last] : [];
  }

  const first = { opacity: 1 };
  const last = { opacity: geometry.opacityFrom };
  if (independentTransforms && geometry.distancePx !== 0) {
    first.translate = "0 0";
    last.translate = "0 " + geometry.distancePx + "px";
  }
  return [first, last];
}

// 把一个表面拆成若干条 WAAPI 动画规格（§3.6）：
// - splitFade 表面：表面几何/阴影一条（若表面帧非空）+ 每个直接元素子级一条
//   opacity（0 ↔ 自然值）；无直接元素子级时回退为「表面整体」（opacity 0↔1
//   并入表面帧；无几何帧时单独 opacity 帧）。
// - 非 splitFade 表面：仅表面整体一条。
// 只有 animateShadow 为 true 的表面才读取并传入 naturalBoxShadow。
export function animationSpecsFor(surface, kind, direction, independentTransforms) {
  if (!isElement(surface)) return [];
  const def = surfaceDefFor(kind);
  const out = direction === "out";
  const timing = {
    distancePx: def.distancePx,
    scaleFrom: def.scaleFrom,
    opacityFrom: def.opacityFrom,
  };
  const boxShadow = def.animateShadow ? naturalBoxShadow(surface) : null;
  const surfaceFrames = out
    ? exitKeyframesFor(kind, timing, independentTransforms, boxShadow)
    : keyframesFor(kind, timing, independentTransforms, boxShadow);

  if (!def.splitFade) {
    return surfaceFrames.length > 0 ? [{ element: surface, keyframes: surfaceFrames }] : [];
  }

  const children = directElementChildren(surface);
  if (children.length > 0) {
    const specs = [];
    if (surfaceFrames.length > 0) specs.push({ element: surface, keyframes: surfaceFrames });
    for (const child of children) {
      specs.push({ element: child, keyframes: fadeKeyframesFor(direction, naturalOpacity(child)) });
    }
    return specs;
  }

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
