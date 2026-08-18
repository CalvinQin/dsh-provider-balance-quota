# 小红书图文文案

> 配图：`docs/xiaohongshu-poster.png`（2160×2880，3:4，可裁 1:1 或直接发）

## 标题（二选一）

1. 余额不够用？DeepSeek 用户必装的 DSH 插件，余额额度一眼看全 💎
2. 我把 DeepSeek 余额和 ChatGPT 额度做进了一个侧边栏插件 📊

## 正文

用 DeepSeek Harness（DSH）跑任务最烦什么？跑一半余额见底、额度用尽直接中断 😮💨

这个插件（dsh-provider-balance）把两件事塞进了侧边栏一个小卡片：

💎 **DeepSeek 余额**：官方接口实时显示，欠费前就知道，一键跳转充值
🤖 **ChatGPT 接入**：CodexManager 登录即同步，GPT-5.x 直接出现在模型选择器，切换账号 DSH 自动跟随
📊 **额度进度条**：官方 Codex 用量接口，剩余比例 + 重置倒计时，90 秒缓存不打扰

装法就一条命令（DSH Desktop 托盘 → Open DSH Terminal）：

```bash
dsh plugin add dsh-provider-balance
```

重启 DSH Desktop，侧边栏底部就会出现余额/额度卡片（设置页顶部也有完整版「供应商余额与额度」）。

完全开源（MIT），纯本地请求，不发任何数据出机器。喜欢的话点个 star ⭐

## 话题标签

#DeepSeek #DeepSeekHarness #DSH #AI编程 #ChatGPT #Codex #效率工具 #程序员日常 #开源插件 #AI工具推荐

## 评论区置顶（可选）

- 插件市场也能搜到：DSH Desktop 侧边栏 → 插件市场 → 搜索 dsh-provider-balance
- 遇到问题：GitHub issues，欢迎 PR
