# 架构说明 / Architecture

## 从输入到命中 / From input to impact

`index.html` 提供部署、HUD、暂停、设置、重部署和结算界面。`src/game.js` 拥有唯一的对局状态机、玩家状态与运行循环；没有服务端游戏逻辑。

`index.html` contains deployment, HUD, pause, settings, redeployment and results. `src/game.js` owns the match state machine, player state and loop. There is no server-side game simulation.

| 模块 / Module    | 职责 / Responsibility                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------------- |
| `config.js`      | 武器参数、难度、时间与默认设置 / Weapons, difficulty, timing and defaults                      |
| `look-input.js`  | 鼠标输入累积、拖动坐标与视角计算 / Mouse accumulation, drag coordinates and view angles        |
| `core.js`        | 纯计算：碰撞、射线、导航、弹药、据点 / Pure collision, rays, navigation, ammo and objectives   |
| `world.js`       | 场景、据点、碰撞体、士兵和侦察车模型 / Scene, objectives, colliders, soldiers and scout models |
| `weapon-view.js` | 独立前景场景、武器与手臂动作 / Separate foreground scene, weapon and hand animation            |
| `effects.js`     | 有上限的粒子、弹痕、抛壳与曳光池 / Bounded particle, decal, casing and tracer pools            |
| `audio.js`       | Web Audio 合成、压限、声像和衰减 / Web Audio synthesis, limiting, panning and attenuation      |
| `ui.js`          | 菜单、HUD、地图、设置和本机成绩 / Menus, HUD, map, settings and local records                  |

## 120 Hz 模拟，按显示帧读取鼠标 / 120 Hz simulation, render-frame mouse input

物理以 `1/120 s` 固定步长运行，每个显示帧最多追赶 12 步。鼠标位移是距离，不乘帧时间、不按单个事件硬截断；显示帧在物理更新之前一次性消费全部输入。暂停、失焦和鼠标锁定切换会清除未消费的输入。

Physics runs at `1/120 s`, with at most twelve catch-up steps per display frame. Mouse input represents displacement: it is neither multiplied by frame time nor capped per event. Each display frame consumes the entire input batch before simulation. Pause, focus loss and lock transitions clear pending input.

桌面优先请求 `unadjustedMovement` 原始输入；仅在浏览器报告不支持该选项时改用标准输入并给出提示。拒绝锁定鼠标时显示可选的窗口操作，不自动改换控制方式。窗口拖动使用 `clientX/Y` 坐标差，避免相对位移的重定位跳变。镜头不随甩鼠额外侧倾。

Desktop input prefers `unadjustedMovement`. Only an unsupported-option error retries standard input, with a visible message. A denied lock offers explicit windowed controls rather than silently switching. Windowed dragging uses `clientX/Y` differences to avoid recenter deltas. Turning does not add camera roll.

## 碰撞与战斗共用遮挡 / Collision and combat share occlusion

角色使用圆柱近似的水平圆形碰撞和垂直支撑检测；水平移动分段，避免高速穿过薄墙。建筑的墙与门楣分别建模，门洞是真正的通路。车体采用有惯性、速度相关转向、制动和碰撞的地面运动模型。

Characters use horizontal circle collision with vertical support checks. Horizontal substeps prevent tunnelling through thin cover. Walls and lintels have separate colliders, leaving real doorways. The scout uses inertial ground motion, speed-dependent steering, braking and collision response.

射击先求最近环境交点，再比较头部和身体命中体，前方墙壁和友军会挡住射线。AI 的感知和射击也查询遮挡，不再用概率直接扣玩家生命。随机性用于枪口散布，而命中取决于实际射线。

Gunfire finds the nearest environment hit, then compares head/body hit volumes. Walls and friendly units stop the ray. AI perception and shooting also use occlusion; randomness changes aim spread rather than directly deducting player health.

手雷沿每个时间步的完整线段检查碰撞，应用重力、法线反弹和地面摩擦。爆炸按距离与遮挡结算伤害，爆炸桶可连锁。视觉曳光不改变即时射线的命中规则。

Grenades sweep each step's complete segment, with gravity, normal-based bounce and ground friction. Explosions apply distance falloff and occlusion; barrels can chain. Visual tracers do not alter hitscan resolution.

## AI 与据点 / AI and objectives

AI 分批更新感知，使用四邻接 A\* 网格绕障碍。优先队列采用二叉堆；每个显示帧最多计算一条新路径。双方会进攻据点、交火、换弹和重生；受压时可寻找附近能遮蔽来袭方向的掩体。

AI staggers perception and navigates a four-connected A\* grid. A binary-heap queue limits path-selection cost; at most one new path is calculated per display frame. Both teams attack objectives, engage, reload and respawn. Under fire they can seek nearby cover that occludes the attacker.

据点进度为 `[-1, 1]`，分别对应守军与联军。双方同时在圈内时冻结。敌方据点需先中立化再完全占领。仅多数据点的一方使对方持续失去增援。

Capture progress spans `[-1, 1]`, from defenders to allies. Opposing presence freezes it. Enemy points must be neutralized before flipping; only a majority drains the other team's tickets.

## 资源、保存与发布 / Resources, persistence and publishing

静态场景和士兵的刚性部分按材质合批；旗帜、肢体、雷达、爆炸桶和瞬时特效保留独立更新。特效池有固定容量，避免持续交火无限分配 GPU 资源。

Static scenery and rigid soldier parts are batched by material. Flags, limbs, radar, barrels and transient effects remain separately updated. Fixed-capacity effect pools prevent unbounded GPU allocation during sustained combat.

设置和最佳成绩分别保存在 `frontline.settings.v2`、`frontline.record.v2`。不支持浏览器存储时，在设置或结算处显示本次会话的保存状态。音频只在用户操作后创建，暂停时挂起；依赖加载不访问 CDN。

Settings and records use `frontline.settings.v2` and `frontline.record.v2`. Unavailable storage is reported in settings/results. Audio is created after a user gesture and suspended on pause. Runtime dependencies do not contact a CDN.

GitHub Pages 直接从 `main` 根目录发布，无构建步骤。入口与模块使用发行修订号防止旧缓存混入；修改发行版本时需同步 `BUILD`、入口和本地模块 URL 的 `rev`。Python 启动器要求本地文件重新验证缓存。

GitHub Pages serves the `main` root without building. Entry and module URLs carry a release revision to avoid stale cache mixtures. A release revision updates `BUILD`, entry URLs and local module `rev` values together. The Python launcher revalidates local file caches.
