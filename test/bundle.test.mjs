/**
 * test/bundle.test.mjs — 构建产物冒烟测试（.plan/v0.2.0/plan-b-rewrite.md §5.6）。
 *
 * 断言 `client.js` 仍是 dsh 0.2.2-alpha.2 要求的 classic 契约：
 * 调用 window.__ModuleLoader__.load 注册、factory 返回冻结签名、
 * 顶层无 import/export、inject 为空、apply 可调。
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, beforeEach, describe, test } from "node:test";

import {
  disposeEnvironment,
  importBundle,
  materializeBundle,
  resetEnvironment,
} from "./helpers/env.mjs";

const CLIENT_URL = new URL("../client.js", import.meta.url).href;

const FACTORY_NAMES = ["createPolicy", "createSurfaceTracker", "createGate", "createTransitionRuntime"];
const KEYFRAME_NAMES = ["keyframesFor", "exitKeyframesFor", "fadeKeyframesFor", "animationSpecsFor"];
const EXPECTED_EXPORTS = [...FACTORY_NAMES, ...KEYFRAME_NAMES, "inject", "apply"];

let registration = null;
let api = null;
let loadFailure = null;

try {
  registration = await importBundle(CLIENT_URL + "?bundle-smoke=1");
  api = materializeBundle(registration);
} catch (error) {
  loadFailure = error;
}

/** client.js 缺失时 skip，其它加载错误（语法/未注册/factory 异常）一律失败。 */
function bundleTest(name, fn) {
  test(name, (t) => {
    if (!loadFailure) return fn(t);
    if (loadFailure.code === "ERR_MODULE_NOT_FOUND") {
      t.skip(`client.js 不存在，先执行 pnpm build：${loadFailure.message}`);
      return undefined;
    }
    assert.fail(`client.js 加载失败：${loadFailure.stack || "未知原因"}`);
    return undefined;
  });
}

beforeEach(() => {
  resetEnvironment();
});

after(() => {
  disposeEnvironment();
});

describe("client.js 产物契约", () => {
  bundleTest("调用 window.__ModuleLoader__.load 注册并带正确 id", () => {
    assert.ok(registration, "产物必须调用 window.__ModuleLoader__.load");
    assert.equal(registration.id, "@tak1208/dsh-webui-transition");
    assert.equal(typeof registration.factory, "function");
  });

  bundleTest("factory 返回冻结签名的 exports", () => {
    assert.ok(api && typeof api === "object", "factory 必须返回 exports 对象");
    assert.deepEqual(Object.keys(api).sort(), [...EXPECTED_EXPORTS].sort());
    for (const name of FACTORY_NAMES) {
      assert.equal(typeof api[name], "function", `exports.${name} 必须是函数`);
    }
    for (const name of KEYFRAME_NAMES) {
      assert.equal(typeof api[name], "function", `exports.${name} 必须是函数`);
    }
  });

  bundleTest("inject 为空数组（Client-only，无依赖注入）", () => {
    assert.deepEqual(api.inject, []);
  });

  bundleTest("apply 可被调用，effect 清理函数可执行", () => {
    let effectCallback = null;
    let effectName = null;
    const ctx = {
      effect(callback, name) {
        effectCallback = callback;
        effectName = name;
        return () => {};
      },
    };
    assert.doesNotThrow(() => api.apply(ctx));
    assert.equal(typeof effectCallback, "function", "apply 应通过 ctx.effect 接线");
    assert.equal(effectName, "dsh-webui-transition: runtime");

    let cleanup = null;
    assert.doesNotThrow(() => {
      cleanup = effectCallback();
    });
    assert.equal(typeof cleanup, "function", "runtime.start() 必须返回清理函数");
    assert.doesNotThrow(() => cleanup());
  });

  bundleTest("顶层不得出现 import / export（classic script 契约）", async () => {
    const source = await readFile(new URL("../client.js", import.meta.url), "utf8");
    assert.doesNotMatch(source, /^\s*(import|export)\b/m, "产物顶层不得出现 import/export");
    assert.match(source, /__ModuleLoader__/, "产物必须通过 __ModuleLoader__ 注册");
  });
});
