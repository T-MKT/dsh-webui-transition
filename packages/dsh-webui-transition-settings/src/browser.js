/**
 * packages/dsh-webui-transition-settings/src/browser.js — 设置插件浏览器半区入口。
 *
 * 注册「过渡动画」设置页（`settings.section`，Settings 弹窗侧栏）与运行时文案。
 * 设置变更写 localStorage 后通过 Cordis 事件通知主插件（同标签页即时生效）；
 * 主插件不依赖本插件即可运行（读不到设置时用默认 fade）。
 *
 * 依据：.agents/plan/v0.3.0/origin-aware-and-settings.md §2.7 / §3.6.1。
 */

import { SETTINGS_EVENT, readSettings, writeSettings } from "./contract.js";
import { createSettingsPage } from "./settings-page.js";
import { NS, zh, en } from "./locale.js";

export const inject = ["slots", "locale"];

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
            id: "webui-transition",
            order: 25,
            label: () => t("nav"),
            locale: NS,
          },
          Page,
        ),
      ),
    "webui-transition-settings: page",
  );
}
