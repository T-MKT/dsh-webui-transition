/**
 * test/settings.test.mjs — src/settings.js 设置契约单测。
 *
 * 依据：.agents/plan/v0.3.0/origin-aware-and-settings.md §2.6（设置契约）/
 * §2.7（冻结签名）/ §2.3（测试覆盖：默认值、坏 JSON、字段非法、storage 异常、写返回值）；
 * 动画参数见 .agents/plan/v1.1.0/animation-params.md §2.4 / §3.1.1。
 * 装配：test/helpers/env.mjs（fake storage / throwing storage / 环境复位）。
 */

import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";

import {
  DEFAULT_SETTINGS,
  FALLBACK_MODES,
  SETTINGS_EVENT,
  SETTINGS_KEY,
  SETTINGS_RANGES,
  SURFACE_SETTING_KEYS,
  normalizeSettings,
  readSettings,
  writeSettings,
} from "../src/settings.js";
import {
  createFakeStorage,
  createThrowingStorage,
  disposeEnvironment,
  resetEnvironment,
} from "./helpers/env.mjs";

/** 完整默认形状（供 deepEqual 比较用）。 */
function fullDefaults() {
  return {
    fallback: "fade",
    durationMs: null,
    scaleFrom: null,
    opacityFrom: null,
    surfaces: {
      menu: { durationMs: null, scaleFrom: null, opacityFrom: null },
      dialog: { durationMs: null, scaleFrom: null, opacityFrom: null },
      mask: { durationMs: null, scaleFrom: null, opacityFrom: null },
    },
  };
}

/** 在默认形状上覆盖顶层 / 表面字段。 */
function full(overrides = {}) {
  const base = fullDefaults();
  const surfaces = overrides.surfaces
    ? { ...base.surfaces, ...overrides.surfaces }
    : base.surfaces;
  return { ...base, ...overrides, surfaces };
}

/** 带指定原始字符串的 storage（坏 JSON / 非法字段用例共用）。 */
function storageWithRaw(raw) {
  return createFakeStorage({ [SETTINGS_KEY]: raw });
}

const DEFAULTS = fullDefaults();

beforeEach(() => {
  resetEnvironment();
});

after(() => {
  disposeEnvironment();
});

describe("常量：跨包冻结契约", () => {
  test("SETTINGS_KEY / SETTINGS_EVENT / FALLBACK_MODES / SURFACE_SETTING_KEYS 取值正确", () => {
    assert.equal(SETTINGS_KEY, "dsh.webui-transition.settings.v1");
    assert.equal(SETTINGS_EVENT, "dsh-webui-transition/settings");
    assert.deepEqual(FALLBACK_MODES, ["fade", "pointer"]);
    assert.deepEqual(SURFACE_SETTING_KEYS, ["menu", "dialog", "mask"]);
    assert.deepEqual(DEFAULT_SETTINGS, DEFAULTS);
  });

  test("SETTINGS_RANGES 取值正确", () => {
    assert.deepEqual(SETTINGS_RANGES, {
      durationMs: { min: 0, max: 1000, decimals: 0 },
      scaleFrom: { min: 0.5, max: 1, decimals: 2 },
      opacityFrom: { min: 0, max: 1, decimals: 2 },
    });
  });

  test("FALLBACK_MODES / SURFACE_SETTING_KEYS / SETTINGS_RANGES / DEFAULT_SETTINGS 被冻结", () => {
    for (const value of [FALLBACK_MODES, SURFACE_SETTING_KEYS, SETTINGS_RANGES, DEFAULT_SETTINGS]) {
      assert.equal(Object.isFrozen(value), true);
    }
    assert.equal(Object.isFrozen(DEFAULT_SETTINGS.surfaces), true);
    for (const key of SURFACE_SETTING_KEYS) {
      assert.equal(Object.isFrozen(DEFAULT_SETTINGS.surfaces[key]), true, `${key} 组应被冻结`);
    }
    assert.equal(Object.isFrozen(SETTINGS_RANGES.durationMs), true);
    assert.throws(() => FALLBACK_MODES.push("zoom"), TypeError);
    assert.throws(() => SURFACE_SETTING_KEYS.push("tooltip"), TypeError);
    assert.throws(() => {
      DEFAULT_SETTINGS.fallback = "pointer";
    }, TypeError);
    assert.throws(() => {
      DEFAULT_SETTINGS.surfaces.menu.durationMs = 120;
    }, TypeError);
    assert.throws(() => {
      SETTINGS_RANGES.scaleFrom.max = 0.9;
    }, TypeError);
    assert.deepEqual(DEFAULT_SETTINGS, DEFAULTS);
  });
});

describe("normalizeSettings：清洗与默认形状", () => {
  test("合法 fallback 原样返回，其余字段为自动", () => {
    assert.deepEqual(normalizeSettings({ fallback: "pointer" }), full({ fallback: "pointer" }));
    assert.deepEqual(normalizeSettings({ fallback: "fade" }), DEFAULTS);
  });

  test("忽略未知字段", () => {
    assert.deepEqual(
      normalizeSettings({ fallback: "pointer", unknown: 1 }),
      full({ fallback: "pointer" }),
    );
  });

  test("非对象 / 数组 / 空值 → 默认", () => {
    for (const value of [null, undefined, "fade", 0, false, [], [{ fallback: "pointer" }]]) {
      assert.deepEqual(normalizeSettings(value), DEFAULTS, `value=${String(value)}`);
    }
  });

  test("fallback 非法 → 默认 fade，不影响其它字段", () => {
    assert.deepEqual(
      normalizeSettings({ fallback: "zoom", durationMs: 120 }),
      full({ durationMs: 120 }),
    );
    assert.deepEqual(normalizeSettings({ fallback: null }), DEFAULTS);
    assert.deepEqual(normalizeSettings({ fallback: 1 }), DEFAULTS);
  });

  test("非数字 / 非有限数 → null（自动）", () => {
    for (const value of ["120", NaN, Infinity, -Infinity, true, {}, []]) {
      assert.equal(normalizeSettings({ durationMs: value }).durationMs, null, String(value));
    }
  });

  test("数值按 ranges 四舍五入并 clamp", () => {
    assert.equal(normalizeSettings({ durationMs: -50 }).durationMs, 0);
    assert.equal(normalizeSettings({ durationMs: 5000 }).durationMs, 1000);
    assert.equal(normalizeSettings({ durationMs: 120.6 }).durationMs, 121);
    assert.equal(normalizeSettings({ scaleFrom: 0.9123 }).scaleFrom, 0.91);
    assert.equal(normalizeSettings({ scaleFrom: 2 }).scaleFrom, 1);
    assert.equal(normalizeSettings({ scaleFrom: 0.1 }).scaleFrom, 0.5);
    assert.equal(normalizeSettings({ opacityFrom: -1 }).opacityFrom, 0);
    assert.equal(normalizeSettings({ opacityFrom: 0.456 }).opacityFrom, 0.46);
    assert.equal(normalizeSettings({ opacityFrom: 7 }).opacityFrom, 1);
  });

  test("surfaces 非对象 / 数组 → 三组全自动", () => {
    for (const value of [null, "menu", 7, true, []]) {
      assert.deepEqual(normalizeSettings({ surfaces: value }).surfaces, DEFAULTS.surfaces, String(value));
    }
  });

  test("surfaces 逐字段清洗：非法组与未知 key 丢弃，合法字段保留", () => {
    const surfaces = {
      menu: { durationMs: 120, scaleFrom: null, opacityFrom: null },
      dialog: "bogus",
      mask: { durationMs: 5000, scaleFrom: 0.9123 },
      tooltip: { durationMs: 50, scaleFrom: null, opacityFrom: null },
    };
    const result = normalizeSettings({ surfaces });
    assert.deepEqual(result.surfaces, {
      menu: { durationMs: 120, scaleFrom: null, opacityFrom: null },
      dialog: { durationMs: null, scaleFrom: null, opacityFrom: null },
      mask: { durationMs: 1000, scaleFrom: 0.91, opacityFrom: null },
    });
    assert.deepEqual(Object.keys(result.surfaces), ["menu", "dialog", "mask"]);
  });

  test("返回新对象：不共享 DEFAULT_SETTINGS 的嵌套引用", () => {
    const first = normalizeSettings({ durationMs: 100 });
    const second = normalizeSettings({ durationMs: 100 });
    assert.notEqual(first, second);
    assert.notEqual(first.surfaces, second.surfaces);
    assert.notEqual(first.surfaces.menu, second.surfaces.menu);
    first.surfaces.menu.durationMs = 500;
    assert.equal(second.surfaces.menu.durationMs, null);
    assert.equal(DEFAULT_SETTINGS.surfaces.menu.durationMs, null);
  });

  test("逐字段恢复：一个字段非法不清空其它字段", () => {
    const result = normalizeSettings({
      fallback: "bogus",
      durationMs: 240,
      scaleFrom: "x",
      opacityFrom: 0.5,
      surfaces: { menu: { durationMs: -10, scaleFrom: 3 } },
    });
    assert.deepEqual(result, full({
      fallback: "fade",
      durationMs: 240,
      scaleFrom: null,
      opacityFrom: 0.5,
      surfaces: {
        menu: { durationMs: 0, scaleFrom: 1, opacityFrom: null },
      },
    }));
  });

  test("canonical JSON：normalize 后字段顺序固定", () => {
    const normalized = normalizeSettings({
      opacityFrom: 0.5,
      durationMs: 120,
      surfaces: { mask: { durationMs: 80 }, menu: { scaleFrom: 0.96 } },
      fallback: "pointer",
    });
    assert.equal(
      JSON.stringify(normalized),
      '{"fallback":"pointer","durationMs":120,"scaleFrom":null,"opacityFrom":0.5,"surfaces":' +
        '{"menu":{"durationMs":null,"scaleFrom":0.96,"opacityFrom":null},' +
        '"dialog":{"durationMs":null,"scaleFrom":null,"opacityFrom":null},' +
        '"mask":{"durationMs":80,"scaleFrom":null,"opacityFrom":null}}}',
    );
  });
});

describe("readSettings：默认值 / 坏数据 / storage 异常", () => {
  test("无 storage 且无全局 localStorage → 默认", () => {
    assert.deepEqual(readSettings(), DEFAULTS);
  });

  test("空 storage（无该 key）→ 默认", () => {
    assert.deepEqual(readSettings(createFakeStorage()), DEFAULTS);
  });

  test("空字符串 / 坏 JSON → 默认", () => {
    assert.deepEqual(readSettings(storageWithRaw("")), DEFAULTS);
    assert.deepEqual(readSettings(storageWithRaw("{not json")), DEFAULTS);
  });

  test("非对象 JSON（null / 数字 / 字符串 / 数组 / 布尔）→ 默认", () => {
    for (const raw of ["null", "42", '"fade"', '["pointer"]', "true"]) {
      assert.deepEqual(readSettings(storageWithRaw(raw)), DEFAULTS, raw);
    }
  });

  test("字段非法 / 缺失 → 逐字段回退（不清空其它字段）", () => {
    assert.deepEqual(readSettings(storageWithRaw("{}")), DEFAULTS);
    assert.deepEqual(readSettings(storageWithRaw('{"fallback":null}')), DEFAULTS);
    assert.deepEqual(
      readSettings(storageWithRaw('{"fallback":"zoom","durationMs":120}')),
      full({ durationMs: 120 }),
    );
  });

  test("合法 JSON → 完整形状，未知字段忽略", () => {
    assert.deepEqual(
      readSettings(storageWithRaw('{"fallback":"pointer"}')),
      full({ fallback: "pointer" }),
    );
    assert.deepEqual(
      readSettings(storageWithRaw('{"fallback":"fade","unknown":true,"scaleFrom":0.96}')),
      full({ scaleFrom: 0.96 }),
    );
  });

  test("storage 抛异常 → 返回默认且不抛出", () => {
    assert.deepEqual(readSettings(createThrowingStorage()), DEFAULTS);
  });

  test("未传 storage 时懒取 globalThis.localStorage", () => {
    const storage = createFakeStorage({
      [SETTINGS_KEY]: '{"fallback":"pointer","durationMs":90}',
    });
    globalThis.localStorage = storage;
    try {
      assert.deepEqual(readSettings(), full({ fallback: "pointer", durationMs: 90 }));
    } finally {
      delete globalThis.localStorage;
    }
  });
});

describe("writeSettings：写入与失败返回", () => {
  test("写成功返回 true，写入固定 key 的完整 canonical JSON", () => {
    const storage = createFakeStorage();
    assert.equal(writeSettings({ fallback: "pointer" }, storage), true);
    const raw = storage.getItem(SETTINGS_KEY);
    assert.equal(raw, JSON.stringify(full({ fallback: "pointer" })));
    assert.deepEqual(JSON.parse(raw), full({ fallback: "pointer" }));
  });

  test("写入时按 ranges 清洗：clamp / 四舍五入 / 非法字段变 null", () => {
    const storage = createFakeStorage();
    assert.equal(
      writeSettings(
        {
          fallback: "bogus",
          durationMs: 5000,
          scaleFrom: 0.9123,
          opacityFrom: "x",
          surfaces: { menu: { durationMs: -50, scaleFrom: 2 } },
        },
        storage,
      ),
      true,
    );
    assert.deepEqual(
      JSON.parse(storage.getItem(SETTINGS_KEY)),
      full({
        durationMs: 1000,
        scaleFrom: 0.91,
        surfaces: { menu: { durationMs: 0, scaleFrom: 1, opacityFrom: null } },
      }),
    );
  });

  test("写入后可被 readSettings 读回，且可覆盖", () => {
    const storage = createFakeStorage();
    assert.equal(writeSettings({ fallback: "pointer", durationMs: 120 }, storage), true);
    assert.deepEqual(readSettings(storage), full({ fallback: "pointer", durationMs: 120 }));
    assert.equal(writeSettings({ fallback: "fade" }, storage), true);
    assert.deepEqual(readSettings(storage), DEFAULTS);
  });

  test("storage 抛异常 → 返回 false 且不抛出", () => {
    assert.equal(writeSettings({ fallback: "pointer" }, createThrowingStorage()), false);
  });

  test("无 storage 且无全局 localStorage → 返回 false", () => {
    assert.equal(writeSettings({ fallback: "pointer" }), false);
  });
});
