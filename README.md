# 群岛前线：联合作战网页 FPS 原型
# Archipelago Frontline: Combined-Arms Web FPS Prototype

这是一个使用 Three.js 构建的浏览器端第一人称射击原型，目标是验证“步兵、AI 敌人、据点争夺与载具”能否在轻量网页环境中形成可玩的联合作战循环。

This is a browser-based first-person shooter prototype built with Three.js. Its goal is to test whether infantry combat, AI enemies, capture objectives, and vehicles can form a playable combined-arms loop in a lightweight web environment.

本仓库是公开展示与后续迭代版本，不是商业游戏，也不是《战地》系列的复制品；仓库不包含该系列的名称、地图、模型、音频、标识或其他受版权保护素材。

This repository is a public showcase and iteration version, not a commercial game and not a copy of the Battlefield series; it contains none of that series’ names, maps, models, audio, logos, or other copyrighted assets.

## 当前状态
## Current Status

当前提交提供一个可运行的垂直切片：第一人称移动、鼠标观察、射击、换弹、敌人 AI、命中与击杀反馈、生命值、计分、据点区域和简化载具驾驶。

The current commit provides a runnable vertical slice: first-person movement, mouse look, shooting, reloading, enemy AI, hit and kill feedback, health, scoring, a capture zone, and simplified vehicle driving.

此前原型曾实现更大的海陆空地图、双阵营 AI、五类枪械、弹药补给和多种载具；这些内容将按路线图逐步迁移、重构和测试，而不是以未经验证的代码一次性堆入仓库。

An earlier prototype implemented a larger land-sea-air map, two-faction AI, five weapon classes, ammunition resupply, and multiple vehicles; those features will be migrated, refactored, and tested incrementally according to the roadmap rather than added as an unverified code dump.

## 快速运行
## Quick Start

在 Windows 上双击 `start_windows.bat`。脚本会检测 Python，并在本地启动静态网页服务器。

On Windows, double-click `start_windows.bat`. The script checks for Python and starts a local static web server.

在 macOS 或 Linux 上执行以下命令。

On macOS or Linux, run the following commands.

```bash
chmod +x start_mac_linux.sh
./start_mac_linux.sh
```

也可以直接执行 Python 启动器。

You can also run the Python launcher directly.

```bash
python scripts/start_server.py
```

启动后浏览器会打开本地地址。首次加载需要联网从 CDN 获取 Three.js；游戏代码和美术几何体均保存在本仓库中。

After startup, the browser opens a local address. The first load requires internet access to obtain Three.js from a CDN; the game logic and procedural geometry are stored in this repository.

## 操作
## Controls

| 中文操作 | English Action | 按键 / Key |
|---|---|---|
| 移动 | Move | W / A / S / D |
| 冲刺 | Sprint | Shift |
| 跳跃 | Jump | Space |
| 观察 | Look | Mouse |
| 射击 | Fire | Left mouse button |
| 换弹 | Reload | R |
| 进入或离开载具 | Enter or exit vehicle | E |
| 释放鼠标 | Release pointer lock | Esc |

## 项目结构
## Project Structure

```text
battlefield-web-fps-prototype/
├─ index.html
├─ src/
│  ├─ game.js
│  └─ style.css
├─ scripts/
│  └─ start_server.py
├─ docs/
│  ├─ ARCHITECTURE.md
│  └─ ROADMAP.md
├─ start_windows.bat
├─ start_mac_linux.sh
├─ THIRD_PARTY_NOTICE.md
└─ README.md
```

`index.html` 定义页面、HUD 与双语界面文本；`src/game.js` 包含场景、输入、敌人、射击、据点和载具逻辑；`src/style.css` 负责 HUD 与启动界面；`scripts/start_server.py` 提供零依赖本地服务器。

`index.html` defines the page, HUD, and bilingual interface text; `src/game.js` contains scene, input, enemy, shooting, objective, and vehicle logic; `src/style.css` controls the HUD and start screen; `scripts/start_server.py` provides a dependency-free local server.

## 技术选择
## Technical Choices

项目使用原生 JavaScript 和 Three.js，不依赖构建工具，便于初学者直接阅读和运行。程序化几何体替代外部模型，以减少版权与资源依赖。

The project uses vanilla JavaScript and Three.js without a build tool so that beginners can read and run it directly. Procedural geometry replaces external models to reduce copyright and asset dependencies.

当前 AI 使用轻量状态逻辑，而不是导航网格或行为树。当前碰撞与载具物理同样是近似实现，因此代码强调可理解性和迭代速度，而非真实模拟。

The current AI uses lightweight state logic rather than a navigation mesh or behavior tree. Collision and vehicle physics are also approximate, so the code prioritizes understandability and iteration speed over realistic simulation.

## 已知限制
## Known Limitations

当前版本没有在线多人同步、完整刚体物理、复杂寻路、骨骼动画、写实美术、存档系统或移动端触控。

The current version does not include online multiplayer synchronization, full rigid-body physics, complex pathfinding, skeletal animation, realistic art, a save system, or mobile touch controls.

敌人可能在障碍附近选择不理想的路径，载具仅提供简化驾驶体验，且 Three.js 目前通过公共 CDN 加载。

Enemies may choose imperfect paths near obstacles, vehicles provide only simplified handling, and Three.js is currently loaded through a public CDN.

## 后续工作
## Future Work

后续优先级包括：恢复多武器系统、加入弹药补给、扩展双阵营 AI、迁移坦克与飞行载具、增加自动化测试，并将静态演示部署到 GitHub Pages。

Next priorities include restoring the multi-weapon system, adding ammunition resupply, expanding two-faction AI, migrating tanks and aircraft, adding automated tests, and deploying the static demo to GitHub Pages.

详细计划见 `docs/ROADMAP.md`。

See `docs/ROADMAP.md` for the detailed plan.

## 贡献与许可
## Contributing and License

欢迎通过 Issue 报告可复现的问题，或通过 Pull Request 提交范围明确的改进。提交前请阅读 `CONTRIBUTING.md`。

Reproducible issues and focused pull requests are welcome. Read `CONTRIBUTING.md` before submitting changes.

本项目采用 MIT 许可证；Three.js 的第三方说明见 `THIRD_PARTY_NOTICE.md`。

This project is licensed under the MIT License; third-party information for Three.js is listed in `THIRD_PARTY_NOTICE.md`.
