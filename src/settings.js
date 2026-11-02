/**
 * src/settings.js — 主包侧设置契约：localStorage 键 / 事件名 / 合法回退模式 / 读写清洗。
 *
 * 主包（本文件）与设置插件包 `packages/dsh-webui-transition-settings/src/contract.js`
 * 各自独立实现同一份契约，测试保证两者常量与行为一致（防止契约漂移）。
 *
 * 全部延迟访问 `globalThis.localStorage`：模块求值期不读全局；所有 storage 访问
 * 都包在 try/catch 中，任何异常一律回落到默认设置 fade。
 * 计划出处：.agents/plan/v0.3.0/origin-aware-and-settings.md §2.6 / §2.7（Agent A）。
 */

import { globalScope } from "./utils.js";

export const SETTINGS_KEY = "dsh.webui-transition.settings.v1";
export const SETTINGS_EVENT = "dsh-webui-transition/settings";
export const FALLBACK_MODES = Object.freeze(["fade", "pointer"]);
export const DEFAULT_SETTINGS = Object.freeze({ fallback: "fade" });

function defaults() {
  return { fallback: DEFAULT_SETTINGS.fallback };
}

// 懒取 localStorage（getter 本身也可能抛错，如隐私模式/禁用存储）。
function resolveStorage() {
  try {
    const scope = globalScope();
    return scope ? scope.localStorage : null;
  } catch (error) {
    return null;
  }
}

// 非对象 / null / 数组 / fallback 非法 → 默认；合法 → 只保留 fallback。始终返回新对象。
export function normalizeSettings(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaults();
  if (!FALLBACK_MODES.includes(value.fallback)) return defaults();
  return { fallback: value.fallback };
}

export function readSettings(storage = undefined) {
  const target = storage === undefined ? resolveStorage() : storage;
  if (!target || typeof target.getItem !== "function") return defaults();
  try {
    const raw = target.getItem(SETTINGS_KEY);
    if (typeof raw !== "string" || !raw) return defaults();
    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      return defaults();
    }
    return normalizeSettings(parsed);
  } catch (error) {
    return defaults();
  }
}

export function writeSettings(settings, storage = undefined) {
  const normalized = normalizeSettings(settings);
  const target = storage === undefined ? resolveStorage() : storage;
  if (!target || typeof target.setItem !== "function") return false;
  try {
    target.setItem(SETTINGS_KEY, JSON.stringify(normalized));
    return true;
  } catch (error) {
    return false;
  }
}
