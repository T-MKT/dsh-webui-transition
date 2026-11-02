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

// packages/dsh-webui-transition-settings/src/browser.js
var inject = ["slots", "locale"];
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
          id: "webui-transition",
          order: 25,
          label: () => t("nav"),
          locale: NS
        },
        Page
      )
    ),
    "webui-transition-settings: page"
  );
}

    return module.exports;
  },
});
