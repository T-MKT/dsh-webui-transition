# 删除开闭位移（保留淡入与缩放）：代码结构与开发进度

> 本文档是本次编码的真源：确定后直接照着它编码；节点编号在编码期间保持不变（提交信息用它指明完成到哪）。
> 状态：`- [ ]` 未完成 / `- [x]` 已完成。一个最小节点完成 = 其下全部要点已勾选，且「完成判据」成立。
> 版本/分支：`v1.0.0` / `feat/v1.0.0`；基线 dsh `0.2.2-rc.1`。
> 前置：`.agents/plan/v1.0.0/settings-center-origin.md` 已实现并提交（本计划在其之上执行，涉及 `src/marker.js` 的 `centerGeometryFor`）。

## 1 需求与范围

**需求**：删除开/闭动画中所有方向位移。所有表面（menu / listbox / dialog / mask）的关键帧只保留 `opacity`、`transformOrigin`、`scale`、`boxShadow`；几何链路里 `distancePx` / `translate` 概念整体删除（不保留恒为 0 的字段、分支或兼容层）。缩放原点机制保留：menu / listbox / 普通 dialog 仍由触发源决定 origin，设置面板仍由表面标记决定为面板正中心。

**不做的事**：

- 不改缩放强度（`.98`）、时长、缓动、`opacityFrom`、mask 行为、回退模式（仅淡入 / 点击原点）与设置契约。
- 不改表面级原点标记机制（`src/marker.js` / `panel-marker.js` 的契约不变，只简化 `centerGeometryFor` 的返回形状）。
- 不修改宿主 dsh 源码；不改写任何历史 plan 文档（`v0.1.0` / `v0.2.0` / `v0.3.0` 与已执行的本目录前一份计划）。
- 不引入任何「位移 = 0」的向后兼容路径或开关。

**关键假设**：

- 仓库内除 `src/`、`test/` 与文档外，没有代码依赖 `distancePx` 或 geometry 的 `translateX/translateY`（已 grep 核对，仅 `src/` 内部、测试与 README 引用）。
- 宿主不依赖本插件提供位移，删除后无联动副作用；构建产物由 `pnpm build` 重新生成并随提交入库（CI 校验产物一致性）。

## 2 代码结构

```text
dsh-webui-transition/
├── src/
│   ├── defs.js                            # 修改：SURFACE_DEFS 删 distancePx
│   ├── policy.js                          # 修改：timing() 快照删 distancePx
│   ├── origin.js                          # 修改：geometryForSource 删平移与第三参
│   ├── marker.js                          # 修改：centerGeometryFor 仅返回 origin
│   ├── frames.js                          # 修改：删除全部 translate 帧与相关入参
│   ├── gate.js                            # 修改：冲突检测属性集去 translate
│   └── runtime.js                         # 修改：删 distancePx 读取与传参
├── test/
│   ├── origin.test.mjs                    # 修改：geometryForSource 用例改 origin-only
│   ├── frames.test.mjs                    # 修改：timing/geometry 常量与全部期望帧去 translate
│   ├── policy.test.mjs                    # 修改：timing 断言去 distancePx
│   ├── gate.test.mjs                      # 修改：复核用例 + 新增 dialog translate 放行用例
│   └── runtime.test.mjs                   # 修改：删 translate 常量与断言
├── README.md / README.en.md               # 修改：效果表、origin-aware 段、伪元素玻璃段措辞
└── packages/dsh-webui-transition-settings/README.md / README.en.md   # 修改：pointer 回退去掉“方向位移”
```

| 文件 | 新增/修改 | 职责 |
| --- | --- | --- |
| `src/defs.js` | 修改 | 四个 kind 的 `SURFACE_DEFS` 删 `distancePx`，更新文件头注释 |
| `src/policy.js` | 修改 | `timing(kind)` 快照删 `distancePx` |
| `src/origin.js` | 修改 | `geometryForSource(source, surfaceRect)` 删第三参与平移计算，只产 origin；更新模块头 / §2.5 注释 |
| `src/marker.js` | 修改 | `centerGeometryFor` 返回 `{ originX, originY }` |
| `src/frames.js` | 修改 | 删 `translateValue`、`geometryValuesFor` 的 distance、三处 translate 帧与 `animationSpecsFor` timing 快照里的 distancePx；几何帧只剩 origin + scale + boxShadow |
| `src/gate.js` | 修改 | `animatedPropertiesFor` 去 translate（splitFade → `scale`（+`box-shadow`）；非 splitFade → `opacity`） |
| `src/runtime.js` | 修改 | 删两处 `distancePx` 读取与 `geometryForSource(..., distancePx)` 传参；更新 geometryCache 注释 |
| `test/origin.test.mjs` | 修改 | `geometryForSource` 段重写为 origin-only（删第三参、删 translate 期望） |
| `test/frames.test.mjs` | 修改 | 去 translate 的全部期望帧与常量；`{distancePx: NaN}` 回退用例换字段 |
| `test/policy.test.mjs` | 修改 | 删 distancePx 断言，保留 duration/easing/scaleFrom/opacityFrom |
| `test/gate.test.mjs` | 修改 | 复核既有用例；补「dialog 上 transition: translate 放行（不再动画 translate）」 |
| `test/runtime.test.mjs` | 修改 | 删 `MENU_TRANSLATE` / `DIALOG_TRANSLATE` 及所有 translate 断言（含前一份计划新增的中心几何用例） |
| `README.md` / `README.en.md` | 修改 | 效果表去 `4px` / `12px` 位移措辞；origin-aware 段删位移表述；伪元素玻璃段「位移与阴影」→「缩放与阴影」 |
| 设置包 `README.md` / `README.en.md` | 修改 | `pointer` 回退删「朝点击位置做方向位移」 |

**关键接口与数据流**

- 数据流不变：触发源 → `geometryForSource` → `runtime` 缓存 → `animationSpecsFor` → WAAPI；只是 geometry 与帧里不再有位移。
- 标记表面：`isCenterOriginSurface` → `centerGeometryFor(rect)` = `{ originX: rect.width / 2, originY: rect.height / 2 }`（不再带 translate 字段）。
- 退场幽灵：`geometryCache` 复用入场 geometry，镜像帧同样只剩 origin/scale/opacity/boxShadow。

**冻结的签名**（并行 Agent 按此写码，不得自行改动）

```js
// src/origin.js
export function geometryForSource(source, surfaceRect) // → { originX: number, originY: number } | null

// src/marker.js
export function centerGeometryFor(rect) // → { originX: number, originY: number }

// SURFACE_DEFS[kind]（defs.js）
// { role, property, fallbackMs, minMs, maxMs, scaleFrom, opacityFrom, easing, splitFade, animateShadow }

// policy.timing(kind)
// → { durationMs, easing, scaleFrom, opacityFrom }

// 帧形状（frames.js）
// splitFade 表面（geometry 非空）：[{ transformOrigin, scale, [boxShadow] }, ...]，无 opacity
// 非 splitFade 表面（geometry 非空）：[{ opacity, transformOrigin, scale?, [boxShadow] }, ...]
// geometry 为空：splitFade → []；非 splitFade → 纯 opacity 帧
```

## 3 开发进度

### 3.1 几何源头（节点内并行）

#### 3.1.1 策略表与 origin 并行收敛

- [x] **Agent A**：`src/defs.js` — 删 menu / listbox / dialog / mask 的 `distancePx`，更新文件头「冻结策略表」注释；`src/policy.js` — `timing()` 删 `distancePx: def.distancePx`；`test/policy.test.mjs` — 「返回 SURFACE_DEFS 冻结的位移 / 缩放 / 透明度起点」用例改为只断言 `scaleFrom` / `opacityFrom`，删所有 `distancePx` 断言。写入范围：3 文件。（依赖：无）
- [x] **Agent B**：`src/origin.js` — `geometryForSource(source, surfaceRect)` 删第三参与 `dx/dy/length/translateX/translateY` 计算，返回 `{ originX, originY }`，同步更新模块头第 2 条与锚点注释；`src/marker.js` — `centerGeometryFor` 返回 `{ originX, originY }`；`test/origin.test.mjs` — 重写第 7 节 `geometryForSource`：删第三参，逐用例保留投影/clamp 断言，删全部 translate 断言（含对角 clamp 的单位向量用例改为只断言 origin）。写入范围：3 文件。（依赖：§2 冻结签名）
- **完成判据**：两人收敛后 `node --test test/policy.test.mjs test/origin.test.mjs` 通过。

### 3.2 帧与动画规格（线性，依赖 §3.1）

#### 3.2.1 `src/frames.js` 与帧测试

- [x] `src/frames.js`：删 `translateValue`；`geometryValuesFor` 去 `distancePx`；`geometryKeyframesFor` 删两条 `translate` 赋值；`keyframesFor` / `exitKeyframesFor` 的非 splitFade 分支删 `translate`；`animationSpecsFor` 的 timing 快照删 `distancePx`；更新文件头与各函数注释（几何帧 = `transformOrigin` + `scale` + 可选 `boxShadow`）。
- [x] `test/frames.test.mjs`：`MENU_TIMING` / `DIALOG_TIMING` / `MASK_TIMING` 去 `distancePx`；`MENU_GEOMETRY` / `DIALOG_GEOMETRY` / `MASK_GEOMETRY` 去 translate；全部期望帧删 `translate`（含 menu 无子级回退、伪元素玻璃 4 处、mask geometry 用例：非空时只剩 `transformOrigin`）；`{ distancePx: NaN }` 回退用例改成 `{ scaleFrom: NaN }`。
- **完成判据**：`node --test test/frames.test.mjs` 通过。

### 3.3 门卫与运行时（节点内并行，依赖 §3.2）

#### 3.3.1 门卫与 runtime 并行收敛

- [x] **Agent A**：`src/gate.js` — `animatedPropertiesFor`：splitFade → `["scale"]`（`animateShadow` 时加 `"box-shadow"`），非 splitFade → `["opacity"]`，更新门卫 4 注释；`test/gate.test.mjs` — 复核既有用例（mask 的 `translate` 放行、menu 的 `box-shadow` 拒绝、dialog 的 `opacity`/`all` 用例），新增「dialog 上内联 `transition: translate .2s` 放行（插件不再动画 translate）」。写入范围：2 文件。（依赖：§2 冻结签名）
- [x] **Agent B**：`src/runtime.js` — 删 `entryGeometryFor` / `exitGeometryFor` 里的 `distancePx` 读取与三处 `geometryForSource(..., distancePx)` 传参，更新 `geometryCache` 注释的形状；`test/runtime.test.mjs` — 删 `MENU_TRANSLATE` / `DIALOG_TRANSLATE` 常量与所有相关断言（含前一份计划 `centerGeometryFor` 用例里的 `translateX/translateY` 断言），origin 入场 / pointer 回退 / 幽灵复用 / 伪玻璃用例改为只断言 `transformOrigin` 与 `scale`。写入范围：2 文件。（依赖：§2 冻结签名）
- **完成判据**：两人收敛后 `node --test test/gate.test.mjs test/runtime.test.mjs` 通过。

### 3.4 文档与全量验证（线性）

#### 3.4.1 文档 + 残留校验 + 构建 + 全量测试

- [x] 根 `README.md` / `README.en.md`：效果表两条去 `4px` / `12px` 与「从触发侧起步 / 朝触发点收回」；origin-aware 段删「位移方向从触发点指向弹层 / 朝触发点收回」；伪元素玻璃段「表面只做位移与阴影」→「表面只做缩放与阴影」。
- [x] 设置包 `README.md` / `README.en.md`：`pointer` 回退删「朝点击位置做方向位移」（缩放原点语义保留）。
- [x] 残留校验：`grep -rn "distancePx\|translateX\|translateY\|translate:" src packages/dsh-webui-transition-settings/src test` 无输出；`grep -rn "translate" client.js packages/dsh-webui-transition-settings/client.js` 无输出（构建产物同样干净）。
- [x] `pnpm build` 重新生成两份 `client.js`；`pnpm test` 全绿。
- **完成判据**：上述两条 grep 为空 + `pnpm test` 通过 + `git status` 改动文件 = §2 表格 + 两份 `client.js` 产物，无其它改动。

### 3.5 提交（线性）

#### 3.5.1 一次提交

- [x] 只 `git add` §3.4 验证过的文件（含构建产物）。
- [x] 一次 Conventional Commits 提交，提交信息 body 注明完成本计划节点与前置计划（如 `plan: v1.0.0/remove-displacement.md §3.1–3.4（依赖 settings-center-origin）`）；不 push。
- **完成判据**：`git log -1 --stat` 显示单次提交，文件清单与预期一致。
