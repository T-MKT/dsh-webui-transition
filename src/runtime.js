/**
 * src/runtime.js — 观察 / 批量 / 入场 / 退场幽灵 / 清理（替代 v0.1.0 的 `createMotionRuntime`）。
 *
 * 职责：把 tracker 产出的语义意图落成 WAAPI 动画，把 tracker 产出的退场组落成
 * inert 幽灵副本；本身不做 DOM 分类、不做门卫判定、不构造关键帧。
 *
 * 对应计划：.plan/v0.2.0/plan-b-rewrite.md §3.7（模块设计）、§4（冻结签名）、§5.5（测试要点）。
 * 旧名 `createMotionRuntime` 不保留（AGENTS.md：不保留向后兼容性）。
 */

import { OBSERVED_ATTRIBUTES, SURFACE_DEFS } from "./defs.js";
import { animationSpecsFor } from "./frames.js";
import { createGate } from "./gate.js";
import { centerGeometryFor, isCenterOriginSurface } from "./marker.js";
import { geometryForSource } from "./origin.js";
import { createPolicy } from "./policy.js";
import { createSurfaceTracker } from "./tracker.js";
import {
  globalScope,
  isElement,
  isElementConnected,
  supportsIndependentTransforms,
} from "./utils.js";

// ===========================================================================
// 默认依赖：动画器 / 帧调度
// ===========================================================================

function defaultAnimator(element, keyframes, timing, pseudoElement) {
  if (!isElement(element) || typeof element.animate !== "function") return null;
  const options = {
    duration: timing.durationMs,
    easing: timing.easing,
    fill: "both",
  };
  if (pseudoElement) options.pseudoElement = pseudoElement;
  try {
    return element.animate(keyframes, options);
  } catch (error) {
    return null;
  }
}

// 伪元素动画校验：不支持 pseudoElement 的浏览器会静默忽略该选项、把动画落到宿主元素上，
// 宿主的 opacity 动画会重新成为 backdrop-root（模糊失效），因此必须识别并取消。
function animationTargetsPseudo(animation, pseudoElement) {
  if (!pseudoElement) return true;
  const effect = animation && animation.effect;
  return !!effect && effect.pseudoElement === pseudoElement;
}

function defaultRequestFrame(callback) {
  const scope = globalScope();
  if (scope && typeof scope.requestAnimationFrame === "function") {
    return scope.requestAnimationFrame(callback);
  }
  if (typeof window !== "undefined" && window && typeof window.requestAnimationFrame === "function") {
    return window.requestAnimationFrame(callback);
  }
  return setTimeout(callback, 16);
}

function defaultCancelFrame(handle) {
  const scope = globalScope();
  if (scope && typeof scope.cancelAnimationFrame === "function") {
    scope.cancelAnimationFrame(handle);
    return;
  }
  if (typeof window !== "undefined" && window && typeof window.cancelAnimationFrame === "function") {
    window.cancelAnimationFrame(handle);
    return;
  }
  clearTimeout(handle);
}

// ===========================================================================
// 动画生命周期小工具
// ===========================================================================

function cancelAnimation(animation) {
  if (!animation) return;
  try {
    if (typeof animation.cancel === "function") animation.cancel();
  } catch (error) {
    // 忽略动画取消错误
  }
}

// 等待动画 settle（finished promise → finish/cancel 事件 → 立即回调）。
function whenSettled(animation, callback) {
  if (!animation) {
    callback();
    return;
  }
  const finished = animation.finished;
  if (finished && typeof finished.then === "function") {
    finished.then(callback, callback);
    return;
  }
  if (typeof animation.addEventListener === "function") {
    try {
      animation.addEventListener("finish", callback, { once: true });
      animation.addEventListener("cancel", callback, { once: true });
      return;
    } catch (error) {
      // 继续走立即回调
    }
  }
  callback();
}

function waitForAnimation(animation) {
  return new Promise((resolve) => {
    whenSettled(animation, resolve);
  });
}

// 把原始子树里的元素映射到 clone 中的对应元素（按 childNodes 索引逐层下钻）。
function resolveClone(originalRoot, cloneRoot, element) {
  if (element === originalRoot) return cloneRoot;
  const path = [];
  let current = element;
  while (current && current !== originalRoot) {
    const parent = current.parentNode;
    if (!parent) return null;
    path.unshift(Array.prototype.indexOf.call(parent.childNodes, current));
    current = parent;
  }
  if (current !== originalRoot) return null;
  let cloned = cloneRoot;
  for (const index of path) {
    if (!cloned || !cloned.childNodes) return null;
    cloned = cloned.childNodes[index];
  }
  return cloned;
}

// 退场幽灵：inert 化、去重 id/aria 引用、禁用宿主动画，避免再次被观察者动画。
// 关键点：绝不剥离 backdrop-filter —— 幽灵是玻璃层的唯一可见副本，
// 退场动画期间仍需采样页面背景（.plan/v0.2.0/plan-b-rewrite.md §3.7）。
function prepareGhost(element) {
  if (!isElement(element)) return;
  element.setAttribute("data-dsh-transition-ghost", "");
  element.setAttribute("aria-hidden", "true");
  element.setAttribute("inert", "");
  try {
    element.inert = true;
  } catch (error) {
    // inert IDL 属性不存在的环境忽略
  }
  element.setAttribute("tabindex", "-1");

  const nodes = [element];
  if (typeof element.querySelectorAll === "function") {
    for (const node of Array.from(element.querySelectorAll("*"))) nodes.push(node);
  }
  for (const node of nodes) {
    if (!isElement(node)) continue;
    if (node.id) node.removeAttribute("id");
    node.removeAttribute("aria-labelledby");
    node.removeAttribute("aria-describedby");
    node.removeAttribute("aria-controls");
    node.removeAttribute("aria-owns");
    node.removeAttribute("aria-activedescendant");
    node.removeAttribute("aria-flowto");
    node.removeAttribute("autofocus");
    node.removeAttribute("data-modal-autofocus");
    if (node.style) {
      node.style.setProperty("animation", "none");
      node.style.setProperty("transition", "none");
      node.style.setProperty("pointer-events", "none");
      // 不剥离 backdrop-filter：玻璃层在退场动画期间仍需采样页面背景。
    }
  }
}

// ===========================================================================
// 运行时
// ===========================================================================

export function createTransitionRuntime(options = {}) {
  const policy = options.policy || createPolicy();
  const tracker = options.tracker || createSurfaceTracker();
  const gate = options.gate || createGate();
  const root = options.root || (typeof document !== "undefined" ? document : null);
  const animator = typeof options.animator === "function" ? options.animator : defaultAnimator;
  const requestFrame =
    typeof options.requestFrame === "function" ? options.requestFrame : defaultRequestFrame;
  const cancelFrame = typeof options.cancelFrame === "function" ? options.cancelFrame : defaultCancelFrame;
  // 伪元素玻璃检测依赖 computed style：显式传入时转发给 frames，默认由 frames 自行读取。
  const specOptions =
    typeof options.computedStyle === "function" ? { computedStyle: options.computedStyle } : {};
  // 原点感知：origin 提供触发源解析与最近指针点；fallbackMode 决定猜不到触发源时的回退。
  const origin = options.origin && typeof options.origin === "object" ? options.origin : null;
  const fallbackMode =
    typeof options.fallbackMode === "function" ? options.fallbackMode : () => "fade";
  // 入场时缓存的几何（元素 → { originX, originY, translateX, translateY }，标记表面
  // 的 translate 恒为 0），退场幽灵复用。
  let geometryCache = new WeakMap();

  // 规格只依赖「表面 + kind + 方向 + 几何」，入场与退场幽灵共用同一套拆分规则。
  function specsFor(element, kind, direction, geometry) {
    return animationSpecsFor(element, kind, direction, supportsIndependentTransforms(), {
      ...specOptions,
      geometry: geometry || null,
    });
  }

  // -------------------------------------------------------------------------
  // 原点感知：触发源 → 几何（§3.4）
  // -------------------------------------------------------------------------

  function fallbackModeValue() {
    try {
      return fallbackMode() === "pointer" ? "pointer" : "fade";
    } catch (error) {
      return "fade";
    }
  }

  function resolveSource(element) {
    if (!origin || typeof origin.resolve !== "function") return null;
    try {
      return origin.resolve(element);
    } catch (error) {
      return null;
    }
  }

  function lastPointerPoint() {
    if (!origin || typeof origin.lastPointerPoint !== "function") return null;
    try {
      return origin.lastPointerPoint();
    } catch (error) {
      return null;
    }
  }

  // 读取表面矩形；宽/高任一 ≤0（含 jsdom 默认 0）视为不可用。
  function readSurfaceRect(element) {
    if (!isElement(element) || typeof element.getBoundingClientRect !== "function") return null;
    try {
      const rect = element.getBoundingClientRect();
      if (!rect) return null;
      const width = Number(rect.width);
      const height = Number(rect.height);
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        return null;
      }
      return rect;
    } catch (error) {
      return null;
    }
  }

  function surfaceDefFor(kind) {
    return SURFACE_DEFS[kind] || SURFACE_DEFS.menu;
  }

  function pointSource(point) {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
    return { kind: "point", x: point.x, y: point.y };
  }

  // 入场几何：解析触发源 → 几何；猜不到且回退模式为 pointer 时用最近指针点；仍为空 → null。
  // 带中心原点标记的表面（如设置面板）无条件取表面正中心，跳过触发源解析与回退。
  function entryGeometryFor(element, kind) {
    const rect = readSurfaceRect(element);
    if (!rect) return null;
    if (isCenterOriginSurface(element)) return centerGeometryFor(rect);
    const distancePx = surfaceDefFor(kind).distancePx;
    const source = resolveSource(element);
    let geometry = source ? geometryForSource(source, rect, distancePx) : null;
    if (!geometry && fallbackModeValue() === "pointer") {
      const point = pointSource(lastPointerPoint());
      if (point) geometry = geometryForSource(point, rect, distancePx);
    }
    return geometry;
  }

  // 退场几何：优先入场缓存；否则用当前 activeElement（表面外且连接）作 element source，
  // 再按回退模式用最近指针点；都没有 → null。rectElement 是读取矩形的元素
  // （幽灵场景传克隆体，原表面此时已脱离文档、矩形为 0）。
  function exitGeometryFor(original, kind, rectElement) {
    const cached = geometryCache.get(original);
    if (cached) return cached;
    const rect = readSurfaceRect(rectElement);
    if (!rect) return null;
    // 标记表面在缓存未命中时同样取中心几何（克隆体保留标记属性，故两处都判）。
    if (isCenterOriginSurface(original) || isCenterOriginSurface(rectElement)) {
      return centerGeometryFor(rect);
    }
    const distancePx = surfaceDefFor(kind).distancePx;
    const documentNode = root && root.nodeType === 9 ? root : root && root.ownerDocument;
    let active = null;
    try {
      active = documentNode ? documentNode.activeElement : null;
    } catch (error) {
      active = null;
    }
    if (
      isElement(active) &&
      active !== original &&
      !(typeof original.contains === "function" && original.contains(active)) &&
      isElementConnected(active)
    ) {
      const activeRect = readSurfaceRect(active);
      if (activeRect) {
        const geometry = geometryForSource({ kind: "element", rect: activeRect }, rect, distancePx);
        if (geometry) return geometry;
      }
    }
    if (fallbackModeValue() === "pointer") {
      const point = pointSource(lastPointerPoint());
      if (point) return geometryForSource(point, rect, distancePx);
    }
    return null;
  }

  // lastApplied：element -> kind -> "trigger:state"；只在动画真正创建后写入（§3.7 去重修正）。
  let lastApplied = new WeakMap();
  // batchKeys：element -> Set<"trigger:state">；同帧去重，每次 flush 重置（§3.7 去重修正）。
  let batchKeys = new WeakMap();
  const ownedAnimations = new Set();
  const exitAnimations = new Set();
  const ghosts = new Set();
  let batch = [];
  let frameHandle = null;
  let frameScheduled = false;
  let observer = null;
  let unsubscribePolicy = null;
  let started = false;
  let disposed = false;

  // -------------------------------------------------------------------------
  // policy / gate 适配：异常一律视为「不能动画 / 无时长」
  // -------------------------------------------------------------------------

  function isReducedMotion() {
    return !!(policy && typeof policy.reducedMotion === "function" && policy.reducedMotion());
  }

  function timingFor(kind) {
    if (!policy || typeof policy.timing !== "function") return null;
    try {
      return policy.timing(kind);
    } catch (error) {
      return null;
    }
  }

  function canAnimate(element, kind) {
    if (!gate || typeof gate.canAnimate !== "function") return true;
    try {
      return !!gate.canAnimate(element, kind, ownedAnimations);
    } catch (error) {
      return false;
    }
  }

  // -------------------------------------------------------------------------
  // 批量：enqueue → 同帧去重 → rAF flush
  // -------------------------------------------------------------------------

  function hasBatchKey(element, key) {
    const keys = batchKeys.get(element);
    return !!keys && keys.has(key);
  }

  function addBatchKey(element, key) {
    let keys = batchKeys.get(element);
    if (!keys) {
      keys = new Set();
      batchKeys.set(element, keys);
    }
    keys.add(key);
  }

  function markApplied(element, kind, key) {
    let applied = lastApplied.get(element);
    if (!applied) {
      applied = Object.create(null);
      lastApplied.set(element, applied);
    }
    applied[kind] = key;
  }

  // 同帧去重 + lastApplied 去重；两者都只抑制「同一意图的重复入队」，
  // 不抑制「被门卫拒绝后的重试」（拒绝时不写 lastApplied）。
  function enqueue(intent) {
    if (disposed || !intent || !isElement(intent.element) || !intent.kind) return;
    const element = intent.element;
    const kind = String(intent.kind);
    const trigger = String(intent.trigger);
    const state = String(intent.state);
    const key = trigger + ":" + state;

    const applied = lastApplied.get(element);
    if (applied && applied[kind] === key) return;
    if (hasBatchKey(element, key)) return;

    addBatchKey(element, key);
    batch.push({ element: element, kind: kind, trigger: trigger, state: state });
    scheduleFlush();
  }

  function scheduleFlush() {
    if (frameScheduled || disposed) return;
    frameScheduled = true;
    frameHandle = requestFrame(flush);
  }

  function flush() {
    frameScheduled = false;
    frameHandle = null;
    if (disposed) return;
    const current = batch;
    batch = [];
    batchKeys = new WeakMap();
    for (const intent of current) applyEntry(intent);
  }

  // -------------------------------------------------------------------------
  // 入场：门卫 → timing → specs → WAAPI（settle 后 cancel 释放填充态）
  // -------------------------------------------------------------------------

  function applyEntry(intent) {
    const element = intent.element;
    if (!isElement(element) || !isElementConnected(element)) return;
    // 只有入场方向才播动画（退场由 classifyRemoval 的幽灵承担）。
    if (intent.trigger === "visibility" && intent.state !== "visible") return;
    if (isReducedMotion()) return;
    // 门卫拒绝时不写 lastApplied，允许后续重试（§3.7 去重修正）。
    if (!canAnimate(element, intent.kind)) return;
    const timing = timingFor(intent.kind);
    if (!timing || !(timing.durationMs > 0)) return;

    // 原点感知：解析触发源 → 几何；非空则缓存供退场幽灵复用。
    const geometry = entryGeometryFor(element, intent.kind);
    if (geometry) geometryCache.set(element, geometry);

    const specs = specsFor(element, intent.kind, "in", geometry);
    let created = 0;
    for (const spec of specs) {
      const animation = animator(spec.element, spec.keyframes, timing, spec.pseudoElement);
      if (!animation) continue;
      if (!animationTargetsPseudo(animation, spec.pseudoElement)) {
        // 浏览器忽略 pseudoElement：动画落到了宿主上，立即取消，避免重新引入 backdrop-root。
        cancelAnimation(animation);
        continue;
      }
      created += 1;
      ownedAnimations.add(animation);
      let released = false;
      whenSettled(animation, () => {
        if (released) return;
        released = true;
        ownedAnimations.delete(animation);
        // 必须释放填充态：fill:"both" 的动画结束后仍持续生效，会让带 opacity
        // 动画的元素长期充当 backdrop-root，其内部 backdrop-filter 层（DSH 菜单
        // 的 .material）便无法采样页面背景 → 菜单永久半透明、模糊失效。
        cancelAnimation(animation);
      });
    }
    // 只有真正创建了动画才写 lastApplied（§3.7）。
    if (created > 0) markApplied(element, intent.kind, intent.trigger + ":" + intent.state);
  }

  function removeGhost(ghost) {
    ghosts.delete(ghost);
    if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
  }

  // -------------------------------------------------------------------------
  // 退场幽灵：cloneNode(true) → prepareGhost → 插回原位置 → 播退场 → settle 后移除
  // -------------------------------------------------------------------------

  function playGhost(group, parent, nextSibling) {
    if (disposed || !group || !isElement(group.root)) return;
    if (!parent || typeof parent.insertBefore !== "function") return;
    // 父节点已随同一批 mutation 被移除时，幽灵没有可见落点。
    if (typeof parent.isConnected === "boolean" && !parent.isConnected) return;
    // reduced-motion 下不产生幽灵（§1.3 行为契约：prefers-reduced-motion 归零）。
    if (isReducedMotion()) return;

    const rootElement = group.root;
    const insertionPoint = nextSibling && nextSibling.parentNode === parent ? nextSibling : null;
    const ghost = rootElement.cloneNode(true);
    if (!isElement(ghost)) return;
    prepareGhost(ghost);
    try {
      parent.insertBefore(ghost, insertionPoint);
    } catch (error) {
      return;
    }
    ghosts.add(ghost);

    const jobs = [];
    const surfaces = Array.isArray(group.surfaces) ? group.surfaces : [];
    for (const surface of surfaces) {
      if (!surface || !isElement(surface.element)) continue;
      const target = resolveClone(rootElement, ghost, surface.element);
      if (!isElement(target)) continue;
      const timing = timingFor(surface.kind);
      if (!timing || !(timing.durationMs > 0)) continue;
      // 退场几何：优先入场缓存；否则用 activeElement / 指针回退。矩形从克隆体读取
      // （原表面此时已脱离文档，getBoundingClientRect 为 0）。
      const geometry = exitGeometryFor(surface.element, surface.kind, target);
      const specs = specsFor(target, surface.kind, "out", geometry);
      for (const spec of specs) {
        const animation = animator(spec.element, spec.keyframes, timing, spec.pseudoElement);
        if (!animation) continue;
        if (!animationTargetsPseudo(animation, spec.pseudoElement)) {
          // 同上：伪元素动画不可用时不能把退场动画留在幽灵宿主上。
          cancelAnimation(animation);
          continue;
        }
        exitAnimations.add(animation);
        whenSettled(animation, () => {
          exitAnimations.delete(animation);
        });
        jobs.push(animation);
      }
    }

    // 无动画（无 specs / 动画器拒绝）时立即移除幽灵，不留下不可交互的副本。
    if (jobs.length === 0) {
      removeGhost(ghost);
      return;
    }
    Promise.all(jobs.map(waitForAnimation)).then(() => {
      removeGhost(ghost);
    });
  }

  // -------------------------------------------------------------------------
  // MutationObserver 三分支：单条 record 异常不阻断其它
  // -------------------------------------------------------------------------

  function handleRecord(record) {
    if (!record) return;

    if (record.type === "attributes") {
      const intents = tracker.classifyAttributes(record.target) || [];
      for (const intent of intents) enqueue(intent);
      return;
    }

    if (record.type !== "childList") return;

    if (record.addedNodes) {
      for (const node of Array.from(record.addedNodes)) {
        const intents = tracker.classifyAdded(node) || [];
        for (const intent of intents) enqueue(intent);
      }
    }

    if (record.removedNodes) {
      for (const node of Array.from(record.removedNodes)) {
        const groups = tracker.classifyRemoval(node) || [];
        for (const group of groups) playGhost(group, record.target, record.nextSibling);
      }
    }
  }

  function handleRecords(records) {
    if (disposed) return;
    for (const record of records) {
      try {
        handleRecord(record);
      } catch (error) {
        // 单条 mutation 记录失败不阻断其它记录
      }
    }
  }

  // -------------------------------------------------------------------------
  // reduced-motion 热切换（§3.7）：开启时立即取消在播动画并移除全部幽灵；
  // 关闭时不动作，后续动画自动恢复。
  // -------------------------------------------------------------------------

  function cancelOwnedAnimations() {
    for (const animation of Array.from(ownedAnimations)) cancelAnimation(animation);
    ownedAnimations.clear();
    for (const animation of Array.from(exitAnimations)) cancelAnimation(animation);
    exitAnimations.clear();
  }

  function handleReducedMotion(reduced) {
    if (disposed || reduced !== true) return;
    cancelOwnedAnimations();
    for (const ghost of Array.from(ghosts)) removeGhost(ghost);
    ghosts.clear();
  }

  // -------------------------------------------------------------------------
  // 生命周期
  // -------------------------------------------------------------------------

  function resolveObservationRoot() {
    if (!root) return null;
    if (root.nodeType === 9) return root.body || root.documentElement || null;
    return root;
  }

  function resolveObserverCtor() {
    const documentNode = root && root.nodeType === 9 ? root : root && root.ownerDocument;
    const view = documentNode && documentNode.defaultView;
    const scope = globalScope();
    return (view && view.MutationObserver) || (scope && scope.MutationObserver) || null;
  }

  function start() {
    if (disposed || started) return stop;
    const observationRoot = resolveObservationRoot();
    if (!observationRoot || typeof observationRoot.nodeType !== "number") return stop;
    const ObserverCtor = resolveObserverCtor();
    if (typeof ObserverCtor !== "function") return stop;

    // 1. 基线扫描：启动前已存在的表面只写状态，不播入场。
    try {
      tracker.scanRoot(observationRoot);
    } catch (error) {
      // 基线扫描失败不阻断观察
    }

    // 2. reduced-motion 热切换接线。
    if (policy && typeof policy.subscribe === "function") {
      try {
        unsubscribePolicy = policy.subscribe(handleReducedMotion) || null;
      } catch (error) {
        unsubscribePolicy = null;
      }
    }

    // 3. 开始观察。
    observer = new ObserverCtor(handleRecords);
    try {
      observer.observe(observationRoot, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeOldValue: true,
        attributeFilter: OBSERVED_ATTRIBUTES,
      });
    } catch (error) {
      try {
        observer.disconnect();
      } catch (disconnectError) {
        // 忽略 observer 清理错误
      }
      observer = null;
      return stop;
    }
    started = true;
    return stop;
  }

  // stop 与 dispose 同义（§3.7 / §4：start() 返回 stop，dispose() 做同一套清理），幂等。
  function stop() {
    if (disposed) return;
    disposed = true;
    started = false;

    if (observer) {
      try {
        observer.disconnect();
      } catch (error) {
        // 忽略 observer 清理错误
      }
      observer = null;
    }

    if (frameScheduled && frameHandle !== null) {
      try {
        cancelFrame(frameHandle);
      } catch (error) {
        // 忽略帧取消错误
      }
    }
    frameScheduled = false;
    frameHandle = null;
    batch = [];
    batchKeys = new WeakMap();
    lastApplied = new WeakMap();
    geometryCache = new WeakMap();

    cancelOwnedAnimations();

    for (const ghost of Array.from(ghosts)) removeGhost(ghost);
    ghosts.clear();

    if (unsubscribePolicy) {
      try {
        unsubscribePolicy();
      } catch (error) {
        // 忽略退订错误
      }
      unsubscribePolicy = null;
    }
    if (policy && typeof policy.dispose === "function") {
      try {
        policy.dispose();
      } catch (error) {
        // 忽略 policy 清理错误
      }
    }
  }

  return { start: start, dispose: stop, enqueue: enqueue };
}
