# 路线图 / Roadmap

## 已完成：可反复游玩的单人据点战 / Complete: replayable solo conquest

v0.2.0 已实现部署、五武器战斗、碰撞、手雷、程序化音效、双方 AI、三个据点、侦察车、补给、重部署、战况与结算。附带靶场、设置保存、输入回归测试和静态在线入口。

v0.2.0 implements deployment, five-weapon combat, collision, grenades, synthesized audio, opposing AI teams, three objectives, a scout, resupply, redeployment, scoreboard and results. It also includes a firing range, saved settings, input regression tests and a static web entry point.

## 下一步：深化现有玩法 / Next: deepen the current loop

- 在玩家实测的基础上继续调整武器与鼠标输入；保留可对比的版本和异常输入记录。
- 改进 AI 的门口通行、协同攻防和掩体探头行为。
- 增加风格一致的第二张地图、战场细节和更多可交互掩体。
- 将现有自动化检查接入完整的浏览器 CI。

- Tune weapons and mouse input against real playtests, retaining comparable builds and abnormal-input traces.
- Improve AI doorway traversal, coordinated objective play and cover peeking.
- Add a second coherent map, environmental detail and additional interactive cover.
- Integrate the existing automated checks into full browser CI.

## 独立的后续项目 / Separate future projects

联网多人需要权威服务器、同步与安全设计；飞行载具需要独立的飞行和关卡设计；移动端需要完整触控方案。这些不是当前版本里尚未接通的按钮。

Online multiplayer needs an authoritative server, synchronization and security design. Aircraft need dedicated flight and level design, and mobile play needs a complete touch scheme. These are future projects rather than disconnected controls in the current build.
