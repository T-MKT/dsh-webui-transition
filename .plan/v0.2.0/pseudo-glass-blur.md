# 伪元素玻璃层（::before/::after）在过渡期间保持模糊

> 本文件是 v0.2.0 的唯一开发真源，承接 `.plan/v0.1.0/blur-during-transition.md` 的核心不变式。

## 1 问题与事实

用户报告：Agent Team 客户端 UI 看板 `.VoX2oq_panel` 开合动画执行期间模糊未生效，动画结束后才出现模糊。

已核实的宿主事实（dsh `0.2.2-alpha.2`）：

- `@deepseek-ai/dsh-experimental-client-ui-agent-team/lib/client.js`：看板是
  `createPortal` 到 `document.body` 的 `div`，`className` 含 `VoX2oq_panel`、`role: "dialog"`、
  `data-team-panel: true`；玻璃层不在元素本身，而在 `.VoX2oq_panel:before`
  （`background: var(--dsw-specific-menu); backdrop-filter: var(--dsw-menu-backdrop-filter)`）。
- 全量扫描 dsh `0.2.2-alpha.2` 安装包后确认：玻璃层在 `::before` 上的表面共 6 个，其中**只有**
  `.VoX2oq_panel` 带 `role`（即本次案例，`role="dialog"`，会被本插件动画）。其余
  `.ZKlsPq_menu`（子智能体弹层，ARIA 语义在子级 `role="tree"`）、`._7yHdaG_panel`（QueueDock
  面板）、`.Nqubda_panel`、`.pXJmG_card`、`.nLMEza_bar` 都没有 `role`，不在接管范围内。
- 反例（保持 v0.2.0 行为）：上下文用量面板 `.JObwrW_panel`、会话统计面板 `.bRhRbq_panel`、
  日程选择面板 `.ovHEHG_panel` 的 `backdrop-filter` 就在 `role="dialog"` 元素自身上；
  `pseudoGlassFor` 检测到自身玻璃后返回 null，仍用整体 opacity 动画（自身动画不阻断自身
  `backdrop-filter`，见 v0.1.0 A2）。
- 本插件 v0.2.0 对 `role="dialog"` 做「表面整体 opacity + translate」动画（`splitFade: false`）。
  当玻璃层在**后代**（含伪元素）上时，被动画的表面成为 backdrop-root，伪元素
  `backdrop-filter` 只在该 root 内采样（空背景）→ 动画期间无模糊；settle 后 cancel 释放
  fill，表面 opacity 回到自然值 1，backdrop-root 消失 → 模糊恢复。这正是用户描述的现象。
- v0.1.0 的核心不变式「`backdrop-filter` 元素自身为被动画元素，或它没有 opacity 动画的祖先」
  仍成立；本次是把「祖先」进一步扩展到**伪元素宿主**这一情形。
- Chrome 156 实测支持 `element.animate(keyframes, { pseudoElement: "::before" })`：
  `animation.effect.pseudoElement === "::before"`，伪元素 opacity 被驱动、宿主 opacity 不变。
  不支持该选项的浏览器会静默忽略它并把动画落到宿主元素上——必须检测并取消，不能留下
  宿主 opacity 动画（否则重新引入本 bug）。

## 2 设计

**不变式**：opacity 动画只能落在「玻璃层本身」或「与玻璃层同级的兄弟/子级」；绝不落在玻璃层的祖先上。
伪元素玻璃的宿主就是它的祖先，因此：

- 表面自身带 `backdrop-filter`（`JObwrW_panel` 等玻璃 dialog）→ 维持旧行为（自身 opacity 安全）。
- 表面自身无 `backdrop-filter`、但 `::before`/`::after` 计算值有 → **伪元素玻璃模式**：
  1. 表面只做几何帧（translate/scale，来自 `SURFACE_DEFS[kind]`）+ 阴影淡入淡出（`boxShadow: none ↔ 计算值`）；
  2. 每个直接元素子级各一条 `opacity 0 ↔ 自然值`（内容随同淡入）；
  3. 伪元素自身一条 `opacity 0 ↔ 自然值` 的规格，带 `pseudoElement` 字段，经 WAAPI 播放。
- 其它表面维持 v0.2.0 语义（menu/listbox 的 splitFade、dialog/mask 的整体动画）。

检测与降级：

- 伪元素玻璃检测只在「非 splitFade 表面」（dialog/mask）上执行；`SURFACE_DEFS` 不变。
- 运行时创建带 `pseudoElement` 的动画后校验 `animation.effect.pseudoElement`：
  不匹配（浏览器不支持）→ 立即 `cancel()` 并跳过，不计数、不写入去重状态。
  该浏览器下玻璃层不参与淡入淡出，但几何/子级动画仍在，模糊全程有效。
- 伪元素动画会进入 `ownedAnimations` / `exitAnimations`，settle 后 cancel（释放 fill），
  reduced-motion 热切换/dispose 一并 cancel；退场幽灵同样按此规则动画克隆体的伪元素。

## 3 代码结构（改动面）

| 文件 | 改动 |
| --- | --- |
| `src/utils.js` | `defaultComputedStyle(element, pseudoElement?)` 支持伪元素；新增 `readBackdropFilter(style)`（含 `-webkit-` 兜底） |
| `src/frames.js` | 抽出表面级几何帧函数；`naturalOpacity(element, pseudoElement?, computedStyle?)`、`naturalBoxShadow(element, computedStyle?)` 注入 computedStyle；新增伪元素玻璃检测与伪元素玻璃模式；`animationSpecsFor` 增加可选 `options.computedStyle` |
| `src/runtime.js` | `defaultAnimator` 第 4 参 `pseudoElement` 写入动画 options；新增 `animationTargetsPseudo` 校验并取消落到宿主的伪动画；`applyEntry`/`playGhost` 接线；`createTransitionRuntime` 增加可选 `computedStyle`（转发给 frames） |
| `test/helpers/env.mjs` | jsdom 虚拟控制台静音 `getComputedStyle` 伪元素未实现的告警；fake `animate` 暴露 `effect.pseudoElement` |
| `test/frames.test.mjs` | 伪元素玻璃模式规格（表面无 opacity、子级 + 伪元素淡入淡出、阴影、`::after`、自然 opacity、无子级、降级） |
| `test/runtime.test.mjs` | 伪元素规格接线、不支持时取消、退场幽灵伪元素动画 |
| `README.md` / `README.en.md` | 已知边界补伪元素玻璃与降级说明 |
| `AGENTS.md` | `.plan/v0.2.0/` 项目地图 |
| `client.js` | `pnpm build` 产物（不手改） |

**冻结签名变化**（相对 `.plan/v0.2.0/plan-b-rewrite.md` §4）：

```js
animationSpecsFor(surface, kind, direction, independentTransforms, options = {})
//   options.computedStyle?: (element, pseudoElement?) => CSSStyleDeclaration | null
//   伪元素规格形状：{ element, keyframes, pseudoElement }
createTransitionRuntime({ ..., computedStyle? })   // 仅转发给 frames 的伪元素检测
defaultAnimator(element, keyframes, timing, pseudoElement?)  // 内部依赖，第 4 参可选
```

`browser.js` 的 exports 列表不变（冒烟测试的冻结签名不变）。

## 4 残留风险（本次不覆盖，记录备查）

- 玻璃层在**后代元素**（非 `::before`/`::after`）上的 role 表面：如 shell ImageLightbox 的
  `role="dialog"` 在外层 `_backdrop_19zw2_2`，而玻璃 mask `_mask_19zw2_19` 是 stage 内的后代
  （不是 dialog 的同级 mask）。插件只动画 dialog，不配对/不拆分该 mask；默认 `--dsw-mask-blur`
  为 `none` 时无影响，若主题把它设为非 none，dialog 入场/退场的 opacity 动画期间该 mask 的
  `backdrop-filter` 会短暂失效（同族问题）。本次只修伪元素玻璃，不扩大到后代玻璃。
- 无 `role` 的玻璃外壳（`.ZKlsPq_menu` 等）仍不接管：这是覆盖范围边界，不是本次缺陷；
  若将来要覆盖，应从插件侧识别「玻璃外壳」（计算样式/`data-menu-material`），而不是给宿主补 role。

## 5 开发进度

- [x] `src/utils.js`：伪元素 computed style + `readBackdropFilter`
- [x] `src/frames.js`：几何帧抽取 + 伪元素玻璃检测 + 伪元素玻璃模式
- [x] `src/runtime.js`：伪动画创建/校验/取消 + 入场/幽灵接线
- [x] `test/helpers/env.mjs`：jsdom 告警静音 + fake `effect.pseudoElement`
- [x] `test/frames.test.mjs` / `test/runtime.test.mjs`：新增用例
- [x] `README.md` / `README.en.md` / `AGENTS.md`
- [x] `pnpm build && pnpm test` 全绿（90 用例）
- [x] 无头 Chrome 机制验证（Agent Team `glass-verifier`，见下方验证记录）
- [x] 无头 Chrome 端到端 harness（修复后的 client.js：入场 / 退场幽灵 / 清理）
- [x] 提交（见 git log）

### 验证记录

无头 Chrome 156（Windows headless + CDP，视口 1280x800，ImageMagick 灰度标准差；面板内 200x140 无内容区域）。
纯尖锐条纹 std=0.4996；静态玻璃 std≈0.0079（「模糊有效」基线）。

| 场景 | 面板 opacity | ::before opacity | std | 结论 |
| --- | --- | --- | --- | --- |
| 静态玻璃 | 1 | 1 | 0.0079 | 基线 |
| 旧策略：面板自身 opacity 动画 50% | 0.5 | 1 | 0.4134（≈无模糊参考 0.4114，RMSE 0.0027） | 模糊完全失效 |
| 旧策略：cancel 释放 fill 后 | 1 | 1 | 0.0079 | 模糊恢复 |
| 旧策略：动画到 100% 但 fill 仍生效 | 1 | 1 | 0.3252 | 动画存在本身即 backdrop-root |
| 新策略：表面 translate/阴影 + 伪元素自淡 50% | 1 | 0.5 | 0.2041（与静态「alpha .5 + 模糊」RMSE=0） | 模糊全程有效 |
| 新策略：退场镜像 50% | 1 | 0.5 | 0.2041（RMSE=0） | 模糊全程有效 |
| 新策略：伪元素 fill 到 100% | 1 | 1 | 0.0079 | 与静止一致 |
| 新策略：仅表面 translate（伪元素不淡） | 1 | 1 | 0.0079 | 表面几何动画不破坏模糊 |

计算样式证据：`effect.pseudoElement === "::before"`；新策略中景 `panelOpacity=1`、
`::before opacity=0.5`、子级 opacity=0.5；无 console 错误。

端到端 harness（同 headless Chrome，加载真实构建产物 `client.js`，慢放 ×10；`ver=new|old` 对比）：

| 构建 | 场景 | 宿主 opacity | ::before opacity | 面板内 std | 判读 |
| --- | --- | --- | --- | --- | --- |
| 修复后（v0.2.0） | 入场（内容 opacity 50% 采样点） | 1 | 0.5 | 0.1785 | ≈静态半透明玻璃标定 0.1803（Δ0.0018），模糊有效 |
| 修复后（v0.2.0） | 入场 settle | 1 | 1 | 0.0058 | =全模糊标定；`panel.getAnimations()=0`、`document.getAnimations()=0` |
| 修复后（v0.2.0） | 退场幽灵（50% 采样点） | 1 | 0.5 | 0.1774 | ≈静态半透明玻璃（Δ0.0029），幽灵内模糊有效；settle 后幽灵移除 |
| 修复前（v0.2.0 旧构建） | 入场（内容 opacity 50% 采样点） | 0.5 | 1 | 0.3595 | ≈无模糊标定 0.3628 → 复现用户报告：动画期间无模糊 |
| 修复前（v0.2.0 旧构建） | 退场幽灵（50% 采样点） | 0.5 | 1 | 0.3595 | 幽灵内无模糊 |

`__animateLog` 证据（修复后）：伪元素规格 `pseudoElement:"::before"` 且 `effect.pseudoElement` 回读一致、
keyframes `[{opacity:0},{opacity:1}]`（退场 `[{opacity:1},{opacity:0}]`）；面板几何规格
`[{translate:"0 12px",boxShadow:"none"},{translate:"0 0",boxShadow:<计算值>}]`（无 opacity）；2 个直接子级各一条
opacity。修复前只有一条宿主 opacity+translate 规格，无伪元素动画。两版本 settle 后无残留动画/幽灵，无 console 错误。
