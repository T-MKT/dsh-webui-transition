/**
 * src/runtime.js — 观察 / 批量 / 入场 / 退场幽灵 / 清理（替代 v0.1.0 的 `createMotionRuntime`）。
 *
 * 职责：把 tracker 产出的语义意图落成 WAAPI 动画，把 tracker 产出的退场组落成
 * inert 幽灵副本；本身不做 DOM 分类、不做门卫判定、不构造关键帧。
 *
 * 对应计划：.plan/v0.2.0/plan-b-rewrite.md §3.7（模块设计）、§4（冻结签名）、§5.5（测试要点）。
 * 旧名 `createMotionRuntime` 不保留（AGENTS.md：不保留向后兼容性）。
 */

import { OBSERVED_ATTRIBUTES } from "./defs.js";
import { animationSpecsFor } from "./frames.js";
import { createGate } from "./gate.js";
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

function defaultAnimator(element, keyframes, timing) {
  if (!isElement(element) || typeof element.animate !== "function") return null;
  try {
    return element.animate(keyframes, {
      duration: timing.durationMs,
      easing: timing.easing,
      fill: "both",
    });
  } catch (error) {
    return null;
  }
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

    const specs = animationSpecsFor(element, intent.kind, "in", supportsIndependentTransforms());
    let created = 0;
    for (const spec of specs) {
      const animation = animator(spec.element, spec.keyframes, timing);
      if (!animation) continue;
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
      const specs = animationSpecsFor(target, surface.kind, "out", supportsIndependentTransforms());
      for (const spec of specs) {
        const animation = animator(spec.element, spec.keyframes, timing);
        if (!animation) continue;
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
