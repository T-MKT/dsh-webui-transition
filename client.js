window.__ModuleLoader__.load({
  id: "@tak1208/dsh-webui-transition",
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;

    // ============================================================
    // 常量（.plan/webui-transition.md §2 冻结）
    // ============================================================

    const OBSERVED_ATTRIBUTES = [
      "hidden",
      "aria-hidden",
      "aria-expanded",
      "open",
      "role",
      "data-slot",
      "data-phase"
    ];

    // 语义面硬排除（与 dsh-motion 一致，前缀改为 dsh-transition）
    const HARD_EXCLUSION =
      '[data-dsh-transition="off"], [data-dsh-transition-ghost], [data-chat-flow],' +
      ' [data-chat-flow-key], [data-streaming], [data-trajectory-scroll], [data-trajectory-row-key],' +
      ' [role="tooltip"], [role="alert"]';

    const MOTION_MEDIA_QUERY = "(prefers-reduced-motion: reduce)";
    const DEFAULT_EASING = "cubic-bezier(.4, 0, .2, 1)";
    const DIALOG_EASING = "cubic-bezier(.22, 1, .36, 1)";

    // tokens() 缺失时的 token 级 fallback（A3 的已知值；kind 级 fallback 见 KIND_POLICY）
    const TOKEN_FALLBACK = {
      easing: DEFAULT_EASING,
      fastMs: 100,
      normalMs: 200,
      slowMs: 300
    };

    // 冻结的时长策略表（§2）：kind → token / fallback / clamp / 入场几何
    const MENU_POLICY = {
      property: "--ds-transition-duration-fast",
      fallbackMs: 150,
      minMs: 120,
      maxMs: 160,
      distancePx: -4,
      scaleFrom: 0.98,
      opacityFrom: 0,
      easing: null // null = 用 --ds-ease-in-out
    };

    const KIND_POLICY = {
      menu: MENU_POLICY,
      listbox: MENU_POLICY,
      dialog: {
        property: "--ds-transition-duration",
        fallbackMs: 220,
        minMs: 160,
        maxMs: 240,
        distancePx: 12,
        scaleFrom: 1,
        opacityFrom: 0,
        easing: DIALOG_EASING
      },
      mask: {
        property: "--ds-transition-duration",
        fallbackMs: 180,
        minMs: 140,
        maxMs: 220,
        distancePx: 0,
        scaleFrom: 1,
        opacityFrom: 0,
        easing: null
      }
    };

    // ============================================================
    // 通用小工具（全部为普通函数，延迟访问 document/window）
    // ============================================================

    function globalScope() {
      return typeof globalThis !== "undefined" ? globalThis : null;
    }

    function isElement(node) {
      return !!node && node.nodeType === 1;
    }

    function clampNumber(value, min, max) {
      return Math.min(max, Math.max(min, value));
    }

    // 解析 CSS 时长（".2s" / "150ms" 等），失败返回 fallback。
    function parseCssDuration(value, fallback) {
      if (typeof value !== "string") return fallback;
      const trimmed = value.trim();
      if (!trimmed) return fallback;
      const match = /^(-?(?:\d+\.?\d*|\.\d+))(ms|s)?$/i.exec(trimmed);
      if (!match) return fallback;
      let milliseconds = parseFloat(match[1]);
      if ((match[2] || "ms").toLowerCase() === "s") milliseconds *= 1000;
      if (!Number.isFinite(milliseconds)) return fallback;
      return milliseconds;
    }

    // 缓动白名单：关键字 / cubic-bezier(a,b,c,d) / steps(...)，其余回退。
    function parseEasing(value, fallback) {
      if (typeof value !== "string") return fallback;
      const trimmed = value.trim();
      if (!trimmed) return fallback;
      const lower = trimmed.toLowerCase();
      if (
        lower === "linear" ||
        lower === "ease" ||
        lower === "ease-in" ||
        lower === "ease-out" ||
        lower === "ease-in-out" ||
        lower === "step-start" ||
        lower === "step-end"
      ) {
        return lower;
      }
      if (
        /^cubic-bezier\(\s*-?(?:\d+\.?\d*|\.\d+)\s*,\s*-?(?:\d+\.?\d*|\.\d+)\s*,\s*-?(?:\d+\.?\d*|\.\d+)\s*,\s*-?(?:\d+\.?\d*|\.\d+)\s*\)$/i.test(
          trimmed
        )
      ) {
        return trimmed;
      }
      if (
        /^steps\(\s*\d+\s*(?:,\s*(?:start|end|jump-start|jump-end|jump-none|jump-both)\s*)?\)$/i.test(
          trimmed
        )
      ) {
        return trimmed;
      }
      return fallback;
    }

    // 默认读取某个元素的 computed style（浏览器中即 window.getComputedStyle）。
    function defaultComputedStyle(element) {
      if (!isElement(element)) return null;
      const document = element.ownerDocument;
      const view = document && document.defaultView;
      if (view && typeof view.getComputedStyle === "function") return view.getComputedStyle(element);
      const scope = globalScope();
      if (scope && typeof scope.getComputedStyle === "function") return scope.getComputedStyle(element);
      if (typeof window !== "undefined" && window && typeof window.getComputedStyle === "function") {
        return window.getComputedStyle(element);
      }
      return null;
    }

    // 默认 matchMedia：优先 globalThis，其次 window；缺失返回 null。
    function defaultMatchMedia(query) {
      const scope = globalScope();
      if (scope && typeof scope.matchMedia === "function") return scope.matchMedia(query);
      if (typeof window !== "undefined" && window && typeof window.matchMedia === "function") {
        return window.matchMedia(query);
      }
      return null;
    }

    function defaultRootElement() {
      const scope = globalScope();
      if (scope && scope.document && scope.document.documentElement) return scope.document.documentElement;
      if (typeof window !== "undefined" && window && window.document && window.document.documentElement) {
        return window.document.documentElement;
      }
      return null;
    }

    function readStyleProperty(style, property) {
      if (!style) return "";
      try {
        return style.getPropertyValue(property) || "";
      } catch (error) {
        return "";
      }
    }

    function isExcluded(element) {
      if (!isElement(element) || typeof element.closest !== "function") return false;
      try {
        return element.closest(HARD_EXCLUSION) !== null;
      } catch (error) {
        return false;
      }
    }

    function roleKind(element) {
      if (!isElement(element)) return null;
      const role = element.getAttribute("role");
      if (!role) return null;
      const token = role.trim().toLowerCase();
      if (token === "menu") return "menu";
      if (token === "listbox") return "listbox";
      if (token === "dialog") return "dialog";
      return null;
    }

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
        return container.querySelector('[role="menu"], [role="listbox"], [role="dialog"]') !== null;
      } catch (error) {
        return false;
      }
    }

    // 收集 container（含自身）内的语义面：menu / listbox / dialog，并为 dialog 配对 mask。
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

    // 独立 transform 支持探测：CSS.supports('translate', ...) 且 CSS.supports('scale', ...)。
    function supportsIndependentTransforms() {
      const scope = globalScope();
      const css = scope && scope.CSS;
      if (!css || typeof css.supports !== "function") return false;
      try {
        return css.supports("translate", "0 1px") && css.supports("scale", ".98");
      } catch (error) {
        return false;
      }
    }

    // ============================================================
    // region policy：token / reduced-motion / 时长策略
    // ============================================================

    function createPolicy(options = {}) {
      const optionTokenSource = options.tokenSource;
      const optionMatchMedia = options.matchMedia;
      const computedStyle =
        typeof options.computedStyle === "function" ? options.computedStyle : defaultComputedStyle;

      const listeners = new Set();
      let mediaQueryList = null;
      let mediaResolved = false;
      let mediaListenerAttached = false;
      let disposed = false;

      function handleMediaChange(event) {
        // 以 MediaQueryList 的最新状态为准；事件携带的状态存在时优先使用（兼容测试桩）。
        const reduced =
          event && typeof event.matches === "boolean" ? event.matches : readReducedMotion();
        for (const listener of Array.from(listeners)) {
          try {
            listener(reduced);
          } catch (error) {
            // 监听器自身的错误不应影响其它监听器
          }
        }
      }

      function resolveMediaQueryList() {
        if (mediaResolved) return mediaQueryList;
        mediaResolved = true;
        try {
          if (typeof optionMatchMedia === "function") {
            mediaQueryList = optionMatchMedia(MOTION_MEDIA_QUERY) || null;
          } else if (optionMatchMedia && typeof optionMatchMedia === "object") {
            mediaQueryList = optionMatchMedia;
          } else {
            mediaQueryList = defaultMatchMedia(MOTION_MEDIA_QUERY);
          }
        } catch (error) {
          mediaQueryList = null;
        }
        if (mediaQueryList && typeof mediaQueryList.addEventListener === "function") {
          mediaQueryList.addEventListener("change", handleMediaChange);
          mediaListenerAttached = true;
        } else if (mediaQueryList && typeof mediaQueryList.addListener === "function") {
          mediaQueryList.addListener(handleMediaChange);
          mediaListenerAttached = true;
        }
        return mediaQueryList;
      }

      function readReducedMotion() {
        if (disposed) return false;
        const list = resolveMediaQueryList();
        return !!(list && list.matches);
      }

      function readStyle() {
        if (disposed) return null;
        try {
          const source = typeof optionTokenSource === "function" ? optionTokenSource() : optionTokenSource;
          if (source && typeof source.getPropertyValue === "function") return source;
          if (source) return computedStyle(source);
          const element = defaultRootElement();
          return element ? computedStyle(element) : null;
        } catch (error) {
          return null;
        }
      }

      // 读取 kind 对应的时长 token；缺失时返回 kind 级 fallback。
      function durationFor(properties) {
        const style = readStyle();
        const parsed = parseCssDuration(readStyleProperty(style, properties.property), NaN);
        return Number.isFinite(parsed) ? parsed : properties.fallbackMs;
      }

      // MotionTokenSnapshot：缺失的 token 用已知 token 值（100/200/300ms）兜底。
      function tokens() {
        const style = readStyle();
        const fast = parseCssDuration(
          readStyleProperty(style, "--ds-transition-duration-fast"),
          TOKEN_FALLBACK.fastMs
        );
        const normal = parseCssDuration(
          readStyleProperty(style, "--ds-transition-duration"),
          TOKEN_FALLBACK.normalMs
        );
        const slow = parseCssDuration(
          readStyleProperty(style, "--ds-transition-duration-slow"),
          TOKEN_FALLBACK.slowMs
        );
        return {
          easing: parseEasing(readStyleProperty(style, "--ds-ease-in-out"), TOKEN_FALLBACK.easing),
          fastMs: fast,
          normalMs: normal,
          slowMs: slow
        };
      }

      function timing(kind) {
        const properties = KIND_POLICY[kind] || MENU_POLICY;
        const duration = clampNumber(durationFor(properties), properties.minMs, properties.maxMs);
        const snapshot = tokens();
        return {
          durationMs: readReducedMotion() ? 0 : duration,
          easing: properties.easing === null ? snapshot.easing : properties.easing,
          distancePx: properties.distancePx,
          scaleFrom: properties.scaleFrom,
          opacityFrom: properties.opacityFrom
        };
      }

      function subscribe(listener) {
        if (typeof listener !== "function" || disposed) return () => {};
        resolveMediaQueryList();
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      }

      function dispose() {
        if (disposed) return;
        disposed = true;
        if (mediaListenerAttached && mediaQueryList) {
          try {
            if (typeof mediaQueryList.removeEventListener === "function") {
              mediaQueryList.removeEventListener("change", handleMediaChange);
            } else if (typeof mediaQueryList.removeListener === "function") {
              mediaQueryList.removeListener(handleMediaChange);
            }
          } catch (error) {
            // 忽略宿主 MediaQueryList 的清理错误
          }
        }
        mediaListenerAttached = false;
        listeners.clear();
      }

      return {
        reducedMotion: readReducedMotion,
        tokens: tokens,
        timing: timing,
        subscribe: subscribe,
        dispose: dispose
      };
    }

    // ============================================================
    // region classifier：DOM → SurfaceIntent / RemovalSurface
    // ============================================================

    function createClassifier() {
      // 入场：childList 的新增子树 → mount intent（dialog 配对 mask）。
      function classifySubtree(node) {
        if (!isElement(node) || isExcluded(node)) return [];
        const surfaces = collectSurfaces(node);
        if (surfaces.length === 0) {
          // 单独插入的 mask（dialog 已在 DOM 中）：只动画 mask 本身。
          if (isMaskElement(node) && findDialogSibling(node)) {
            return [{ element: node, kind: "mask", trigger: "mount", state: "mounted" }];
          }
          return [];
        }
        const intents = [];
        for (const surface of surfaces) {
          intents.push({
            element: surface.element,
            kind: surface.kind,
            trigger: "mount",
            state: "mounted"
          });
        }
        return intents;
      }

      // 退场：在删除子树中定位 dialog(+mask) / menu / listbox。
      function classifyRemoval(node) {
        if (!isElement(node) || isExcluded(node)) return [];
        const surfaces = collectSurfaces(node);
        if (surfaces.length === 0) return [];
        const contained = surfaces.filter((surface) => {
          if (surface.element === node) return true;
          return typeof node.contains === "function" && node.contains(surface.element);
        });
        if (contained.length === 0) return [];
        return [{ root: node, surfaces: contained }];
      }

      // 属性变化：语义面可见性切换（visible / hidden）。
      function classifyMutation(record) {
        if (!record) return [];
        if (record.type === "childList") {
          const intents = [];
          if (record.addedNodes) {
            for (const node of Array.from(record.addedNodes)) {
              for (const intent of classifySubtree(node)) intents.push(intent);
            }
          }
          return intents;
        }
        if (record.type !== "attributes") return [];
        const target = record.target;
        if (!isElement(target) || isExcluded(target)) return [];
        const kind = roleKind(target);
        if (!kind) return [];
        const state = isSurfaceVisible(target) ? "visible" : "hidden";
        const intents = [{ element: target, kind: kind, trigger: "visibility", state: state }];
        if (kind === "dialog") {
          const mask = findMask(target);
          if (mask && !isExcluded(mask)) {
            intents.push({ element: mask, kind: "mask", trigger: "visibility", state: state });
          }
        }
        return intents;
      }

      return {
        classifyMutation: classifyMutation,
        classifySubtree: classifySubtree,
        classifyRemoval: classifyRemoval
      };
    }

    // ============================================================
    // region compatibility：三重门卫
    // ============================================================

    function createCompatibility(options = {}) {
      const computedStyle =
        typeof options.computedStyle === "function" ? options.computedStyle : defaultComputedStyle;

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

      function hasHostAnimation(element, ownedAnimations) {
        if (typeof element.getAnimations === "function") {
          let animations = [];
          try {
            animations = element.getAnimations() || [];
          } catch (error) {
            animations = [];
          }
          for (const animation of animations) {
            if (ownedAnimations && ownedAnimations.has(animation)) continue;
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

      function canAnimate(element, kind, ownedAnimations) {
        if (!isElement(element)) return false;
        if (isExcluded(element)) return false;
        if (!isAtLeastSelfVisible(element)) return false;
        if (hasHostAnimation(element, ownedAnimations)) return false;
        return true;
      }

      return { canAnimate: canAnimate };
    }

    // ============================================================
    // region runtime：观察 / 批量 / 入场 / 退场幽灵 / 清理
    // ============================================================

    // 入场关键帧（§2 时长策略表）。
    function keyframesFor(kind, timing, independentTransforms) {
      const policy = timing && typeof timing === "object" ? timing : {};
      const opacityFrom = Number.isFinite(policy.opacityFrom) ? policy.opacityFrom : 0;
      const distancePx = Number.isFinite(policy.distancePx) ? policy.distancePx : 0;
      const scaleFrom = Number.isFinite(policy.scaleFrom) ? policy.scaleFrom : 1;

      const first = { opacity: opacityFrom };
      const last = { opacity: 1 };
      if (independentTransforms && kind !== "mask" && distancePx !== 0) {
        first.translate = "0 " + distancePx + "px";
        last.translate = "0 0";
        if (kind === "menu" || kind === "listbox") {
          first.scale = String(scaleFrom);
          last.scale = "1";
        }
      }
      return [first, last];
    }

    // 退场关键帧 = 入场镜像。
    function exitKeyframesFor(kind, timing, independentTransforms) {
      const policy = timing && typeof timing === "object" ? timing : {};
      const opacityFrom = Number.isFinite(policy.opacityFrom) ? policy.opacityFrom : 0;
      const distancePx = Number.isFinite(policy.distancePx) ? policy.distancePx : 0;
      const scaleFrom = Number.isFinite(policy.scaleFrom) ? policy.scaleFrom : 1;

      const first = { opacity: 1 };
      const last = { opacity: opacityFrom };
      if (independentTransforms && kind !== "mask" && distancePx !== 0) {
        first.translate = "0 0";
        last.translate = "0 " + distancePx + "px";
        if (kind === "menu" || kind === "listbox") {
          first.scale = "1";
          last.scale = String(scaleFrom);
        }
      }
      return [first, last];
    }

    function defaultAnimator(element, keyframes, timing) {
      if (!isElement(element) || typeof element.animate !== "function") return null;
      try {
        return element.animate(keyframes, {
          duration: timing.durationMs,
          easing: timing.easing,
          fill: "both"
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

    // 把原始子树里的元素映射到 clone 中的对应元素。
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
          node.style.setProperty("backdrop-filter", "none");
          node.style.setProperty("-webkit-backdrop-filter", "none");
        }
      }
    }

    function createMotionRuntime(options = {}) {
      const policy = options.policy || createPolicy();
      const classifier = options.classifier || createClassifier();
      const compatibility = options.compatibility || createCompatibility();
      const root = options.root || (typeof document !== "undefined" ? document : null);
      const animator = typeof options.animator === "function" ? options.animator : defaultAnimator;
      const requestFrame = typeof options.requestFrame === "function" ? options.requestFrame : defaultRequestFrame;
      const cancelFrame = typeof options.cancelFrame === "function" ? options.cancelFrame : defaultCancelFrame;

      const lastApplied = new WeakMap();
      const ownedAnimations = new Set();
      const exitAnimations = new Set();
      const ghosts = new Set();
      let batch = [];
      let frameHandle = null;
      let frameScheduled = false;
      let observer = null;
      let started = false;
      let disposed = false;

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
        if (!compatibility || typeof compatibility.canAnimate !== "function") return true;
        try {
          return !!compatibility.canAnimate(element, kind, ownedAnimations);
        } catch (error) {
          return false;
        }
      }

      // 同帧去重：lastApplied[element][kind] = "trigger:state"。
      function enqueue(intent) {
        if (disposed || !intent || !isElement(intent.element) || !intent.kind) return;
        const key = String(intent.trigger) + ":" + String(intent.state);
        let applied = lastApplied.get(intent.element);
        if (!applied) {
          applied = Object.create(null);
          lastApplied.set(intent.element, applied);
        }
        if (applied[intent.kind] === key) return;
        applied[intent.kind] = key;
        batch.push({
          element: intent.element,
          kind: intent.kind,
          trigger: String(intent.trigger),
          state: String(intent.state)
        });
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
        for (const intent of current) applyEntry(intent);
      }

      function applyEntry(intent) {
        const element = intent.element;
        if (!isElement(element) || !element.isConnected) return;
        // 只有入场方向才播动画（退场由 classifyRemoval 的幽灵承担）。
        if (intent.trigger === "visibility" && intent.state !== "visible") return;
        if (isReducedMotion()) return;
        if (!canAnimate(element, intent.kind)) return;
        const timing = timingFor(intent.kind);
        if (!timing || !(timing.durationMs > 0)) return;
        const animation = animator(
          element,
          keyframesFor(intent.kind, timing, supportsIndependentTransforms()),
          timing
        );
        if (!animation) return;
        ownedAnimations.add(animation);
        whenSettled(animation, () => {
          ownedAnimations.delete(animation);
        });
      }

      function removeGhost(ghost) {
        ghosts.delete(ghost);
        if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
      }

      // 退场：cloneNode(true) → prepareGhost → 插回原位置 → exitKeyframesFor → settle 后移除。
      function playGhost(group, parent, nextSibling) {
        if (disposed || !group || !isElement(group.root)) return;
        if (!parent || typeof parent.insertBefore !== "function") return;
        // 父节点已随同一批 mutation 被移除时，幽灵没有可见落点。
        if (typeof parent.isConnected === "boolean" && !parent.isConnected) return;
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
        for (const surface of group.surfaces) {
          if (!surface || !isElement(surface.element)) continue;
          const target = resolveClone(rootElement, ghost, surface.element);
          if (!isElement(target)) continue;
          const timing = timingFor(surface.kind);
          if (!timing || !(timing.durationMs > 0)) continue;
          const animation = animator(
            target,
            exitKeyframesFor(surface.kind, timing, supportsIndependentTransforms()),
            timing
          );
          if (!animation) continue;
          exitAnimations.add(animation);
          whenSettled(animation, () => {
            exitAnimations.delete(animation);
          });
          jobs.push(animation);
        }

        if (jobs.length === 0) {
          removeGhost(ghost);
          return;
        }
        Promise.all(jobs.map(waitForAnimation)).then(() => {
          removeGhost(ghost);
        });
      }

      function scheduleExit(node, parent, nextSibling) {
        if (disposed || !isElement(node) || isReducedMotion()) return;
        let groups = [];
        try {
          groups = classifier.classifyRemoval(node) || [];
        } catch (error) {
          return;
        }
        for (const group of groups) playGhost(group, parent, nextSibling);
      }

      function handleRecord(record) {
        if (!record) return;
        let intents = [];
        try {
          intents = classifier.classifyMutation(record) || [];
        } catch (error) {
          intents = [];
        }
        for (const intent of intents) enqueue(intent);
        if (record.type === "childList" && record.removedNodes) {
          for (const node of Array.from(record.removedNodes)) {
            scheduleExit(node, record.target, record.nextSibling);
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

      function start() {
        if (disposed || started) return stop;
        const documentNode = root && root.nodeType === 9 ? root : root && root.ownerDocument;
        const observationRoot = root && root.nodeType === 9 ? root.body || root.documentElement : root;
        if (!observationRoot || typeof observationRoot.nodeType !== "number") return stop;
        const view = documentNode && documentNode.defaultView;
        const ObserverCtor =
          (view && view.MutationObserver) ||
          (typeof globalThis !== "undefined" ? globalThis.MutationObserver : undefined);
        if (typeof ObserverCtor !== "function") return stop;
        observer = new ObserverCtor(handleRecords);
        observer.observe(observationRoot, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeOldValue: true,
          attributeFilter: OBSERVED_ATTRIBUTES
        });
        started = true;
        return stop;
      }

      function stop() {
        if (disposed) return;
        disposed = true;
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
        for (const animation of Array.from(ownedAnimations)) cancelAnimation(animation);
        ownedAnimations.clear();
        for (const animation of Array.from(exitAnimations)) cancelAnimation(animation);
        exitAnimations.clear();
        for (const ghost of Array.from(ghosts)) removeGhost(ghost);
        ghosts.clear();
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

    // ============================================================
    // region register：classic script 注册 + apply
    // ============================================================

    function apply(ctx) {
      const runtime = createMotionRuntime({ root: document });
      ctx.effect(() => runtime.start(), "dsh-webui-transition: runtime");
    }

    exports.createPolicy = createPolicy;
    exports.createClassifier = createClassifier;
    exports.createCompatibility = createCompatibility;
    exports.createMotionRuntime = createMotionRuntime;
    exports.keyframesFor = keyframesFor;
    exports.exitKeyframesFor = exitKeyframesFor;
    exports.inject = [];
    exports.apply = apply;

    return module.exports;
  }
});
