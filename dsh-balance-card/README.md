# dsh-balance-card

DeepSeek Harness 插件：提供 DeepSeek 余额同源代理与侧边栏数据源。设置页 UI 已与 ChatGPT 额度合并到「供应商余额与额度」，展示 DeepSeek 账户余额、充值/赠送明细，并提供一键充值。

## 架构

| 文件 | 角色 |
| --- | --- |
| `lib/index.js` | Host 半区（Cordis 插件）：在 WebServer 上注册 `GET /ext/balance` 同源代理路由 |
| `lib/client.js` | 浏览器半区（`dsh.client` bundle）：注册 `settings.section`（`order: -100`，置顶），渲染余额卡片 |

### 余额数据流

浏览器 → `GET /ext/balance`（Host 同源路由，含 Origin 校验）→ Host 解析密钥（与 `llm-deepseek` 适配器一致：`llm-deepseek` 设置段 → `ctx.credentials` → 环境变量）→ `GET https://api.deepseek.com/user/balance` → 返回 JSON。**API Key 永不进入浏览器。**

响应契约：

```jsonc
// 成功
{ "ok": true, "data": { "is_available": true, "balance_infos": [{ "currency": "CNY", "total_balance": "110.00", "granted_balance": "10.00", "topped_up_balance": "100.00" }] } }
// 失败
{ "ok": false, "code": "missing-key" | "network" | "upstream" | "forbidden" | "internal", "message": "…" }
```

## 安装

```bash
# 1) 把插件放进 profile 的扁平 node_modules（Host 与 Loader 都能解析到）
cp -R dsh-balance-card ~/.dsh/profiles/node_modules/

# 2) 在 ~/.dsh/profiles/web/cordis.patch.yml 追加（watchUserPatches 会热挂载 Host 半区）：
# - insert:
#     - id: balance-card
#       name: dsh-balance-card

# 3) 刷新浏览器页面 —— client-modules 会把新条目写进 window.__DSH_BOOT__，
#    客户端插件随页面加载挂载，设置页顶部即出现余额卡片
```

## 配置

- 密钥：`DEEPSEEK_API_KEY`（`~/.dsh/.credentials.yaml` 或环境变量），或 `llm-deepseek` 设置段中的 `apiKeyEnv`。
- 接口地址：默认 `https://api.deepseek.com`，可用 `$DEEPSEEK_BASE_URL` 或 `llm-deepseek.baseURL` 覆盖。
- 充值页：客户端常量 `RECHARGE_URL = https://platform.deepseek.com/top_up`。
