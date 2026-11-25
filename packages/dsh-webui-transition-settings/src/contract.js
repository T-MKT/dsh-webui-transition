/**
 * packages/dsh-webui-transition-settings/src/contract.js — 设置契约（跨包冻结）。
 *
 * 与主包 src/settings.js 契约一致，由 test/contract.test.mjs 防漂移：两个包各自
 * 维护一份独立实现（设置包不得从根包 src/ 跨包 import），常量取值与
 * normalizeSettings / readSettings / writeSettings 行为必须完全相同。
 *
 * 存储形态：localStorage[SETTINGS_KEY] = JSON 文本
 * `{ fallback, durationMs, scaleFrom, opacityFrom, surfaces: { menu, dialog, mask } }`；
 * 数字字段 null 表示「自动」。读取失败（storage 不可用 / 访问抛错 / 坏 JSON）一律
 * 回退默认；字段逐项清洗，一个字段非法不清空其它字段。
 *
 * 另导出表面级中心原点标记常量（ORIGIN_MARKER_ATTRIBUTE / ORIGIN_MARKER_CENTER）：
 * 表面所属插件给表面元素打标记，主插件据此无条件以表面正中心为 transform-origin 缩放。
 *
 * 依据：.agents/plan/v0.3.0/origin-aware-and-settings.md §2.6 / §2.7；
 * 标记常量见 .agents/plan/v1.0.0/settings-center-origin.md §2；
 * 动画参数见 .agents/plan/v1.1.0/animation-params.md §2.4。
 */

export const SETTINGS_KEY = "dsh.webui-transition.settings.v1";
export const SETTINGS_EVENT = "dsh-webui-transition/settings";
export const FALLBACK_MODES = Object.freeze(["fade", "pointer"]);
// 设置页的分表面组：一个组同时作用于内部 menu / listbox 两个 kind。
export const SURFACE_SETTING_KEYS = Object.freeze(["menu", "dialog", "mask"]);

// 三个可调参数的范围；decimals 是写入前的四舍五入位数。
export const SETTINGS_RANGES = Object.freeze({
  durationMs: Object.freeze({ min: 0, max: 1000, decimals: 0 }),
  scaleFrom: Object.freeze({ min: 0.5, max: 1, decimals: 2 }),
  opacityFrom: Object.freeze({ min: 0, max: 1, decimals: 2 }),
});

// null = 自动（跟随上一级，最终回落到 token / SURFACE_DEFS）。
export const DEFAULT_SETTINGS = Object.freeze({
  fallback: "fade",
  durationMs: null,
  scaleFrom: null,
  opacityFrom: null,
  surfaces: Object.freeze({
    menu: Object.freeze({ durationMs: null, scaleFrom: null, opacityFrom: null }),
    dialog: Object.freeze({ durationMs: null, scaleFrom: null, opacityFrom: null }),
    mask: Object.freeze({ durationMs: null, scaleFrom: null, opacityFrom: null }),
  }),
});

// 表面级中心原点标记契约：与主包 src/marker.js 同值、独立实现（跨包不 import），
// 由 test/contract.test.mjs 防漂移。
export const ORIGIN_MARKER_ATTRIBUTE = "data-dsh-transition-origin";
export const ORIGIN_MARKER_CENTER = "center";

function defaults() {
  const surfaces = {};
  for (const key of SURFACE_SETTING_KEYS) {
    surfaces[key] = { durationMs: null, scaleFrom: null, opacityFrom: null };
  }
  return {
    fallback: DEFAULT_SETTINGS.fallback,
    durationMs: null,
    scaleFrom: null,
    opacityFrom: null,
    surfaces: surfaces,
  };
}

// 单个数字字段：非有限数 / 非数字 → null；否则按范围四舍五入并 clamp。
function normalizeNumber(value, range) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const clamped = Math.min(range.max, Math.max(range.min, value));
  const factor = 10 ** range.decimals;
  return Math.round(clamped * factor) / factor;
}

// 一组表面参数：非对象 → 三项全 null；逐字段清洗，未知字段丢弃。
function normalizeSurfaceGroup(value) {
  const group = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    durationMs: normalizeNumber(group.durationMs, SETTINGS_RANGES.durationMs),
    scaleFrom: normalizeNumber(group.scaleFrom, SETTINGS_RANGES.scaleFrom),
    opacityFrom: normalizeNumber(group.opacityFrom, SETTINGS_RANGES.opacityFrom),
  };
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

// 逐字段清洗，始终返回新的完整对象：一个字段非法不影响其它字段（缺省即「自动」）。
export function normalizeSettings(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const surfaces = {};
  const rawSurfaces =
    source.surfaces && typeof source.surfaces === "object" && !Array.isArray(source.surfaces)
      ? source.surfaces
      : {};
  for (const key of SURFACE_SETTING_KEYS) {
    surfaces[key] = normalizeSurfaceGroup(rawSurfaces[key]);
  }
  return {
    fallback: FALLBACK_MODES.includes(source.fallback) ? source.fallback : DEFAULT_SETTINGS.fallback,
    durationMs: normalizeNumber(source.durationMs, SETTINGS_RANGES.durationMs),
    scaleFrom: normalizeNumber(source.scaleFrom, SETTINGS_RANGES.scaleFrom),
    opacityFrom: normalizeNumber(source.opacityFrom, SETTINGS_RANGES.opacityFrom),
    surfaces: surfaces,
  };
}

// 读取设置：任何失败（不可用 / 抛错 / 坏 JSON）都回退默认。
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
