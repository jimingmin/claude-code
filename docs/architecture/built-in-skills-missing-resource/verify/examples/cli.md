# Reconstructed `verify/examples/cli.md`

这份页面可以高置信恢复成 CLI verifier 的示例页。内容依据 `init-verifiers` 中对 `verifier-cli` 的模板要求，以及 built-in verification agent 的输出规范整理，抓取时间为 2026-04-07。

## 1. 这页服务什么场景

它对应的目标不是 Web UI，也不是 HTTP API，而是终端程序、REPL、交互式命令和批处理脚本。

`init-verifiers` 对 CLI verifier 的默认工具建议也能直接证明这一点：

- `Tmux`
- `Bash(asciinema:*)`
- `Read`
- `Glob`
- `Grep`

## 2. 高置信恢复的执行 recipe

### 2.1 先确认运行入口

CLI verifier 首先应该确定：

- 真正的入口命令是什么
- 该命令是否需要先 build
- 是否有环境变量、配置文件或示例输入

这正是 `init-verifiers` 在交互问答里要求用户提供的项目特定信息。

### 2.2 用 tmux 承载交互式流程

如果 CLI 不是“一次执行即退出”，而是交互式程序，就应当把它放进 tmux session，再逐步发送按键、采集 pane 输出。

典型流程可以恢复为：

```bash
tmux new-session -d -s verifier-cli
tmux send-keys -t verifier-cli 'npm run dev-cli' C-m
tmux capture-pane -pt verifier-cli
```

如果程序需要多轮输入，就继续：

```bash
tmux send-keys -t verifier-cli 'help' C-m
tmux capture-pane -pt verifier-cli
```

这类流程的关键不是 tmux 命令本身，而是保留一份可复查的交互轨迹。

### 2.3 可选使用 asciinema

`init-verifiers` 还专门要求检查 `asciinema` 是否存在，并把它作为可选项而不是硬依赖。这说明原始 example 页很可能会建议：

- 有 `asciinema` 时，可以把关键交互录下来，便于复查
- 没有时也不应阻断验证流程

## 3. 这页应该要求做哪些检查

CLI verifier 不应只验证 happy path。高置信恢复出的检查项包括：

- 正常输入：确认主命令按预期工作
- `--help` / usage：确认帮助文本与实际参数一致
- 非法输入：确认 stderr、错误码和报错信息合理
- 边界值：空输入、超长输入、缺参、错误 flag
- 交互状态：多轮输入后状态是否正确推进

## 4. PASS / FAIL 证据长什么样

对 CLI verifier 来说，最有价值的证据通常是：

- 运行命令本身
- tmux pane 中捕获到的 stdout / stderr
- 进程退出码
- 失败或边界场景下的实际输出

原始 example 页很可能就是为了防止 verifier 写出“我读了代码，看起来没问题”这类无效结论。

## 5. 清理动作

CLI 验证结束后，这页大概率还会要求：

- 停掉 tmux 里的长驻进程
- 结束录屏或相关子进程
- 把最终结论写成逐检查的 PASS / FAIL，而不是只给一句总评