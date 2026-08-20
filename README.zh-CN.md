# DSH CLIProxyAPI Provider

[![CI](https://github.com/ChadCSong/dsh-cliproxyapi-provider/actions/workflows/ci.yml/badge.svg)](https://github.com/ChadCSong/dsh-cliproxyapi-provider/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

面向 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）的
[CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI) 自动发现与模型同步插件。

它能自动发现本地 CPA 服务，把实时模型目录同步到 DSH 原生模型选择器，并让你直接从列表选择
读图模型，不需要手填模型 ID。

> [English](README.md)

## 主要功能

- **本地地址零配置**：依次探测 `127.0.0.1:8317`、`localhost:8317` 和 `[::1]:8317`。
- **动态模型发现**：读取 `/v1/models?client_version=pi`，同时兼容标准 `data[].id` 格式。
- **原生模型切换**：所有模型进入 DSH 的模型选择器，显示在 `CLIProxyAPI (auto)` 分组下。
- **新版本在上**：同一模型家族内按版本倒序排列。
- **读图模型只能选择**：地址和 Key 生效后，从 CPA 返回的模型下拉列表选择，不能手填 ID。
- **同步模型能力**：读取上下文上限、输出上限、reasoning、图片输入和 service tier 信息。
- **自动刷新**：CPA 增删账号或模型后，无需重装插件。
- **安全保存 Key**：API Key 通过 DSH credential service 保存，不写入 `settings.yaml`。
- **标准 DSH 插件**：同一份包支持 DSH Web、headless profile 和 DSH Desktop，不是 Desktop 私有插件。

## 环境要求

- DeepSeek Harness `0.1.0-rc.7` 或 `0.1.0-rc.8`
- Node.js `22.19+` 或 `24+`
- 已启动的 CLIProxyAPI 服务

当前版本以 DSH `0.1.0-rc.8` 的公开插件接口作为构建和测试基准，同时保留对基于 rc.7 的
DSH Desktop 版本的运行兼容性。

## 安装

安装到你使用的 DSH profile：

```sh
dsh plugin --profile web add github:ChadCSong/dsh-cliproxyapi-provider
```

DSH Desktop 通常使用 `desktop` profile：

```sh
dsh plugin --profile desktop add github:ChadCSong/dsh-cliproxyapi-provider
```

安装后重启一次对应的 DSH 进程。插件已经通过 `package.json` 和 `cordis.patch.yml` 声明标准
DSH bundle，不需要手动修改 profile。

### 从本地源码安装

```sh
git clone https://github.com/ChadCSong/dsh-cliproxyapi-provider.git
cd dsh-cliproxyapi-provider
pnpm install
pnpm build
dsh plugin --profile web add "$PWD"
```

请把 `web` 换成你实际使用的 profile。

## 使用方法

1. 启动 CLIProxyAPI。使用默认 `8317` 端口时，CPA 地址可以留空。
2. 打开 DSH 的 **设置 → 插件 → CLIProxyAPI（自动探测）**。
3. CPA 开启 bearer 鉴权时，填写一次 API Key。
4. 地址与 Key 生效后，在自动加载的下拉列表中选择读图模型。
5. 回到会话，在 DSH 原生模型选择器的 **CLIProxyAPI (auto)** 分组中选择模型。

还可以使用：

```text
/cpa-status
/cpa-refresh
```

`/cpa-status` 查看当前连接地址和已同步模型数量；`/cpa-refresh` 立即重新探测并刷新模型目录。

## 配置

为了让已安装版本升级时保留设置，内部命名空间继续使用 `dsh-cliproxyapi`：

```yaml
dsh-cliproxyapi:
  enabled: true
  # 留空即自动探测，也支持显式填写远程 CPA 地址
  baseURL: ''
  apiKeyEnv: CLIPROXYAPI_API_KEY
  # 留空即采用目录中第一个声明 image 输入的模型
  visionModel: ''
  protocol: openai-completions
  refreshIntervalSeconds: 300
  probeTimeoutMs: 2000
```

### 地址解析顺序

插件去重后按以下顺序探测：

1. 设置中明确填写的 `baseURL`
2. DSH 启动环境中的 `CLIPROXYAPI_BASE_URL`
3. 本机 `8317` 端口的 loopback 候选地址

只有你明确配置时，插件才会访问非本机地址。

### API Key

`apiKeyEnv` 是凭据引用名，不是明文密钥。设置界面通过 DSH credential service 写入 API Key，
默认引用名为 `CLIPROXYAPI_API_KEY`。

### 推理协议

默认 `openai-completions`，使用 CPA 的 `/v1/chat/completions`。只有 CPA 部署要求通过 Responses API
调用目标模型时，才需要切换为 `openai-responses`。

### 读图模型

DSH 在附加图片前会检查模型的 `inputModalities`。插件优先采用 CPA 的 `input_modalities` 信息；如果
目录没有标注，显式选择读图模型会在 DSH 内为该模型补充 `image` 能力。模型本身仍需真正支持
OpenAI 兼容的图片内容。

## 兼容原理

插件通过公开的 settings contract 管理 DSH 官方 `@deepseek-ai/dsh-llm-pi-ai` adapter 中的一条
route，不自行复制模型传输层。因此流式响应、工具调用、附件、reasoning 和错误处理仍由官方 adapter
负责。

Host 代码不导入 Electron 或 `dsh-plugin-desktop` API，设置卡片也只使用公开 DSH client service/slot，
所以它可以同时用于 CLI/Web 和 Desktop profile。

## 开发

```sh
pnpm install
pnpm test
pnpm typecheck
pnpm build
```

针对本地 Harness 源码开发时：

```sh
DSH_CHECKOUT=/absolute/path/to/deepseek-harness pnpm test
DSH_CHECKOUT=/absolute/path/to/deepseek-harness pnpm build
```

也可以让 `DSH_PACKAGES_ROOT` 指向 DSH 的 `node_modules`。构建生成的本地路径文件已被 Git 忽略，
不会进入发布包。

## 安全与贡献

自动探测只访问 loopback 地址。插件不会把明文 API Key 写入设置、模型缓存或日志。安全问题请参考
[SECURITY.md](SECURITY.md) 私下报告。

欢迎提交 Issue 和 Pull Request。修改行为时请补充或更新测试，并确保 `pnpm test`、
`pnpm typecheck` 和 `pnpm build` 通过。

## License

[MIT](LICENSE)
