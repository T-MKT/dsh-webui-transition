/**
 * src/gate.js — 兼容性门卫（四重）：排除区 / 可见性 / 宿主动画 / 宿主 CSS transition 冲突。
 *
 * 对应 .plan/v0.2.0/plan-b-rewrite.md §3.5（冻结签名见 §4，测试要点见 §5.3）。
 * 本模块是 v0.1.0 `createCompatibility`（client.js 三重门卫）的拆分 + plan 新增的
 * 第四重门卫 `hasHostTransitionConflict`；旧名 `createCompatibility` 不保留（§4）。
 *
 * Gate = { canAnimate(element, kind, ownedAnimations): boolean }
 */

import { SURFACE_DEFS } from "./defs.js";
import {
  defaultComputedStyle,
  isElement,
  isExcluded,
  parseCssDuration,
  readStyleProperty,
} from "./utils.js";

/**
 * 创建门卫实例。
 *
 * @param {object} [options]
 * @param {(element: Element) => CSSStyleDeclaration | null} [options.computedStyle]
 *   读取计算样式的依赖，默认 utils.defaultComputedStyle；单测可注入。
 * @returns {{ canAnimate(element: Element, kind: string, ownedAnimations?: Set<Animation>): boolean }}
 */
export function createGate(options = {}) {
  const computedStyle =
    typeof options.computedStyle === "function" ? options.computedStyle : defaultComputedStyle;

  // -------------------------------------------------------------------------
  // 门卫 2：至少自身可见（照搬 v0.1.0 createCompatibility 语义）
  // 自身 hidden、祖先 hidden / aria-hidden、自身与祖先 computed display:none → 拒绝。
  // -------------------------------------------------------------------------
  function isAtLeastSelfVisible(element) {
    if (element.hidden) return false;
    // 祖先隐藏：hidden / aria-hidden / display:none
    let ancestor = element.parentElement;
    while (ancestor) {
      if (ancestor.hidden) return false;
      if (ancestor.getAttribute("aria-hidden") === "true") return false;
      ancestor = ancestor.parentElement;
    }
    // 自身与祖先的 display:none
    let current = element;
    while (current && current.nodeType === 1) {
      const style = computedStyle(current);
      if (style && style.display === "none") return false;
      current = current.parentElement;
    }
    return true;
  }

  // -------------------------------------------------------------------------
  // 门卫 3：宿主已有动画（照搬 v0.1.0 createCompatibility 语义）
  // getAnimations() 中存在非 owned 且未 finished 的动画，或 computed animation-name 非 none → 拒绝。
  // -------------------------------------------------------------------------
  function isOwnedAnimation(ownedAnimations, animation) {
    if (!ownedAnimations || typeof ownedAnimations.has !== "function") return false;
    try {
      return ownedAnimations.has(animation);
    } catch (error) {
      return false;
    }
  }

  function hasHostAnimation(element, ownedAnimations) {
    if (typeof element.getAnimations === "function") {
      let animations = [];
      try {
        animations = element.getAnimations() || [];
      } catch (error) {
        animations = [];
      }
      for (const animation of animations) {
        if (isOwnedAnimation(ownedAnimations, animation)) continue;
        if (animation && animation.playState !== "finished") return true;
      }
    }
    const style = computedStyle(element);
    if (style) {
      let animationName = "";
      try {
        animationName = style.animationName || style.getPropertyValue("animation-name") || "";
      } catch (error) {
        animationName = "";
      }
      if (animationName && animationName !== "none") return true;
    }
    return false;
  }

  // -------------------------------------------------------------------------
  // 门卫 4（v0.2.0 新增）：宿主 CSS transition 冲突（§3.5）
  //
  // 属性集合由 SURFACE_DEFS[kind] 决定，与我们实际会动画的属性保持一致：
  // - splitFade: true（menu/listbox）→ translate、scale，animateShadow 为 true 时加 box-shadow，
  //   不写 opacity（透明度下沉到直接元素子级，由子级动画负责）；
  // - splitFade: false → opacity，distancePx !== 0 时加 translate。
  // -------------------------------------------------------------------------
  function animatedPropertiesFor(kind) {
    const surface = SURFACE_DEFS[kind];
    const definition = surface && typeof surface === "object" ? surface : SURFACE_DEFS.menu;
    if (definition.splitFade) {
      const properties = ["translate", "scale"];
      if (definition.animateShadow) properties.push("box-shadow");
      return properties;
    }
    const properties = ["opacity"];
    if (definition.distancePx !== 0) properties.push("translate");
    return properties;
  }

  // 读取 computed style 长属性：优先驼峰属性，其次 getPropertyValue（kebab-case）。
  function readComputedProperty(style, camelName, kebabName) {
    let value = "";
    try {
      const direct = style[camelName];
      if (typeof direct === "string") value = direct;
    } catch (error) {
      value = "";
    }
    const trimmed = value.trim();
    if (trimmed) return trimmed;
    return readStyleProperty(style, kebabName).trim();
  }

  function splitCssList(value) {
    if (typeof value !== "string") return [];
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  function hasHostTransitionConflict(element, kind) {
    try {
      const style = computedStyle(element);
      if (!style) return false;
      const propertyValue = readComputedProperty(style, "transitionProperty", "transition-property");
      const propertyList = splitCssList(propertyValue).map((property) => property.toLowerCase());
      // transition-property 为 "none" / 空 → 没有可冲突的过渡。
      if (propertyList.length === 0 || propertyValue.toLowerCase() === "none") return false;
      const durationList = splitCssList(
        readComputedProperty(style, "transitionDuration", "transition-duration"),
      );
      if (durationList.length === 0) return false;

      for (const property of animatedPropertiesFor(kind)) {
        for (let index = 0; index < propertyList.length; index += 1) {
          const candidate = propertyList[index];
          // "all" 覆盖全部属性；否则必须精确命中我们动画的属性名。
          if (candidate !== "all" && candidate !== property) continue;
          // CSS 时长列表按属性索引取模循环：第 index 个属性用 durationList[index % len]。
          const duration = parseCssDuration(durationList[index % durationList.length], 0);
          if (duration > 0) return true;
        }
      }
      return false;
    } catch (error) {
      // 只读检测：任何读取/解析异常一律放行（§3.5：失败放行，视为无冲突）。
      return false;
    }
  }

  // -------------------------------------------------------------------------
  // 四重门卫按 §3.5 顺序执行
  // -------------------------------------------------------------------------
  function canAnimate(element, kind, ownedAnimations) {
    if (!isElement(element)) return false;
    if (isExcluded(element)) return false;
    if (!isAtLeastSelfVisible(element)) return false;
    if (hasHostAnimation(element, ownedAnimations)) return false;
    if (hasHostTransitionConflict(element, kind)) return false;
    return true;
  }

  return { canAnimate };
}
