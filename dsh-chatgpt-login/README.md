# dsh-chatgpt-login

DeepSeek Harness 插件：**ChatGPT 账号 OAuth 授权登录、CodexManager 同步与额度展示**。授权或同步后 ChatGPT 直接成为 DSH 的 LLM provider；模型选择器里出现 GPT-5.x 等模型，agent 可直接使用（走 Codex 协议）。设置页与 DeepSeek 余额合并为「供应商余额与额度」，侧边栏展示剩余额度进度。

## 工作方式

1. 设置页顶部「ChatGPT」卡片点 **一键授权登录** → Host 向 `auth.openai.com` 申请设备码（Codex CLI 同款 client_id，官方授权流）
2. 新标签页打开 OpenAI 授权页，输入验证码并点「继续」（就是标准"使用 ChatGPT 登录"授权页）
3. Host 轮询到授权 → 换取 OAuth access/refresh token → 存入 `~/.dsh/chatgpt-oauth.json`（0600）
4. access token 同步进 DSH 凭据库 `CHATGPT_ACCESS_TOKEN`，并在 `llm-pi-ai` 设置段写入 `providers.openai-codex` —— 由 dsh-llm-pi-ai 适配器注册 `openai-codex` 路由
5. 后台每 30 分钟检查一次，token 临近过期（<6h）时用 refresh_token 自动刷新并回写

## 架构

| 文件 | 角色 |
| --- | --- |
| `lib/index.js` | Host 半区：设备码登录流、令牌持久化与刷新、凭据/设置接线、`/ext/chatgpt/*` 路由 |
| `lib/client.js` | 浏览器半区：设置页登录卡片（一键授权、状态、退出登录） |

### Host 路由（同源校验）

- `GET /ext/chatgpt/status` — `{loggedIn, configured, account, expiresAt}`（不回传令牌）
- `POST /ext/chatgpt/login/start` — 发起设备码授权，返回 `{userCode, verificationUrl}`
- `GET /ext/chatgpt/login/status` — 轮询授权；批准后自动换 token 并接入路由
- `POST /ext/chatgpt/logout` — 清令牌、凭据与 provider 配置

## 安装

```bash
cp -R dsh-chatgpt-login ~/.dsh/profiles/node_modules/

# ~/.dsh/profiles/web/cordis.patch.yml 追加：
# - insert:
#     - id: chatgpt-login
#       name: dsh-chatgpt-login

# 重启 DeepSeek Harness（Host 半区需要进程重载），刷新页面即可
```

## 注意

- 免费档 ChatGPT 账号有速率/用量限制，额度用尽时请求会报 `usage limit has been reached`，等额度恢复或升级 Plus 即可。
- 令牌等价于登录凭据，仅保存在本机；`llm-pi-ai` 的 Models 页面会把 `openai-codex` 显示为一个可配置 provider（`apiKeyEnv: CHATGPT_ACCESS_TOKEN`），无需手动编辑。
