/**
 * packages/dsh-webui-transition-settings/src/settings-page.js — 「过渡动画」设置页。
 *
 * createSettingsPage 返回一个 React 组件：标题 / 说明 + `SegmentedControl`
 * （无锚点时的回退方式：仅淡入 / 点击原点）+ hint。组件从 props.t 取文案
 * （由 shell 按 slot 的 locale 注入；缺失时退化为 key 本身）。
 *
 * 页面的全部副作用都收敛在动作里并 try/catch —— 组件 render 抛错会被 renderer
 * 静默退役该设置条目。布局只用 `--dsw-*` token 的内联样式，不手写分段控件：
 * 分段控件来自 shell 的 baseline 共享模块 `@deepseek-ai/dsh-client-ui-primitives`。
 *
 * 用 React.createElement 而非 JSX，使本文件可被 Node 直接 import 做渲染测试。
 * 依据：.agents/plan/v0.3.0/origin-aware-and-settings.md §2.4 / §2.7 / §3.6.1。
 */

import React from "react";
import { SegmentedControl } from "@deepseek-ai/dsh-client-ui-primitives";

import { SETTINGS_KEY } from "./contract.js";

const { useEffect, useState } = React;

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

/**
 * @param {{
 *   readSettings: () => { fallback: "fade" | "pointer" },
 *   writeSettings: (settings: { fallback: "fade" | "pointer" }) => boolean,
 *   emit: (payload: { fallback: "fade" | "pointer" }) => void,
 * }} deps
 * @returns {React.ComponentType<{ t?: (key: string) => string }>}
 */
export function createSettingsPage({ readSettings, writeSettings, emit }) {
  function SettingsPage(props) {
    const t = typeof props?.t === "function" ? props.t : (key) => key;
    const [fallback, setFallback] = useState(() => readSettings().fallback);

    // 跨标签页同步：同一标签页的即时生效走 Cordis 事件，storage 只做兜底。
    useEffect(() => {
      const onStorage = (event) => {
        if (event?.key !== null && event?.key !== SETTINGS_KEY) return;
        try {
          setFallback(readSettings().fallback);
        } catch {
          // 读取失败保持当前值（契约本身已兜底默认值）。
        }
      };
      window.addEventListener("storage", onStorage);
      return () => window.removeEventListener("storage", onStorage);
    }, []);

    const handleChange = (value) => {
      try {
        setFallback(value);
        writeSettings({ fallback: value });
        emit({ fallback: value });
      } catch {
        // 任何存储 / 事件失败都不外抛：保证设置页不会因一次点击被退役。
      }
    };

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
        label: t("title"),
        value: fallback,
        options: [
          { value: "fade", label: t("fallbackFade") },
          { value: "pointer", label: t("fallbackPointer") },
        ],
        onChange: handleChange,
      }),
      React.createElement("span", { style: hintStyle }, t("hint")),
    );
  }

  return SettingsPage;
}
