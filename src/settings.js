/**
 * src/settings.js — 主包侧设置契约：localStorage 键 / 事件名 / 回退模式 /
 * 可调配动画参数（时长、初始缩放、透明度起点）/ 读写清洗。
 *
 * 主包（本文件）与设置插件包 `packages/dsh-webui-transition-settings/src/contract.js`
 * 各自独立实现同一份契约，测试保证两者常量与行为一致（防止契约漂移）。
 *
 * 全部延迟访问 `globalThis.localStorage`：模块求值期不读全局；所有 storage 访问
 * 都包在 try/catch 中，任何异常一律回落到默认设置。
 * 计划出处：.agents/plan/v0.3.0/origin-aware-and-settings.md §2.6 / §2.7（Agent A）；
 * 动画参数见 .agents/plan/v1.1.0/animation-params.md §2.4。
 */

import { globalScope } from "./utils.js";

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

// 懒取 localStorage（getter 本身也可能抛错，如隐私模式/禁用存储）。
function resolveStorage() {
  try {
    const scope = globalScope();
    return scope ? scope.localStorage : null;
  } catch (error) {
    return null;
  }
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
