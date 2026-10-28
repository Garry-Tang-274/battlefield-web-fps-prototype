# 更新记录 / Changelog

## v0.2.0 — 潮线行动 / Operation Breakwater

### 战斗 / Combat

- 五类武器与独立库存；全自动、半自动和泵动扳机规则；按住瞄准、四倍镜、后坐力、散布、爆头和距离衰减。
- Five independent weapon inventories; automatic, semi-auto and pump trigger rules; ADS, 4× optic, recoil, spread, headshots and range falloff.
- 修复子弹无视掩体、AI 概率直接扣血的问题。双方射击共用遮挡与命中检测。
- Fixed shots ignoring cover and AI applying random direct health damage. Both sides now use shared occlusion and hit resolution.
- 新增重力弹跳手雷、爆炸遮挡、连锁爆炸桶、近战与补给。
- Added bouncing grenades, occluded explosions, chain-reaction barrels, melee and resupply.

### 手感与声音 / Feel and sound

- 枪口焰、弹痕、抛壳、曳光、命中与受击方向、武器与手臂动作。
- Muzzle flashes, impact marks, casings, tracers, hit/damage feedback, and animated weapons and hands.
- 原创 Web Audio 枪声、脚步、换弹、爆炸、空间声像与距离衰减。
- Original Web Audio gunfire, footsteps, reloads, explosions, directional panning and attenuation.
- 120 Hz 移动碰撞、冲刺体力、蹲伏、跳跃缓冲、落地反馈和脱战生命恢复。
- 120 Hz movement/collision, sprint stamina, crouch, buffered jumps, landing feedback and out-of-combat regeneration.
- 修正按鼠标事件截断快速位移的路径，加入逐显示帧完整累积、原始输入、窗口拖动坐标与锁定切换清理；移除甩鼠附加镜头侧倾。
- Replaced per-event mouse clipping with complete render-frame accumulation, raw input, windowed drag coordinates and lock-transition resets; removed turn-induced camera roll.
- 加入明确的发行修订号、资源版本 URL 和只读输入记录，便于区分旧缓存与当前输入问题。
- Added explicit release revisions, versioned asset URLs and read-only input traces to distinguish stale builds from live input issues.

### 对局与世界 / Match and world

- 6 对 6 单人据点战、三个据点、三档难度、增援消耗、阵亡部署与胜负结算。
- Solo 6-v-6 conquest, three objectives, three difficulties, ticket bleed, redeployment and match results.
- 双方 AI 使用二叉堆 A*，按显示帧分配寻路工作，并在受压时寻找掩体。
- AI teams use binary-heap A*, render-frame path budgets and cover seeking under fire.
- 海岸、机库、中继塔、补给站、集装箱、棕榈树、天空和动态海面组成原创低多边形场景。
- Original low-poly scenery with coast, hangar, relay tower, supply station, containers, palms, sky and animated sea.
- 侦察车支持碰撞、惯性、制动、独立瞄准、机枪热量、耐久、爆炸与重新生成。
- The scout supports collision, inertia, braking, independent aim, turret heat, health, destruction and respawn.

### 使用与维护 / Usability and maintenance

- 新部署界面、靶场、设置保存、暂停保护、战术地图、实时战况和本机最佳成绩。
- New deployment UI, firing range, persistent settings, safe pause, tactical map, live scoreboard and personal records.
- Three.js 随仓库附带；保留原 Windows、macOS / Linux 和 Python 启动方式。
- Bundled Three.js and retained Windows, macOS/Linux and Python launchers.
- 拆分运行模块，加入碰撞、战斗规则、导航和鼠标输入的自动化测试；更新说明与路线图。
- Modularized runtime, added automated collision/combat/navigation/mouse tests, and updated documentation and roadmap.
