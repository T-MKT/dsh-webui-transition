/**
 * test/panel-marker.test.mjs — src/panel-marker.js 的源级打标行为。
 *
 * 直接调用 startPanelMarker() 观察 document.body：插入 buildSettingsOverlay() 后
 * panel 带 `data-dsh-transition-origin="center"` 标记；插入 buildGlassPanel()
 * 不打标；stop() 断开 observer 后不再打标。
 *
 * jsdom 与 DOM fixture 全部复用 test/helpers/env.mjs；MutationObserver 回调是微任务，
 * 用 nextTask()（宏任务）等它落地。
 *
 * 依据：.agents/plan/v1.2.0/plugin-page-config.md §3.2.1 Agent B。
 */

import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";

import {
  buildGlassPanel,
  buildSettingsOverlay,
  disposeEnvironment,
  document,
  nextTask,
  resetEnvironment,
} from "./helpers/env.mjs";
import { ORIGIN_MARKER_ATTRIBUTE, ORIGIN_MARKER_CENTER } from "../src/marker.js";
import { startPanelMarker } from "../src/panel-marker.js";

// 所有用例共用同一个 jsdom 文档：上一个用例若没 stop，残留 observer 会继续响应
// 后续 DOM 插入，污染“stop 后不打标”用例。beforeEach 兜底断开并复位环境。
let stop = null;

function disconnect() {
  if (!stop) return;
  stop();
  stop = null;
}

beforeEach(() => {
  disconnect();
  resetEnvironment();
});

after(() => {
  disconnect();
  disposeEnvironment();
});

test("插入设置面板后给 panel 打中心原点标记", async () => {
  stop = startPanelMarker();

  const { overlay, panel } = buildSettingsOverlay();
  document.body.append(overlay);
  // MutationObserver 回调是微任务，nextTask 的宏任务排在它之后。
  await nextTask();

  assert.equal(
    panel.getAttribute(ORIGIN_MARKER_ATTRIBUTE),
    ORIGIN_MARKER_CENTER,
    "设置面板必须带中心缩放标记",
  );
});

test("插入非设置表面不打中心原点标记", async () => {
  stop = startPanelMarker();

  const panel = buildGlassPanel();
  document.body.append(panel);
  await nextTask();

  assert.equal(panel.getAttribute(ORIGIN_MARKER_ATTRIBUTE), null, "非设置表面不应被打标");
});

test("stop() 之后插入设置面板不再打标", async () => {
  stop = startPanelMarker();
  disconnect();

  const { overlay, panel } = buildSettingsOverlay();
  document.body.append(overlay);
  await nextTask();

  assert.equal(panel.getAttribute(ORIGIN_MARKER_ATTRIBUTE), null, "observer 断开后不应再打标");
});
