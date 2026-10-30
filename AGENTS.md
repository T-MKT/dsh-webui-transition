# AGENTS.md

## 环境要求
项目全局使用 `pnpm` 进行操作。

当前项目兼容 `dsh` 版本：`0.2.2-alpha.2`

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
│   ├── webui-transition.md              # 代码结构与开发进度（真源）
│   ├── blur-during-transition.md        # 过渡期间保持玻璃层模糊 + 阴影淡入（增强计划）
│   └── compatible-with-0.2.2-alpha.2.md # dsh 版本基线迁移计划
├── AGENTS.md
├── .gitignore
├── LICENSE
├── package.json                         # bundle manifest + dsh.client（浏览器半区声明）
├── cordis.patch.yml                     # Loader 补丁：insert 一行 dsh-webui-transition
├── index.js                             # Host 半区：空 apply()（占位，满足 bundle 行）
├── client.js                            # Client 半区：语义动效运行时（classic script）
├── test/
│   └── runtime.test.mjs                 # jsdom 单测（node --test）
├── README.md / README.en.md             # 中英文说明（安装、效果、退出开关、已知边界）
└── COMPATIBLE_VERSION                   # 兼容的 dsh 版本与检查日期（待插件代码落地时创建）
```

