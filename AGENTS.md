# AGENTS.md

## 环境要求
项目全局使用 `pnpm` 进行操作。

当前项目兼容 `dsh` 版本：`0.2.2-alpha.2`

常用命令：`pnpm build`（`src/browser.js` → `client.js`）、`pnpm test`（先构建，再跑 `node --test`）。

## 工作原则
- **禁止修改 `dsh` 源代码。**
- 高内聚低耦合，文件及文件夹职责清晰。
- 保持简洁。如无必要，勿增实体。

- 不保留向后兼容性。直接移除过时的路径，而不是添加兼容层、回退机制或迁移逻辑。
- 注意 `dsh` 的接口可用性。

## 项目地图

```text
dsh-webui-transition/
├── .plan/
│   ├── v0.1.0/                          # 历史真源（保留，只读，不作开发依据）
│   │   ├── webui-transition.md
│   │   ├── blur-during-transition.md
│   │   └── compatible-with-0.2.2-alpha.2.md
│   └── v0.2.0/
│       ├── plan-b-rewrite.md            # v0.2.0 主体真源（ESM 重写计划）
│       └── pseudo-glass-blur.md         # v0.2.0 伪元素玻璃模糊修复真源
├── src/                                 # ESM 源码（esbuild 入口：src/browser.js）
│   ├── defs.js                          # 常量 + SURFACE_DEFS 表面描述符
│   ├── utils.js                         # 通用小工具（CSS 解析 / 默认依赖 / 语义工具）
│   ├── policy.js                        # createPolicy：token / reduced-motion / 时长
│   ├── tracker.js                       # createSurfaceTracker：表面状态机 + DOM 分类
│   ├── gate.js                          # createGate：兼容性门卫（WAAPI / CSS animation / CSS transition）
│   ├── frames.js                        # 纯帧函数：关键帧 + 动画规格拆分（含伪元素玻璃）
│   ├── runtime.js                       # createTransitionRuntime：观察 / 批量 / 入场 / 幽灵 / 清理
│   └── browser.js                       # 浏览器入口：__ModuleLoader__.load 注册
├── scripts/
│   └── build.mjs                        # esbuild：src/browser.js → client.js（classic IIFE）
├── test/
│   ├── helpers/
│   │   └── env.mjs                      # jsdom 装配 / fake loader / fake animate
│   ├── policy.test.mjs
│   ├── tracker.test.mjs
│   ├── gate.test.mjs
│   ├── frames.test.mjs
│   ├── runtime.test.mjs
│   └── bundle.test.mjs                  # 构建产物冒烟：classic 契约 + 冻结签名
├── AGENTS.md
├── .gitignore
├── LICENSE
├── package.json                         # bundle manifest + dsh.client + build/test scripts
├── pnpm-workspace.yaml                  # allowBuilds: esbuild
├── cordis.patch.yml                     # Loader 补丁：insert 一行 dsh-webui-transition
├── index.js                             # Host 半区：空 apply()（占位，满足 bundle 行）
├── client.js                            # 构建产物（pnpm build 生成，不手改；dsh 直接加载的 classic iife）
├── README.md / README.en.md             # 中英文说明（安装、效果、退出开关、已知边界）
└── COMPATIBLE_VERSION                   # 兼容的 dsh 版本与检查日期
```

