# 架构说明
# Architecture Notes

## 设计目标
## Design Goals

当前架构优先保证无需构建即可运行、源代码易于阅读、第三方依赖最少，并为后续模块化重构保留清晰边界。

The current architecture prioritizes build-free execution, readable source code, minimal third-party dependencies, and clear boundaries for later modular refactoring.

## 运行时组成
## Runtime Components

浏览器负责渲染、输入、游戏循环和音频；Python 脚本仅提供静态 HTTP 服务，不参与游戏逻辑。

The browser handles rendering, input, the game loop, and audio; the Python script only provides static HTTP serving and does not participate in game logic.

`index.html` 包含稳定的 DOM 与双语 HUD，`src/style.css` 只处理显示，`src/game.js` 当前集中保存原型逻辑。

`index.html` contains the stable DOM and bilingual HUD, `src/style.css` only handles presentation, and `src/game.js` currently centralizes prototype logic.

## 数据流
## Data Flow

键盘和鼠标事件写入输入状态，动画循环读取输入并更新玩家、敌人、载具和 HUD，随后由 Three.js 渲染场景。

Keyboard and mouse events write to input state; the animation loop reads that state, updates the player, enemies, vehicles, and HUD, and then Three.js renders the scene.

射击使用摄像机中心射线检测。敌人采用简化追踪与概率命中，目的是建立可测试的战斗闭环，而不是模拟完整弹道学。

Shooting uses a ray cast from the camera center. Enemies use simplified pursuit and probabilistic hits to establish a testable combat loop rather than simulate complete ballistics.

## 推荐重构顺序
## Recommended Refactoring Order

第一步将配置、输入、实体和 HUD 拆分为独立模块；第二步引入固定时间步；第三步加入碰撞层、导航层和测试层。

First separate configuration, input, entities, and HUD into independent modules; then introduce a fixed time step; finally add collision, navigation, and testing layers.
