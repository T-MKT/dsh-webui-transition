/**
 * src/tracker.js — 表面状态机与 DOM 分类（替代 v0.1.0 的 `createClassifier`）。
 *
 * 只做「观察结果 → 语义意图」的纯分类，不做动画、不碰 MutationObserver：
 * - 状态机只记录 role 表面（menu / listbox / dialog）的 visibility；
 * - mask 不是独立语义面，单独用 WeakMap 记录 mask -> dialog 配对（§3.4 关键事实）。
 *
 * 关键事实：MutationObserver 回调执行时被删节点的 parentNode 已为 null，
 * 因此「单独删除 mask 时判断 dialog 兄弟是否仍在 DOM」不能依赖
 * `findDialogSibling(node)`（此时必为 null），只能依赖 tracker 在
 * scanRoot / classifyAdded / classifyAttributes 阶段写下的配对记录。
 *
 * 对应计划：.plan/v0.2.0/plan-b-rewrite.md §3.4（模块设计）、§4（冻结签名）、§5.2。
 */

import { SURFACE_SELECTOR } from "./defs.js";
import { isElement, isElementConnected, isExcluded, roleKind } from "./utils.js";

// ---------------------------------------------------------------------------
// 语义工具：自 v0.1.0 client.js 原样搬入，语义不变；仅本模块内部使用，不导出。
// ---------------------------------------------------------------------------

function classTokens(element) {
  const className = isElement(element) ? element.getAttribute("class") : null;
  if (!className) return [];
  return className.split(/\s+/);
}

// 宿主 mask 的类名形如 `.VOzbGW_mask` / `._mask_14mp3_18`（A2 证据）。
function isMaskElement(element) {
  if (!isElement(element) || roleKind(element) !== null) return false;
  if (element.getAttribute("aria-hidden") !== "true") return false;
  const tokens = classTokens(element);
  for (const token of tokens) {
    if (/(?:^|[-_])mask(?:[-_]|$)/i.test(token)) return true;
  }
  return false;
}

// dialog 的 mask 是它的同级兄弟（overlay > mask + panel，A2 证据）。
function findMask(dialog) {
  if (!isElement(dialog)) return null;
  const parent = dialog.parentElement;
  if (!parent) return null;
  for (const child of Array.from(parent.children)) {
    if (child !== dialog && isMaskElement(child)) return child;
  }
  return null;
}

function findDialogSibling(element) {
  if (!isElement(element)) return null;
  const parent = element.parentElement;
  if (!parent) return null;
  for (const child of Array.from(parent.children)) {
    if (child !== element && roleKind(child) === "dialog") return child;
  }
  return null;
}

function hasSurfaceDescendant(container) {
  if (!isElement(container) || typeof container.querySelector !== "function") return false;
  try {
    return container.querySelector(SURFACE_SELECTOR) !== null;
  } catch (error) {
    return false;
  }
}

// 收集 container（含自身）内的语义面：menu / listbox / dialog，并为 dialog 配对 mask。
// 注意：mask 的配对查找不限制在 container 内，交给调用方按场景裁剪（§3.4 边界）。
function collectSurfaces(container) {
  const surfaces = [];
  const seen = new Set();
  const containerKind = roleKind(container);
  if (!containerKind && !hasSurfaceDescendant(container)) return surfaces;

  function add(element, kind) {
    if (!isElement(element) || seen.has(element)) return;
    if (isExcluded(element)) return;
    seen.add(element);
    surfaces.push({ element: element, kind: kind });
  }

  if (containerKind) add(container, containerKind);
  if (isElement(container) && typeof container.querySelectorAll === "function") {
    for (const element of Array.from(container.querySelectorAll("[role]"))) {
      const kind = roleKind(element);
      if (kind) add(element, kind);
    }
  }
  // dialog 配 mask：mask 必须是 dialog 的同级（可能不在 container 内，交给调用方裁剪）。
  for (const surface of surfaces.slice()) {
    if (surface.kind !== "dialog") continue;
    const mask = findMask(surface.element);
    if (mask) add(mask, "mask");
  }
  return surfaces;
}

// 判断元素自身与祖先链是否被隐藏（aria-hidden 只看祖先，mask 自身常带 aria-hidden）。
function isSurfaceVisible(element) {
  if (!isElement(element)) return false;
  if (element.hidden) return false;
  let current = element;
  while (current && current.nodeType === 1) {
    if (current.hidden) return false;
    if (current.getAttribute("aria-hidden") === "true") return false;
    if (current.style && current.style.display === "none") return false;
    current = current.parentElement;
  }
  return true;
}

// ---------------------------------------------------------------------------
// 表面追踪器
// ---------------------------------------------------------------------------

export function createSurfaceTracker(options = {}) {
  // 只记录 role 表面：element -> { kind, visibility }；无记录视为 unknown。
  const states = new WeakMap();
  // mask -> dialog 配对：供「单独删除 mask」在节点已脱离 DOM 时回查 dialog。
  const maskDialogs = new WeakMap();

  function rememberSurface(element, kind) {
    states.set(element, {
      kind: kind,
      visibility: isSurfaceVisible(element) ? "visible" : "hidden",
    });
  }

  // 记录 dialog 的同级 mask 配对，返回该 mask（无则 null）。
  function pairMask(dialog) {
    const mask = findMask(dialog);
    if (!mask || isExcluded(mask)) return null;
    maskDialogs.set(mask, dialog);
    return mask;
  }

  function mountIntent(element, kind) {
    return { element: element, kind: kind, trigger: "mount", state: "mounted" };
  }

  function forgetSurface(element) {
    states.delete(element);
    maskDialogs.delete(element);
  }

  // 启动基线：已存在的表面只写状态，不发入场（启动前已存在的表面不播入场）。
  function scanRoot(root) {
    if (!isElement(root)) return;
    for (const surface of collectSurfaces(root)) {
      if (surface.kind === "mask") continue;
      rememberSurface(surface.element, surface.kind);
      if (surface.kind === "dialog") pairMask(surface.element);
    }
  }

  // childList addedNodes：新增子树 -> mount intents。
  function classifyAdded(node) {
    if (!isElement(node) || isExcluded(node)) return [];
    const surfaces = collectSurfaces(node);
    if (surfaces.length === 0) {
      // 单独插入的 mask（dialog 已在 DOM 中）：只动画 mask 本身，并记录配对。
      if (!isMaskElement(node)) return [];
      const dialog = findDialogSibling(node);
      if (!dialog) return [];
      maskDialogs.set(node, dialog);
      return [mountIntent(node, "mask")];
    }
    const intents = [];
    for (const surface of surfaces) {
      // 新增子树里的语义面：role 表面写状态；dialog 记录 mask 配对。
      if (surface.kind !== "mask") {
        rememberSurface(surface.element, surface.kind);
        if (surface.kind === "dialog") pairMask(surface.element);
      }
      intents.push(mountIntent(surface.element, surface.kind));
    }
    return intents;
  }

  // attributes：仅 role 表面；只有 hidden/unknown -> visible 才发入场 intent（状态机去重）。
  function classifyAttributes(target) {
    if (!isElement(target) || isExcluded(target)) return [];
    const kind = roleKind(target);
    if (!kind) return [];
    const previous = states.get(target);
    const previousVisibility = previous ? previous.visibility : "unknown";
    const visibility = isSurfaceVisible(target) ? "visible" : "hidden";
    states.set(target, { kind: kind, visibility: visibility });
    // dialog 的 mask 配对与可见性同步刷新（mask 可能不在目标子树内）。
    const mask = kind === "dialog" ? pairMask(target) : null;
    if (previousVisibility === "visible" || visibility !== "visible") return [];
    const intents = [{ element: target, kind: kind, trigger: "visibility", state: "visible" }];
    if (mask) intents.push({ element: mask, kind: "mask", trigger: "visibility", state: "visible" });
    return intents;
  }

  // childList removedNodes：退场组。用 node.contains 裁剪（与 v0.1.0 一致）。
  function classifyRemoval(node) {
    if (!isElement(node) || isExcluded(node)) return [];
    const surfaces = collectSurfaces(node);
    const contained = [];
    for (const surface of surfaces) {
      if (surface.element === node) {
        contained.push({ element: surface.element, kind: surface.kind });
      } else if (typeof node.contains === "function" && node.contains(surface.element)) {
        contained.push({ element: surface.element, kind: surface.kind });
      }
    }
    if (contained.length > 0) {
      // 清理被删表面的状态与配对，避免后续重挂载被旧状态去重。
      for (const surface of contained) forgetSurface(surface.element);
      return [{ root: node, surfaces: contained }];
    }
    // 单独删除 mask：此时 findDialogSibling 必为 null，回查配对记录；
    // dialog 若已不在 DOM（同一批一起删除），则不再为 mask 单独播退场。
    if (!isMaskElement(node)) return [];
    const dialog = maskDialogs.get(node) || findDialogSibling(node);
    // 被删 mask 的配对一律清理（含 dialog 同时被删的陈旧配对）。
    maskDialogs.delete(node);
    if (!dialog || !isElementConnected(dialog)) return [];
    return [{ root: node, surfaces: [{ element: node, kind: "mask" }] }];
  }

  // options：冻结签名保留（§4），当前无行为选项。

  return {
    scanRoot: scanRoot,
    classifyAdded: classifyAdded,
    classifyAttributes: classifyAttributes,
    classifyRemoval: classifyRemoval,
  };
}
