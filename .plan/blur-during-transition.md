# 过渡期间保持玻璃层模糊：代码结构与开发进度

> 本文档是本次编码的真源：确定后直接照着它编码；节点编号在编码期间保持不变（提交信息用它指明完成到哪）。
> 状态：`- [ ]` 未完成 / `- [x]` 已完成。一个最小节点完成 = 其下全部要点已勾选，且「完成判据」成立。
> 分支：`dsh-e80307a0-6652`（已确认，不在 main）；基线 dsh `0.2.2-alpha.2`。

## 1 需求与范围

**需求**：让菜单的玻璃层在**开合动画进行中**也保持模糊，而不是等动画结束才出现（当前修复只保证了动画结束后恢复模糊）。具体：

1. 菜单（`role="menu"` / `role="listbox"`，即 `[data-menu-material]` 表面）入场、退场动画全程，其子级 `.material` 的 `backdrop-filter: var(--dsw-menu-backdrop-filter)` 保持对页面背景采样。
2. 退场幽灵不再主动剥离 `backdrop-filter`，使「关闭」动画同样保持磨砂。
3. 玻璃 dialog（composer 上下文面板 `JObwrW_panel`、会话统计面板 `bRhRbq_panel`，`backdrop-filter` 与 `role="dialog"` 同元素）的**退场**也保持模糊（其入场本就正常）。
4. 菜单容器自身的 `box-shadow`（`--dsw-elevation-prominent`，含 0.5px stroke）与淡入淡出**同步淡入/淡出**：入场时不能先出现「只有阴影的轮廓」，退场时阴影不能残留在已淡完的内容后面。

**不做的事**：

- **不改网页结构**：不增删/移动/包裹任何宿主节点，不碰 React 树，不复制 `.material`，不延迟宿主卸载时序（退场仍走幽灵副本）。
- 不改动效参数（时长、`-4px`/`12px` 位移、`scale .98`、缓动、reduced-motion 归零）与分类器语义（`role` 选择器、硬排除、`data-dsh-transition="off"`、`canAnimate` 门卫）。
- 不引入 `<style>` 注入、CSS 变量动画或阴影字符串解析：阴影淡入同样走 WAAPI 关键帧（`box-shadow: none ↔ 元素计算值`，不做字符串改写）。
- 不做消息入场/流式/滚动等其它动效；不新增依赖、不新增源文件；不改 dsh 源码。

**关键假设**（已用代码/无头 Chromium 核实，与事实不符时先改本节）：

- A1. 菜单 `[role="menu"]` 表面就是 `[data-menu-material]` 元素，`.material` 是它的**直接子元素**；对祖先做 opacity 动画会让它成为 backdrop-root，子级 `backdrop-filter` 只在该 root 内采样（空背景）→ 动画期间无模糊。已由 `dsh-web-frontend` 的 `Z1` 组件与 `_surface_ri079_1/_material_ri079_21` CSS 核实，并用无头 Chromium 复现。
- A2. 玻璃层与动画元素**同元素**时（`JObwrW_panel`/`bRhRbq_panel` 的 `role="dialog"` + `backdrop-filter`），自身 opacity（含动画中）不阻断自身 `backdrop-filter`；end-state 已实测，动画中由 CSS 语义推出，由 §3.2 实机验证兜底。
- A3. 设置面板/mask 不是玻璃（settings 只有 mask 用 `--dsw-mask-blur`，默认 `none`），dialog/mask 的入场动画不需要拆分；两处玻璃 dialog 保持根 opacity 动画即入场正常。退场幽灵不再剥 `backdrop-filter` 后，其自身 opacity 动画不阻断自身 filter → 关闭动画同样保持模糊。
- A4. 菜单表面的直接元素子级 = `.material` + 内容容器（viewport/footer）；把淡入淡出下沉到直接子级不会改变可见性结构，且子级自然 opacity 大多为 1（非 1 时按计算值收尾，见 §2）。
- A5. 宿主菜单无自带 animation/transition（原计划 A1 已核）。直接子元素若自带宿主动画，本插件短暂覆盖其 opacity，属可接受边界（写入 README）。
- A6. 幽灵克隆子元素的自然 opacity 可在 `cloneNode` 后用 `getComputedStyle` 读到（detached 元素；读不到则回退 1，视觉影响仅限自然 opacity≠1 的少数子元素）。
- A7. `box-shadow` 可直接在 WAAPI 关键帧里用 `none ↔ 元素计算值` 插值：CSS 规范把 `none` 视为等长「全透明阴影列表」，浏览器会补透明阴影做插值，无需解析阴影字符串；幽灵克隆（detached）同样能读到计算阴影，读不到则跳过阴影动画、退化为「阴影不淡入」。

## 2 代码结构

```text
dsh-webui-transition/
├── .plan/
│   ├── blur-during-transition.md    # 新增：本计划（真源）
│   └── webui-transition.md          # 修改：§2 数据流 + §3.4.2 记录本条增强并指向本文件
├── AGENTS.md                        # 修改：项目地图补一行本计划
├── client.js                        # 修改：关键帧/规格函数（含阴影淡入）+ 入场/退场接线 + prepareGhost
├── test/runtime.test.mjs            # 修改：入场/退场用例更新，新增拆分淡入淡出与阴影断言
├── README.md / README.en.md         # 修改：已知边界改写
```

| 文件 | 新增/修改 | 职责/改什么 |
| --- | --- | --- |
| `client.js` | 修改 | ①新增 `directElementChildren` / `naturalOpacity` / `naturalBoxShadow` / `fadeKeyframesFor` / `animationSpecsFor`；②`keyframesFor`/`exitKeyframesFor` 语义改为「表面级」（menu/listbox 不含 opacity，几何 + 可选 boxShadow；支持 `none ↔ 计算值` 的阴影淡入）；③`applyEntry` 改为按 specs 播放（表面几何/阴影 + 子元素 opacity）；④`playGhost` 同构拆分；⑤`prepareGhost` 删除 `backdrop-filter`/`-webkit-backdrop-filter` 的 `none` 覆盖；⑥`exports` 增加 `fadeKeyframesFor` / `animationSpecsFor` |
| `test/runtime.test.mjs` | 修改 | 入场：表面动画不含 opacity、含 boxShadow 首尾帧（`none` → 计算值）、每个直接子元素各一条 opacity 动画、settle 后全部 cancel；退场：幽灵根无 opacity、含阴影淡出、子元素淡出、`backdrop-filter` 未被清空、settle 后移除；dialog/mask 行为不变 |
| `README.md` / `README.en.md` | 修改 | 「已知边界」把「动画期间暂停采样背景」改写为「过渡期间保持模糊」，并补：容器阴影随动画淡入淡出；直接子元素的宿主 CSS animation 可能被短暂覆盖 |
| `.plan/webui-transition.md` | 修改 | §2 数据流补「拆分淡入」；§3.4.2 增记本条增强并指向本计划 |
| `AGENTS.md` | 修改 | 项目地图 `.plan/` 下补本计划一行 |

**关键接口与数据流**：

```text
MutationObserver → classifier（不变）→ enqueue → rAF flush
  ▼
applyEntry(surface, kind)
  ▼ animationSpecsFor(surface, kind, direction="in", independentTransforms)
  · menu/listbox：
      spec[0]     = { surface, 表面关键帧：translate/scale（**无 opacity**）+ boxShadow: none → 计算值 }
      spec[1..n]  = { 每个直接元素子级, opacity 0 → 自然值 }
      （读不到 boxShadow / 无几何能力时对应字段退化；无直接元素子级 → 回退为 surface 整体关键帧，保持旧行为）
      （不支持独立 transform → 表面关键帧只保留阴影淡入，无位移动画）
  · dialog/mask：spec[0] = { surface, 表面整体关键帧（与现状一致：opacity [+translate]；阴影由自身 opacity 一起淡入，不额外加 boxShadow） }
  ▼ 每个 spec：element.animate(keyframes, { duration, easing, fill:"both" })
  ▼ settle → cancel（释放填充态；避免持久 backdrop-root，沿用上次修复）
退场（classifyRemoval → cloneNode → prepareGhost）：
  · prepareGhost 不再清 backdrop-filter/-webkit-backdrop-filter（其余清理不变）
  · 每个 surface 对克隆：
      menu/listbox：克隆根几何 + 阴影（计算值 → none）+ 克隆子级 opacity 自然值 → 0
      dialog/mask：克隆根整体镜像（与现状一致）
  → 全部动画 settle 后移除幽灵
```

核心不变式：**凡是 `backdrop-filter` 元素自身为「被动画元素」或其祖先不存在 opacity 动画，模糊即全程可用**。因此唯一的 opacity 动画只能落在「玻璃元素自身」或「它的兄弟/子级」，绝不再落在其祖先上。

**冻结的签名**（无并行，但单测直接调用这些函数，实现期间不得自行改名/改形）：

```js
// 新增（经 exports 暴露供单测；均为 client.js factory 闭包内普通函数）
function directElementChildren(element)      // → Element[]（只含 nodeType===1 的直接子节点）
function naturalOpacity(element)             // → number（getComputedStyle().opacity；异常/NaN → 1）
function naturalBoxShadow(element)           // → string | null（getComputedStyle().boxShadow；none/空/异常 → null）
function fadeKeyframesFor(direction, opacity)
  // direction: 'in'  → [{ opacity: 0 }, { opacity }]
  // direction: 'out' → [{ opacity }, { opacity: 0 }]
function animationSpecsFor(surface, kind, direction, independentTransforms)
  // → AnimationSpec[]，AnimationSpec = { element, keyframes }
  //   menu/listbox: 表面（几何 + 可选阴影淡入/淡出）+ 每个直接子级的 opacity；无子级时回退表面整体
  //   dialog/mask:  仅表面整体（与现 keyframesFor/exitKeyframesFor 一致）
  //   内部负责读 naturalOpacity / naturalBoxShadow；单测可用元素内联样式控制计算值

// 签名变化（新增可选 boxShadow 参数）、语义调整（单测据此更新）
function keyframesFor(kind, timing, independentTransforms, boxShadow = null)       // 表面级入场
function exitKeyframesFor(kind, timing, independentTransforms, boxShadow = null)   // 表面级退场
//   menu/listbox → translate/scale（不支持独立 transform 时省略）+ boxShadow none↔值；
//                  两者都没有 → []（此时仅子级淡入）
//   dialog/mask  → 与当前实现完全一致，忽略 boxShadow 参数
```

**boxShadow 关键帧的构造约定（冻结）**：

- 只在 `independentTransforms` 与 boxShadow 同时缺失时表面关键帧为 `[]`；有几何无阴影时只有几何帧；有阴影无几何时只有阴影帧。
- 入场两帧：第 1 帧 `boxShadow: "none"`，第 2 帧 `boxShadow: <naturalBoxShadow 返回的计算值>`；退场镜像。**不得改写阴影字符串**，插值全靠 CSS 对 `none` 的补透明阴影规则。
- `naturalBoxShadow` 返回 `null`（无阴影）时，入场/退场都不写 `boxShadow` 字段。
- 不变：`createPolicy` / `createClassifier` / `createCompatibility` / `createMotionRuntime` 的 options 与返回形状。

**实现要点（写码时照此）**：

- `applyEntry` 循环播放 specs，每个 animation 都 `ownedAnimations.add`，`whenSettled` 内 `cancelAnimation`（保留现有 `released` 守卫）。
- `playGhost` 对每个 surface 用 `resolveClone` 得到克隆落点再算 specs；`jobs` 收集全部 animation，沿用 `Promise.all` settle 后 `removeGhost`。
- `naturalOpacity` / `naturalBoxShadow` 只在 menu/listbox 上调用：入场读表面（或其直接子级自然 opacity），退场读克隆节点；数量 = 1 + 直接子级数（通常 3），不遍历整棵子树。
- 退化路径必须存在：`independentTransforms=false`（老浏览器）时 menu 仍通过子级 opacity 有淡入淡出；阴影读不到时阴影不参与动画；子级读不到 opacity 时回退 1。
- 阴影只挂在**表面那一条** WAAPI 动画的 `boxShadow` 字段上（与 translate/scale 同一 keyframe 对象），不新增额外动画对象。
- `prepareGhost` 仅删两行 `backdrop-filter` / `-webkit-backdrop-filter` 的 `none`，其余（`animation/transition:none`、`pointer-events:none`、剥 id/aria-*、tabindex、inert/aria-hidden）全部保留。
- 不写 `transform` 属性（仍只用独立 `translate`/`scale`）；不新增 `<style>` 注入；不改写阴影字符串。

**备选方案（不采用，记录理由）**：

1. 用注入 CSS + 属性（`[data-...] > * { animation: … }`）实现子级淡入：CSS 动画的隐式终值天然适配自然 opacity、代码更短，但 jsdom 单测只能测属性存在、测不到实际动画，且注入样式的生命周期/清理面更大——本仓库的单测以 WAAPI 假动画为核心，故不采用。
2. 去掉菜单淡入、只保留位移/缩放：最简单且模糊全程可用，但违背原需求「淡入 + 上浮」，不采用。

## 3 开发进度

> 本次改动集中在 `client.js` 与其强耦合的单测/文档，单智能体线性执行；不设 Agent 并行（协调成本大于收益）。

### 3.1 入场与退场拆分：表面几何 + 阴影淡入淡出 + 子级淡入淡出

#### 3.1.1 入场拆分（`client.js` + 单测同步）

- [x] `client.js`：新增 `directElementChildren` / `naturalOpacity` / `naturalBoxShadow` / `fadeKeyframesFor` / `animationSpecsFor`；`keyframesFor` 语义改为「menu/listbox 表面级：几何 + 可选 boxShadow、不含 opacity；dialog/mask 不变」
- [x] `client.js`：`applyEntry` 改为按 `animationSpecsFor(surface, kind, 'in', …)` 播放；每个动画 settle 后 cancel；空子级/无独立 transform/无阴影的退化路径
- [x] `client.js`：`exports` 增加 `fadeKeyframesFor` / `animationSpecsFor`
- [x] `test/runtime.test.mjs`：更新入场用例（表面动画不含 opacity、含 `boxShadow: none → 计算值`、直接子元素各有 opacity 动画、settle 后全部释放）；新增「菜单入场不产生 surface opacity 动画」断言
- **完成判据**：`node --check client.js && node --test` 全绿

#### 3.1.2 退场拆分 + 幽灵不再剥玻璃（`client.js` + 单测同步）

- [x] `client.js`：`playGhost` 按 specs 拆分（menu/listbox 克隆根几何 + 阴影 `计算值 → none` + 子级自然值→0；dialog/mask 维持整体镜像）
- [x] `client.js`：`prepareGhost` 删除 `backdrop-filter` / `-webkit-backdrop-filter` 的 `none` 覆盖
- [x] `test/runtime.test.mjs`：更新退场用例（幽灵根动画不含 opacity、含阴影淡出、子级淡出、`backdrop-filter` 未被清除、settle 后幽灵移除）；dialog/mask 退场断言保持
- **完成判据**：`node --check client.js && node --test` 全绿

#### 3.1.3 文档

- [x] `README.md` / `README.en.md`：「已知边界」改写为过渡期间保持模糊；新增「容器阴影随动画淡入淡出」「直接子元素宿主 CSS animation 可能被短暂覆盖」两条边界
- [x] `.plan/webui-transition.md`：§2 数据流补拆分淡入与阴影淡入；§3.4.2 增记本条增强并指向本计划
- [x] `AGENTS.md` 项目地图补本计划；回填本文件进度
- **完成判据**：`grep -n "过渡期间" README.md README.en.md` 命中且两文中英对应；文档中无「动画期间暂停采样」旧表述

### 3.2 实机验证

#### 3.2.1 无头 Chromium + CDP：动画中 / 静止 / 退场 / 阴影四维度像素验证

- [x] 启动 Windows 无头 Chromium（独立 user-data-dir + CDP），用 dsh 的浏览器授权 cookie 打开 `127.0.0.1:3080`
- [x] 注入 z-index:1099 的高对比条纹探针（菜单表面 z-index 1100 之下），页面内临时把 `Element.prototype.animate` 时长 ×10 作为慢放测试桩
- [x] 打开模型菜单，在动画约 92% 进度截图：菜单区域红/蓝条纹占比——旧实现约 40%+，新实现应 <10%（证明动画期间 blur 生效）
- [x] 在动画约 15% 进度截图：菜单外缘环带（面板矩形外 3–24px）亮度与「无菜单基线」差异 < 阈值，且明显低于静止态阴影环带（证明阴影随动画淡入，而非提前出现）
- [x] 静止态截图：条纹占比 = 0%；阴影环带完整；`[role=menu]` 的 `getAnimations()` 为空（无残留）
- [x] 点击外部关闭，幽灵刚插入时截图：幽灵区域条纹占比 <10%（证明退场保持模糊）；幽灵移除前阴影应已淡出（环带接近基线）；随后幽灵被移除
- [x] 抽检设置面板（mask/panel）与两处玻璃 dialog：动画期间/结束渲染正常，console 无插件异常
- **完成判据**：上述像素阈值全部满足，且临时测试文件、无头进程、外部临时目录清理干净
- **验证记录（2026-10-30，Windows 无头 Chrome 156.0.8078.48 + CDP，视口 1414×800）**：
  - 探针：48px 周期红/蓝条纹（`z-index:1099`，菜单表面 `z-index:1100`）；`Element.prototype.animate` 时长 ×10 后暂停到目标进度。8px 条纹会与 `blur(40px)` 的降采样产生摩尔纹，故改用 48px 周期。
  - 入场 92%：菜单中央内容无关带条纹占比 0%、高频能量 0.27（无菜单基线 100% / 7.94），视觉上玻璃层完全磨砂、文字清晰。
  - 入场 15%：菜单矩形外 3–24px 环带亮度与无菜单基线差 `+0.011`（仅 0.7% 像素差 >1 luma）；静止态同环带差 `-0.214`（4.5% 像素差 >1）→ 阴影随动画淡入，无「先出现只阴影轮廓」。计算 `box-shadow` 插值：15% 时 alpha 0.004–0.01，92% 时约为自然值 92%，退场幽灵 95% 时 alpha≈0。
  - 静止态：条纹占比 0%、高频能量 0.24；`[role="menu"]` 的 `getAnimations()` 为 0，无幽灵；`box-shadow` 为完整自然值。
  - 退场：幽灵根关键帧只有 `translate`/`scale`/`boxShadow`（无 `opacity`），三个直接子级各一条 `opacity 1→0`；`.material` 计算 `backdrop-filter` 仍为 `blur(40px) saturate(1.5)`、无内联覆盖；刚插入幽灵区域条纹占比 0%；幽灵在全部动画 settle 后移除。
  - 旧实现对照：同一 `.material` 外套 `opacity: 0.999` 祖先时条纹占比 100%（backdrop-root 失效模式可复现）。
  - 设置面板：panel 关键帧 `[opacity, translate]`、mask `[opacity]`；动画中与静止渲染正常。
  - 两处玻璃 dialog（`JObwrW_panel` 上下文用量、`bRhRbq_panel` 单轮统计）：入场关键帧 `[opacity, translate]`；退场幽灵保留计算 `backdrop-filter: blur(40px) saturate(1.5)`；幽灵移除正常。
  - 控制台：无任何提及 `dsh-webui-transition` 的错误、无未捕获异常。宿主/其它第三方插件既有 `slot entry crashed in 'conversation.chat.node'`（React #130）在有/无本插件时均出现，与本插件无关。

#### 3.2.2 用户实机确认

- [x] 用户在 GUI 刷新后确认：菜单入场/退场全程磨砂、无「清晰 → 模糊」跳变；阴影随淡入淡出、无「先出现灰色轮廓」或「内容淡完阴影残留」；两处玻璃 dialog 的关闭动画保持模糊
- **完成判据**：用户确认；若可见问题按反馈在 §3.1 内修正后重验

### 3.3 提交

- [x] `git add client.js test/runtime.test.mjs README.md README.en.md .plan/blur-during-transition.md .plan/webui-transition.md AGENTS.md`
- [x] 提交信息：`feat(webui-transition): 过渡期间保持玻璃层模糊与阴影同步淡入（.plan/blur-during-transition.md §3.1）`
- **完成判据**：`node --check client.js && node --test` 全绿；`git status` 干净；不 push
