/**
 * test/contract.test.mjs — 跨包设置契约一致性（.agents/plan/v0.3.0/origin-aware-and-settings.md
 * §2.3 / §2.6 / §3.2.1 Agent E）。
 *
 * 主包 `src/settings.js` 与设置包 `src/contract.js` 是同一份冻结契约的两份独立实现：
 * 常量、normalize/read/write 行为、写入的 key 与 JSON 文本必须完全一致，防止跨包契约漂移。
 * 表面级中心原点标记常量（主包 `src/marker.js` / 设置包 `src/contract.js`）同样两包
 * 独立实现、取值必须一致（设置面板由设置插件打标，主插件识别）。
 */

import assert from "node:assert/strict";
import { after, describe, test } from "node:test";

import * as settingsContract from "../packages/dsh-webui-transition-settings/src/contract.js";
import * as mainMarker from "../src/marker.js";
import * as mainSettings from "../src/settings.js";
import {
  createFakeStorage,
  createThrowingStorage,
  disposeEnvironment,
} from "./helpers/env.mjs";

after(() => {
  disposeEnvironment();
});

/** 快照 fake storage 的全部内容，按键排序，便于 deepEqual 比较。 */
function snapshotStorage(storage) {
  const entries = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    entries.push([key, storage.getItem(key)]);
  }
  return entries.sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
}

/** 用主包 key 预置记录（key 漂移由常量用例单独断言）。 */
function seededStorage(stored) {
  return createFakeStorage(stored === undefined ? {} : { [mainSettings.SETTINGS_KEY]: stored });
}

// ---------------------------------------------------------------------------
// 1. 契约常量
// ---------------------------------------------------------------------------

describe("契约常量：两包必须完全一致", () => {
  test("SETTINGS_KEY 一致", () => {
    assert.equal(settingsContract.SETTINGS_KEY, mainSettings.SETTINGS_KEY);
  });

  test("SETTINGS_EVENT 一致", () => {
    assert.equal(settingsContract.SETTINGS_EVENT, mainSettings.SETTINGS_EVENT);
  });

  test("FALLBACK_MODES 的数组内容与顺序一致", () => {
    assert.deepEqual([...settingsContract.FALLBACK_MODES], [...mainSettings.FALLBACK_MODES]);
  });

  test("DEFAULT_SETTINGS 深比较一致", () => {
    assert.deepEqual(settingsContract.DEFAULT_SETTINGS, mainSettings.DEFAULT_SETTINGS);
  });

  // 表面级中心原点标记：设置插件给设置面板打标，主插件识别；两包各自实现一份常量。
  test("ORIGIN_MARKER_ATTRIBUTE 一致", () => {
    assert.equal(settingsContract.ORIGIN_MARKER_ATTRIBUTE, mainMarker.ORIGIN_MARKER_ATTRIBUTE);
  });

  test("ORIGIN_MARKER_CENTER 一致", () => {
    assert.equal(settingsContract.ORIGIN_MARKER_CENTER, mainMarker.ORIGIN_MARKER_CENTER);
  });
});

// ---------------------------------------------------------------------------
// 2. normalizeSettings：同一组输入两侧结果 deepEqual
// ---------------------------------------------------------------------------

const NORMALIZE_CASES = [
  ["undefined", undefined],
  ["null", null],
  ["空对象", {}],
  ["fallback 为 pointer", { fallback: "pointer" }],
  ["fallback 非法", { fallback: "bogus" }],
  ["坏 JSON 字符串", "{not json"],
  ["数组", ["fade", "pointer"]],
];

describe("normalizeSettings：同一组输入两侧行为一致", () => {
  for (const [label, value] of NORMALIZE_CASES) {
    test(`输入「${label}」时两侧结果 deepEqual`, () => {
      const mainResult = mainSettings.normalizeSettings(value);
      const contractResult = settingsContract.normalizeSettings(value);
      assert.deepEqual(contractResult, mainResult);
    });
  }
});

// ---------------------------------------------------------------------------
// 3. readSettings：向 fake storage 注入相同数据后两侧结果 deepEqual
// ---------------------------------------------------------------------------

const READ_CASES = [
  ["无记录", undefined],
  ["null 文本", "null"],
  ["空对象", "{}"],
  ["fallback 为 pointer", '{"fallback":"pointer"}'],
  ["fallback 非法", '{"fallback":"bogus"}'],
  ["坏 JSON 文本", "{not json"],
  ["数组", '["fade","pointer"]'],
];

describe("readSettings：相同 storage 数据两侧行为一致", () => {
  for (const [label, stored] of READ_CASES) {
    test(`storage 为「${label}」时两侧结果 deepEqual`, () => {
      const mainResult = mainSettings.readSettings(seededStorage(stored));
      const contractResult = settingsContract.readSettings(seededStorage(stored));
      assert.deepEqual(contractResult, mainResult);
    });
  }
});

// ---------------------------------------------------------------------------
// 4. writeSettings：两侧返回值、写入的 key 与 JSON 文本一致
// ---------------------------------------------------------------------------

const WRITE_CASES = [
  ["undefined", undefined],
  ["null", null],
  ["空对象", {}],
  ["fallback 为 pointer", { fallback: "pointer" }],
  ["fallback 非法", { fallback: "bogus" }],
  ["坏 JSON 字符串", "{not json"],
  ["数组", ["fade", "pointer"]],
];

describe("writeSettings：同一组输入两侧行为一致", () => {
  for (const [label, value] of WRITE_CASES) {
    test(`传入「${label}」时返回值与写入内容一致`, () => {
      const mainStorage = createFakeStorage();
      const contractStorage = createFakeStorage();
      const mainResult = mainSettings.writeSettings(value, mainStorage);
      const contractResult = settingsContract.writeSettings(value, contractStorage);
      assert.equal(contractResult, mainResult, "writeSettings 返回值应一致");
      assert.deepEqual(
        snapshotStorage(contractStorage),
        snapshotStorage(mainStorage),
        "写入的 key 与 JSON 文本应一致"
      );
    });
  }

  test("合法设置写入同一 key 与同一 JSON 文本", () => {
    const mainStorage = createFakeStorage();
    const contractStorage = createFakeStorage();
    assert.equal(mainSettings.writeSettings({ fallback: "pointer" }, mainStorage), true);
    assert.equal(settingsContract.writeSettings({ fallback: "pointer" }, contractStorage), true);
    assert.deepEqual(snapshotStorage(mainStorage), [
      [mainSettings.SETTINGS_KEY, '{"fallback":"pointer"}'],
    ]);
    assert.deepEqual(snapshotStorage(contractStorage), snapshotStorage(mainStorage));
  });
});

// ---------------------------------------------------------------------------
// 5. storage 异常：两侧同样兜底（读默认值 / 写返回 false）
// ---------------------------------------------------------------------------

describe("storage 抛异常：两侧兜底行为一致", () => {
  test("readSettings 对抛异常的 storage 返回同一默认值", () => {
    const mainResult = mainSettings.readSettings(createThrowingStorage());
    const contractResult = settingsContract.readSettings(createThrowingStorage());
    assert.deepEqual(contractResult, mainResult);
  });

  test("writeSettings 对抛异常的 storage 都返回 false", () => {
    assert.equal(mainSettings.writeSettings({ fallback: "pointer" }, createThrowingStorage()), false);
    assert.equal(
      settingsContract.writeSettings({ fallback: "pointer" }, createThrowingStorage()),
      false
    );
  });
});
