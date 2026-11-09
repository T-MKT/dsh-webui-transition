/**
 * packages/dsh-webui-transition-settings/src/panel-marker.js — 给设置面板打表面级中心原点标记。
 *
 * 设置插件启动时观察 document.body（childList + subtree）；宿主每次打开设置弹窗都会
 * 把 `[role="dialog"][data-shortcut-modal="settings"]` 面板插到 body 下，命中即打
 * `data-dsh-transition-origin="center"` 标记。主插件读标记后以面板正中心为
 * transform-origin 缩放，设置插件不直接参与动画。
 *
 * observer 回调是微任务，早于主插件读取几何的 rAF flush，标记不会晚于入场第一帧；
 * 面板关闭即卸载，标记无需清理，stop() 只断开 observer。
 * 观察 / 回调 / 停止的异常一律就地吞掉，不向调用方抛错。
 *
 * 依据：.agents/plan/v1.0.0/settings-center-origin.md §2（冻结签名）。
 */

import { ORIGIN_MARKER_ATTRIBUTE, ORIGIN_MARKER_CENTER } from "./contract.js";

export const SETTINGS_PANEL_SELECTOR = '[role="dialog"][data-shortcut-modal="settings"]';

// 缺省懒取 globalThis（模块求值期不读全局）；访问抛错视为不可用。
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
    return typeof globalThis !== "undefined" && typeof globalThis.MutationObserver === "function"
      ? globalThis.MutationObserver
      : null;
  } catch (error) {
    return null;
  }
}

// 单个新增节点：自身命中或后代命中都打标；异常不影响其它节点。
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
    // 单个节点打标失败不阻断其它节点
  }
}

function handleRecords(records) {
  for (const record of records) {
    try {
      if (!record || record.type !== "childList" || !record.addedNodes) continue;
      for (const node of Array.from(record.addedNodes)) markAdded(node);
    } catch (error) {
      // 单条 record 失败不阻断其它 record
    }
  }
}

// 返回 stop(): void；document / body / MutationObserver 任一不可用时为空 stop。
export function startPanelMarker(options = {}) {
  const documentNode = resolveDocument(options);
  const ObserverCtor = resolveObserverCtor(options);
  const root = documentNode && documentNode.body;
  if (!root || typeof ObserverCtor !== "function") return () => {};

  let observer = null;
  try {
    observer = new ObserverCtor(handleRecords);
    observer.observe(root, { childList: true, subtree: true });
  } catch (error) {
    try {
      if (observer) observer.disconnect();
    } catch (disconnectError) {
      // 忽略 observer 清理错误
    }
    return () => {};
  }

  return function stop() {
    if (!observer) return;
    try {
      observer.disconnect();
    } catch (error) {
      // 忽略 observer 清理错误
    }
    observer = null;
  };
}
