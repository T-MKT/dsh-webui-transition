# AGENTS.md

## 环境要求
项目全局使用 `pnpm` 进行操作。

当前项目基线 `dsh` 版本：`0.2.2-rc.1`
当前项目兼容 `dsh` 版本：`0.2.2-rc.1`

常用命令：`pnpm build`（主插件 `src/browser.js` → `client.js`；设置插件 `packages/dsh-webui-transition-settings/src/browser.js` → 该包 `client.js`）、`pnpm test`（先构建，再跑 `node --test`）。

## 工作原则
- **禁止修改 `dsh` 源代码。**
- 高内聚低耦合，文件及文件夹职责清晰。
- 保持简洁。如无必要，勿增实体。

- 不保留向后兼容性。直接移除过时的路径，而不是添加兼容层、回退机制或迁移逻辑。
- 注意 `dsh` 的接口可用性。

## 项目地图

```text
dsh-webui-transition/                         # 根包 = bundle + 主 client 插件
├── .agents/plan/
│   ├── v0.1.0/                               # 历史真源（保留，只读，不作开发依据）
│   │   ├── webui-transition.md
│   │   ├── blur-during-transition.md
│   │   └── compatible-with-0.2.2-alpha.2.md
│   ├── v0.2.0/
│   │   ├── plan-b-rewrite.md                 # v0.2.0 主体真源（ESM 重写计划）
│   │   └── pseudo-glass-blur.md              # v0.2.0 伪元素玻璃模糊修复真源
│   └── v0.3.0/
│       └── origin-aware-and-settings.md      # v0.3.0 真源（原点感知 + 设置插件 + CI）
├── .github/workflows/ci.yml                  # CI：install / build / test / 产物一致性
├── src/                                      # ESM 源码（esbuild 入口：src/browser.js）
│   ├── defs.js                               # 常量 + SURFACE_DEFS 表面描述符
│   ├── utils.js                              # 通用小工具（CSS 解析 / 默认依赖 / 语义工具）
│   ├── policy.js                             # createPolicy：token / reduced-motion / 时长
│   ├── tracker.js                            # createSurfaceTracker：表面状态机 + DOM 分类
│   ├── gate.js                               # createGate：兼容性门卫（WAAPI / CSS animation / CSS transition）
│   ├── settings.js                           # 主包侧设置契约：localStorage 读/清洗/写
│   ├── origin.js                             # 交互捕获 / 触发源解析 / origin 几何
│   ├── frames.js                             # 纯帧函数：关键帧 + 动画规格拆分（含原点感知与伪元素玻璃）
│   ├── runtime.js                            # createTransitionRuntime：观察 / 批量 / 入场 / 幽灵 / 清理
│   └── browser.js                            # 浏览器入口：__ModuleLoader__.load 注册
├── packages/dsh-webui-transition-settings/   # 设置插件包（独立 client）
│   ├── package.json                          # dsh.client / exports ./client / files
│   ├── index.js                              # host 占位 apply()
│   ├── client.js                             # 构建产物（pnpm build 生成，不手改）
│   ├── README.md / README.en.md              # 设置包说明（中英同步）
│   ├── locale/en.json / locale/zh.json       # meta.title/description（插件清单显示）
│   └── src/
│       ├── browser.js                        # factory 入口：inject/apply + settings.section 注册
│       ├── settings-page.js                  # React 页面（SegmentedControl）
│       ├── contract.js                       # 与主包重复的 key/event/default/modes + read/write
│       └── locale.js                         # zh/en 运行时文案
├── scripts/
│   └── build.mjs                             # esbuild：主插件 iife + 设置插件 cjs→factory 两个产物
├── test/
│   ├── helpers/
│   │   └── env.mjs                           # jsdom 装配 / fake loader / fake animate / fake storage
│   ├── policy.test.mjs
│   ├── tracker.test.mjs
│   ├── gate.test.mjs
│   ├── settings.test.mjs                     # 主包设置契约
│   ├── origin.test.mjs                       # 触发源解析 / 闸门 / 新鲜度 / 几何
│   ├── contract.test.mjs                     # 两包设置契约防漂移
│   ├── frames.test.mjs
│   ├── runtime.test.mjs
│   ├── settings-page.test.mjs                # 设置页渲染 / 切换写 storage + emit
│   ├── settings-plugin.test.mjs              # 设置插件产物 / inject / slot 注册
│   └── bundle.test.mjs                       # 两个构建产物冒烟：classic 契约 + 冻结签名
├── locale/en.json / locale/zh.json           # 根包展示元信息（meta.title/description）
├── AGENTS.md
├── .gitignore
├── LICENSE
├── package.json                              # bundle manifest + dsh.client + 依赖设置包 + build/test scripts
├── pnpm-workspace.yaml                       # packages: ["packages/*"] + allowBuilds: esbuild
├── cordis.patch.yml                          # Loader 补丁：insert 两行（主插件 + 设置插件）
├── index.js                                  # Host 半区：空 apply()（占位，满足 bundle 行）
├── client.js                                 # 主插件构建产物（pnpm build 生成，不手改）
├── README.md / README.en.md                  # 中英文说明（安装、效果、设置、退出开关、已知边界）
└── COMPATIBLE_VERSION                        # 兼容的 dsh 版本与检查日期
```
