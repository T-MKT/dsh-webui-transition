# AGENTS.md

## 环境要求
项目全局使用 `pnpm` 进行操作。

当前项目基线 `dsh` 版本：`0.2.2-rc.1`
当前项目兼容 `dsh` 版本：`0.2.2-rc.1`

常用命令：`pnpm build`（打唯一产物：`src/browser.js` → `client.js`）、`pnpm test`（先构建，再跑 `node --test`）。

发布：单包用 pnpm 发布（`pnpm publish`，或 `pnpm pack` 后 `npm publish <tarball>`）。发布前确认 `client.js` 已重建。

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
│   ├── v0.3.0/
│   │   └── origin-aware-and-settings.md      # v0.3.0 真源（原点感知 + 设置插件 + CI）
│   ├── v1.1.0/
│   │   └── animation-params.md               # v1.1.0 真源（可调配动画参数：时长 / 缩放 / 透明度）
│   └── v1.2.0/
│       └── plugin-page-config.md             # v1.2.0 真源（设置并入插件详情页、回到单包）
├── .github/workflows/ci.yml                  # CI：install / build / test / 产物一致性
├── assets/icons/logo.png                     # 插件清单图标（package.json.icon）
├── src/                                      # ESM 源码（esbuild 入口：src/browser.js）
│   ├── defs.js                               # 常量 + SURFACE_DEFS 表面描述符
│   ├── utils.js                              # 通用小工具（CSS 解析 / 默认依赖 / 语义工具）
│   ├── policy.js                             # createPolicy：token / reduced-motion / 读取设置计算最终 timing
│   ├── tracker.js                            # createSurfaceTracker：表面状态机 + DOM 分类
│   ├── gate.js                               # createGate：兼容性门卫（WAAPI / CSS animation / CSS transition）
│   ├── settings.js                           # 设置契约：回退方式 + 三参数 + 分表面组（读/逐字段清洗/写）
│   ├── settings-page.js                      # React 配置页：回退方式 + 目标 + 三个数字字段（插件详情页内嵌）
│   ├── settings-locale.js                    # 配置页 zh/en 扁平字典
│   ├── panel-marker.js                       # 观察 body：给设置面板打中心原点标记
│   ├── origin.js                             # 交互捕获 / 触发源解析 / origin 几何
│   ├── marker.js                             # 表面级中心原点标记契约 + 中心几何
│   ├── frames.js                             # 纯帧函数：关键帧 + 动画规格拆分（含原点感知、伪元素玻璃、timing 覆盖）
│   ├── runtime.js                            # createTransitionRuntime：观察 / 批量 / 入场 / 幽灵 / 清理
│   └── browser.js                            # 唯一客户端入口：运行时 + 配置页注册 + 打标
├── scripts/
│   └── build.mjs                             # 构建入口：单入口 cjs + __ModuleLoader__ factory 包装
├── test/
│   ├── helpers/
│   │   └── env.mjs                           # jsdom 装配 / fake loader / fake animate / fake storage
│   ├── policy.test.mjs                       # token / clamp / 设置优先级与实时读取
│   ├── tracker.test.mjs
│   ├── gate.test.mjs
│   ├── settings.test.mjs                     # 主包设置契约（默认形状 / 逐字段清洗 / 范围 clamp / canonical JSON）
│   ├── origin.test.mjs                       # 触发源解析 / 闸门 / 新鲜度 / 几何
│   ├── frames.test.mjs                       # 关键帧 / 规格拆分 / timing 覆盖
│   ├── runtime.test.mjs                      # 观察 / 入场 / 幽灵 / 清理 / 中心原点标记表面 / timing 透传
│   ├── settings-page.test.mjs                # 配置页渲染 / 目标切换 / 字段提交与重置 / 跨标签同步
│   ├── panel-marker.test.mjs                 # 设置面板中心原点打标（源级）
│   └── bundle.test.mjs                       # 唯一产物冒烟：classic 契约 + 冻结签名 + apply 装配
├── locale/en.json / locale/zh.json           # 根包展示元信息（meta.title/description）
├── AGENTS.md
├── .gitignore
├── LICENSE
├── package.json                              # bundle manifest + dsh.client + build/test scripts
├── pnpm-workspace.yaml                       # allowBuilds: esbuild（单包，无 workspace glob）
├── cordis.patch.yml                          # Loader 补丁：insert 一行（主插件）
├── index.js                                  # Host 半区：空 apply()（占位，满足 bundle 行）
├── client.js                                 # 唯一构建产物（pnpm build 生成，不手改）
├── README.md / README.en.md                  # 中英文说明（安装、效果、设置、退出开关、已知边界）
└── COMPATIBLE_VERSION                        # 兼容的 dsh 版本与检查日期
```
