/**
 * src/origin.js — 交互捕获、触发源解析与 origin 几何（v0.3.0 origin-aware 基础）。
 *
 * 职责（只读 DOM，不写 DOM、不 preventDefault）：
 * 1. `createInteractionTracker`：在 window 的 capture 阶段记录最近一次指针 / 键盘
 *    交互（事件时刻的坐标与元素矩形），并为动画表面解析触发源，优先级为
 *    DOM 邻接（子菜单 / 非 portal wrapper）→ aria-controls → 展开态扫描（邻接闸门）
 *    → 最近指针目标 → 键盘 activeElement / 最近 keydown → null。
 * 2. `geometryForSource`：把触发源换算成表面内的 transform-origin。
 *
 * 矩形一律在事件时刻经元素自身的 `getBoundingClientRect()` 读取，元素随后卸载
 * 不影响解析；布局 API 缺失 / 异常 / 零尺寸时按「无触发源」处理（无法确认时
 * 宁可回退，不猜）。jsdom 的矩形为 0，测试需自行 stub，本模块不做特殊适配。
 *
 * 对应计划：.agents/plan/v0.3.0/origin-aware-and-settings.md §2.5（冻结行为）、
 * §2.7（冻结签名）。
 */

import { clampNumber, isElement, isElementConnected } from "./utils.js";

// 触发源新鲜度与邻接闸门（§2.5 冻结值；误配时宁可回退）。
const FRESH_MS = 2500;
const ADJACENT_GAP_PX = 24;
const MAX_CENTER_DISTANCE_PX = 1400;

const TRIGGER_SELECTOR = 'button, a[href], [role="button"], [aria-haspopup]';
const MENU_ANCESTOR_SELECTOR = '[role="menu"]';
const MENU_ITEM_SELECTOR = '[role="menuitem"], [aria-haspopup]';
const EXPANDED_SELECTOR = '[aria-expanded="true"][aria-haspopup]';
const GHOST_SELECTOR = "[data-dsh-transition-ghost]";

// ---------------------------------------------------------------------------
// 矩形与 DOM 小工具（全部失败安全，异常 → null / false）。
// ---------------------------------------------------------------------------

function numberValue(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

// 把 DOMRect / 矩形字面量归一成 { left, top, width, height }；缺字段返回 null。
function toBox(rect) {
  if (!rect) return null;
  const left = numberValue(rect.left);
  const top = numberValue(rect.top);
  let width = numberValue(rect.width);
  let height = numberValue(rect.height);
  if (width === null && left !== null) {
    const right = numberValue(rect.right);
    width = right === null ? null : right - left;
  }
  if (height === null && top !== null) {
    const bottom = numberValue(rect.bottom);
    height = bottom === null ? null : bottom - top;
  }
  if (left === null || top === null || width === null || height === null) return null;
  return { left, top, width, height };
}

function isValidBox(box) {
  return !!box && box.width > 0 && box.height > 0;
}

function isValidRect(rect) {
  return isValidBox(toBox(rect));
}

// 事件时刻读取元素矩形：返回原始矩形对象（便于调用方原样交给几何计算），
// 读不到 / 不可用 → null。
function readRect(element) {
  if (!isElement(element) || typeof element.getBoundingClientRect !== "function") return null;
  try {
    const rect = element.getBoundingClientRect();
    return toBox(rect) ? rect : null;
  } catch (error) {
    return null;
  }
}

function boxCenter(box) {
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

function centerDistance(a, b) {
  const first = boxCenter(a);
  const second = boxCenter(b);
  const dx = first.x - second.x;
  const dy = first.y - second.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// 两矩形在 x / y 轴上的投影间隙（0 = 该轴有重叠）。
function projectionGap(a, b) {
  return {
    dx: Math.max(0, a.left - (b.left + b.width), b.left - (a.left + a.width)),
    dy: Math.max(0, a.top - (b.top + b.height), b.top - (a.top + a.height)),
  };
}

// 展开态扫描的邻接闸门：至少一轴投影重叠且另一轴间隙 ≤24px，或最近边距
// ≤24px；且中心距离 ≤1400px。通过时返回中心距离（用于「取最近者」），否则 null。
function adjacencyDistance(a, b) {
  const gap = projectionGap(a, b);
  const overlapX = gap.dx === 0;
  const overlapY = gap.dy === 0;
  const projectionAdjacent =
    (overlapX && gap.dy <= ADJACENT_GAP_PX) || (overlapY && gap.dx <= ADJACENT_GAP_PX);
  const nearestEdge = Math.sqrt(gap.dx * gap.dx + gap.dy * gap.dy);
  if (!projectionAdjacent && nearestEdge > ADJACENT_GAP_PX) return null;
  const distance = centerDistance(a, b);
  if (distance > MAX_CENTER_DISTANCE_PX) return null;
  return distance;
}

function elementMatches(element, selector) {
  if (!isElement(element) || typeof element.matches !== "function") return false;
  try {
    return element.matches(selector);
  } catch (error) {
    return false;
  }
}

function closestMatch(element, selector) {
  if (!isElement(element) || typeof element.closest !== "function") return null;
  try {
    return element.closest(selector);
  } catch (error) {
    return null;
  }
}

function containsNode(container, node) {
  if (!isElement(container) || !node) return false;
  if (container === node) return true;
  try {
    return typeof container.contains === "function" && container.contains(node);
  } catch (error) {
    return false;
  }
}

function tagNameOf(element) {
  const name = isElement(element) ? element.tagName : null;
  return typeof name === "string" ? name.toUpperCase() : "";
}

function sourceFromElement(element) {
  if (!isElement(element)) return null;
  const rect = readRect(element);
  if (!isValidRect(rect)) return null;
  return { kind: "element", rect };
}

// surface 父级的直接子级里，找不在 surface 内、矩形有效的 trigger，
// 多个候选取与 surface 中心最近者（toolbar 等场景下更稳）。
function findSiblingTrigger(container, surface, selector) {
  if (!isElement(container)) return null;
  let children = [];
  try {
    children = Array.from(container.children || []);
  } catch (error) {
    return null;
  }
  const surfaceBox = toBox(readRect(surface));
  let best = null;
  let bestDistance = Infinity;
  for (const child of children) {
    if (child === surface || containsNode(surface, child)) continue;
    if (!elementMatches(child, selector)) continue;
    const box = toBox(readRect(child));
    if (!isValidBox(box)) continue;
    const distance = surfaceBox ? centerDistance(surfaceBox, box) : 0;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = child;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// createInteractionTracker
// ---------------------------------------------------------------------------

export function createInteractionTracker(options = {}) {
  const opts = options && typeof options === "object" ? options : {};
  const now = typeof opts.now === "function" ? opts.now : () => Date.now();

  let started = false;
  let activeSnapshot = null;
  // 最近一次 pointerdown/click：{ kind, rect, target, x, y, time }
  let pointerRecord = null;
  // 最近一次 pointermove：{ x, y, time }
  let moveRecord = null;
  // 最近一次 keydown：{ kind, rect, target, time }
  let keyboardRecord = null;

  // ---- 环境访问：window / document 缺省懒取，避免模块求值期绑定全局 ----

  function getWindow() {
    if (opts.window !== undefined) return opts.window || null;
    if (typeof globalThis === "undefined") return null;
    return globalThis.window || null;
  }

  function getDocument() {
    if (opts.document !== undefined) return opts.document || null;
    if (typeof globalThis !== "undefined" && globalThis.document) return globalThis.document;
    const window = getWindow();
    return window && window.document ? window.document : null;
  }

  function currentTime() {
    try {
      const value = Number(now());
      return Number.isFinite(value) ? value : 0;
    } catch (error) {
      return 0;
    }
  }

  function isFresh(record) {
    return !!record && currentTime() - record.time <= FRESH_MS;
  }

  function readActiveElement(document) {
    if (!document) return activeSnapshot;
    try {
      return isElement(document.activeElement) ? document.activeElement : null;
    } catch (error) {
      return activeSnapshot;
    }
  }

  function snapshotActiveElement() {
    activeSnapshot = readActiveElement(getDocument());
  }

  // ---- 事件记录 ----

  function readEventTarget(event) {
    if (!event) return null;
    try {
      return isElement(event.target) ? event.target : null;
    } catch (error) {
      return null;
    }
  }

  function readEventPoint(event) {
    if (!event) return { x: null, y: null };
    return { x: numberValue(event.clientX), y: numberValue(event.clientY) };
  }

  function recordPointer(event) {
    const target = readEventTarget(event);
    if (!target) return;
    const point = readEventPoint(event);
    pointerRecord = {
      kind: "element",
      rect: readRect(target),
      target,
      x: point.x,
      y: point.y,
      time: currentTime(),
    };
  }

  function recordMove(event) {
    const point = readEventPoint(event);
    moveRecord = { x: point.x, y: point.y, time: currentTime() };
  }

  function recordKeydown(event) {
    const target = readEventTarget(event);
    if (!target) return;
    keyboardRecord = { kind: "element", rect: readRect(target), target, time: currentTime() };
  }

  function handlePointerDown(event) {
    try {
      recordPointer(event);
      snapshotActiveElement();
    } catch (error) {
      // 记录失败只影响本次解析，不影响宿主。
    }
  }

  function handleClick(event) {
    try {
      recordPointer(event);
      snapshotActiveElement();
    } catch (error) {
      // 同上。
    }
  }

  function handleKeydown(event) {
    try {
      recordKeydown(event);
      snapshotActiveElement();
    } catch (error) {
      // 同上。
    }
  }

  function handlePointerMove(event) {
    try {
      recordMove(event);
      snapshotActiveElement();
    } catch (error) {
      // 同上。
    }
  }

  function start() {
    if (started) return;
    const window = getWindow();
    if (!window || typeof window.addEventListener !== "function") return;
    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("click", handleClick, true);
    window.addEventListener("keydown", handleKeydown, true);
    window.addEventListener("pointermove", handlePointerMove, true);
    started = true;
  }

  function stop() {
    if (!started) return;
    started = false;
    const window = getWindow();
    if (!window || typeof window.removeEventListener !== "function") return;
    window.removeEventListener("pointerdown", handlePointerDown, true);
    window.removeEventListener("click", handleClick, true);
    window.removeEventListener("keydown", handleKeydown, true);
    window.removeEventListener("pointermove", handlePointerMove, true);
  }

  // ---- 触发源解析（§2.5 优先级 1 → 6） ----

  // 1. DOM 邻接：子菜单取 menuitem / aria-haspopup 祖先；非 portal 菜单取
  //    wrapper 内的 trigger。body / html 视为 surface 的 portal 容器而非 wrapper，
  //    避免把页面里任意 trigger 误判成邻接源。
  function resolveAdjacent(surface) {
    const parent = surface.parentElement;
    if (!isElement(parent)) return null;
    if (closestMatch(parent, MENU_ANCESTOR_SELECTOR)) {
      return (
        sourceFromElement(closestMatch(parent, MENU_ITEM_SELECTOR)) ||
        sourceFromElement(findSiblingTrigger(parent, surface, MENU_ITEM_SELECTOR))
      );
    }
    const tagName = tagNameOf(parent);
    if (tagName === "BODY" || tagName === "HTML") return null;
    return sourceFromElement(findSiblingTrigger(parent, surface, TRIGGER_SELECTOR));
  }

  // 2. aria 关联：surface.id → [aria-controls~="id"]。
  function resolveAriaControls(surface) {
    let id = "";
    try {
      id = surface.getAttribute("id") || "";
    } catch (error) {
      return null;
    }
    if (!id) return null;
    const document = getDocument();
    if (!document || typeof document.querySelector !== "function") return null;
    const escaped = String(id).replace(/["\\]/g, "\\$&");
    let trigger = null;
    try {
      trigger = document.querySelector('[aria-controls~="' + escaped + '"]');
    } catch (error) {
      return null;
    }
    return sourceFromElement(trigger);
  }

  // 3. 展开态扫描：所有 [aria-expanded="true"][aria-haspopup]，过邻接闸门，取最近。
  function resolveExpanded(surface) {
    const surfaceBox = toBox(readRect(surface));
    if (!isValidBox(surfaceBox)) return null;
    const document = getDocument();
    if (!document || typeof document.querySelectorAll !== "function") return null;
    let candidates = [];
    try {
      candidates = Array.from(document.querySelectorAll(EXPANDED_SELECTOR));
    } catch (error) {
      return null;
    }
    let best = null;
    let bestDistance = Infinity;
    for (const candidate of candidates) {
      if (containsNode(surface, candidate)) continue;
      if (closestMatch(candidate, GHOST_SELECTOR)) continue;
      const box = toBox(readRect(candidate));
      if (!isValidBox(box)) continue;
      const distance = adjacencyDistance(surfaceBox, box);
      if (distance === null || distance >= bestDistance) continue;
      bestDistance = distance;
      best = candidate;
    }
    return sourceFromElement(best);
  }

  // 4 / 5 的共用分支：记录仍新鲜、矩形有效；target 仍在文档上取当前矩形，
  // 否则用事件时刻记录下的矩形（元素随后卸载也不影响）。
  function resolveRecorded(record) {
    if (!record || !isFresh(record) || !isElement(record.target)) return null;
    let rect = null;
    if (isElementConnected(record.target)) rect = readRect(record.target);
    if (!isValidRect(rect)) rect = record.rect;
    if (!isValidRect(rect)) return null;
    return { kind: "element", rect };
  }

  // 5. 键盘：当前 document.activeElement 在 surface 外且是 trigger 型元素；
  //    否则最近 keydown 记录。
  function resolveKeyboard(surface) {
    const active = readActiveElement(getDocument());
    if (active && !containsNode(surface, active) && elementMatches(active, TRIGGER_SELECTOR)) {
      const rect = readRect(active);
      if (isValidRect(rect)) return { kind: "element", rect };
    }
    return resolveRecorded(keyboardRecord);
  }

  function resolve(surface) {
    try {
      if (!isElement(surface)) return null;
      const adjacent = resolveAdjacent(surface);
      if (adjacent) return adjacent;
      const controlled = resolveAriaControls(surface);
      if (controlled) return controlled;
      const expanded = resolveExpanded(surface);
      if (expanded) return expanded;
      const pointer = resolveRecorded(pointerRecord);
      if (pointer) return pointer;
      return resolveKeyboard(surface);
    } catch (error) {
      return null;
    }
  }

  // 最近 pointerdown 的坐标（没有则 pointermove 的坐标），≤2500ms 才返回。
  function lastPointerPoint() {
    try {
      const record = pointerRecord || moveRecord;
      if (!record || !isFresh(record)) return null;
      if (typeof record.x !== "number" || typeof record.y !== "number") return null;
      if (!Number.isFinite(record.x) || !Number.isFinite(record.y)) return null;
      return { x: record.x, y: record.y };
    } catch (error) {
      return null;
    }
  }

  return { start, stop, resolve, lastPointerPoint };
}

// ---------------------------------------------------------------------------
// geometryForSource
// ---------------------------------------------------------------------------

// 统一 -0 → +0，避免深比较把零坐标当成差异。
function normalizeZero(value) {
  return value === 0 ? 0 : value;
}

export function geometryForSource(source, surfaceRect) {
  try {
    if (!source || (source.kind !== "element" && source.kind !== "point")) return null;
    const box = toBox(surfaceRect);
    if (!isValidBox(box)) return null;

    let anchorX = null;
    let anchorY = null;
    if (source.kind === "point") {
      anchorX = numberValue(source.x);
      anchorY = numberValue(source.y);
    } else {
      const anchorBox = toBox(source.rect);
      if (!anchorBox) return null;
      // 触发元素上离表面最近的边/点：把表面中心投影到触发矩形内。
      // 触发矩形比表面宽（整行按钮）时，用触发矩形中心会把 origin 推到表面另一侧；
      // 投影则落在面向表面的那条边上（§2.5 修正）。
      anchorX = clampNumber(
        box.left + box.width / 2,
        anchorBox.left,
        anchorBox.left + anchorBox.width,
      );
      anchorY = clampNumber(
        box.top + box.height / 2,
        anchorBox.top,
        anchorBox.top + anchorBox.height,
      );
    }
    if (anchorX === null || anchorY === null) return null;

    // origin 落在表面局部坐标内（可等于 0 / width / height）。
    const originX = normalizeZero(clampNumber(anchorX - box.left, 0, box.width));
    const originY = normalizeZero(clampNumber(anchorY - box.top, 0, box.height));

    return { originX, originY };
  } catch (error) {
    return null;
  }
}
