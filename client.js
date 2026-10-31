(() => {
  // src/defs.js
  var OBSERVED_ATTRIBUTES = [
    "hidden",
    "aria-hidden",
    "aria-expanded",
    "open",
    "role",
    "data-slot",
    "data-phase"
  ];
  var HARD_EXCLUSION = '[data-dsh-transition="off"], [data-dsh-transition-ghost], [data-chat-flow], [data-chat-flow-key], [data-streaming], [data-trajectory-scroll], [data-trajectory-row-key], [role="tooltip"], [role="alert"]';
  var MOTION_MEDIA_QUERY = "(prefers-reduced-motion: reduce)";
  var DEFAULT_EASING = "cubic-bezier(.4, 0, .2, 1)";
  var DIALOG_EASING = "cubic-bezier(.22, 1, .36, 1)";
  var TOKEN_FALLBACK = {
    easing: DEFAULT_EASING,
    fastMs: 100,
    normalMs: 200,
    slowMs: 300
  };
  var SURFACE_DEFS = {
    menu: {
      role: "menu",
      property: "--ds-transition-duration-fast",
      fallbackMs: 150,
      minMs: 120,
      maxMs: 160,
      distancePx: -4,
      scaleFrom: 0.98,
      opacityFrom: 0,
      easing: null,
      // null = 用 --ds-ease-in-out
      splitFade: true,
      // 透明度下沉到直接元素子级
      animateShadow: true
    },
    listbox: {
      role: "listbox",
      property: "--ds-transition-duration-fast",
      fallbackMs: 150,
      minMs: 120,
      maxMs: 160,
      distancePx: -4,
      scaleFrom: 0.98,
      opacityFrom: 0,
      easing: null,
      splitFade: true,
      animateShadow: true
    },
    dialog: {
      role: "dialog",
      property: "--ds-transition-duration",
      fallbackMs: 220,
      minMs: 160,
      maxMs: 240,
      distancePx: 12,
      scaleFrom: 1,
      opacityFrom: 0,
      easing: DIALOG_EASING,
      splitFade: false,
      animateShadow: false
    },
    mask: {
      role: null,
      property: "--ds-transition-duration",
      fallbackMs: 180,
      minMs: 140,
      maxMs: 220,
      distancePx: 0,
      scaleFrom: 1,
      opacityFrom: 0,
      easing: null,
      splitFade: false,
      animateShadow: false
    }
  };
  var SURFACE_SELECTOR = '[role="menu"], [role="listbox"], [role="dialog"]';

  // src/utils.js
  function globalScope() {
    return typeof globalThis !== "undefined" ? globalThis : null;
  }
  function isElement(node) {
    return !!node && node.nodeType === 1;
  }
  function clampNumber(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }
  function parseCssDuration(value, fallback) {
    if (typeof value !== "string") return fallback;
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    const match = /^(-?(?:\d+\.?\d*|\.\d+))(ms|s)?$/i.exec(trimmed);
    if (!match) return fallback;
    let milliseconds = parseFloat(match[1]);
    if ((match[2] || "ms").toLowerCase() === "s") milliseconds *= 1e3;
    if (!Number.isFinite(milliseconds)) return fallback;
    return milliseconds;
  }
  function parseEasing(value, fallback) {
    if (typeof value !== "string") return fallback;
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    const lower = trimmed.toLowerCase();
    if (lower === "linear" || lower === "ease" || lower === "ease-in" || lower === "ease-out" || lower === "ease-in-out" || lower === "step-start" || lower === "step-end") {
      return lower;
    }
    if (/^cubic-bezier\(\s*-?(?:\d+\.?\d*|\.\d+)\s*,\s*-?(?:\d+\.?\d*|\.\d+)\s*,\s*-?(?:\d+\.?\d*|\.\d+)\s*,\s*-?(?:\d+\.?\d*|\.\d+)\s*\)$/i.test(
      trimmed
    )) {
      return trimmed;
    }
    if (/^steps\(\s*\d+\s*(?:,\s*(?:start|end|jump-start|jump-end|jump-none|jump-both)\s*)?\)$/i.test(
      trimmed
    )) {
      return trimmed;
    }
    return fallback;
  }
  function defaultComputedStyle(element, pseudoElement = null) {
    if (!isElement(element)) return null;
    const pseudo = pseudoElement || void 0;
    const document2 = element.ownerDocument;
    const view = document2 && document2.defaultView;
    if (view && typeof view.getComputedStyle === "function") {
      return pseudo ? view.getComputedStyle(element, pseudo) : view.getComputedStyle(element);
    }
    const scope = globalScope();
    if (scope && typeof scope.getComputedStyle === "function") {
      return pseudo ? scope.getComputedStyle(element, pseudo) : scope.getComputedStyle(element);
    }
    if (typeof window !== "undefined" && window && typeof window.getComputedStyle === "function") {
      return pseudo ? window.getComputedStyle(element, pseudo) : window.getComputedStyle(element);
    }
    return null;
  }
  function readBackdropFilter(style) {
    if (!style) return "";
    let value = "";
    try {
      value = style.backdropFilter || style.webkitBackdropFilter || "";
    } catch (error) {
      value = "";
    }
    if (!value) value = readStyleProperty(style, "backdrop-filter");
    if (!value) value = readStyleProperty(style, "-webkit-backdrop-filter");
    const trimmed = String(value).trim();
    return trimmed && trimmed.toLowerCase() !== "none" ? trimmed : "";
  }
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
  function isElementConnected(element) {
    if (!isElement(element)) return false;
    return element.isConnected !== false;
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
  function isExcluded(element) {
    if (!isElement(element) || typeof element.closest !== "function") return false;
    try {
      return element.closest(HARD_EXCLUSION) !== null;
    } catch (error) {
      return false;
    }
  }

  // src/frames.js
  function surfaceDefFor(kind) {
    return SURFACE_DEFS[kind] || SURFACE_DEFS.menu;
  }
  function geometryFor(def, timing) {
    const source = timing && typeof timing === "object" ? timing : {};
    return {
      distancePx: Number.isFinite(source.distancePx) ? source.distancePx : def.distancePx,
      scaleFrom: Number.isFinite(source.scaleFrom) ? source.scaleFrom : def.scaleFrom,
      opacityFrom: Number.isFinite(source.opacityFrom) ? source.opacityFrom : def.opacityFrom
    };
  }
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
  function directElementChildren(element) {
    if (!isElement(element) || !element.childNodes) return [];
    const children = [];
    for (const child of Array.from(element.childNodes)) {
      if (child.nodeType === 1) children.push(child);
    }
    return children;
  }
  function isGeneratedPseudoElement(style) {
    if (!style) return false;
    let content = "";
    try {
      content = style.content || "";
    } catch (error) {
      content = "";
    }
    const trimmed = String(content).trim().toLowerCase();
    return trimmed !== "" && trimmed !== "none" && trimmed !== "normal" && trimmed !== "initial" && trimmed !== "inherit" && trimmed !== "unset";
  }
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
  function fadeKeyframesFor(direction, opacity) {
    const value = Number.isFinite(opacity) ? opacity : 1;
    if (direction === "out") return [{ opacity: value }, { opacity: 0 }];
    return [{ opacity: 0 }, { opacity: value }];
  }
  function keyframesFor(kind, timing, independentTransforms, boxShadow = null) {
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
  function exitKeyframesFor(kind, timing, independentTransforms, boxShadow = null) {
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
  function animationSpecsFor(surface, kind, direction, independentTransforms, options = {}) {
    if (!isElement(surface)) return [];
    const def = surfaceDefFor(kind);
    const out = direction === "out";
    const computedStyle = options && typeof options.computedStyle === "function" ? options.computedStyle : defaultComputedStyle;
    const timing = {
      distancePx: def.distancePx,
      scaleFrom: def.scaleFrom,
      opacityFrom: def.opacityFrom
    };
    const pseudoGlass = def.splitFade ? null : pseudoGlassFor(surface, computedStyle);
    const boxShadow = def.animateShadow || pseudoGlass !== null ? naturalBoxShadow(surface, computedStyle) : null;
    if (!def.splitFade && pseudoGlass === null) {
      const surfaceFrames2 = out ? exitKeyframesFor(kind, timing, independentTransforms, boxShadow) : keyframesFor(kind, timing, independentTransforms, boxShadow);
      return surfaceFrames2.length > 0 ? [{ element: surface, keyframes: surfaceFrames2 }] : [];
    }
    const surfaceFrames = geometryKeyframesFor(kind, timing, independentTransforms, boxShadow, out);
    const children = directElementChildren(surface);
    const specs = [];
    if (surfaceFrames.length > 0) specs.push({ element: surface, keyframes: surfaceFrames });
    for (const child of children) {
      specs.push({
        element: child,
        keyframes: fadeKeyframesFor(direction, naturalOpacity(child, null, computedStyle))
      });
    }
    if (pseudoGlass !== null) {
      specs.push({
        element: surface,
        pseudoElement: pseudoGlass,
        keyframes: fadeKeyframesFor(direction, naturalOpacity(surface, pseudoGlass, computedStyle))
      });
    }
    if (children.length > 0 || pseudoGlass !== null) return specs;
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

  // src/gate.js
  function createGate(options = {}) {
    const computedStyle = typeof options.computedStyle === "function" ? options.computedStyle : defaultComputedStyle;
    function isAtLeastSelfVisible(element) {
      if (element.hidden) return false;
      let ancestor = element.parentElement;
      while (ancestor) {
        if (ancestor.hidden) return false;
        if (ancestor.getAttribute("aria-hidden") === "true") return false;
        ancestor = ancestor.parentElement;
      }
      let current = element;
      while (current && current.nodeType === 1) {
        const style = computedStyle(current);
        if (style && style.display === "none") return false;
        current = current.parentElement;
      }
      return true;
    }
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
    function animatedPropertiesFor(kind) {
      const surface = SURFACE_DEFS[kind];
      const definition = surface && typeof surface === "object" ? surface : SURFACE_DEFS.menu;
      if (definition.splitFade) {
        const properties2 = ["translate", "scale"];
        if (definition.animateShadow) properties2.push("box-shadow");
        return properties2;
      }
      const properties = ["opacity"];
      if (definition.distancePx !== 0) properties.push("translate");
      return properties;
    }
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
      return value.split(",").map((entry) => entry.trim()).filter((entry) => entry.length > 0);
    }
    function hasHostTransitionConflict(element, kind) {
      try {
        const style = computedStyle(element);
        if (!style) return false;
        const propertyValue = readComputedProperty(style, "transitionProperty", "transition-property");
        const propertyList = splitCssList(propertyValue).map((property) => property.toLowerCase());
        if (propertyList.length === 0 || propertyValue.toLowerCase() === "none") return false;
        const durationList = splitCssList(
          readComputedProperty(style, "transitionDuration", "transition-duration")
        );
        if (durationList.length === 0) return false;
        for (const property of animatedPropertiesFor(kind)) {
          for (let index = 0; index < propertyList.length; index += 1) {
            const candidate = propertyList[index];
            if (candidate !== "all" && candidate !== property) continue;
            const duration = parseCssDuration(durationList[index % durationList.length], 0);
            if (duration > 0) return true;
          }
        }
        return false;
      } catch (error) {
        return false;
      }
    }
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

  // src/policy.js
  function createPolicy(options = {}) {
    const optionTokenSource = options.tokenSource;
    const optionMatchMedia = options.matchMedia;
    const computedStyle = typeof options.computedStyle === "function" ? options.computedStyle : defaultComputedStyle;
    const listeners = /* @__PURE__ */ new Set();
    let mediaQueryList = null;
    let mediaResolved = false;
    let mediaListenerAttached = false;
    let disposed = false;
    function handleMediaChange(event) {
      const reduced = event && typeof event.matches === "boolean" ? event.matches : readReducedMotion();
      for (const listener of Array.from(listeners)) {
        try {
          listener(reduced);
        } catch (error) {
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
    function durationFor(def) {
      const style = readStyle();
      const parsed = parseCssDuration(readStyleProperty(style, def.property), NaN);
      return Number.isFinite(parsed) ? parsed : def.fallbackMs;
    }
    function tokens() {
      const style = readStyle();
      return {
        easing: parseEasing(readStyleProperty(style, "--ds-ease-in-out"), TOKEN_FALLBACK.easing),
        fastMs: parseCssDuration(readStyleProperty(style, "--ds-transition-duration-fast"), TOKEN_FALLBACK.fastMs),
        normalMs: parseCssDuration(readStyleProperty(style, "--ds-transition-duration"), TOKEN_FALLBACK.normalMs),
        slowMs: parseCssDuration(readStyleProperty(style, "--ds-transition-duration-slow"), TOKEN_FALLBACK.slowMs)
      };
    }
    function timing(kind) {
      const def = SURFACE_DEFS[kind] || SURFACE_DEFS.menu;
      const duration = clampNumber(durationFor(def), def.minMs, def.maxMs);
      const snapshot = tokens();
      return {
        durationMs: readReducedMotion() ? 0 : duration,
        easing: def.easing === null ? snapshot.easing : def.easing,
        distancePx: def.distancePx,
        scaleFrom: def.scaleFrom,
        opacityFrom: def.opacityFrom
      };
    }
    function subscribe(listener) {
      if (typeof listener !== "function" || disposed) return () => {
      };
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
        }
      }
      mediaListenerAttached = false;
      listeners.clear();
    }
    return {
      reducedMotion: readReducedMotion,
      tokens,
      timing,
      subscribe,
      dispose
    };
  }

  // src/tracker.js
  function classTokens(element) {
    const className = isElement(element) ? element.getAttribute("class") : null;
    if (!className) return [];
    return className.split(/\s+/);
  }
  function isMaskElement(element) {
    if (!isElement(element) || roleKind(element) !== null) return false;
    if (element.getAttribute("aria-hidden") !== "true") return false;
    const tokens = classTokens(element);
    for (const token of tokens) {
      if (/(?:^|[-_])mask(?:[-_]|$)/i.test(token)) return true;
    }
    return false;
  }
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
  function collectSurfaces(container) {
    const surfaces = [];
    const seen = /* @__PURE__ */ new Set();
    const containerKind = roleKind(container);
    if (!containerKind && !hasSurfaceDescendant(container)) return surfaces;
    function add(element, kind) {
      if (!isElement(element) || seen.has(element)) return;
      if (isExcluded(element)) return;
      seen.add(element);
      surfaces.push({ element, kind });
    }
    if (containerKind) add(container, containerKind);
    if (isElement(container) && typeof container.querySelectorAll === "function") {
      for (const element of Array.from(container.querySelectorAll("[role]"))) {
        const kind = roleKind(element);
        if (kind) add(element, kind);
      }
    }
    for (const surface of surfaces.slice()) {
      if (surface.kind !== "dialog") continue;
      const mask = findMask(surface.element);
      if (mask) add(mask, "mask");
    }
    return surfaces;
  }
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
  function createSurfaceTracker(options = {}) {
    const states = /* @__PURE__ */ new WeakMap();
    const maskDialogs = /* @__PURE__ */ new WeakMap();
    function rememberSurface(element, kind) {
      states.set(element, {
        kind,
        visibility: isSurfaceVisible(element) ? "visible" : "hidden"
      });
    }
    function pairMask(dialog) {
      const mask = findMask(dialog);
      if (!mask || isExcluded(mask)) return null;
      maskDialogs.set(mask, dialog);
      return mask;
    }
    function mountIntent(element, kind) {
      return { element, kind, trigger: "mount", state: "mounted" };
    }
    function forgetSurface(element) {
      states.delete(element);
      maskDialogs.delete(element);
    }
    function scanRoot(root) {
      if (!isElement(root)) return;
      for (const surface of collectSurfaces(root)) {
        if (surface.kind === "mask") continue;
        rememberSurface(surface.element, surface.kind);
        if (surface.kind === "dialog") pairMask(surface.element);
      }
    }
    function classifyAdded(node) {
      if (!isElement(node) || isExcluded(node)) return [];
      const surfaces = collectSurfaces(node);
      if (surfaces.length === 0) {
        if (!isMaskElement(node)) return [];
        const dialog = findDialogSibling(node);
        if (!dialog) return [];
        maskDialogs.set(node, dialog);
        return [mountIntent(node, "mask")];
      }
      const intents = [];
      for (const surface of surfaces) {
        if (surface.kind !== "mask") {
          rememberSurface(surface.element, surface.kind);
          if (surface.kind === "dialog") pairMask(surface.element);
        }
        intents.push(mountIntent(surface.element, surface.kind));
      }
      return intents;
    }
    function classifyAttributes(target) {
      if (!isElement(target) || isExcluded(target)) return [];
      const kind = roleKind(target);
      if (!kind) return [];
      const previous = states.get(target);
      const previousVisibility = previous ? previous.visibility : "unknown";
      const visibility = isSurfaceVisible(target) ? "visible" : "hidden";
      states.set(target, { kind, visibility });
      const mask = kind === "dialog" ? pairMask(target) : null;
      if (previousVisibility === "visible" || visibility !== "visible") return [];
      const intents = [{ element: target, kind, trigger: "visibility", state: "visible" }];
      if (mask) intents.push({ element: mask, kind: "mask", trigger: "visibility", state: "visible" });
      return intents;
    }
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
        for (const surface of contained) forgetSurface(surface.element);
        return [{ root: node, surfaces: contained }];
      }
      if (!isMaskElement(node)) return [];
      const dialog = maskDialogs.get(node) || findDialogSibling(node);
      maskDialogs.delete(node);
      if (!dialog || !isElementConnected(dialog)) return [];
      return [{ root: node, surfaces: [{ element: node, kind: "mask" }] }];
    }
    return {
      scanRoot,
      classifyAdded,
      classifyAttributes,
      classifyRemoval
    };
  }

  // src/runtime.js
  function defaultAnimator(element, keyframes, timing, pseudoElement) {
    if (!isElement(element) || typeof element.animate !== "function") return null;
    const options = {
      duration: timing.durationMs,
      easing: timing.easing,
      fill: "both"
    };
    if (pseudoElement) options.pseudoElement = pseudoElement;
    try {
      return element.animate(keyframes, options);
    } catch (error) {
      return null;
    }
  }
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
  function cancelAnimation(animation) {
    if (!animation) return;
    try {
      if (typeof animation.cancel === "function") animation.cancel();
    } catch (error) {
    }
  }
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
      }
    }
    callback();
  }
  function waitForAnimation(animation) {
    return new Promise((resolve) => {
      whenSettled(animation, resolve);
    });
  }
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
  function prepareGhost(element) {
    if (!isElement(element)) return;
    element.setAttribute("data-dsh-transition-ghost", "");
    element.setAttribute("aria-hidden", "true");
    element.setAttribute("inert", "");
    try {
      element.inert = true;
    } catch (error) {
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
      }
    }
  }
  function createTransitionRuntime(options = {}) {
    const policy = options.policy || createPolicy();
    const tracker = options.tracker || createSurfaceTracker();
    const gate = options.gate || createGate();
    const root = options.root || (typeof document !== "undefined" ? document : null);
    const animator = typeof options.animator === "function" ? options.animator : defaultAnimator;
    const requestFrame = typeof options.requestFrame === "function" ? options.requestFrame : defaultRequestFrame;
    const cancelFrame = typeof options.cancelFrame === "function" ? options.cancelFrame : defaultCancelFrame;
    const specOptions = typeof options.computedStyle === "function" ? { computedStyle: options.computedStyle } : {};
    function specsFor(element, kind, direction) {
      return animationSpecsFor(element, kind, direction, supportsIndependentTransforms(), specOptions);
    }
    let lastApplied = /* @__PURE__ */ new WeakMap();
    let batchKeys = /* @__PURE__ */ new WeakMap();
    const ownedAnimations = /* @__PURE__ */ new Set();
    const exitAnimations = /* @__PURE__ */ new Set();
    const ghosts = /* @__PURE__ */ new Set();
    let batch = [];
    let frameHandle = null;
    let frameScheduled = false;
    let observer = null;
    let unsubscribePolicy = null;
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
      if (!gate || typeof gate.canAnimate !== "function") return true;
      try {
        return !!gate.canAnimate(element, kind, ownedAnimations);
      } catch (error) {
        return false;
      }
    }
    function hasBatchKey(element, key) {
      const keys = batchKeys.get(element);
      return !!keys && keys.has(key);
    }
    function addBatchKey(element, key) {
      let keys = batchKeys.get(element);
      if (!keys) {
        keys = /* @__PURE__ */ new Set();
        batchKeys.set(element, keys);
      }
      keys.add(key);
    }
    function markApplied(element, kind, key) {
      let applied = lastApplied.get(element);
      if (!applied) {
        applied = /* @__PURE__ */ Object.create(null);
        lastApplied.set(element, applied);
      }
      applied[kind] = key;
    }
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
      batch.push({ element, kind, trigger, state });
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
      batchKeys = /* @__PURE__ */ new WeakMap();
      for (const intent of current) applyEntry(intent);
    }
    function applyEntry(intent) {
      const element = intent.element;
      if (!isElement(element) || !isElementConnected(element)) return;
      if (intent.trigger === "visibility" && intent.state !== "visible") return;
      if (isReducedMotion()) return;
      if (!canAnimate(element, intent.kind)) return;
      const timing = timingFor(intent.kind);
      if (!timing || !(timing.durationMs > 0)) return;
      const specs = specsFor(element, intent.kind, "in");
      let created = 0;
      for (const spec of specs) {
        const animation = animator(spec.element, spec.keyframes, timing, spec.pseudoElement);
        if (!animation) continue;
        if (!animationTargetsPseudo(animation, spec.pseudoElement)) {
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
          cancelAnimation(animation);
        });
      }
      if (created > 0) markApplied(element, intent.kind, intent.trigger + ":" + intent.state);
    }
    function removeGhost(ghost) {
      ghosts.delete(ghost);
      if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
    }
    function playGhost(group, parent, nextSibling) {
      if (disposed || !group || !isElement(group.root)) return;
      if (!parent || typeof parent.insertBefore !== "function") return;
      if (typeof parent.isConnected === "boolean" && !parent.isConnected) return;
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
        const specs = specsFor(target, surface.kind, "out");
        for (const spec of specs) {
          const animation = animator(spec.element, spec.keyframes, timing, spec.pseudoElement);
          if (!animation) continue;
          if (!animationTargetsPseudo(animation, spec.pseudoElement)) {
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
      if (jobs.length === 0) {
        removeGhost(ghost);
        return;
      }
      Promise.all(jobs.map(waitForAnimation)).then(() => {
        removeGhost(ghost);
      });
    }
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
        }
      }
    }
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
    function resolveObservationRoot() {
      if (!root) return null;
      if (root.nodeType === 9) return root.body || root.documentElement || null;
      return root;
    }
    function resolveObserverCtor() {
      const documentNode = root && root.nodeType === 9 ? root : root && root.ownerDocument;
      const view = documentNode && documentNode.defaultView;
      const scope = globalScope();
      return view && view.MutationObserver || scope && scope.MutationObserver || null;
    }
    function start() {
      if (disposed || started) return stop;
      const observationRoot = resolveObservationRoot();
      if (!observationRoot || typeof observationRoot.nodeType !== "number") return stop;
      const ObserverCtor = resolveObserverCtor();
      if (typeof ObserverCtor !== "function") return stop;
      try {
        tracker.scanRoot(observationRoot);
      } catch (error) {
      }
      if (policy && typeof policy.subscribe === "function") {
        try {
          unsubscribePolicy = policy.subscribe(handleReducedMotion) || null;
        } catch (error) {
          unsubscribePolicy = null;
        }
      }
      observer = new ObserverCtor(handleRecords);
      try {
        observer.observe(observationRoot, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeOldValue: true,
          attributeFilter: OBSERVED_ATTRIBUTES
        });
      } catch (error) {
        try {
          observer.disconnect();
        } catch (disconnectError) {
        }
        observer = null;
        return stop;
      }
      started = true;
      return stop;
    }
    function stop() {
      if (disposed) return;
      disposed = true;
      started = false;
      if (observer) {
        try {
          observer.disconnect();
        } catch (error) {
        }
        observer = null;
      }
      if (frameScheduled && frameHandle !== null) {
        try {
          cancelFrame(frameHandle);
        } catch (error) {
        }
      }
      frameScheduled = false;
      frameHandle = null;
      batch = [];
      batchKeys = /* @__PURE__ */ new WeakMap();
      lastApplied = /* @__PURE__ */ new WeakMap();
      cancelOwnedAnimations();
      for (const ghost of Array.from(ghosts)) removeGhost(ghost);
      ghosts.clear();
      if (unsubscribePolicy) {
        try {
          unsubscribePolicy();
        } catch (error) {
        }
        unsubscribePolicy = null;
      }
      if (policy && typeof policy.dispose === "function") {
        try {
          policy.dispose();
        } catch (error) {
        }
      }
    }
    return { start, dispose: stop, enqueue };
  }

  // src/browser.js
  function apply(ctx) {
    const runtime = createTransitionRuntime({ root: document });
    ctx.effect(() => runtime.start(), "dsh-webui-transition: runtime");
  }
  var api = {
    createPolicy,
    createSurfaceTracker,
    createGate,
    createTransitionRuntime,
    keyframesFor,
    exitKeyframesFor,
    fadeKeyframesFor,
    animationSpecsFor,
    inject: [],
    apply
  };
  window.__ModuleLoader__.load({
    id: "@tak1208/dsh-webui-transition",
    factory: () => api
  });
})();
