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
var DEFAULT_SETTINGS = Object.freeze({ fallback: "fade" });
var ORIGIN_MARKER_ATTRIBUTE = "data-dsh-transition-origin";
var ORIGIN_MARKER_CENTER = "center";
function defaults() {
  return { fallback: DEFAULT_SETTINGS.fallback };
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
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaults();
  if (!FALLBACK_MODES.includes(value.fallback)) return defaults();
  return { fallback: value.fallback };
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
function createSettingsPage({ readSettings: readSettings2, writeSettings: writeSettings2, emit }) {
  function SettingsPage(props) {
    const t = typeof props?.t === "function" ? props.t : (key) => key;
    const [fallback, setFallback] = useState(() => readSettings2().fallback);
    useEffect(() => {
      const onStorage = (event) => {
        if (event?.key !== null && event?.key !== SETTINGS_KEY) return;
        try {
          setFallback(readSettings2().fallback);
        } catch {
        }
      };
      window.addEventListener("storage", onStorage);
      return () => window.removeEventListener("storage", onStorage);
    }, []);
    const handleChange = (value) => {
      try {
        setFallback(value);
        writeSettings2({ fallback: value });
        emit({ fallback: value });
      } catch {
      }
    };
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
        label: t("title"),
        value: fallback,
        options: [
          { value: "fade", label: t("fallbackFade") },
          { value: "pointer", label: t("fallbackPointer") }
        ],
        onChange: handleChange
      }),
      import_react.default.createElement("span", { style: hintStyle }, t("hint"))
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
  description: "\u65E0\u6CD5\u63A8\u65AD\u89E6\u53D1\u5143\u7D20\u65F6\uFF0C\u5F39\u5C42\u5982\u4F55\u5165\u573A\u3002",
  fallbackFade: "\u4EC5\u6DE1\u5165",
  fallbackPointer: "\u70B9\u51FB\u539F\u70B9",
  hint: "\u4EC5\u6DE1\u5165\uFF1A\u4E0D\u505A\u51E0\u4F55\u52A8\u753B\uFF0C\u53EA\u505A\u900F\u660E\u5EA6\u8FC7\u6E21\u3002\u70B9\u51FB\u539F\u70B9\uFF1A\u4EE5\u6700\u8FD1\u4E00\u6B21\u70B9\u51FB\u7684\u4F4D\u7F6E\u4F5C\u4E3A\u7F29\u653E\u539F\u70B9\u3002"
};
var en = {
  nav: "Transitions",
  title: "Transitions",
  description: "How overlays animate in when the trigger element cannot be inferred.",
  fallbackFade: "Fade only",
  fallbackPointer: "Pointer origin",
  hint: "Fade only: no geometric animation, opacity only. Pointer origin: scale from the most recent pointer position."
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
