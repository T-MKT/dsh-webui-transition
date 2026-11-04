/**
 * packages/dsh-webui-transition-settings/src/contract.js — 设置契约（跨包冻结）。
 *
 * 与主包 src/settings.js 契约一致，由 test/contract.test.mjs 防漂移：两个包各自
 * 维护一份独立实现（设置包不得从根包 src/ 跨包 import），常量取值与
 * normalizeSettings / readSettings / writeSettings 行为必须完全相同。
 *
 * 存储形态：localStorage[SETTINGS_KEY] = JSON 文本 { "fallback": "fade" | "pointer" }。
 * 读取失败（storage 不可用 / 访问抛错 / 坏 JSON / 字段非法）一律回退默认 fade，
 * 不向调用方抛错；normalize 始终返回新的 { fallback } 对象，冻结的 DEFAULT_SETTINGS
 * 只作为默认值来源，不直接暴露给调用方（与主包行为一致）。
 * 依据：.agents/plan/v0.3.0/origin-aware-and-settings.md §2.6 / §2.7。
 */

export const SETTINGS_KEY = "dsh.webui-transition.settings.v1";
export const SETTINGS_EVENT = "dsh-webui-transition/settings";
export const FALLBACK_MODES = Object.freeze(["fade", "pointer"]);
export const DEFAULT_SETTINGS = Object.freeze({ fallback: "fade" });

function defaults() {
  return { fallback: DEFAULT_SETTINGS.fallback };
}

// storage 缺省懒取 globalThis.localStorage；getter 本身也可能抛错（隐私模式/禁用存储）。
function resolveStorage() {
  try {
    return typeof globalThis !== "undefined" ? globalThis.localStorage : null;
  } catch {
    return null;
  }
}

// 只有同时具备目标方法的对象才算可用 storage（null / 缺方法一律视为不可用）。
function supports(storage, method) {
  return !!storage && typeof storage[method] === "function";
}

// 非对象 / null / 数组 / 非法 fallback → 默认；合法 → 只保留 fallback。始终返回新对象。
export function normalizeSettings(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaults();
  if (!FALLBACK_MODES.includes(value.fallback)) return defaults();
  return { fallback: value.fallback };
}

// 读取设置：任何失败（不可用 / 抛错 / 坏 JSON / 非法字段）都回退默认。
export function readSettings(storage = undefined) {
  const target = storage === undefined ? resolveStorage() : storage;
  if (!supports(target, "getItem")) return defaults();
  try {
    const raw = target.getItem(SETTINGS_KEY);
    if (typeof raw !== "string" || raw === "") return defaults();
    return normalizeSettings(JSON.parse(raw));
  } catch {
    return defaults();
  }
}

// 写入设置：normalize 后以 JSON 写入；成功 true，storage 不可用或异常 false。
export function writeSettings(settings, storage = undefined) {
  const normalized = normalizeSettings(settings);
  const target = storage === undefined ? resolveStorage() : storage;
  if (!supports(target, "setItem")) return false;
  try {
    target.setItem(SETTINGS_KEY, JSON.stringify(normalized));
    return true;
  } catch {
    return false;
  }
}
