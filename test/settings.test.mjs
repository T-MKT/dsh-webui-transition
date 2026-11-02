/**
 * test/settings.test.mjs — src/settings.js 设置契约单测。
 *
 * 依据：.agents/plan/v0.3.0/origin-aware-and-settings.md §2.6（设置契约）/
 * §2.7（冻结签名）/ §2.3（测试覆盖：默认值、坏 JSON、字段非法、storage 异常、写返回值）。
 * 装配：test/helpers/env.mjs（fake storage / throwing storage / 环境复位）。
 */

import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";

import {
  DEFAULT_SETTINGS,
  FALLBACK_MODES,
  SETTINGS_EVENT,
  SETTINGS_KEY,
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

const FADE = { fallback: "fade" };
const POINTER = { fallback: "pointer" };

/** 带指定原始字符串的 storage（坏 JSON / 非法字段用例共用）。 */
function storageWithRaw(raw) {
  return createFakeStorage({ [SETTINGS_KEY]: raw });
}

beforeEach(() => {
  resetEnvironment();
});

after(() => {
  disposeEnvironment();
});

describe("常量：跨包冻结契约", () => {
  test("SETTINGS_KEY / SETTINGS_EVENT / FALLBACK_MODES / DEFAULT_SETTINGS 取值正确", () => {
    assert.equal(SETTINGS_KEY, "dsh.webui-transition.settings.v1");
    assert.equal(SETTINGS_EVENT, "dsh-webui-transition/settings");
    assert.deepEqual(FALLBACK_MODES, ["fade", "pointer"]);
    assert.deepEqual(DEFAULT_SETTINGS, FADE);
  });

  test("FALLBACK_MODES 与 DEFAULT_SETTINGS 被冻结，无法就地修改", () => {
    assert.equal(Object.isFrozen(FALLBACK_MODES), true);
    assert.equal(Object.isFrozen(DEFAULT_SETTINGS), true);
    assert.throws(() => FALLBACK_MODES.push("zoom"), TypeError);
    assert.throws(() => {
      DEFAULT_SETTINGS.fallback = "pointer";
    }, TypeError);
    assert.deepEqual(FALLBACK_MODES, ["fade", "pointer"]);
    assert.deepEqual(DEFAULT_SETTINGS, FADE);
  });
});

describe("normalizeSettings：清洗非法数据", () => {
  test("合法 fallback 原样返回", () => {
    assert.deepEqual(normalizeSettings(POINTER), POINTER);
    assert.deepEqual(normalizeSettings(FADE), FADE);
  });

  test("只保留 fallback，忽略无关字段", () => {
    assert.deepEqual(normalizeSettings({ fallback: "pointer", unknown: 1 }), POINTER);
  });

  test("非对象 / 数组 / 空值 → 默认", () => {
    for (const value of [null, undefined, "fade", 0, false, [], [{ fallback: "pointer" }]]) {
      assert.deepEqual(normalizeSettings(value), DEFAULT_SETTINGS, `value=${String(value)}`);
    }
  });

  test("字段缺失或非法 → 默认", () => {
    for (const value of [{}, { fallback: null }, { fallback: "zoom" }, { fallback: 1 }, { fallback: true }]) {
      assert.deepEqual(normalizeSettings(value), DEFAULT_SETTINGS, JSON.stringify(value));
    }
  });
});

describe("readSettings：默认值 / 坏数据 / storage 异常", () => {
  test("无 storage 且无全局 localStorage → 默认", () => {
    assert.deepEqual(readSettings(), DEFAULT_SETTINGS);
  });

  test("空 storage（无该 key）→ 默认", () => {
    assert.deepEqual(readSettings(createFakeStorage()), DEFAULT_SETTINGS);
  });

  test("空字符串 / 坏 JSON → 默认", () => {
    assert.deepEqual(readSettings(storageWithRaw("")), DEFAULT_SETTINGS);
    assert.deepEqual(readSettings(storageWithRaw("{not json")), DEFAULT_SETTINGS);
  });

  test("非对象 JSON（null / 数字 / 字符串 / 数组 / 布尔）→ 默认", () => {
    for (const raw of ["null", "42", '"fade"', '["pointer"]', "true"]) {
      assert.deepEqual(readSettings(storageWithRaw(raw)), DEFAULT_SETTINGS, raw);
    }
  });

  test("字段非法 / 缺失 → 默认", () => {
    for (const raw of ['{}', '{"fallback":null}', '{"fallback":"zoom"}', '{"fallback":1}']) {
      assert.deepEqual(readSettings(storageWithRaw(raw)), DEFAULT_SETTINGS, raw);
    }
  });

  test("合法 JSON → 返回 { fallback }，忽略无关字段", () => {
    assert.deepEqual(readSettings(storageWithRaw('{"fallback":"pointer"}')), POINTER);
    assert.deepEqual(readSettings(storageWithRaw('{"fallback":"fade","unknown":true}')), FADE);
  });

  test("storage 抛异常 → 返回默认且不抛出", () => {
    assert.deepEqual(readSettings(createThrowingStorage()), DEFAULT_SETTINGS);
  });

  test("未传 storage 时懒取 globalThis.localStorage", () => {
    const storage = createFakeStorage({ [SETTINGS_KEY]: '{"fallback":"pointer"}' });
    globalThis.localStorage = storage;
    try {
      assert.deepEqual(readSettings(), POINTER);
    } finally {
      delete globalThis.localStorage;
    }
  });
});

describe("writeSettings：写入与失败返回", () => {
  test("写成功返回 true，写入固定 key 与 {fallback:'pointer'} JSON", () => {
    const storage = createFakeStorage();
    assert.equal(writeSettings(POINTER, storage), true);
    const raw = storage.getItem(SETTINGS_KEY);
    assert.equal(raw, '{"fallback":"pointer"}');
    assert.deepEqual(JSON.parse(raw), POINTER);
  });

  test("写入后可被 readSettings 读回，且可覆盖", () => {
    const storage = createFakeStorage();
    assert.equal(writeSettings(POINTER, storage), true);
    assert.deepEqual(readSettings(storage), POINTER);
    assert.equal(writeSettings(FADE, storage), true);
    assert.deepEqual(readSettings(storage), FADE);
  });

  test("storage 抛异常 → 返回 false 且不抛出", () => {
    assert.equal(writeSettings(POINTER, createThrowingStorage()), false);
  });

  test("无 storage 且无全局 localStorage → 返回 false", () => {
    assert.equal(writeSettings(POINTER), false);
  });
});
