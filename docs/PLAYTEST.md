# v0.2.0 验证记录 / Validation record

验收版本：`20261028-r3`。以下记录区分自动化规则检查、实际浏览器交互和玩家实机反馈。

Accepted build: `20261028-r3`. The evidence below distinguishes automated rule checks, browser interaction and physical player feedback.

## 规则与工程检查 / Rules and source checks

- `npm test`：29 项通过，覆盖高速防穿透、滑动碰撞、门楣高度、最近遮挡、视线、弹药守恒、伤害衰减、据点中立化与争夺、A\*、快速甩鼠与高频事件累积。
- `npm test`: 29 passed, covering movement tunnelling/sliding, lintel clearance, nearest occlusion, sight, ammo conservation, damage falloff, capture neutralization/contests, A\*, fast turns and high-rate mouse accumulation.
- `npm run check`：模块与资源可解析，DOM 标识无重复，运行资源和模块修订号一致。
- `npm run check`: resolvable modules/assets, unique DOM IDs and matching runtime release revisions.
- `python -m py_compile scripts/start_server.py`：通过。
- Python launcher compilation check: passed.

## 浏览器实际流程 / Exercised browser paths

- 靶场中五种武器均可切换和射击；自动步枪按住连射，霰弹枪与精确射手步枪按住只射击一次。
- All five weapons switched/fired in range. Automatic rifle held-fire repeats; shotgun and marksman rifle held-fire produce one shot per press.
- AR-4 射击后为 `21 / 180`；中途切枪取消换弹，随后完成换弹为 `30 / 171`，其余武器弹药独立保留。
- AR-4 changed to `21 / 180` after firing. Switching cancelled a reload; a completed reload produced `30 / 171`, retaining other weapon inventories independently.
- 四倍镜、爆头和靶标倒下/恢复、近战、手雷消耗/爆炸、冲刺体力、跳跃落地、墙体阻挡均已交互检查。
- Exercised optic, headshots, target knockdown/reset, melee, grenade consumption/explosion, sprint stamina, jump/landing and wall blocking.
- 侦察车登车、行驶、制动与机枪过热/冷却已检查。
- Exercised scout entry, driving, braking and turret overheating/cooling.
- 玩家完成一次据点占领，得到 `+250`；友方据点重部署恢复生命与弹药。
- A player capture awarded `+250`; redeploying at a friendly point restored health/ammunition.
- 暂停期间对局时间保持 `295.3 s`，音频挂起；恢复后继续模拟。
- Match time stayed at `295.3 s` and audio suspended while paused, then resumed.
- 自然运行至增援耗尽，出现败局结算、正确的零增援和本机最佳成绩记录；设置刷新后保留。
- A naturally completed match reached ticket exhaustion, defeat results, a correct zero-ticket HUD and saved personal record; settings survived reload.
- Web Audio 实测产生非零输出，枪声峰值约 `0.38`；实际检查路径未出现项目控制台错误。
- Web Audio produced non-zero output, with observed gunfire peaks around `0.38`; exercised paths produced no project console errors.

## 甩鼠问题的实机闭环 / Physical mouse issue resolution

玩家报告快速大幅转身时视角跳动或反弹。先前独立浏览器仍加载旧页面，缺少新增的原始输入设置。之后给入口、样式和所有运行模块加入一致修订号，并在界面标明实际构建版本。

The player reported angle jumps/reversals during fast large turns. Their standalone browser was still loading an older page without the raw-input setting. Entry, styles and runtime modules were subsequently revisioned consistently, with the actual build shown in the UI.

`r3` 使用逐帧完整位移累积、原始锁定输入、窗口坐标差和锁定切换清理，并移除了鼠标横移附加镜头侧倾。独立 Chrome 会话确认处于 `raw` 输入，观察到约 `120 FPS`、帧时间第 95 百分位约 `8.5 ms`。玩家再次大角度甩鼠后明确回复“不会了”。这些帧率数值来自该次会话，不是跨设备性能基准。

`r3` uses complete per-frame displacement accumulation, raw pointer capture, windowed coordinate differences and transition resets, without turn-induced camera roll. A standalone Chrome session confirmed `raw` mode at approximately `120 FPS` and an `8.5 ms` 95th-percentile frame interval. The player explicitly confirmed that large turns no longer jumped. These timings describe that session, not a cross-device benchmark.

## 支持范围 / Supported scope

桌面键鼠单人游戏；内嵌浏览器无法锁鼠时使用明确选择的窗口操作。手机触控、联网多人、飞行载具和通用刚体物理不在此版本范围内。

Desktop mouse/keyboard single-player game, with explicitly selected windowed controls when an embedded browser cannot capture the pointer. Mobile touch, online multiplayer, aircraft and general rigid-body physics are outside this build.
