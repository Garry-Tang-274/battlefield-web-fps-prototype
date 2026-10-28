# 贡献指南 / Contributing

先运行游戏再修改。提交问题时，注明浏览器版本、操作系统、页面右上角的发行修订号，以及可重复的步骤。输入问题请说明是视角跳变还是帧率停顿，并注明是否使用鼠标锁定或窗口操作。

Run the game before making changes. Report browser/OS versions, the release revision shown at the top right, and reproducible steps. For input issues, distinguish angle jumps from frame stalls and state whether captured-pointer or windowed controls are active.

## 本地检查 / Local checks

无需安装依赖；Node.js 22+ 用于测试，Python 3 用于本地服务。

No dependency installation is required. Use Node.js 22+ for tests and Python 3 for serving.

```bash
npm test
npm run check
python -m py_compile scripts/start_server.py
python scripts/start_server.py
```

修改会影响的行为需要实际试玩：开局、瞄准与射击、换弹与切枪、碰撞、暂停恢复、重部署、结算和设置保存。静态检查不替代手感验收。新增可见文本保持中英对应；所有素材需有明确许可。

Playtest affected paths: deployment, ADS/fire, reload/switch, collision, pause/resume, redeployment, results and saved settings. Static checks do not establish good game feel. Keep visible copy paired in Chinese and English, and use clearly licensed assets.

## 保持模块边界 / Keep module boundaries

对局状态由 `game.js` 持有；纯规则放在 `core.js` 或 `look-input.js`，便于直接测试。不要引入第二个对局状态或在 UI 中修改生命、弹药和据点。

`game.js` owns match state. Keep pure rules in `core.js` or `look-input.js` for direct testing. Do not introduce a second match state or mutate health, ammo or captures from the UI.

发布更新时同步 `config.js` 的 `BUILD`、`index.html` 的资源修订号和本地模块 URL 的 `rev`，避免旧模块与新入口混合。

When publishing, synchronize `BUILD` in `config.js`, asset revisions in `index.html`, and `rev` in local module URLs to avoid mixing old modules with a new entry.

`window.frontline.snapshot()` 是只读运行状态；页面的 `data-input-trace` 保存最近一段鼠标输入。记录只保存在当前页面内，不包含账号、凭据或外部上传。

`window.frontline.snapshot()` exposes read-only runtime state. The page's `data-input-trace` holds recent mouse input. These records remain in the current page without account data, credentials or external uploads.
