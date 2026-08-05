# 群岛前线：联合作战网页 FPS 原型
# Archipelago Frontline: Combined-Arms Web FPS Prototype

![Status](https://img.shields.io/badge/status-playable%20prototype-2f81f7)
![Three.js](https://img.shields.io/badge/Three.js-browser%20runtime-black)
![Language](https://img.shields.io/badge/docs-bilingual-d8aa56)
![License](https://img.shields.io/badge/license-MIT-3fb950)

这是一个使用原生 JavaScript 与 Three.js 构建的浏览器端第一人称射击原型，用于验证步兵、AI 敌人、据点争夺与简化载具能否形成轻量但完整的联合作战循环。

This is a browser-based first-person shooter prototype built with vanilla JavaScript and Three.js. It tests whether infantry combat, AI enemies, capture objectives, and simplified vehicles can form a lightweight but complete combined-arms loop.

> **项目状态：** 当前版本是可运行的垂直切片，而不是商业游戏或任何现有游戏系列的复制品。仓库只使用原创代码、程序化几何体和允许使用的第三方依赖。
>
> **Project status:** The current version is a runnable vertical slice, not a commercial game or a copy of an existing game series. The repository uses original code, procedural geometry, and permitted third-party dependencies only.

[快速运行](#快速运行) · [操作方式](#操作方式) · [架构说明](docs/ARCHITECTURE.md) · [路线图](docs/ROADMAP.md) · [个人主页](https://garry-tang-274.github.io)

[Quick start](#快速运行) · [Controls](#操作方式) · [Architecture](docs/ARCHITECTURE.md) · [Roadmap](docs/ROADMAP.md) · [Portfolio](https://garry-tang-274.github.io)

## 当前可以体验什么
## What Is Playable Now

当前提交包含第一人称移动、鼠标观察、冲刺、跳跃、射击、换弹、敌人 AI、命中与击杀反馈、生命值、计分、据点区域和简化载具驾驶。

The current build includes first-person movement, mouse look, sprinting, jumping, shooting, reloading, enemy AI, hit and kill feedback, health, scoring, a capture zone, and simplified vehicle driving.

此前实验版本曾探索更大的海陆空地图、双阵营 AI、多武器系统、弹药补给和多类载具。后续功能会按路线图逐项迁移、测试和重构，而不是一次性导入未经验证的代码。

Earlier experiments explored a larger land-sea-air map, two-faction AI, multiple weapon classes, ammunition resupply, and several vehicle types. Future features will be migrated, tested, and refactored incrementally rather than imported as an unverified code dump.

## 快速运行
## Quick Start

Windows 用户可双击 `start_windows.bat`。脚本会检测 Python，并启动本地静态网页服务器。

Windows users can double-click `start_windows.bat`. The script checks for Python and starts a local static web server.

macOS 或 Linux 用户执行：

macOS or Linux users can run:

```bash
chmod +x start_mac_linux.sh
./start_mac_linux.sh
```

也可以直接使用 Python 启动器：

The Python launcher can also be used directly:

```bash
python scripts/start_server.py
```

首次加载需要联网从 CDN 获取 Three.js；游戏逻辑与程序化美术几何体保存在仓库中。

The first load requires internet access to obtain Three.js from a CDN; the game logic and procedural art geometry are stored in the repository.

## 操作方式
## Controls

| 中文操作 | English action | 按键 / Key |
|---|---|---|
| 移动 | Move | W / A / S / D |
| 冲刺 | Sprint | Shift |
| 跳跃 | Jump | Space |
| 观察 | Look | Mouse |
| 射击 | Fire | Left mouse button |
| 换弹 | Reload | R |
| 进入或离开载具 | Enter or exit vehicle | E |
| 释放鼠标 | Release pointer lock | Esc |

## 设计取舍
## Design Choices

项目不使用构建工具，便于初学者直接阅读和运行。程序化几何体替代外部模型，以降低版权风险和资源依赖。

The project avoids build tooling so beginners can read and run it directly. Procedural geometry replaces external models to reduce copyright risk and asset dependencies.

当前 AI 使用轻量状态逻辑，碰撞与载具物理也是近似实现。代码优先保证可理解性、快速迭代和明确边界，而不是追求写实模拟。

The current AI uses lightweight state logic, while collision and vehicle physics are approximate. The code prioritizes understandability, rapid iteration, and explicit boundaries over realistic simulation.

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

## 已知限制
## Known Limitations

当前版本没有在线多人同步、完整刚体物理、复杂寻路、骨骼动画、写实美术、存档系统或移动端触控。敌人在障碍附近可能选择不理想的路径，载具只提供简化驾驶体验。

The current version does not include online multiplayer synchronization, full rigid-body physics, complex pathfinding, skeletal animation, realistic art, a save system, or mobile touch controls. Enemies may choose imperfect paths near obstacles, and vehicles provide simplified handling only.

## 后续工作
## Future Work

下一阶段优先恢复多武器系统与弹药补给，扩展双阵营 AI，迁移坦克和飞行载具，加入自动化测试，并部署静态试玩页面。

The next priorities are restoring multiple weapon classes and ammunition resupply, expanding two-faction AI, migrating tanks and aircraft, adding automated tests, and deploying a static playable page.

详细计划见 [路线图](docs/ROADMAP.md)。

See the [roadmap](docs/ROADMAP.md) for details.

## 贡献与许可
## Contributing and License

欢迎通过 Issue 报告可复现问题，或通过 Pull Request 提交范围明确的改进。提交前请阅读 `CONTRIBUTING.md`。

Reproducible issues and focused pull requests are welcome. Read `CONTRIBUTING.md` before submitting changes.

本项目采用 MIT 许可证；Three.js 的第三方说明见 `THIRD_PARTY_NOTICE.md`。

This project is licensed under the MIT License; third-party information for Three.js is listed in `THIRD_PARTY_NOTICE.md`.
