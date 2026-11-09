/**
 * src/marker.js — 表面级原点标记 + 中心几何纯函数。
 *
 * 表面所属插件可以在表面元素上打 `data-dsh-transition-origin="center"` 标记，
 * 主插件据此无条件以表面正中心为 `transform-origin` 缩放（不解析触发源）。
 * 标记值是跨插件的通用 opt-in 契约：主插件不认识任何宿主属性，由表面所属
 * 插件自己打标记（当前由设置插件给设置面板打）。
 *
 * 依据：.agents/plan/v1.0.0/settings-center-origin.md §2（冻结签名）。
 */

export const ORIGIN_MARKER_ATTRIBUTE = "data-dsh-transition-origin";
export const ORIGIN_MARKER_CENTER = "center";

// 只有元素节点且标记值精确等于 "center" 才算中心原点表面；读取异常一律 false。
export function isCenterOriginSurface(element) {
  if (!element || element.nodeType !== 1) return false;
  try {
    return element.getAttribute(ORIGIN_MARKER_ATTRIBUTE) === ORIGIN_MARKER_CENTER;
  } catch (error) {
    return false;
  }
}

// 表面矩形 → 中心 origin 几何：形状与 origin.js 的 geometry 一致。
// 统一 -0 → +0，避免深比较把零坐标当成差异。
export function centerGeometryFor(rect) {
  const originX = rect.width / 2;
  const originY = rect.height / 2;
  return {
    originX: originX === 0 ? 0 : originX,
    originY: originY === 0 ? 0 : originY,
  };
}
