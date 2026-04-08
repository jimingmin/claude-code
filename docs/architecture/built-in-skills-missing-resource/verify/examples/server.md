# Reconstructed `verify/examples/server.md`

这份页面可以高置信恢复成 server verifier 的示例页。内容依据 `init-verifiers` 对 web / API verifier 的模板要求，以及 built-in verification agent 的执行策略整理，抓取时间为 2026-04-07。

## 1. 这页服务什么场景

它覆盖的是所有“先起服务，再验证行为”的场景，包括：

- Web UI / 前端应用
- API 服务
- 需要本地 dev server 才能操作的项目

从 `init-verifiers` 的交互问题可以直接确认，这一页至少要围绕三类项目信息展开：

- dev server 命令
- 服务 URL / base URL
- ready signal

## 2. 高置信恢复的执行 recipe

### 2.1 先把服务稳定启动起来

这页大概率会先要求 verifier 明确记录：

- 启动命令是什么
- 服务监听在哪个端口或 URL
- 控制台里哪段文本表示“已经 ready”

原因很直接：后续所有 UI / API 检查都建立在服务真的起来了，而不是“猜它应该起来了”。

### 2.2 Web UI 路径

如果目标是 Web 应用，`init-verifiers` 已经明确把 Playwright、Chrome DevTools MCP 或 Claude Chrome Extension 作为推荐能力来源。因此这页高置信会包含类似原则：

- 启动服务后，用浏览器自动化真正打开页面
- 如果需要登录，先按项目提供的登录步骤完成认证
- 直接点击、输入、提交、刷新，验证用户可见行为
- 观察页面报错、控制台错误或请求失败，而不是只看首页是否返回 `200`

同仓 verification agent 还特别强调了一条更严格的规则：

- 不要只验证 HTML 能打开
- 还要抽查同源资源、图片优化地址、静态资源或页面依赖的 API 路由

### 2.3 API 路径

如果目标是 API 服务，这页高概率会要求：

- 发送一个成功路径请求，确认响应体而不只是状态码
- 发送一个失败路径请求，确认错误处理
- 发送边界输入，例如空值、超长值、非法类型
- 必要时做幂等 / 重复请求验证

示意形式大致会接近：

```bash
curl -s -X POST http://localhost:8000/api/items \
  -H 'Content-Type: application/json' \
  -d '{"name":"demo"}'
```

随后再跑一类错误路径：

```bash
curl -s -X POST http://localhost:8000/api/items \
  -H 'Content-Type: application/json' \
  -d '{}'
```

## 3. 认证是这页的重点变量

`init-verifiers` 明确要求为 web 和 API verifier 追问认证方式，因此这页很可能专门留出认证段落：

- 是否需要登录
- 登录 URL 或 token 注入方式
- 测试凭据来自哪里
- 登录成功后如何确认状态正确

这意味着 server verifier 不是默认假设“所有页面都公开可访问”，而是要把认证步骤纳入验证脚本的一部分。

## 4. 对抗性检查在 server 场景里尤其重要

同仓 verification agent 把 server / API 的典型对抗性探针写得很明确，因此这页高置信应当提醒 verifier 至少做其中一类：

- 并发请求
- 非法输入
- 边界值
- 重复提交 / 幂等性
- 不存在资源的访问

这一步的目的不是“额外加分”，而是避免 verifier 只验证首屏和 happy path。

## 5. 清理与报告

验证完成后，这页大概率还会要求：

- 停掉本次启动的 dev server
- 关闭浏览器 session 或临时 token
- 按检查项逐条给出命令、输出与 PASS / FAIL

因此，这份 example 页的真正价值，是把“如何运行一个可复查的服务级验证流程”写成可复用模板。