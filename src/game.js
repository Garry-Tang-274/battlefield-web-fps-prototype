import {
  FIXED_DT,
  MATCH_SECONDS,
  START_TICKETS,
  WEAPONS,
  DIFFICULTIES,
  VERSION,
  BUILD,
} from "./config.js?rev=20261028-r3";
import {
  clamp,
  damp,
  distance,
  terrainHeight,
  circleFree,
  moveCircle,
  castWorld,
  raySphere,
  lineOfSight,
  transferAmmo,
  damageAtRange,
  updateCapture,
  ticketDrain,
  createNav,
} from "./core.js?rev=20261028-r3";
import {
  buildWorld,
  createSoldier,
  material,
} from "./world.js?rev=20261028-r3";
import { BattlefieldAudio } from "./audio.js?rev=20261028-r3";
import { Effects } from "./effects.js?rev=20261028-r3";
import { WeaponView } from "./weapon-view.js?rev=20261028-r3";
import { Interface, readSettings, $, show } from "./ui.js?rev=20261028-r3";
import { LookInput, applyLook } from "./look-input.js?rev=20261028-r3";

const T = window.THREE;
const settings = readSettings();
const look = new LookInput(),
  debugMode = new URLSearchParams(location.search).has("debug");
let renderer, scene, camera, world, audio, fx, weaponView, ui;
const input = {
  keys: new Set(),
  fire: false,
  aim: false,
  look: false,
  queued: 0,
  jumpBuffer: 0,
};
const p = {
  x: 0,
  y: 0,
  z: 68,
  vx: 0,
  vy: 0,
  vz: 0,
  yaw: 0,
  pitch: 0,
  eye: 1.7,
  grounded: true,
  coyote: 0,
  health: 100,
  stamina: 100,
  sprint: 0,
  crouched: false,
  ads: 0,
  bloom: 0,
  recoil: 0,
  recoilV: 0,
  weapon: 0,
  inventory: [],
  cooldown: 0,
  reloadTime: 0,
  reloadStage: false,
  switchTime: 0,
  grenades: 2,
  grenadeTime: 0,
  meleeTime: 0,
  dead: false,
  respawn: 0,
  vehicle: false,
  invulnerable: 0,
  lastDamage: -99,
  stepDistance: 0,
  land: 0,
  staminaDelay: 0,
};
const game = {
  phase: "menu",
  paused: false,
  player: p,
  bots: [],
  targets: [],
  grenades: [],
  time: 0,
  remaining: MATCH_SECONDS,
  tickets: { blue: START_TICKETS, red: START_TICKETS },
  stats: {},
  mode: "conquest",
  difficulty: "regular",
  interaction: "",
  world: null,
  camera: null,
};
let nav,
  accumulator = 0,
  lastTime = performance.now() / 1000,
  renderTime = 0,
  hudClock = 0,
  frameCount = 0,
  fpsClock = 0,
  smoothedFps = 60,
  dryCooldown = 0;
let environmentTime = 0,
  modalReturn = "menu",
  botPathBudget = 0,
  windowed = false,
  pointerPending = false,
  rawInputActive = false,
  diagnosticTime = 0;
const v1 = new T.Vector3(),
  v2 = new T.Vector3();
const frameSamples = [];
const motionTrace = [];
let frameP95 = 0,
  frameMax = 0,
  navMilliseconds = 0;

function fail(message) {
  show("errorScreen");
  $("errorMessage").textContent = message;
}
$("retryButton").onclick = () => location.reload();
try {
  init();
} catch (error) {
  console.error(error);
  fail(
    "无法初始化 3D 战场。请启用浏览器硬件加速后重试。 / Unable to initialize 3D. Enable browser hardware acceleration and reload.",
  );
}

function init() {
  if (!T) throw new Error("Three.js is unavailable");
  document.documentElement.dataset.build = BUILD;
  document.querySelector(".build-label").innerHTML =
    `SINGLE PLAYER <i></i> v${VERSION} / ${BUILD}`;
  document.querySelector("#pauseMenu .overline").textContent =
    `TACTICAL PAUSE / ${BUILD}`;
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(
    settings.fov,
    innerWidth / innerHeight,
    0.08,
    1100,
  );
  camera.rotation.order = "YXZ";
  renderer = new T.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.info.autoReset = false;
  renderer.domElement.setAttribute(
    "aria-label",
    "群岛前线战场 / Archipelago Frontline battlefield",
  );
  $("game").appendChild(renderer.domElement);
  world = buildWorld(scene);
  audio = new BattlefieldAudio();
  fx = new Effects(scene);
  weaponView = new WeaponView();
  game.world = world;
  game.camera = camera;
  nav = createNav(world.colliders);
  ui = new Interface(settings, {
    settingsChanged: applySettings,
    uiSound: () => audio.ui(),
  });
  ui.bindPoints(world.points);
  applySettings();
  const names = ["ALPHA", "BRAVO", "DELTA", "ECHO", "FOXTROT"];
  for (let i = 0; i < 11; i++) {
    const team = i < 5 ? 1 : -1,
      model = createSoldier(scene, team);
    model.group.visible = false;
    game.bots.push({
      id: i,
      team,
      name: team === 1 ? names[i] + "-01" : "RAVEN-0" + (i - 4),
      model,
      x: 0,
      y: 0,
      z: 0,
      yaw: 0,
      health: 100,
      alive: true,
      respawn: 0,
      navTime: 0,
      thinkTime: 0,
      shotTime: 0,
      reloadTime: 0,
      mag: 24,
      burst: 0,
      burstPause: 0,
      reaction: 0,
      target: null,
      path: [],
      walk: 0,
      flash: 0,
      lastFired: -99,
      lastDamage: -99,
      underFire: 0,
      coverTime: 0,
      coverDest: null,
      tacticTime: 0,
      objective: i % 3,
      playerHit: -99,
    });
  }
  for (const [i, x, z] of [
    [0, -65, 25],
    [1, -70, 10],
    [2, -60, 0],
    [3, -65, -16],
  ]) {
    const model = createSoldier(scene, -1, true);
    model.group.visible = false;
    game.targets.push({
      id: 100 + i,
      team: -1,
      name: `靶标 / TARGET 0${i + 1}`,
      model,
      x,
      y: 0,
      z,
      yaw: Math.PI,
      health: 100,
      alive: true,
      respawn: 0,
      training: true,
    });
  }
  installControls();
  bindMenus();
  renderer.domElement.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    pause();
    fail(
      "图形上下文已中断。重新加载可恢复游戏。 / Graphics context lost. Reload to restore the game.",
    );
  });
  $("startButton").disabled = false;
  $("startButton").firstElementChild.textContent = "部署出击 / DEPLOY";
  // Read-only diagnostics. No gameplay commands or hidden cheats.
  Object.defineProperty(window, "frontline", {
    value: Object.freeze({
      version: VERSION,
      snapshot: () => ({
        build: BUILD,
        phase: game.phase,
        paused: game.paused,
        mode: game.mode,
        windowed,
        time: Math.round(game.time * 10) / 10,
        remaining: Math.ceil(game.remaining),
        player: {
          x: p.x,
          y: p.y,
          z: p.z,
          yaw: p.yaw,
          pitch: p.pitch,
          health: p.health,
          stamina: p.stamina,
          crouched: p.crouched,
          weapon: WEAPONS[p.weapon].id,
          mag: p.inventory[p.weapon]?.mag,
          reserve: p.inventory[p.weapon]?.reserve,
          inventory: p.inventory.map((a) => ({ ...a })),
          dead: p.dead,
          vehicle: p.vehicle,
          reloading: p.reloadTime > 0,
          ads: p.ads,
        },
        tickets: { ...game.tickets },
        points: world.points.map((q) => ({
          id: q.id,
          owner: q.owner,
          progress: q.progress,
          contested: q.contested,
        })),
        bots: game.bots.map((b) => ({
          id: b.id,
          team: b.team,
          alive: b.alive,
          x: b.x,
          z: b.z,
          health: b.health,
          cover: b.coverTime > 0,
        })),
        targets: game.targets.map((b) => ({
          alive: b.alive,
          health: b.health,
        })),
        grenades: game.grenades.length,
        stats: { ...game.stats },
        audio: {
          state: audio.ctx?.state || "locked",
          voices: audio.voices,
          volume: audio.volume,
          peak: audio.meter(),
        },
        graphics: {
          calls: renderer.info.render.calls,
          triangles: renderer.info.render.triangles,
          fps: Math.round(smoothedFps),
          frameP95Ms: Math.round(frameP95 * 10) / 10,
          frameMaxMs: Math.round(frameMax * 10) / 10,
          navigationMs: Math.round(navMilliseconds * 100) / 100,
        },
        inputMode: windowed ? "windowed" : rawInputActive ? "raw" : "standard",
      }),
    }),
    writable: false,
  });
  requestAnimationFrame(frame);
}

function applySettings() {
  if (!renderer) return;
  audio.setVolume(settings.volume);
  renderer.setPixelRatio(
    Math.min(devicePixelRatio, settings.quality === "high" ? 1.5 : 1),
  );
  renderer.shadowMap.enabled = settings.quality === "high";
  renderer.shadowMap.needsUpdate = true;
  renderer.setSize(innerWidth, innerHeight);
  camera.fov = settings.fov;
  camera.updateProjectionMatrix();
  ui?.syncSettings();
}
function clearInput() {
  input.keys.clear();
  input.fire = input.aim = input.look = false;
  input.queued = input.jumpBuffer = 0;
  look.reset();
}
function locked() {
  return document.pointerLockElement === renderer.domElement;
}
async function lockPointer() {
  if (!renderer.domElement.requestPointerLock) {
    pause();
    ui.message(
      "请使用支持鼠标锁定的桌面浏览器。 / Use a desktop browser with pointer lock.",
    );
    return;
  }
  pointerPending = true;
  rawInputActive = false;
  try {
    try {
      await renderer.domElement.requestPointerLock({
        unadjustedMovement: settings.rawInput,
      });
      rawInputActive = settings.rawInput;
    } catch (error) {
      if (error.name !== "NotSupportedError" || !settings.rawInput) throw error;
      await renderer.domElement.requestPointerLock();
      ui.message(
        "浏览器不支持原始输入，已使用标准鼠标输入。 / Raw input unsupported. Using standard pointer input.",
        3,
      );
    }
  } catch (error) {
    pointerFailure(error);
  } finally {
    pointerPending = false;
  }
}
function pointerFailure(error) {
  if (game.phase !== "active" || p.dead || windowed) return;
  pause();
  show("windowedButton");
  $("pauseMenu").querySelector("p:not(.overline)").textContent =
    "浏览器未能锁定鼠标。可重试，或选择窗口操作。 / Pointer capture unavailable. Retry or use windowed controls.";
  if (error) console.info("Pointer capture:", error.name, error.message);
}
function hideScreens() {
  for (const id of [
    "menu",
    "pauseMenu",
    "settingsMenu",
    "helpMenu",
    "deathScreen",
    "endScreen",
  ])
    show(id, false);
}
function startMatch() {
  audio.unlock().then((ok) => {
    if (!ok)
      ui.message(
        "音频不可用，游戏仍可继续。 / Audio unavailable; the game can continue.",
        4,
      );
  });
  clearInput();
  hideScreens();
  world.reset();
  fx.reset();
  ui.reset();
  motionTrace.length = 0;
  windowed = false;
  show("windowedButton", false);
  show("scoreboard", false);
  document.querySelector(".minimap-frame").classList.remove("expanded");
  $("bottomHint").textContent =
    "WASD 移动 / MOVE　⇧ 冲刺 / SPRINT　R 换弹 / RELOAD　ESC 暂停 / PAUSE";
  game.phase = "active";
  game.paused = false;
  game.mode = ui.mode;
  game.difficulty = $("difficulty").value;
  game.time = 0;
  game.remaining = MATCH_SECONDS;
  game.tickets = { blue: START_TICKETS, red: START_TICKETS };
  game.stats = {
    score: 0,
    kills: 0,
    deaths: 0,
    shots: 0,
    hits: 0,
    headshots: 0,
    captures: 0,
  };
  game.grenades.forEach((g) => scene.remove(g.mesh));
  game.grenades = [];
  accumulator = 0;
  if (game.mode === "conquest") {
    world.points[2].owner = -1;
    world.points[2].progress = -1;
  }
  resetPlayer(
    ui.weapon,
    game.mode === "training" ? { x: -65, z: 44 } : { x: 0, z: 68 },
  );
  for (const bot of game.bots) {
    bot.model.group.visible = game.mode === "conquest";
    respawnBot(bot, true);
  }
  for (const target of game.targets) {
    target.health = 100;
    target.alive = true;
    target.respawn = 0;
    target.model.group.visible = game.mode === "training";
    target.model.group.position.set(target.x, 0, target.z);
    target.model.group.rotation.set(0, Math.PI, 0);
  }
  show("hud");
  document.body.classList.add("playing");
  ui.message(
    game.mode === "training"
      ? "自由靶场 / FIRING RANGE\n试试右键瞄准，1–5 切换武器。 / Hold RMB to aim. 1–5 switches weapons."
      : "潮线行动 / OPERATION BREAKWATER\n占领多数据点，切断敌方增援。 / Hold the majority. Cut their reinforcements.",
    5,
  );
  audio.ui("capture");
  lockPointer();
}
function resetPlayer(weapon, spawn) {
  Object.assign(p, {
    x: spawn.x,
    z: spawn.z,
    y: terrainHeight(spawn.x, spawn.z),
    vx: 0,
    vy: 0,
    vz: 0,
    yaw: 0,
    pitch: 0,
    eye: 1.7,
    health: 100,
    stamina: 100,
    sprint: 0,
    crouched: false,
    ads: 0,
    bloom: 0,
    recoil: 0,
    recoilV: 0,
    weapon,
    cooldown: 0.2,
    reloadTime: 0,
    switchTime: 0,
    grenades: 2,
    grenadeTime: 0,
    meleeTime: 0,
    dead: false,
    respawn: 0,
    vehicle: false,
    invulnerable: 2.5,
    lastDamage: -99,
    stepDistance: 0,
    land: 0,
    staminaDelay: 0,
    grounded: true,
    coyote: 0.12,
  });
  p.inventory = WEAPONS.map((w) => ({ mag: w.mag, reserve: w.reserve }));
  weaponView.select(weapon);
  weaponView.update(1 / 60, { alive: true });
  show("deathScreen", false);
  clearInput();
  updateCamera(1 / 60);
}
function respawnBot(b, initial = false) {
  const z = b.team === 1 ? 61 : -63;
  let spawn;
  for (let tries = 0; tries < 25; tries++) {
    const candidate = {
      x: ((b.id % 3) - 1) * 23 + (Math.random() - 0.5) * 9,
      z: z + (Math.random() - 0.5) * 10,
    };
    if (
      circleFree(candidate.x, candidate.z, 0.6, world.colliders) &&
      distance(candidate, world.jeep) > 4
    ) {
      spawn = candidate;
      break;
    }
  }
  spawn ||= { x: 0, z: b.team === 1 ? 68 : -68 };
  Object.assign(b, {
    x: spawn.x,
    z: spawn.z,
    y: 0,
    yaw: b.team === 1 ? 0 : Math.PI,
    health: 100,
    alive: true,
    respawn: 0,
    navTime: Math.random(),
    thinkTime: Math.random() * 0.3,
    shotTime: 0,
    reloadTime: 0,
    mag: 24,
    burst: 0,
    burstPause: 0,
    reaction: 0,
    target: null,
    path: [],
    walk: 0,
    flash: 0,
    lastFired: -99,
    lastDamage: -99,
    underFire: 0,
    coverTime: 0,
    coverDest: null,
    tacticTime: Math.random() * 2,
    playerHit: -99,
  });
  b.model.group.visible = game.mode === "conquest";
  b.model.group.position.set(b.x, 0, b.z);
  b.model.group.rotation.set(0, b.yaw, 0);
  b.model.legs.forEach((l) => (l.rotation.x = 0));
  if (!initial) b.objective = (b.objective + 1) % 3;
  else {
    b.kills = 0;
    b.deaths = 0;
  }
}
function pause() {
  if (game.phase !== "active" || game.paused) return;
  game.paused = true;
  clearInput();
  audio.pause();
  show("pauseMenu");
  show("deathScreen", false);
  show("scoreboard", false);
  if (locked()) document.exitPointerLock();
}
function resume() {
  if (game.phase !== "active") return;
  show("pauseMenu", false);
  show("settingsMenu", false);
  show("helpMenu", false);
  game.paused = false;
  clearInput();
  audio.unlock();
  if (p.dead) show("deathScreen");
  else if (!windowed) lockPointer();
}
function returnToMenu() {
  game.phase = "menu";
  game.paused = false;
  clearInput();
  audio.pause();
  hideScreens();
  show("menu");
  show("hud", false);
  document.body.classList.remove("playing");
  if (locked()) document.exitPointerLock();
  game.bots.forEach((b) => (b.model.group.visible = false));
  game.targets.forEach((b) => (b.model.group.visible = false));
  game.grenades.forEach((g) => scene.remove(g.mesh));
  game.grenades = [];
  fx.reset();
  world.reset();
}
function openModal(id) {
  modalReturn = game.phase === "active" ? "pauseMenu" : "menu";
  if (game.phase === "active") pause();
  show(modalReturn, false);
  show(id);
  $(id).querySelector("button,input,select")?.focus();
}
function closeModal(id) {
  show(id, false);
  show(modalReturn);
  $(modalReturn).querySelector("button:not(:disabled)")?.focus();
}
function bindMenus() {
  $("startButton").onclick = startMatch;
  $("resumeButton").onclick = resume;
  $("windowedButton").onclick = () => {
    windowed = true;
    resume();
    $("bottomHint").textContent =
      "WASD 移动 / MOVE · 右键拖动 / RMB DRAG LOOK · Q 瞄准 / AIM · P 暂停 / PAUSE";
    ui.message(
      "窗口操作：右键拖动观察，Q 切换瞄准。 / WINDOWED: RMB drag to look. Q toggles aim.",
      5,
    );
  };
  $("menuSettings").onclick = $("pauseSettings").onclick = () =>
    openModal("settingsMenu");
  $("helpButton").onclick = $("pauseHelp").onclick = () =>
    openModal("helpMenu");
  for (const b of document.querySelectorAll("[data-close]"))
    b.onclick = () => closeModal(b.dataset.close);
  $("pauseButton").onclick = pause;
  $("returnButton").onclick = $("endReturn").onclick = returnToMenu;
  $("restartButton").onclick = $("playAgain").onclick = startMatch;
  $("redeployButton").onclick = redeploy;
}
function installControls() {
  document.addEventListener("keydown", (e) => {
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLSelectElement
    )
      return;
    if (e.code === "Escape" || e.code === "KeyP") {
      if (!$("settingsMenu").classList.contains("hidden")) {
        closeModal("settingsMenu");
        return;
      }
      if (!$("helpMenu").classList.contains("hidden")) {
        closeModal("helpMenu");
        return;
      }
      if (game.phase === "active" && !e.repeat) {
        if (game.paused && e.code === "KeyP") resume();
        else pause();
      }
      return;
    }
    if (game.phase !== "active" || game.paused) return;
    if (p.dead) {
      if (e.code === "Space" && p.respawn <= 0) {
        e.preventDefault();
        redeploy();
      }
      return;
    }
    if (!locked() && !windowed) return;
    if (
      [
        "Space",
        "Tab",
        "ControlLeft",
        "ControlRight",
        "KeyW",
        "KeyA",
        "KeyS",
        "KeyD",
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
      ].includes(e.code)
    )
      e.preventDefault();
    input.keys.add(e.code);
    if (e.code === "Tab") show("scoreboard");
    if (e.repeat) return;
    if (e.code === "Space") input.jumpBuffer = 0.15;
    if (e.code === "KeyQ" && windowed) input.aim = !input.aim;
    if (e.code === "KeyR") reload();
    if (e.code === "KeyE") interact();
    if (e.code === "KeyG") throwGrenade();
    if (e.code === "KeyV") melee();
    if (e.code === "KeyM")
      document.querySelector(".minimap-frame").classList.toggle("expanded");
    if (/^Digit[1-5]$/.test(e.code)) switchWeapon(Number(e.code.slice(5)) - 1);
  });
  document.addEventListener("keyup", (e) => {
    input.keys.delete(e.code);
    if (e.code === "Tab") show("scoreboard", false);
  });
  document.addEventListener("mousemove", (e) => {
    if (game.phase !== "active" || game.paused || p.dead) return;
    if (locked()) look.relative(e.movementX, e.movementY);
    else if (windowed && input.look) look.drag(e.clientX, e.clientY);
  });
  document.addEventListener("mousedown", (e) => {
    if (
      game.phase !== "active" ||
      game.paused ||
      p.dead ||
      (!locked() && !windowed)
    )
      return;
    if (e.button === 0) {
      input.fire = true;
      input.queued = 0.25;
    }
    if (e.button === 2) {
      input.look = true;
      if (windowed) look.beginDrag(e.clientX, e.clientY);
      else input.aim = true;
    }
  });
  document.addEventListener("mouseup", (e) => {
    if (e.button === 0) input.fire = false;
    if (e.button === 2) {
      input.look = false;
      look.endDrag();
      if (!windowed) input.aim = false;
    }
  });
  renderer.domElement.addEventListener("contextmenu", (e) =>
    e.preventDefault(),
  );
  renderer.domElement.addEventListener(
    "wheel",
    (e) => {
      if ((!locked() && !windowed) || game.paused || p.dead) return;
      e.preventDefault();
      if (p.switchTime <= 0)
        switchWeapon((p.weapon + (e.deltaY > 0 ? 1 : 4)) % 5);
    },
    { passive: false },
  );
  document.addEventListener("pointerlockchange", () => {
    look.reset(locked());
    if (
      !locked() &&
      !windowed &&
      game.phase === "active" &&
      !game.paused &&
      !p.dead
    )
      pause();
  });
  document.addEventListener("pointerlockerror", () => {
    if (!pointerPending) pointerFailure();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pause();
  });
  window.addEventListener("blur", () => pause());
  window.addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    weaponView.resize();
  });
}

function switchWeapon(index) {
  if (p.vehicle || p.dead || index === p.weapon) return;
  p.weapon = index;
  p.reloadTime = 0;
  p.switchTime = 0.3;
  p.cooldown = Math.max(p.cooldown, 0.2);
  p.ads = 0;
  p.bloom = 0;
  weaponView.select(index);
  audio.reload(0);
}
function reload() {
  if (p.dead || p.vehicle || p.reloadTime > 0 || p.meleeTime > 0) return;
  const w = WEAPONS[p.weapon],
    a = p.inventory[p.weapon];
  if (a.mag >= w.mag || a.reserve === 0) return;
  p.reloadTime = w.reload;
  p.reloadStage = false;
  input.aim = false;
  audio.reload(0);
}
function aimDirection() {
  return new T.Vector3(0, 0, -1).applyEuler(
    new T.Euler(p.pitch + p.recoil, p.yaw, 0, "YXZ"),
  );
}
function eyeOf(unit) {
  return {
    x: unit.x,
    y: (unit.y || 0) + (unit === p ? p.eye : 1.5),
    z: unit.z,
  };
}
function units() {
  return game.mode === "training" ? game.targets : game.bots;
}
function activeColliders(ignoreVehicle = false) {
  return ignoreVehicle || world.jeep.destroyed
    ? world.colliders
    : [...world.colliders, world.jeep.collider];
}
function rayUnit(origin, dir, unit, range) {
  let best = null;
  const feet = unit.y || 0,
    short = unit === p && p.crouched;
  for (const [y, r, head] of [
    [short ? 0.97 : 1.72, 0.23, true],
    [short ? 0.68 : 1.23, 0.34, false],
    [short ? 0.43 : 0.72, 0.33, false],
  ]) {
    const hit = raySphere(
      origin,
      dir,
      { x: unit.x, y: feet + y, z: unit.z },
      r,
      range,
    );
    if (hit !== null && (!best || hit < best.distance))
      best = { distance: hit, head };
  }
  return best;
}
function shootRay(
  origin,
  dir,
  range,
  baseDamage,
  team,
  source,
  weapon,
  headMultiplier = 2,
  falloff = null,
) {
  const env = castWorld(
    origin,
    dir,
    activeColliders(source === p && p.vehicle),
    range,
  );
  let length = env?.distance ?? range,
    target = null,
    head = false;
  for (const unit of [...units(), p]) {
    if (
      unit === source ||
      (unit === p && (p.dead || game.mode === "training")) ||
      (unit !== p && !unit.alive)
    )
      continue;
    const hit = rayUnit(origin, dir, unit, length);
    if (hit && hit.distance < length) {
      length = hit.distance;
      target = unit;
      head = hit.head;
    }
  }
  const end = new T.Vector3(
    origin.x + dir.x * length,
    origin.y + dir.y * length,
    origin.z + dir.z * length,
  );
  let effectiveHit = false;
  if (target) {
    if (
      (target.team !== team && target !== p) ||
      (target === p && team !== 1)
    ) {
      const damage = falloff
        ? damageAtRange(falloff, length, head)
        : baseDamage * (head ? headMultiplier : 1);
      hitUnit(target, damage, source, weapon, head);
      fx.hit(end, head);
      effectiveHit = true;
    }
  } else if (env) {
    fx.impact(
      end,
      new T.Vector3(env.normal.x, env.normal.y, env.normal.z),
      env.collider.surface,
    );
    audio.impact(env.collider.surface, end);
    if (env.collider.barrel)
      damageBarrel(env.collider.barrel, baseDamage, source);
    if (env.collider === world.jeep.collider) damageJeep(baseDamage, source);
  }
  const muzzle =
    source === p
      ? new T.Vector3(origin.x, origin.y - 0.13, origin.z).addScaledVector(
          dir,
          0.7,
        )
      : new T.Vector3(origin.x, origin.y - 0.18, origin.z).addScaledVector(
          dir,
          0.55,
        );
  fx.tracer(muzzle, end, team === -1);
  return {
    hit: effectiveHit,
    head,
    killed: !!target && target !== p && !target.alive,
  };
}
function playerFire() {
  if (
    p.dead ||
    p.cooldown > 0 ||
    p.reloadTime > 0 ||
    p.switchTime > 0 ||
    p.meleeTime > 0 ||
    p.grenadeTime > 0.25 ||
    p.sprint > 0.38
  )
    return false;
  if (p.vehicle) return turretFire();
  const w = WEAPONS[p.weapon],
    a = p.inventory[p.weapon];
  if (a.mag <= 0) {
    if (dryCooldown <= 0) {
      audio.empty();
      dryCooldown = 0.35;
      if (a.reserve === 0)
        ui.message(
          "弹药耗尽 · 寻找绿色补给箱 / OUT OF AMMO · Find a green supply crate",
          2,
        );
    }
    if (a.reserve > 0) reload();
    input.queued = 0;
    return false;
  }
  a.mag--;
  p.cooldown = w.interval;
  p.invulnerable = 0;
  game.stats.shots++;
  const origin = eyeOf(p),
    dir = aimDirection();
  let anyHit = false,
    head = false,
    killed = false;
  const move = Math.hypot(p.vx, p.vz),
    spread =
      w.spread * (1 - p.ads) +
      w.adsSpread * p.ads +
      (p.grounded ? 0 : 0.022) +
      p.bloom +
      (1 - p.ads * 0.8) * move * 0.0012;
  for (let n = 0; n < w.pellets; n++) {
    const radius = Math.sqrt(Math.random()) * spread,
      angle = Math.random() * Math.PI * 2;
    v1.set(Math.cos(p.yaw), 0, -Math.sin(p.yaw));
    v2.crossVectors(v1, dir).normalize();
    const ray = dir
      .clone()
      .addScaledVector(v1, Math.cos(angle) * radius)
      .addScaledVector(v2, Math.sin(angle) * radius)
      .normalize();
    const result = shootRay(
      origin,
      ray,
      w.range,
      w.damage,
      1,
      p,
      w.name,
      w.head,
      w,
    );
    anyHit ||= result.hit;
    head ||= result.head && result.hit;
    killed ||= result.killed;
  }
  if (anyHit) {
    game.stats.hits++;
    if (!killed) {
      ui.hit(false, head);
      if (settings.hitSound) audio.confirm(false, head);
    } else ui.hit(true, head);
  }
  p.bloom = clamp(p.bloom + 0.003 * (1 - p.ads * 0.7), 0, 0.025);
  p.recoilV += w.recoil * 24 * (1 - p.ads * 0.4);
  p.yaw += (Math.random() - 0.5) * w.recoil * 0.17;
  weaponView.fire(w.recoil / 0.018);
  audio.gun(w.sound);
  fx.shell(new T.Vector3(p.x, p.y + p.eye - 0.15, p.z), p.yaw);
  input.queued = 0;
  return true;
}
function hitUnit(unit, amount, source, weapon, head = false) {
  if (unit === p) {
    if (p.dead || p.invulnerable > 0) return;
    const old = p.health;
    p.health = Math.max(0, p.health - amount);
    p.lastDamage = game.time;
    const dir = source
      ? Math.atan2(source.x - p.x, -(source.z - p.z)) + p.yaw
      : 0;
    ui.damage(dir);
    if (old - p.health > 3) audio.hurt();
    if (p.health <= 0) die(source, weapon);
    return;
  }
  if (!unit.alive) return;
  unit.health -= amount;
  unit.lastDamage = game.time;
  unit.underFire = 2;
  if (source === p) unit.playerHit = game.time;
  if (unit.health > 0) return;
  unit.alive = false;
  unit.respawn = unit.training ? 2.2 : 6 + Math.random() * 2;
  unit.model.marker.visible = false;
  unit.model.muzzle.visible = false;
  if (!unit.training) {
    unit.deaths++;
    if (source && source !== p) source.kills = (source.kills || 0) + 1;
  }
  if (unit.training) {
    game.stats.score += 50;
    game.stats.kills++;
    ui.score(
      `靶标命中 / TARGET DOWN +50${head ? "\n精准射击 / HEADSHOT" : ""}`,
    );
    ui.hit(true, head);
    if (settings.hitSound) audio.confirm(true, head);
    return;
  }
  game.tickets[unit.team === 1 ? "blue" : "red"] = Math.max(
    0,
    game.tickets[unit.team === 1 ? "blue" : "red"] - 1,
  );
  ui.kill(
    source === p ? "你 / YOU" : source?.name || "爆炸 / BLAST",
    unit.name,
    source?.team ?? 1,
    weapon,
    head,
  );
  if (source === p) {
    game.stats.score += head ? 150 : 100;
    game.stats.kills++;
    if (head) game.stats.headshots++;
    ui.score(
      `${head ? "精准击杀 / HEADSHOT" : "击杀确认 / ELIMINATION"} +${head ? 150 : 100}`,
    );
    ui.hit(true, head);
    if (settings.hitSound) audio.confirm(true, head);
  } else if (game.time - unit.playerHit < 8 && unit.team === -1) {
    game.stats.score += 40;
    ui.score("协助击杀 / ASSIST +40");
  }
}
function die(source, weapon) {
  p.dead = true;
  p.health = 0;
  p.vehicle = false;
  p.respawn = 5;
  clearInput();
  show("scoreboard", false);
  p.reloadTime = 0;
  game.stats.deaths++;
  if (source && source !== p) source.kills = (source.kills || 0) + 1;
  game.tickets.blue = Math.max(0, game.tickets.blue - 3);
  $("deathCause").textContent =
    `${source?.name || "环境 / ENVIRONMENT"} · ${weapon}`;
  $("spawnSelect").innerHTML =
    '<option value="base">联军基地 / ALLIED BASE</option>' +
    world.points
      .filter((q) => q.owner === 1 && !q.contested)
      .map(
        (q) => `<option value="${q.id}">${q.id} · ${q.name} / ${q.en}</option>`,
      )
      .join("");
  show("deathScreen");
  if (locked()) document.exitPointerLock();
}
function redeploy() {
  if (!p.dead || p.respawn > 0 || game.phase !== "active") return;
  const point = world.points.find(
    (q) => q.id === $("spawnSelect").value && q.owner === 1 && !q.contested,
  );
  let spawn = { x: 0, z: 68 };
  if (point) {
    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2,
        candidate = {
          x: point.x + Math.cos(angle) * 6,
          z: point.z + Math.sin(angle) * 6,
        },
        danger = game.bots.some(
          (b) => b.alive && b.team === -1 && distance(b, candidate) < 13,
        );
      if (
        !danger &&
        circleFree(candidate.x, candidate.z, 0.5, activeColliders())
      ) {
        spawn = candidate;
        break;
      }
    }
  }
  resetPlayer(p.weapon, spawn);
  game.paused = false;
  audio.unlock();
  ui.message("增援已抵达 / REINFORCEMENTS DEPLOYED", 2);
  if (!windowed) lockPointer();
}
function throwGrenade() {
  if (
    p.dead ||
    p.vehicle ||
    p.grenades <= 0 ||
    p.grenadeTime > 0 ||
    p.meleeTime > 0
  )
    return;
  p.grenades--;
  p.grenadeTime = 0.7;
  p.reloadTime = 0;
  p.invulnerable = 0;
  const dir = aimDirection(),
    origin = new T.Vector3(p.x, p.y + p.eye - 0.1, p.z).addScaledVector(
      dir,
      0.65,
    );
  const mesh = new T.Mesh(
    new T.SphereGeometry(0.11, 8, 6),
    material(0x4c6344, 0.2),
  );
  mesh.position.copy(origin);
  scene.add(mesh);
  game.grenades.push({
    mesh,
    v: dir.multiplyScalar(18).add(new T.Vector3(p.vx * 0.5, 4, p.vz * 0.5)),
    fuse: 2.8,
    source: p,
    bounces: 0,
  });
  audio.reload(1);
}
function melee() {
  if (p.dead || p.vehicle || p.meleeTime > 0 || p.grenadeTime > 0) return;
  p.meleeTime = 0.52;
  p.reloadTime = 0;
  p.invulnerable = 0;
  audio.jump(false);
  const origin = eyeOf(p),
    dir = aimDirection();
  let closest = null,
    range = 2.5;
  for (const b of units()) {
    if (!b.alive || b.team === 1) continue;
    const dx = b.x - p.x,
      dz = b.z - p.z,
      d = Math.hypot(dx, dz);
    if (
      d < range &&
      (dx * dir.x + dz * dir.z) / Math.max(d, 0.01) > 0.65 &&
      lineOfSight(origin, eyeOf(b), world.colliders)
    ) {
      closest = b;
      range = d;
    }
  }
  if (closest) {
    hitUnit(closest, 110, p, "近战 / MELEE");
    fx.hit(new T.Vector3(closest.x, 1.3, closest.z));
    ui.hit(true);
    if (settings.hitSound) audio.confirm(true);
  }
}

function updatePlayer(dt) {
  p.invulnerable = Math.max(0, p.invulnerable - dt);
  p.cooldown = Math.max(0, p.cooldown - dt);
  p.switchTime = Math.max(0, p.switchTime - dt);
  p.grenadeTime = Math.max(0, p.grenadeTime - dt);
  p.meleeTime = Math.max(0, p.meleeTime - dt);
  dryCooldown = Math.max(0, dryCooldown - dt);
  input.queued = Math.max(0, input.queued - dt);
  input.jumpBuffer = Math.max(0, input.jumpBuffer - dt);
  p.bloom = damp(p.bloom, 0, 7, dt);
  p.recoilV += (-95 * p.recoil - 17 * p.recoilV) * dt;
  p.recoil = clamp(p.recoil + p.recoilV * dt, -0.01, 0.4);
  p.land = damp(p.land, 0, 10, dt);
  if (p.dead) {
    p.respawn = Math.max(0, p.respawn - dt);
    return;
  }
  const w = WEAPONS[p.weapon];
  if (p.reloadTime > 0) {
    p.reloadTime = Math.max(0, p.reloadTime - dt);
    if (!p.reloadStage && p.reloadTime < w.reload * 0.28) {
      p.reloadStage = true;
      audio.reload(1);
    }
    if (p.reloadTime === 0) {
      p.inventory[p.weapon] = transferAmmo(
        p.inventory[p.weapon].mag,
        p.inventory[p.weapon].reserve,
        w.mag,
      );
      audio.reload(1);
    }
  }
  const k = input.keys;
  if (windowed) {
    p.yaw +=
      (Number(k.has("ArrowLeft")) - Number(k.has("ArrowRight"))) * dt * 1.4;
    p.pitch = clamp(
      p.pitch + (Number(k.has("ArrowUp")) - Number(k.has("ArrowDown"))) * dt,
      -1.45,
      1.45,
    );
  }
  if (p.vehicle) {
    updateVehicle(dt);
    p.ads = damp(p.ads, 0, 15, dt);
    p.sprint = 0;
  } else {
    const crouch =
      k.has("KeyC") || k.has("ControlLeft") || k.has("ControlRight");
    if (crouch) p.crouched = true;
    else if (circleFree(p.x, p.z, 0.4, activeColliders(), p.y, 1.82))
      p.crouched = false;
    p.eye = damp(p.eye, p.crouched ? 1.08 : 1.7, 14, dt);
    const aim =
      input.aim &&
      p.reloadTime <= 0 &&
      p.switchTime <= 0 &&
      p.grenadeTime <= 0 &&
      p.meleeTime <= 0;
    p.ads = damp(p.ads, aim ? 1 : 0, 14, dt);
    const forward = Number(k.has("KeyW")) - Number(k.has("KeyS")),
      strafe = Number(k.has("KeyD")) - Number(k.has("KeyA"));
    const wantsSprint =
      (k.has("ShiftLeft") || k.has("ShiftRight")) &&
      forward > 0 &&
      !aim &&
      !p.crouched &&
      !input.fire &&
      p.reloadTime <= 0 &&
      p.stamina > 4;
    p.sprint = damp(p.sprint, wantsSprint ? 1 : 0, 9, dt);
    if (wantsSprint) {
      p.stamina = Math.max(0, p.stamina - dt * 19);
      p.staminaDelay = 0.8;
    } else {
      p.staminaDelay = Math.max(0, p.staminaDelay - dt);
      if (p.staminaDelay === 0) p.stamina = Math.min(100, p.stamina + dt * 14);
    }
    const speed =
        (p.crouched ? 2.45 : aim ? 3.25 : 4.9 + p.sprint * 3.8) * w.mobility,
      norm = Math.hypot(forward, strafe) || 1;
    const vx =
        ((-Math.sin(p.yaw) * forward + Math.cos(p.yaw) * strafe) / norm) *
        speed,
      vz =
        ((-Math.cos(p.yaw) * forward - Math.sin(p.yaw) * strafe) / norm) *
        speed;
    p.vx = damp(p.vx, vx, p.grounded ? 15 : 3.4, dt);
    p.vz = damp(p.vz, vz, p.grounded ? 15 : 3.4, dt);
    const obstacles = activeColliders(),
      height = p.crouched ? 1.25 : 1.85;
    const beforeX = p.x,
      beforeZ = p.z,
      collision = moveCircle(
        p,
        p.vx * dt,
        p.vz * dt,
        0.4,
        obstacles,
        p.y,
        height,
      );
    if (collision.hitX) p.vx = 0;
    if (collision.hitZ) p.vz = 0;
    const oldY = p.y;
    p.vy -= 21 * dt;
    if (p.grounded) p.coyote = 0.1;
    else p.coyote = Math.max(0, p.coyote - dt);
    if (input.jumpBuffer > 0 && p.coyote > 0) {
      p.vy = 7;
      p.grounded = false;
      p.coyote = 0;
      input.jumpBuffer = 0;
      audio.jump();
    }
    p.y += p.vy * dt;
    let floor = terrainHeight(p.x, p.z);
    for (const b of obstacles) {
      if (b.disabled) continue;
      const within =
        p.x + 0.3 > b.minX &&
        p.x - 0.3 < b.maxX &&
        p.z + 0.3 > b.minZ &&
        p.z - 0.3 < b.maxZ;
      if (!within) continue;
      if (b.maxY <= oldY + 0.08) floor = Math.max(floor, b.maxY);
      if (p.vy > 0 && oldY + height <= b.minY + 0.03 && p.y + height > b.minY) {
        p.y = b.minY - height;
        p.vy = 0;
      }
    }
    if (p.y <= floor) {
      if (!p.grounded && p.vy < -3) {
        p.land = Math.min(2, (-p.vy - 3) * 0.25);
        audio.jump(true);
        if (p.vy < -13) hitUnit(p, (-p.vy - 13) * 6, null, "坠落 / FALL");
      }
      p.y = floor;
      p.vy = 0;
      p.grounded = true;
    } else p.grounded = false;
    p.stepDistance += Math.hypot(p.x - beforeX, p.z - beforeZ);
    if (
      p.grounded &&
      p.stepDistance > (wantsSprint ? 2.4 : p.crouched ? 2.3 : 1.85)
    ) {
      p.stepDistance = 0;
      if (!p.crouched)
        audio.step(Math.abs(p.x) < 6 ? "metal" : "sand", wantsSprint);
    }
    if (p.grounded && Math.hypot(p.vx, p.vz) > 6 && Math.random() < dt * 8)
      fx.dust(new T.Vector3(p.x, 0.08, p.z));
  }
  if (game.time - p.lastDamage > 6)
    p.health = Math.min(100, p.health + dt * 12);
  if (((w.auto && input.fire) || input.queued > 0) && (locked() || windowed))
    playerFire();
}
function updateCamera(dt) {
  if (p.dead) {
    camera.position.set(p.x, p.y + 1.05, p.z);
    camera.rotation.set(-0.08, p.yaw, 0.12);
    return;
  }
  const shake = settings.shake,
    bob = p.grounded
      ? Math.sin(renderTime * (p.sprint > 0.5 ? 15 : 10)) *
        Math.min(0.025, Math.hypot(p.vx, p.vz) * 0.004) *
        (1 - p.ads * 0.7)
      : 0;
  camera.position.set(
    p.x,
    p.y + p.eye + bob * shake - p.land * 0.035 * shake,
    p.z,
  );
  camera.rotation.set(p.pitch + p.recoil, p.yaw, -p.land * 0.008 * shake);
  const adsFov =
    p.weapon === 3
      ? (Math.atan(Math.tan((settings.fov * Math.PI) / 360) / 4) * 360) /
        Math.PI
      : WEAPONS[p.weapon].adsFov;
  const targetFov =
    (settings.fov + (p.vehicle ? 3 : p.sprint * 7)) * (1 - p.ads) +
    adsFov * p.ads;
  camera.fov = damp(camera.fov, targetFov, 13, dt);
  camera.updateProjectionMatrix();
  audio.setListener(camera.position, p.yaw);
}
function turretFire() {
  const j = world.jeep;
  if (j.overheated || j.cooldown > 0) return false;
  p.cooldown = 0.1;
  j.cooldown = 0.1;
  j.heat = Math.min(1, j.heat + 0.065);
  j.flashTime = 0.055;
  if (j.heat >= 0.99) {
    j.overheated = true;
    ui.message("机枪过热 / TURRET OVERHEATED", 1.5);
  }
  game.stats.shots++;
  const origin = eyeOf(p),
    dir = aimDirection();
  dir.x += (Math.random() - 0.5) * 0.012;
  dir.y += (Math.random() - 0.5) * 0.012;
  dir.normalize();
  const result = shootRay(origin, dir, 180, 36, 1, p, "HMG-50", 2);
  if (result.hit) {
    game.stats.hits++;
    ui.hit();
    if (settings.hitSound) audio.confirm();
  }
  audio.gun("turret");
  p.recoilV += 0.4;
  input.queued = 0;
  return true;
}
function updateVehicle(dt) {
  const j = world.jeep,
    k = input.keys,
    throttle = Number(k.has("KeyW")) - Number(k.has("KeyS")),
    steer = Number(k.has("KeyA")) - Number(k.has("KeyD"));
  const brake = k.has("Space"),
    opposing =
      throttle &&
      Math.sign(j.speed) !== Math.sign(throttle) &&
      Math.abs(j.speed) > 0.4;
  j.speed += throttle * (opposing ? 20 : 11) * dt;
  j.speed *= Math.exp(-(brake ? 9 : throttle ? 0.4 : 1.5) * dt);
  j.speed = clamp(j.speed, -7, 19);
  j.yaw +=
    steer * Math.sign(j.speed) * Math.min(1.1, Math.abs(j.speed) * 0.12) * dt;
  const oldX = j.x,
    oldZ = j.z,
    result = moveCircle(
      j,
      -Math.sin(j.yaw) * j.speed * dt,
      -Math.cos(j.yaw) * j.speed * dt,
      1.8,
      world.colliders,
      0,
      2.1,
      79,
    );
  if (result.hitX || result.hitZ) {
    if (Math.abs(j.speed) > 7) {
      damageJeep(Math.abs(j.speed) * 1.5, null);
      p.land = Math.min(2, Math.abs(j.speed) * 0.1);
    }
    j.speed *= 0.45;
  }
  const roll = (Math.hypot(j.x - oldX, j.z - oldZ) * Math.sign(j.speed)) / 0.5;
  j.wheels.forEach((wheel, i) => {
    wheel.rotation.x -= roll;
    if (i % 2 === 0)
      wheel.rotation.y = damp(wheel.rotation.y, steer * 0.35, 8, dt);
  });
  j.sync();
  j.group.rotation.z = Math.sin(game.time * 16) * Math.abs(j.speed) * 0.0008;
  j.group.rotation.x = damp(j.group.rotation.x, -throttle * 0.022, 5, dt);
  p.x = j.x;
  p.z = j.z;
  p.y = 0;
  p.eye = 2.7;
  j.turret.rotation.y = p.yaw - j.yaw;
}
function damageJeep(amount, source) {
  const j = world.jeep;
  if (j.destroyed) return;
  j.health -= amount;
  if (j.health > 0) return;
  j.health = 0;
  j.destroyed = true;
  j.group.visible = false;
  j.speed = 0;
  j.respawn = 22;
  j.collider.disabled = true;
  explode(new T.Vector3(j.x, 1, j.z), source, 10, 110);
  if (p.vehicle) {
    p.vehicle = false;
    hitUnit(p, 150, null, "载具爆炸 / VEHICLE BLAST");
  }
}
function findInteraction() {
  if (p.dead) return "";
  if (p.vehicle)
    return `离开侦察车 / EXIT SCOUT\n${Math.round(Math.abs(world.jeep.speed) * 3.6)} km/h`;
  if (!world.jeep.destroyed && distance(p, world.jeep) < 4.8)
    return "驾驶侦察车 / DRIVE SCOUT";
  if (world.supplies.some((s) => distance(p, s) < 3.8))
    return "补充弹药与手雷 / RESUPPLY";
  return "";
}
function interact() {
  if (p.dead) return;
  const j = world.jeep;
  if (p.vehicle) {
    let exit = null;
    for (const [a, b] of [
      [3.4, 0],
      [-3.4, 0],
      [0, 4.2],
      [0, -4.2],
    ]) {
      const q = {
        x: j.x + Math.cos(j.yaw) * a + Math.sin(j.yaw) * b,
        z: j.z - Math.sin(j.yaw) * a + Math.cos(j.yaw) * b,
      };
      if (
        Math.abs(q.x) < 82 &&
        Math.abs(q.z) < 82 &&
        circleFree(q.x, q.z, 0.45, activeColliders())
      ) {
        exit = q;
        break;
      }
    }
    if (!exit) {
      ui.message("车门受阻 / EXIT BLOCKED", 1.4);
      return;
    }
    p.vehicle = false;
    p.x = exit.x;
    p.z = exit.z;
    p.y = terrainHeight(p.x, p.z);
    p.eye = 1.7;
    p.vx = p.vz = 0;
    j.speed = 0;
    audio.engineSpeed(0, false);
    ui.message("已下车 / DISMOUNTED", 1.2);
    return;
  }
  if (!j.destroyed && distance(p, j) < 4.8) {
    p.vehicle = true;
    p.reloadTime = 0;
    p.yaw = j.yaw;
    p.pitch = 0;
    p.ads = 0;
    clearInput();
    ui.message(
      "W/S 油门 · A/D 转向 · 空格制动 / THROTTLE · STEER · SPACE BRAKE",
      3,
    );
    return;
  }
  if (world.supplies.some((s) => distance(p, s) < 3.8)) {
    for (let i = 0; i < WEAPONS.length; i++)
      p.inventory[i].reserve = WEAPONS[i].reserve;
    p.grenades = 2;
    p.health = 100;
    audio.reload(1);
    ui.message("弹药、手雷与医疗补给已就绪 / AMMO, FRAGS & HEALTH RESTORED", 2);
  }
}

function perceive(bot) {
  const candidates = game.bots.filter((b) => b.team !== bot.team && b.alive);
  if (bot.team === -1 && !p.dead && p.invulnerable <= 0) candidates.push(p);
  let best = null,
    score = Infinity;
  for (const enemy of candidates) {
    const d = distance(bot, enemy);
    if (d > 60 || d >= score) continue;
    if (
      lineOfSight(
        eyeOf(bot),
        eyeOf(enemy),
        activeColliders(p.vehicle && enemy === p),
      )
    ) {
      best = enemy;
      score = d;
    }
  }
  if (best !== bot.target) {
    bot.reaction =
      DIFFICULTIES[game.difficulty].reaction + (bot.team === 1 ? 0.1 : 0);
    bot.burst = 0;
  }
  bot.target = best;
  return best;
}
function seekCover(bot, enemy) {
  let best = null,
    bestScore = Infinity;
  for (const b of world.colliders) {
    if (
      b.disabled ||
      b.maxY < 1.45 ||
      b.maxY > 6 ||
      Math.hypot((b.minX + b.maxX) / 2 - bot.x, (b.minZ + b.maxZ) / 2 - bot.z) >
        13
    )
      continue;
    const candidates = [
      { x: b.minX - 0.85, z: b.minZ - 0.85 },
      { x: b.maxX + 0.85, z: b.minZ - 0.85 },
      { x: b.minX - 0.85, z: b.maxZ + 0.85 },
      { x: b.maxX + 0.85, z: b.maxZ + 0.85 },
    ];
    for (const c of candidates) {
      const dist = distance(bot, c);
      if (dist > 11 || dist < 1 || !circleFree(c.x, c.z, 0.55, world.colliders))
        continue;
      const score = dist + distance(c, enemy) * 0.03;
      if (score >= bestScore) continue;
      if (
        !lineOfSight(eyeOf(enemy), { x: c.x, y: 1.2, z: c.z }, world.colliders)
      ) {
        best = c;
        bestScore = score;
      }
    }
  }
  return best;
}
function updateBots(dt) {
  if (game.mode === "training") {
    for (const target of game.targets)
      if (!target.alive) {
        target.respawn -= dt;
        target.model.group.rotation.z = damp(
          target.model.group.rotation.z,
          Math.PI * 0.48,
          8,
          dt,
        );
        if (target.respawn <= 0) {
          target.alive = true;
          target.health = 100;
          target.model.group.rotation.z = 0;
          target.model.group.visible = true;
        }
      }
    return;
  }
  for (const bot of game.bots) {
    bot.flash = Math.max(0, bot.flash - dt);
    bot.model.muzzle.visible = bot.flash > 0;
    bot.model.marker.visible = bot.alive && bot.team === 1;
    if (!bot.alive) {
      bot.respawn -= dt;
      bot.model.group.rotation.z = damp(
        bot.model.group.rotation.z,
        1.45,
        8,
        dt,
      );
      bot.model.group.position.y = damp(
        bot.model.group.position.y,
        -0.25,
        7,
        dt,
      );
      if (bot.respawn < 4) bot.model.group.visible = false;
      if (bot.respawn <= 0) respawnBot(bot);
      continue;
    }
    bot.thinkTime -= dt;
    bot.navTime -= dt;
    bot.shotTime -= dt;
    bot.burstPause -= dt;
    bot.reaction -= dt;
    bot.coverTime -= dt;
    bot.tacticTime -= dt;
    bot.underFire = Math.max(0, bot.underFire - dt);
    if (bot.reloadTime > 0) {
      bot.reloadTime -= dt;
      if (bot.reloadTime <= 0) bot.mag = 24;
    }
    if (game.time - bot.lastDamage > 8)
      bot.health = Math.min(100, bot.health + dt * 6);
    if (bot.thinkTime <= 0) {
      perceive(bot);
      bot.thinkTime = 0.24 + Math.random() * 0.14;
    }
    const enemy = bot.target;
    if (enemy && bot.tacticTime <= 0 && bot.underFire > 0) {
      bot.coverDest = seekCover(bot, enemy);
      bot.coverTime = bot.coverDest ? 2.5 + Math.random() : 0;
      bot.tacticTime = 5 + Math.random() * 3;
      if (bot.coverDest) bot.navTime = 0;
    }
    let dest = world.points[bot.objective];
    if (dest.owner === bot.team && !dest.contested && distance(bot, dest) < 8) {
      const unowned = world.points.filter(
        (q) => q.owner !== bot.team || q.contested,
      );
      if (unowned.length && game.time % 7 < 0.15) {
        dest = unowned[(bot.id + Math.floor(game.time / 7)) % unowned.length];
        bot.objective = world.points.indexOf(dest);
        bot.navTime = 0;
      }
    }
    if (bot.coverTime > 0 && bot.coverDest) dest = bot.coverDest;
    else if (enemy && distance(bot, enemy) > 23)
      dest = { x: enemy.x, z: enemy.z };
    else if (enemy && distance(bot, enemy) < 35) {
      const angle =
        Math.atan2(bot.z - enemy.z, bot.x - enemy.x) +
        (bot.id % 2 ? 1 : -1) * 0.23;
      dest = {
        x: enemy.x + Math.cos(angle) * 20,
        z: enemy.z + Math.sin(angle) * 20,
      };
    }
    if (bot.navTime <= 0 && botPathBudget > 0) {
      botPathBudget--;
      const started = performance.now();
      bot.path = nav.path(bot, dest);
      navMilliseconds += performance.now() - started;
      bot.navTime = 1.4 + Math.random() * 0.8;
    }
    let next = bot.path[0];
    if (next && distance(bot, next) < 0.7) {
      bot.path.shift();
      next = bot.path[0];
    }
    const stop = distance(bot, dest) < (dest.id ? 4.7 : 1.4),
      moving = next && !stop;
    if (moving) {
      const dx = next.x - bot.x,
        dz = next.z - bot.z,
        d = Math.hypot(dx, dz) || 1,
        speed = enemy ? 2.9 : 3.6;
      let sx = 0,
        sz = 0;
      for (const other of game.bots) {
        if (other === bot || !other.alive) continue;
        const dist = distance(bot, other);
        if (dist > 0 && dist < 1.2) {
          sx += ((bot.x - other.x) / dist) * (1.2 - dist);
          sz += ((bot.z - other.z) / dist) * (1.2 - dist);
        }
      }
      moveCircle(
        bot,
        ((dx / d) * speed + sx) * dt,
        ((dz / d) * speed + sz) * dt,
        0.43,
        activeColliders(),
        0,
        1.8,
        80,
      );
      bot.walk += speed * dt * 2.2;
    } else bot.walk += dt;
    const desiredYaw = enemy
      ? Math.atan2(bot.x - enemy.x, bot.z - enemy.z)
      : next
        ? Math.atan2(bot.x - next.x, bot.z - next.z)
        : bot.yaw;
    const delta =
      ((desiredYaw - bot.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    bot.yaw += delta * Math.min(1, dt * 9);
    bot.model.group.position.set(bot.x, 0, bot.z);
    bot.model.group.rotation.set(0, bot.yaw, 0);
    bot.model.legs[0].rotation.x = moving ? Math.sin(bot.walk) * 0.48 : 0;
    bot.model.legs[1].rotation.x = moving ? -Math.sin(bot.walk) * 0.48 : 0;
    if (
      enemy &&
      bot.reaction <= 0 &&
      bot.shotTime <= 0 &&
      bot.burstPause <= 0 &&
      bot.reloadTime <= 0 &&
      lineOfSight(
        eyeOf(bot),
        eyeOf(enemy),
        activeColliders(p.vehicle && enemy === p),
      )
    ) {
      if (bot.mag <= 0) {
        bot.reloadTime = 2.4;
        continue;
      }
      const diff = DIFFICULTIES[game.difficulty],
        from = eyeOf(bot),
        to = eyeOf(enemy),
        dir = new T.Vector3(
          to.x - from.x,
          to.y - from.y - 0.24,
          to.z - from.z,
        ).normalize(),
        spread = bot.team === -1 ? diff.spread : 0.056;
      dir.x += (Math.random() - 0.5) * spread * 2;
      dir.y += (Math.random() - 0.5) * spread * 1.35;
      dir.z += (Math.random() - 0.5) * spread * 2;
      dir.normalize();
      shootRay(
        from,
        dir,
        80,
        (bot.team === -1 ? diff.damage : 1) * 15,
        bot.team,
        bot,
        "AR-4",
        1.5,
      );
      bot.mag--;
      bot.shotTime = 0.17;
      bot.lastFired = game.time;
      bot.flash = 0.065;
      audio.gun("rifle", from);
      bot.burst++;
      if (bot.burst >= 3) {
        bot.burst = 0;
        bot.burstPause = 0.65 + Math.random() * 0.8;
      }
    }
  }
}
function updateObjectives(dt) {
  if (game.mode === "training") return;
  for (const q of world.points) {
    let blue = 0,
      red = 0;
    for (const b of game.bots)
      if (b.alive && distance(b, q) < 8) {
        if (b.team === 1) blue++;
        else red++;
      }
    const present = !p.dead && distance(p, q) < 8;
    if (present) blue++;
    const changed = updateCapture(q, blue, red, dt);
    if (changed !== null) {
      if (changed === 1) {
        ui.message(`${q.id} ${q.name} 已控制 / OBJECTIVE SECURED`, 2.4);
        audio.ui("capture");
        if (present) {
          game.stats.score += 250;
          game.stats.captures++;
          ui.score("据点占领 / CAPTURE +250");
        }
      } else if (changed === -1)
        ui.message(`${q.id} ${q.name} 已失守 / OBJECTIVE LOST`, 2);
    }
  }
  const blue = world.points.filter((q) => q.owner === 1).length,
    red = world.points.filter((q) => q.owner === -1).length,
    drain = ticketDrain(blue, red);
  game.tickets.blue = Math.max(0, game.tickets.blue - drain.blue * dt * 0.6);
  game.tickets.red = Math.max(0, game.tickets.red - drain.red * dt * 0.6);
  game.remaining = Math.max(0, game.remaining - dt);
  if (game.remaining <= 0 || game.tickets.blue <= 0 || game.tickets.red <= 0)
    endMatch();
}
function updateGrenades(dt) {
  for (let i = game.grenades.length - 1; i >= 0; i--) {
    const g = game.grenades[i];
    g.fuse -= dt;
    g.v.y -= 17 * dt;
    const step = g.v.clone().multiplyScalar(dt),
      length = step.length();
    if (length > 0.00001) {
      const obstacles = activeColliders().map((b) => ({
          ...b,
          minX: b.minX - 0.11,
          maxX: b.maxX + 0.11,
          minZ: b.minZ - 0.11,
          maxZ: b.maxZ + 0.11,
          minY: b.minY - 0.11,
          maxY: b.maxY + 0.11,
        })),
        hit = castWorld(
          g.mesh.position,
          step.clone().normalize(),
          obstacles,
          length + 0.025,
        );
      if (hit) {
        const normal = new T.Vector3(hit.normal.x, hit.normal.y, hit.normal.z);
        g.mesh.position.addScaledVector(
          step.clone().normalize(),
          Math.max(0, hit.distance - 0.02),
        );
        g.mesh.position.addScaledVector(normal, 0.025);
        g.v.addScaledVector(normal, -1.48 * g.v.dot(normal));
        g.v.multiplyScalar(normal.y > 0.5 ? 0.68 : 0.82);
        g.bounces++;
        if (g.bounces < 5) audio.impact("metal", g.mesh.position);
      } else g.mesh.position.add(step);
    }
    if (g.mesh.position.y < 0.12) {
      g.mesh.position.y = 0.12;
      g.v.y = Math.abs(g.v.y) * 0.4;
      g.v.x *= 0.95;
      g.v.z *= 0.95;
    }
    g.mesh.rotation.x += g.v.length() * dt;
    g.mesh.rotation.z += dt * 4;
    if (g.fuse <= 0) {
      explode(g.mesh.position.clone(), g.source, 10, 125);
      scene.remove(g.mesh);
      g.mesh.geometry.dispose();
      game.grenades.splice(i, 1);
    }
  }
}
function damageBarrel(item, amount, source) {
  if (item.exploded) return;
  item.health -= amount;
  if (item.health <= 0) {
    item.exploded = true;
    item.group.visible = false;
    item.collider.disabled = true;
    explode(new T.Vector3(item.x, 0.8, item.z), source, 9, 105);
  }
}
function explode(pos, source, radius, damage) {
  fx.explosion(pos);
  audio.explosion(pos);
  for (const unit of [...units(), p]) {
    if (
      (unit !== p && !unit.alive) ||
      (unit === p && (p.dead || game.mode === "training"))
    )
      continue;
    if (
      source &&
      unit !== source &&
      (unit === p ? 1 : unit.team) === (source === p ? 1 : source.team)
    )
      continue;
    const target = eyeOf(unit),
      d = Math.hypot(target.x - pos.x, target.y - pos.y, target.z - pos.z);
    if (d > radius) continue;
    const from = { x: pos.x, y: Math.max(0.4, pos.y + 0.15), z: pos.z };
    if (!lineOfSight(from, target, world.colliders)) continue;
    hitUnit(
      unit,
      damage * (1 - d / radius) * (unit === source ? 0.75 : 1),
      source,
      "爆炸 / BLAST",
    );
    if (source === p && unit !== p) {
      ui.hit();
      if (settings.hitSound) audio.confirm();
    }
  }
  for (const barrel of world.destructibles)
    if (
      !barrel.exploded &&
      Math.hypot(barrel.x - pos.x, barrel.z - pos.z) < radius * 0.75
    )
      damageBarrel(barrel, damage, source);
  const j = world.jeep;
  if (!j.destroyed && Math.hypot(j.x - pos.x, j.z - pos.z) < radius)
    damageJeep(damage * 0.6, source);
  const d = Math.hypot(p.x - pos.x, p.z - pos.z);
  if (d < 20) p.land = Math.min(3, (20 - d) / 6);
}
function updateWorldState(dt) {
  const j = world.jeep;
  j.cooldown = Math.max(0, j.cooldown - dt);
  j.heat = Math.max(0, j.heat - dt * (j.overheated ? 0.18 : 0.12));
  if (j.heat < 0.2) j.overheated = false;
  j.flashTime = Math.max(0, j.flashTime - dt);
  j.flash.visible = j.flashTime > 0;
  if (j.destroyed) {
    j.respawn -= dt;
    if (j.respawn <= 0 && distance(p, { x: 10, z: 61 }) > 4) j.reset();
  } else if (!p.vehicle) {
    j.speed *= Math.exp(-dt * 4);
    j.group.rotation.z = damp(j.group.rotation.z, 0, 8, dt);
  }
  audio.engineSpeed(j.speed, p.vehicle);
  game.interaction = findInteraction();
}
function endMatch() {
  game.phase = "ended";
  game.paused = false;
  clearInput();
  show("deathScreen", false);
  show("scoreboard", false);
  audio.engineSpeed(0, false);
  if (locked()) document.exitPointerLock();
  const won = game.tickets.blue > game.tickets.red,
    tie = Math.abs(game.tickets.blue - game.tickets.red) < 0.01;
  $("resultOverline").textContent = tie
    ? "OPERATION CONCLUDED"
    : won
      ? "OPERATION COMPLETE"
      : "OPERATION FAILED";
  $("resultTitle").innerHTML = tie
    ? "战线僵持<span>STALEMATE</span>"
    : won
      ? "守住了这片海<span>VICTORY</span>"
      : "整备，再战<span>DEFEAT</span>";
  $("resultReason").textContent =
    game.remaining <= 0
      ? "作战时间结束 / TIME LIMIT REACHED"
      : won
        ? "敌方增援耗尽 / ENEMY TICKETS EXHAUSTED"
        : "联军增援耗尽 / ALLIED TICKETS EXHAUSTED";
  const stats = game.stats,
    accuracy = stats.shots ? Math.round((stats.hits / stats.shots) * 100) : 0;
  $("resultStats").innerHTML = [
    [stats.score, "得分 / SCORE"],
    [`${stats.kills} / ${stats.deaths}`, "击杀 / 阵亡 · K / D"],
    [`${accuracy}%`, "命中率 / ACCURACY"],
    [stats.captures, "占领 / CAPTURES"],
  ]
    .map(([value, label]) => `<div><b>${value}</b><span>${label}</span></div>`)
    .join("");
  ui.record(stats, won && !tie);
  ui.update(0, game);
  show("endScreen");
  audio.ui("capture");
}
function simulate(dt) {
  game.time += dt;
  updatePlayer(dt);
  updateBots(dt);
  updateGrenades(dt);
  updateWorldState(dt);
  updateObjectives(dt);
  fx.update(dt);
}
function frame(nowMs) {
  requestAnimationFrame(frame);
  const now = nowMs / 1000,
    actualElapsed = Math.max(0, now - lastTime),
    elapsed = clamp(actualElapsed, 0, 0.1);
  lastTime = now;
  renderTime += elapsed;
  const running = game.phase === "active" && !game.paused;
  if (running) {
    navMilliseconds = 0;
    const motion = look.consume(),
      adsFactor = p.weapon === 3 ? 1 - p.ads * 0.72 : 1 - p.ads * 0.3;
    if (motion.events) {
      motionTrace.push({
        t: Math.round(now * 1000),
        ms: Math.round(actualElapsed * 1000),
        yaw: p.yaw,
        pitch: p.pitch,
        dx: motion.dx,
        dy: motion.dy,
        events: motion.events,
        packets: look.lastPackets,
      });
      if (motionTrace.length > 90) motionTrace.shift();
    }
    Object.assign(
      p,
      applyLook(
        p.yaw,
        p.pitch,
        motion.dx,
        motion.dy,
        settings.sensitivity,
        settings.invertY,
        adsFactor,
      ),
    );
    weaponView.look(motion.dx, motion.dy);
    botPathBudget = 1;
    accumulator += elapsed;
    let steps = 0;
    while (accumulator >= FIXED_DT && steps < 12 && game.phase === "active") {
      simulate(FIXED_DT);
      accumulator -= FIXED_DT;
      steps++;
    }
    environmentTime += elapsed;
    world.update(environmentTime, elapsed);
    updateCamera(elapsed);
    weaponView.update(elapsed, {
      ads: p.ads,
      sprint: p.sprint,
      speed: Math.hypot(p.vx, p.vz),
      time: renderTime,
      reload:
        p.reloadTime > 0 ? 1 - p.reloadTime / WEAPONS[p.weapon].reload : 0,
      switching: p.switchTime / 0.3,
      land: p.land,
      melee: p.meleeTime / 0.52,
      grenade: p.grenadeTime / 0.7,
      scoped: p.weapon === 3 && p.ads > 0.85,
      alive: !p.dead && !p.vehicle,
    });
    hudClock += elapsed;
    if (hudClock >= 1 / 30) {
      ui.update(hudClock, game);
      hudClock = 0;
    }
  } else if (game.phase === "menu") {
    environmentTime += elapsed;
    const t = renderTime * 0.025;
    camera.position.set(
      95 + Math.sin(t) * 8,
      26 + Math.sin(t * 0.7) * 2,
      104 + Math.cos(t) * 7,
    );
    camera.lookAt(-4, 3, -11);
    camera.fov = 58;
    camera.updateProjectionMatrix();
    world.update(environmentTime, elapsed);
    accumulator = 0;
  } else accumulator = 0;
  renderer.info.reset();
  renderer.render(scene, camera);
  if (game.phase === "active" && !p.dead && !p.vehicle)
    weaponView.render(renderer);
  frameCount++;
  fpsClock += actualElapsed;
  frameSamples.push(actualElapsed * 1000);
  if (frameSamples.length > 120) frameSamples.shift();
  if (now - diagnosticTime > (debugMode ? 0.2 : 0.25)) {
    diagnosticTime = now;
    $("game").dataset.telemetry = JSON.stringify(window.frontline.snapshot());
    $("game").dataset.inputTrace = JSON.stringify(motionTrace);
  }
  if (fpsClock >= 1) {
    const sorted = [...frameSamples].sort((a, b) => a - b);
    frameP95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
    frameMax = sorted.at(-1) || 0;
    smoothedFps = frameCount / fpsClock;
    frameCount = 0;
    fpsClock = 0;
    if (settings.showFps)
      $("performance").textContent =
        `${Math.round(smoothedFps)} FPS · ${renderer.info.render.calls} CALLS`;
  }
}
