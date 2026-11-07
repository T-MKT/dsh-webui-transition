/**
 * packages/dsh-webui-transition-settings/src/browser.js — 设置插件浏览器半区入口。
 *
 * 注册「过渡动画」设置页（`settings.section`，Settings 弹窗侧栏）、
 * 该页的侧栏导航图标（`settings.section.icon`）与运行时文案。
 * 设置变更写 localStorage 后通过 Cordis 事件通知主插件（同标签页即时生效）；
 * 主插件不依赖本插件即可运行（读不到设置时用默认 fade）。
 *
 * 依据：.agents/plan/v0.3.0/origin-aware-and-settings.md §2.7 / §3.6.1（页面与文案）；
 * 导航图标见 dsh 0.2.2-alpha.3 的 `settings.section.icon` slot。
 */

import { SETTINGS_EVENT, readSettings, writeSettings } from "./contract.js";
import { createSettingsPage } from "./settings-page.js";
import { NavIcon } from "./nav-icon.js";
import { NS, zh, en } from "./locale.js";

export const inject = ["slots", "locale"];

// 导航图标按 section id 寻址：两处注册必须使用同一个 id。
const SECTION_ID = "webui-transition";

export function apply(ctx) {
  const t = ctx.locale.bind(NS);
  const Page = createSettingsPage({
    readSettings,
    writeSettings,
    emit: (payload) => ctx.emit(SETTINGS_EVENT, payload),
  });
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "webui-transition-settings: dictionaries");
  ctx.effect(
    () =>
      ctx.slots.inject("settings.section", () =>
        ctx.slots.register(
          {
            name: "settings.section",
            id: SECTION_ID,
            order: 25,
            label: () => t("nav"),
            locale: NS,
          },
          Page,
        ),
      ),
    "webui-transition-settings: page",
  );
  ctx.effect(
    () =>
      ctx.slots.inject("settings.section.icon", () =>
        ctx.slots.register({ name: "settings.section.icon", id: SECTION_ID }, NavIcon),
      ),
    "webui-transition-settings: nav icon",
  );
}
