window.__ModuleLoader__.load({
  id: "@tak1208/dsh-webui-transition-settings",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// packages/dsh-webui-transition-settings/src/browser.js
var browser_exports = {};
__export(browser_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(browser_exports);

// packages/dsh-webui-transition-settings/src/contract.js
var SETTINGS_KEY = "dsh.webui-transition.settings.v1";
var SETTINGS_EVENT = "dsh-webui-transition/settings";
var FALLBACK_MODES = Object.freeze(["fade", "pointer"]);
var SURFACE_SETTING_KEYS = Object.freeze(["menu", "dialog", "mask"]);
var SETTINGS_RANGES = Object.freeze({
  durationMs: Object.freeze({ min: 0, max: 1e3, decimals: 0 }),
  scaleFrom: Object.freeze({ min: 0.5, max: 1, decimals: 2 }),
  opacityFrom: Object.freeze({ min: 0, max: 1, decimals: 2 })
});
var DEFAULT_SETTINGS = Object.freeze({
  fallback: "fade",
  durationMs: null,
  scaleFrom: null,
  opacityFrom: null,
  surfaces: Object.freeze({
    menu: Object.freeze({ durationMs: null, scaleFrom: null, opacityFrom: null }),
    dialog: Object.freeze({ durationMs: null, scaleFrom: null, opacityFrom: null }),
    mask: Object.freeze({ durationMs: null, scaleFrom: null, opacityFrom: null })
  })
});
var ORIGIN_MARKER_ATTRIBUTE = "data-dsh-transition-origin";
var ORIGIN_MARKER_CENTER = "center";
function defaults() {
  const surfaces = {};
  for (const key of SURFACE_SETTING_KEYS) {
    surfaces[key] = { durationMs: null, scaleFrom: null, opacityFrom: null };
  }
  return {
    fallback: DEFAULT_SETTINGS.fallback,
    durationMs: null,
    scaleFrom: null,
    opacityFrom: null,
    surfaces
  };
}
function normalizeNumber(value, range) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const clamped = Math.min(range.max, Math.max(range.min, value));
  const factor = 10 ** range.decimals;
  return Math.round(clamped * factor) / factor;
}
function normalizeSurfaceGroup(value) {
  const group = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    durationMs: normalizeNumber(group.durationMs, SETTINGS_RANGES.durationMs),
    scaleFrom: normalizeNumber(group.scaleFrom, SETTINGS_RANGES.scaleFrom),
    opacityFrom: normalizeNumber(group.opacityFrom, SETTINGS_RANGES.opacityFrom)
  };
}
function resolveStorage() {
  try {
    return typeof globalThis !== "undefined" ? globalThis.localStorage : null;
  } catch {
    return null;
  }
}
function supports(storage, method) {
  return !!storage && typeof storage[method] === "function";
}
function normalizeSettings(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const surfaces = {};
  const rawSurfaces = source.surfaces && typeof source.surfaces === "object" && !Array.isArray(source.surfaces) ? source.surfaces : {};
  for (const key of SURFACE_SETTING_KEYS) {
    surfaces[key] = normalizeSurfaceGroup(rawSurfaces[key]);
  }
  return {
    fallback: FALLBACK_MODES.includes(source.fallback) ? source.fallback : DEFAULT_SETTINGS.fallback,
    durationMs: normalizeNumber(source.durationMs, SETTINGS_RANGES.durationMs),
    scaleFrom: normalizeNumber(source.scaleFrom, SETTINGS_RANGES.scaleFrom),
    opacityFrom: normalizeNumber(source.opacityFrom, SETTINGS_RANGES.opacityFrom),
    surfaces
  };
}
function readSettings(storage = void 0) {
  const target = storage === void 0 ? resolveStorage() : storage;
  if (!supports(target, "getItem")) return defaults();
  try {
    const raw = target.getItem(SETTINGS_KEY);
    if (typeof raw !== "string" || raw === "") return defaults();
    return normalizeSettings(JSON.parse(raw));
  } catch {
    return defaults();
  }
}
function writeSettings(settings, storage = void 0) {
  const normalized = normalizeSettings(settings);
  const target = storage === void 0 ? resolveStorage() : storage;
  if (!supports(target, "setItem")) return false;
  try {
    target.setItem(SETTINGS_KEY, JSON.stringify(normalized));
    return true;
  } catch {
    return false;
  }
}

// packages/dsh-webui-transition-settings/src/settings-page.js
var import_react = __toESM(require("react"), 1);
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
var { useEffect, useState } = import_react.default;
var TARGETS = ["global", "menu", "dialog", "mask"];
var PARAMS = ["durationMs", "scaleFrom", "opacityFrom"];
var TARGET_LABEL_KEYS = {
  global: "targetGlobal",
  menu: "targetMenu",
  dialog: "targetDialog",
  mask: "targetMask"
};
var PARAM_LABEL_KEYS = {
  durationMs: "duration",
  scaleFrom: "scale",
  opacityFrom: "opacity"
};
var containerStyle = {
  maxWidth: 720,
  display: "flex",
  flexDirection: "column",
  gap: 12
};
var headerStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 4
};
var titleStyle = {
  fontSize: 16,
  fontWeight: 500,
  color: "var(--dsw-alias-label-primary)"
};
var descriptionStyle = {
  fontSize: 14,
  color: "var(--dsw-alias-label-secondary)"
};
var hintStyle = {
  fontSize: 12,
  color: "var(--dsw-alias-label-tertiary)"
};
var fieldsStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 12
};
var fieldWrapperStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 4
};
function fieldKey(target, param) {
  return target + ":" + param;
}
function withoutKey(map, key) {
  const next = { ...map };
  delete next[key];
  return next;
}
function textFor(value) {
  return typeof value === "number" ? String(value) : "";
}
function storedValue(settings, target, param) {
  if (target === "global") return settings[param];
  const group = settings.surfaces && settings.surfaces[target];
  return group ? group[param] : null;
}
function draftsFrom(settings) {
  const drafts = {};
  for (const target of TARGETS) {
    for (const param of PARAMS) {
      drafts[fieldKey(target, param)] = textFor(storedValue(settings, target, param));
    }
  }
  return drafts;
}
function clampToRange(value, range) {
  const clamped = Math.min(range.max, Math.max(range.min, value));
  const factor = 10 ** range.decimals;
  return Math.round(clamped * factor) / factor;
}
function withValue(settings, target, param, value) {
  if (target === "global") {
    return normalizeSettings({ ...settings, [param]: value });
  }
  const surfaces = { ...settings.surfaces };
  surfaces[target] = { ...surfaces[target], [param]: value };
  return normalizeSettings({ ...settings, surfaces });
}
function hintKeyFor(target, param) {
  if (param === "durationMs") {
    return target === "global" ? "durationHostHint" : "durationGlobalHint";
  }
  if (param === "scaleFrom") {
    if (target === "global") return "scaleDefaultHint";
    return target === "mask" ? "scaleMaskHint" : "scaleGlobalHint";
  }
  return target === "global" ? "opacityDefaultHint" : "opacityGlobalHint";
}
function createSettingsPage({ readSettings: readSettings2, writeSettings: writeSettings2, emit }) {
  function SettingsPage(props) {
    const t = typeof props?.t === "function" ? props.t : (key) => key;
    const [settings, setSettings] = useState(() => normalizeSettings(readSettings2()));
    const [drafts, setDrafts] = useState(() => draftsFrom(settings));
    const [invalid, setInvalid] = useState({});
    const [target, setTarget] = useState("global");
    const applySettings = (next) => {
      setSettings(next);
      setDrafts(draftsFrom(next));
      setInvalid({});
    };
    const writeField = (fieldTarget, param, value) => {
      const next = withValue(settings, fieldTarget, param, value);
      try {
        writeSettings2(next);
        emit(next);
      } catch {
      }
      applySettings(next);
    };
    const commit = (fieldTarget, param) => {
      const key = fieldKey(fieldTarget, param);
      const text = drafts[key] === void 0 ? "" : drafts[key];
      const trimmed = text.trim();
      const current = storedValue(settings, fieldTarget, param);
      if (trimmed === "") {
        if (current === null) {
          setDrafts((previous) => ({ ...previous, [key]: "" }));
          setInvalid((previous) => withoutKey(previous, key));
          return;
        }
        writeField(fieldTarget, param, null);
        return;
      }
      const parsed = Number(trimmed);
      if (!Number.isFinite(parsed)) {
        setDrafts((previous) => ({ ...previous, [key]: textFor(current) }));
        setInvalid((previous) => withoutKey(previous, key));
        return;
      }
      const value = clampToRange(parsed, SETTINGS_RANGES[param]);
      if (value === current) {
        setDrafts((previous) => ({ ...previous, [key]: textFor(current) }));
        setInvalid((previous) => withoutKey(previous, key));
        return;
      }
      writeField(fieldTarget, param, value);
    };
    const edit = (fieldTarget, param, text) => {
      const key = fieldKey(fieldTarget, param);
      const trimmed = String(text).trim();
      setDrafts((previous) => ({ ...previous, [key]: text }));
      setInvalid((previous) => {
        if (trimmed !== "" && !Number.isFinite(Number(trimmed))) {
          return { ...previous, [key]: true };
        }
        return withoutKey(previous, key);
      });
    };
    const changeFallback = (value) => {
      const next = normalizeSettings({ ...settings, fallback: value });
      try {
        writeSettings2(next);
        emit(next);
      } catch {
      }
      applySettings(next);
    };
    useEffect(() => {
      const onStorage = (event) => {
        if (event?.key !== null && event?.key !== SETTINGS_KEY) return;
        try {
          applySettings(normalizeSettings(readSettings2()));
        } catch {
        }
      };
      window.addEventListener("storage", onStorage);
      return () => window.removeEventListener("storage", onStorage);
    }, []);
    const items = TARGETS.map((value) => ({
      value,
      label: t(TARGET_LABEL_KEYS[value]),
      id: "dsh-webui-transition-target-" + value,
      panelId: "dsh-webui-transition-panel-" + value
    }));
    const fields = PARAMS.map((param) => {
      const key = fieldKey(target, param);
      const value = storedValue(settings, target, param);
      return import_react.default.createElement(
        "div",
        {
          key: param,
          style: fieldWrapperStyle,
          onKeyDown: (event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            commit(target, param);
          },
          onBlur: () => commit(target, param)
        },
        import_react.default.createElement(import_dsh_client_ui_primitives.SettingsValueField, {
          id: "dsh-webui-transition-" + target + "-" + param,
          label: t(PARAM_LABEL_KEYS[param]),
          hint: t(hintKeyFor(target, param)),
          numeric: param === "durationMs",
          placeholder: t("auto"),
          text: drafts[key] === void 0 ? "" : drafts[key],
          overridden: value !== null,
          overriddenLabel: t("custom"),
          resetLabel: t("useAuto"),
          invalid: !!invalid[key],
          invalidLabel: t("invalidNumber"),
          onEdit: (text) => edit(target, param, text),
          onReset: () => writeField(target, param, null)
        })
      );
    });
    return import_react.default.createElement(
      "div",
      { style: containerStyle },
      import_react.default.createElement(
        "div",
        { style: headerStyle },
        import_react.default.createElement("span", { style: titleStyle }, t("title")),
        import_react.default.createElement("span", { style: descriptionStyle }, t("description"))
      ),
      import_react.default.createElement(import_dsh_client_ui_primitives.SegmentedControl, {
        id: "dsh-webui-transition-fallback",
        label: t("fallbackTitle"),
        value: settings.fallback,
        options: [
          { value: "fade", label: t("fallbackFade") },
          { value: "pointer", label: t("fallbackPointer") }
        ],
        onChange: changeFallback
      }),
      import_react.default.createElement("span", { style: hintStyle }, t("hint")),
      import_react.default.createElement(
        "div",
        { style: headerStyle },
        import_react.default.createElement("span", { style: titleStyle }, t("paramsTitle")),
        import_react.default.createElement("span", { style: hintStyle }, t("paramsHint"))
      ),
      import_react.default.createElement(import_dsh_client_ui_primitives.SegmentedTabs, {
        items,
        value: target,
        onChange: (value) => {
          try {
            setTarget(value);
          } catch {
          }
        },
        label: t("paramsTitle")
      }),
      import_react.default.createElement(
        "div",
        {
          role: "tabpanel",
          id: "dsh-webui-transition-panel-" + target,
          "aria-labelledby": "dsh-webui-transition-target-" + target,
          style: fieldsStyle
        },
        fields
      )
    );
  }
  return SettingsPage;
}

// packages/dsh-webui-transition-settings/src/nav-icon.js
var import_react2 = __toESM(require("react"), 1);
function NavIcon({ size = 16 }) {
  return import_react2.default.createElement(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 16 16",
      fill: "none",
      "aria-hidden": "true"
    },
    import_react2.default.createElement("path", { stroke: "currentColor", strokeWidth: 1.3, strokeLinejoin: "round", strokeLinecap: "round", d: "M7.2 12.32L4.1 13.89L4.78 9.57L1.69 6.48L6.01 5.79L8 1.9L9.99 5.79L14.31 6.48L13.3 7.49" }),
    import_react2.default.createElement("path", { stroke: "currentColor", strokeWidth: 1, strokeLinecap: "round", d: "M11.12 9.47L14.35 9.47M9.15 11.43L12.4 11.43M10.47 13.38L13.69 13.38" })
  );
}

// packages/dsh-webui-transition-settings/src/locale.js
var NS = "webui-transition";
var zh = {
  nav: "\u8FC7\u6E21\u52A8\u753B",
  title: "\u8FC7\u6E21\u52A8\u753B",
  description: "\u53EF\u8C03\u914D\u52A8\u753B\u65F6\u957F\u3001\u521D\u59CB\u7F29\u653E\u4E0E\u900F\u660E\u5EA6\u8D77\u70B9\u3002",
  fallbackTitle: "\u65E0\u951A\u70B9\u56DE\u9000\u65B9\u5F0F",
  fallbackFade: "\u4EC5\u6DE1\u5165",
  fallbackPointer: "\u70B9\u51FB\u539F\u70B9",
  hint: "\u4EC5\u6DE1\u5165\uFF1A\u4E0D\u505A\u51E0\u4F55\u52A8\u753B\uFF0C\u53EA\u505A\u900F\u660E\u5EA6\u8FC7\u6E21\u3002\u70B9\u51FB\u539F\u70B9\uFF1A\u4EE5\u6700\u8FD1\u4E00\u6B21\u70B9\u51FB\u7684\u4F4D\u7F6E\u4F5C\u4E3A\u7F29\u653E\u539F\u70B9\u3002",
  paramsTitle: "\u52A8\u753B\u53C2\u6570",
  paramsHint: "\u5168\u5C40\u9ED8\u8BA4 + \u5206\u8868\u9762\u8986\u76D6\uFF1B\u5206\u8868\u9762\u7559\u7A7A\u5373\u8DDF\u968F\u5168\u5C40\uFF0C\u5168\u5C40\u7559\u7A7A\u5219\u81EA\u52A8\uFF08\u65F6\u957F\u8BFB\u5BBF\u4E3B token\uFF0C\u7F29\u653E/\u900F\u660E\u5EA6\u7528\u5185\u7F6E\u9ED8\u8BA4\uFF09\u3002",
  targetGlobal: "\u5168\u5C40",
  targetMenu: "\u83DC\u5355\u4E0E\u5217\u8868",
  targetDialog: "\u5BF9\u8BDD\u6846",
  targetMask: "\u906E\u7F69",
  duration: "\u52A8\u753B\u65F6\u957F\uFF08\u6BEB\u79D2\uFF09",
  scale: "\u521D\u59CB\u7F29\u653E",
  opacity: "\u900F\u660E\u5EA6\u8D77\u70B9",
  durationHostHint: "\u7559\u7A7A\u65F6\u8BFB\u53D6\u5BBF\u4E3B\u52A8\u753B\u65F6\u957F token\u3002",
  durationGlobalHint: "\u7559\u7A7A\u65F6\u8DDF\u968F\u5168\u5C40\uFF1B0 \u8868\u793A\u5173\u95ED\u8BE5\u8868\u9762\u7EC4\u7684\u8FC7\u6E21\u52A8\u753B\u3002",
  scaleDefaultHint: "\u7559\u7A7A\u65F6\u4F7F\u7528\u5185\u7F6E\u9ED8\u8BA4\uFF08\u7EA6 0.98\uFF09\u3002",
  scaleGlobalHint: "\u7559\u7A7A\u65F6\u8DDF\u968F\u5168\u5C40\u7F29\u653E\u3002",
  scaleMaskHint: "\u906E\u7F69\u9ED8\u8BA4\u56FA\u5B9A\u4E3A 1\uFF08\u5168\u5C40\u7F29\u653E\u4E0D\u4F5C\u7528\u4E8E\u906E\u7F69\uFF09\uFF0C\u7559\u7A7A\u65F6\u8DDF\u968F\u9ED8\u8BA4\u3002",
  opacityDefaultHint: "\u7559\u7A7A\u65F6\u4F7F\u7528\u5185\u7F6E\u9ED8\u8BA4 0\u3002",
  opacityGlobalHint: "\u7559\u7A7A\u65F6\u8DDF\u968F\u5168\u5C40\u900F\u660E\u5EA6\u3002",
  auto: "\u81EA\u52A8",
  custom: "\u5DF2\u81EA\u5B9A\u4E49",
  useAuto: "\u6539\u4E3A\u81EA\u52A8",
  invalidNumber: "\u8BF7\u8F93\u5165\u6709\u6548\u6570\u5B57\u3002"
};
var en = {
  nav: "Transitions",
  title: "Transitions",
  description: "Tune animation duration, initial scale, and opacity start.",
  fallbackTitle: "Fallback when no anchor",
  fallbackFade: "Fade only",
  fallbackPointer: "Pointer origin",
  hint: "Fade only: no geometric animation, opacity only. Pointer origin: scale from the most recent pointer position.",
  paramsTitle: "Animation parameters",
  paramsHint: "Global defaults with per-surface overrides. A surface field left empty follows the global value; a global field left empty is automatic (duration from the host token, scale/opacity from built-in defaults).",
  targetGlobal: "Global",
  targetMenu: "Menus & lists",
  targetDialog: "Dialogs",
  targetMask: "Masks",
  duration: "Duration (ms)",
  scale: "Initial scale",
  opacity: "Opacity start",
  durationHostHint: "Leave empty to read the host's animation duration token.",
  durationGlobalHint: "Leave empty to follow the global value; 0 disables the transition for this surface group.",
  scaleDefaultHint: "Leave empty to use the built-in default (about 0.98).",
  scaleGlobalHint: "Leave empty to follow the global scale.",
  scaleMaskHint: "Masks are fixed at 1 by default (the global scale does not apply to masks); leave empty to use that default.",
  opacityDefaultHint: "Leave empty to use the built-in default of 0.",
  opacityGlobalHint: "Leave empty to follow the global opacity.",
  auto: "Auto",
  custom: "Custom",
  useAuto: "Use auto",
  invalidNumber: "Enter a valid number."
};

// packages/dsh-webui-transition-settings/src/panel-marker.js
var SETTINGS_PANEL_SELECTOR = '[role="dialog"][data-shortcut-modal="settings"]';
function resolveDocument(options) {
  if (options.document) return options.document;
  try {
    return typeof globalThis !== "undefined" && globalThis.document ? globalThis.document : null;
  } catch (error) {
    return null;
  }
}
function resolveObserverCtor(options) {
  if (typeof options.MutationObserver === "function") return options.MutationObserver;
  try {
    return typeof globalThis !== "undefined" && typeof globalThis.MutationObserver === "function" ? globalThis.MutationObserver : null;
  } catch (error) {
    return null;
  }
}
function markAdded(node) {
  if (!node || node.nodeType !== 1) return;
  try {
    if (node.matches(SETTINGS_PANEL_SELECTOR)) {
      node.setAttribute(ORIGIN_MARKER_ATTRIBUTE, ORIGIN_MARKER_CENTER);
    }
    for (const panel of node.querySelectorAll(SETTINGS_PANEL_SELECTOR)) {
      panel.setAttribute(ORIGIN_MARKER_ATTRIBUTE, ORIGIN_MARKER_CENTER);
    }
  } catch (error) {
  }
}
function handleRecords(records) {
  for (const record of records) {
    try {
      if (!record || record.type !== "childList" || !record.addedNodes) continue;
      for (const node of Array.from(record.addedNodes)) markAdded(node);
    } catch (error) {
    }
  }
}
function startPanelMarker(options = {}) {
  const documentNode = resolveDocument(options);
  const ObserverCtor = resolveObserverCtor(options);
  const root = documentNode && documentNode.body;
  if (!root || typeof ObserverCtor !== "function") return () => {
  };
  let observer = null;
  try {
    observer = new ObserverCtor(handleRecords);
    observer.observe(root, { childList: true, subtree: true });
  } catch (error) {
    try {
      if (observer) observer.disconnect();
    } catch (disconnectError) {
    }
    return () => {
    };
  }
  return function stop() {
    if (!observer) return;
    try {
      observer.disconnect();
    } catch (error) {
    }
    observer = null;
  };
}

// packages/dsh-webui-transition-settings/src/browser.js
var inject = ["slots", "locale"];
var SECTION_ID = "webui-transition";
function apply(ctx) {
  const t = ctx.locale.bind(NS);
  const Page = createSettingsPage({
    readSettings,
    writeSettings,
    emit: (payload) => ctx.emit(SETTINGS_EVENT, payload)
  });
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "webui-transition-settings: dictionaries");
  ctx.effect(
    () => ctx.slots.inject(
      "settings.section",
      () => ctx.slots.register(
        {
          name: "settings.section",
          id: SECTION_ID,
          order: 25,
          label: () => t("nav"),
          locale: NS
        },
        Page
      )
    ),
    "webui-transition-settings: page"
  );
  ctx.effect(
    () => ctx.slots.inject(
      "settings.section.icon",
      () => ctx.slots.register({ name: "settings.section.icon", id: SECTION_ID }, NavIcon)
    ),
    "webui-transition-settings: nav icon"
  );
  ctx.effect(
    () => startPanelMarker(),
    "webui-transition-settings: settings panel origin marker"
  );
}

    return module.exports;
  },
});
