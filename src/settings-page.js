/**
 * src/settings-page.js — 「过渡动画」配置页（插件详情页内嵌表单）。
 *
 * createSettingsPage 返回一个 React 组件：标题 / 说明 + 回退方式 `SegmentedControl`
 * + 目标 `SegmentedTabs`（全局 / 菜单与列表 / 对话框 / 遮罩）+ 每个目标的三个可调
 * 数字字段（时长 / 初始缩放 / 透明度起点）。组件从 props.t 取文案（由 shell 按 slot
 * 的 locale 注入；缺失时退化为 key 本身）。
 *
 * 数字字段语义（.agents/plan/v1.1.0/animation-params.md §2.5）：
 * - 空字符串 = null（自动）：跟随全局 / 内置默认；
 * - 非有限数 = invalid：不写入，失焦时回退到已存值；
 * - 有限数：按 SETTINGS_RANGES 四舍五入并 clamp 后写入；
 * - Enter 与失焦提交（SettingsValueField 没有 onBlur/onKeyDown，由外层 wrapper 捕获）。
 *
 * 页面的全部副作用都收敛在动作里并 try/catch —— 组件 render 抛错会被 renderer
 * 静默退役该设置条目。布局只用 `--dsw-*` token 的内联样式，不手写分段控件：
 * 分段控件来自 shell 的 baseline 共享模块 `@deepseek-ai/dsh-client-ui-primitives`。
 *
 * 用 React.createElement 而非 JSX，使本文件可被 Node 直接 import 做渲染测试。
 * 依据：.agents/plan/v0.3.0/origin-aware-and-settings.md §2.4 / §2.7 / §3.6.1；
 * 动画参数见 .agents/plan/v1.1.0/animation-params.md §2.4 / §2.5；
 * 迁入根包并改为 plugins.bundle.config 见 .agents/plan/v1.2.0/plugin-page-config.md §2.2。
 */

import React from "react";
import {
  SegmentedControl,
  SegmentedTabs,
  SettingsValueField,
} from "@deepseek-ai/dsh-client-ui-primitives";

import { SETTINGS_KEY, SETTINGS_RANGES, normalizeSettings } from "./settings.js";

const { useEffect, useState } = React;

// 目标顺序即展示顺序；分表面组与 settings.js 的 SURFACE_SETTING_KEYS 一致。
const TARGETS = ["global", "menu", "dialog", "mask"];
const PARAMS = ["durationMs", "scaleFrom", "opacityFrom"];

const TARGET_LABEL_KEYS = {
  global: "targetGlobal",
  menu: "targetMenu",
  dialog: "targetDialog",
  mask: "targetMask",
};

const PARAM_LABEL_KEYS = {
  durationMs: "duration",
  scaleFrom: "scale",
  opacityFrom: "opacity",
};

const containerStyle = {
  maxWidth: 720,
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const headerStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const titleStyle = {
  fontSize: 16,
  fontWeight: 500,
  color: "var(--dsw-alias-label-primary)",
};

const descriptionStyle = {
  fontSize: 14,
  color: "var(--dsw-alias-label-secondary)",
};

const hintStyle = {
  fontSize: 12,
  color: "var(--dsw-alias-label-tertiary)",
};

const fieldsStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const fieldWrapperStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
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

// 与 settings.js 同规则：先按范围 clamp，再按 decimals 四舍五入。
function clampToRange(value, range) {
  const clamped = Math.min(range.max, Math.max(range.min, value));
  const factor = 10 ** range.decimals;
  return Math.round(clamped * factor) / factor;
}

// 深拷贝一层后写入一个字段，交给 normalizeSettings 生成完整形状。
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

/**
 * @param {{
 *   readSettings: () => object,
 *   writeSettings: (settings: object) => boolean,
 *   emit: (payload: object) => void,
 * }} deps
 * @returns {React.ComponentType<{ t?: (key: string) => string }>}
 */
export function createSettingsPage({ readSettings, writeSettings, emit }) {
  function SettingsPage(props) {
    const t = typeof props?.t === "function" ? props.t : (key) => key;
    const [settings, setSettings] = useState(() => normalizeSettings(readSettings()));
    const [drafts, setDrafts] = useState(() => draftsFrom(settings));
    const [invalid, setInvalid] = useState({});
    const [target, setTarget] = useState("global");

    // 一次设置变更：更新本地快照、重新同步全部草稿、清空 invalid。
    const applySettings = (next) => {
      setSettings(next);
      setDrafts(draftsFrom(next));
      setInvalid({});
    };

    // 写 storage + 广播 + 本地状态；失败不外抛（页面不能因一次写入被退役）。
    const writeField = (fieldTarget, param, value) => {
      const next = withValue(settings, fieldTarget, param, value);
      try {
        writeSettings(next);
        emit(next);
      } catch {
        // 存储 / 事件失败不影响本地 UI
      }
      applySettings(next);
    };

    const commit = (fieldTarget, param) => {
      const key = fieldKey(fieldTarget, param);
      const text = drafts[key] === undefined ? "" : drafts[key];
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
        // 非法输入不写：失焦时回退到已存值。
        setDrafts((previous) => ({ ...previous, [key]: textFor(current) }));
        setInvalid((previous) => withoutKey(previous, key));
        return;
      }

      const value = clampToRange(parsed, SETTINGS_RANGES[param]);
      if (value === current) {
        // 值未变化：只把草稿规范化为规范文本，不写 storage、不广播。
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
        writeSettings(next);
        emit(next);
      } catch {
        // 同上：失败不影响本地 UI
      }
      applySettings(next);
    };

    // 跨标签页同步：同一标签页的即时生效走 Cordis 事件，storage 只做兜底。
    useEffect(() => {
      const onStorage = (event) => {
        if (event?.key !== null && event?.key !== SETTINGS_KEY) return;
        try {
          applySettings(normalizeSettings(readSettings()));
        } catch {
          // 读取失败保持当前值（契约本身已兜底默认值）。
        }
      };
      window.addEventListener("storage", onStorage);
      return () => window.removeEventListener("storage", onStorage);
    }, []);

    const items = TARGETS.map((value) => ({
      value: value,
      label: t(TARGET_LABEL_KEYS[value]),
      id: "dsh-webui-transition-target-" + value,
      panelId: "dsh-webui-transition-panel-" + value,
    }));

    const fields = PARAMS.map((param) => {
      const key = fieldKey(target, param);
      const value = storedValue(settings, target, param);
      return React.createElement(
        "div",
        {
          key: param,
          style: fieldWrapperStyle,
          onKeyDown: (event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            commit(target, param);
          },
          onBlur: () => commit(target, param),
        },
        React.createElement(SettingsValueField, {
          id: "dsh-webui-transition-" + target + "-" + param,
          label: t(PARAM_LABEL_KEYS[param]),
          hint: t(hintKeyFor(target, param)),
          numeric: param === "durationMs",
          placeholder: t("auto"),
          text: drafts[key] === undefined ? "" : drafts[key],
          overridden: value !== null,
          overriddenLabel: t("custom"),
          resetLabel: t("useAuto"),
          invalid: !!invalid[key],
          invalidLabel: t("invalidNumber"),
          onEdit: (text) => edit(target, param, text),
          onReset: () => writeField(target, param, null),
        }),
      );
    });

    return React.createElement(
      "div",
      { style: containerStyle },
      React.createElement(
        "div",
        { style: headerStyle },
        React.createElement("span", { style: titleStyle }, t("title")),
        React.createElement("span", { style: descriptionStyle }, t("description")),
      ),
      React.createElement(SegmentedControl, {
        id: "dsh-webui-transition-fallback",
        label: t("fallbackTitle"),
        value: settings.fallback,
        options: [
          { value: "fade", label: t("fallbackFade") },
          { value: "pointer", label: t("fallbackPointer") },
        ],
        onChange: changeFallback,
      }),
      React.createElement("span", { style: hintStyle }, t("hint")),
      React.createElement(
        "div",
        { style: headerStyle },
        React.createElement("span", { style: titleStyle }, t("paramsTitle")),
        React.createElement("span", { style: hintStyle }, t("paramsHint")),
      ),
      React.createElement(SegmentedTabs, {
        items: items,
        value: target,
        onChange: (value) => {
          try {
            setTarget(value);
          } catch {
            // 目标切换失败不外抛
          }
        },
        label: t("paramsTitle"),
      }),
      React.createElement(
        "div",
        {
          role: "tabpanel",
          id: "dsh-webui-transition-panel-" + target,
          "aria-labelledby": "dsh-webui-transition-target-" + target,
          style: fieldsStyle,
        },
        fields,
      ),
    );
  }

  return SettingsPage;
}
