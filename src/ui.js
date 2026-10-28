import {
  WEAPONS,
  DEFAULT_SETTINGS,
  START_TICKETS,
} from "./config.js?rev=20261028-r3";
import { clamp, distance } from "./core.js?rev=20261028-r3";

export const $ = (id) => document.getElementById(id);
export const show = (id, on = true) => $(id).classList.toggle("hidden", !on);
export function readSettings() {
  let stored = {};
  try {
    stored =
      JSON.parse(localStorage.getItem("frontline.settings.v2") || "{}") || {};
  } catch {}
  const s = { ...DEFAULT_SETTINGS };
  for (const [key, min, max] of [
    ["volume", 0, 1],
    ["sensitivity", 0.2, 2.5],
    ["fov", 65, 105],
    ["shake", 0, 1],
    ["hudScale", 0.85, 1.2],
  ])
    if (Number.isFinite(stored[key])) s[key] = clamp(stored[key], min, max);
  for (const key of ["invertY", "rawInput", "hitSound", "showFps"])
    if (typeof stored[key] === "boolean") s[key] = stored[key];
  if (["high", "low"].includes(stored.quality)) s.quality = stored.quality;
  if (
    matchMedia("(prefers-reduced-motion: reduce)").matches &&
    !("shake" in stored)
  )
    s.shake = 0;
  return s;
}
const paths = [
  "M2 10h9V7h18v2h17v3H30v4h-4l-2-4h-6l-1 8h-5l1-8H8v4H2z",
  "M5 8h24v2h10v3H27v5h-5l1-5h-6l-1 8h-4l1-8H5z",
  "M1 9h44v2H23v4h-9l-2-3H7v5H1z",
  "M1 10h18V6h12v3h16v2H30v3h-8v6h-4l1-8H9v4H1z",
  "M12 6h23v7H24l-2 9h-7l2-10h-5z",
];
export class Interface {
  constructor(settings, callbacks) {
    this.settings = settings;
    this.callbacks = callbacks;
    this.weapon = 0;
    this.mode = "conquest";
    this.messageTime = 0;
    this.scoreTime = 0;
    this.hitTime = 0;
    this.damageTime = 0;
    this.feed = [];
    this.map = $("minimap").getContext("2d");
    $("loadoutOptions").innerHTML = WEAPONS.map(
      (w, i) =>
        `<button class="loadout ${i === 0 ? "active" : ""}" data-weapon="${i}" aria-label="${w.name} ${w.zh} / ${w.en}" aria-pressed="${i === 0}"><small>0${i + 1}</small><svg viewBox="0 0 48 24" aria-hidden="true"><path d="${paths[i]}" fill="currentColor"/></svg></button>`,
    ).join("");
    $("weaponSlots").innerHTML = WEAPONS.map(
      (w, i) =>
        `<div class="weapon-slot" data-slot="${i}"><small>${i + 1}</small>${w.name}</div>`,
    ).join("");
    for (const button of document.querySelectorAll("[data-weapon]"))
      button.onclick = () => {
        this.selectWeapon(Number(button.dataset.weapon));
        callbacks.uiSound();
      };
    for (const button of document.querySelectorAll("[data-mode]"))
      button.onclick = () => {
        this.mode = button.dataset.mode;
        for (const b of document.querySelectorAll("[data-mode]"))
          b.classList.toggle("active", b === button);
        $("difficulty").disabled = this.mode === "training";
        $("modeDescription").innerHTML =
          this.mode === "training"
            ? "无敌人干扰，熟悉所有武器与载具。<br><span>Test every weapon and vehicle without incoming fire.</span>"
            : "控制 A / B / C 据点，消耗敌方增援。<br><span>Hold the majority. Exhaust enemy tickets.</span>";
        callbacks.uiSound();
      };
    for (const id of [
      "volume",
      "sensitivity",
      "fov",
      "shake",
      "hudScale",
      "quality",
      "invertY",
      "rawInput",
      "hitSound",
      "showFps",
    ]) {
      $(id).addEventListener("input", () => {
        settings[id] =
          $(id).type === "checkbox"
            ? $(id).checked
            : id === "quality"
              ? $(id).value
              : Number($(id).value);
        this.saveSettings();
        callbacks.settingsChanged();
      });
    }
    $("resetSettings").onclick = () => {
      Object.assign(settings, DEFAULT_SETTINGS);
      this.saveSettings();
      callbacks.settingsChanged();
    };
    this.selectWeapon(0);
    this.syncSettings();
  }
  saveSettings() {
    try {
      localStorage.setItem(
        "frontline.settings.v2",
        JSON.stringify(this.settings),
      );
    } catch {
      $("settingsMenu").querySelector(".settings-note").textContent =
        "仅本次会话生效 / Session only: browser storage is unavailable";
    }
    this.syncSettings();
  }
  syncSettings() {
    for (const [key, value] of Object.entries(this.settings)) {
      if (!$(key)) continue;
      if ($(key).type === "checkbox") $(key).checked = value;
      else $(key).value = value;
      if ($(key + "Output"))
        $(key + "Output").textContent =
          key === "fov"
            ? `${value}°`
            : key === "sensitivity"
              ? `${value.toFixed(1)}×`
              : `${Math.round(value * 100)}%`;
    }
    document.documentElement.style.setProperty(
      "--hud-scale",
      this.settings.hudScale,
    );
    show("performance", this.settings.showFps);
  }
  selectWeapon(i) {
    this.weapon = i;
    const w = WEAPONS[i];
    $("loadoutName").textContent = w.name;
    $("loadoutType").textContent = `${w.zh} / ${w.en}`;
    $("weaponIndex").textContent = `0${i + 1} / 05`;
    $("loadoutDescription").textContent = w.description;
    $("weaponBars").innerHTML = ["威力 / DMG", "射速 / RPM", "射程 / RNG"]
      .map(
        (label, j) =>
          `<div><span>${label}</span><i><b style="width:${w.bars[j]}%"></b></i></div>`,
      )
      .join("");
    for (const b of document.querySelectorAll("[data-weapon]")) {
      const active = Number(b.dataset.weapon) === i;
      b.classList.toggle("active", active);
      b.setAttribute("aria-pressed", String(active));
    }
  }
  bindPoints(points) {
    $("pointBadges").innerHTML = points
      .map(
        (p) =>
          `<div class="point-badge" id="badge${p.id}"><span>${p.id}</span></div>`,
      )
      .join("");
    $("objectiveMarkers").innerHTML = points
      .map(
        (p) =>
          `<div class="objective-marker" id="marker${p.id}"><b>${p.id}</b><small>${p.name} / ${p.en}</small><span></span></div>`,
      )
      .join("");
  }
  message(text, seconds = 2.4) {
    $("message").textContent = text;
    this.messageTime = seconds;
  }
  score(text, seconds = 1.5) {
    $("scorePop").textContent = text;
    this.scoreTime = seconds;
  }
  hit(kill = false, head = false) {
    this.hitTime = 0.17;
    $("hitmarker").classList.toggle("kill", kill);
    if (head && !kill) this.score("精准命中 / HEADSHOT");
  }
  damage(angle) {
    this.damageTime = 0.7;
    $("damageDirection").style.transform = `rotate(${angle}rad)`;
  }
  kill(killer, victim, team, weapon, head = false) {
    const el = document.createElement("div"),
      a = document.createElement("span"),
      b = document.createElement("span"),
      icon = document.createElement("span");
    a.textContent = killer;
    a.className = team === 1 ? "ally" : "enemy";
    b.textContent = victim;
    b.className = team === 1 ? "enemy" : "ally";
    icon.className = "kill-icon";
    icon.textContent = `[ ${weapon} ]`;
    el.append(a, icon, b);
    if (head) {
      const h = document.createElement("small");
      h.textContent = "◎";
      el.append(h);
    }
    $("killFeed").append(el);
    this.feed.push({ el, time: 5.5 });
    if (this.feed.length > 5) this.feed.shift().el.remove();
  }
  reset() {
    this.messageTime = this.scoreTime = this.hitTime = this.damageTime = 0;
    for (const f of this.feed) f.el.remove();
    this.feed = [];
    $("message").textContent = "";
    $("scorePop").textContent = "";
  }
  update(dt, g) {
    this.messageTime = Math.max(0, this.messageTime - dt);
    this.scoreTime = Math.max(0, this.scoreTime - dt);
    this.hitTime = Math.max(0, this.hitTime - dt);
    this.damageTime = Math.max(0, this.damageTime - dt);
    if (!this.messageTime) $("message").textContent = "";
    $("scorePop").style.opacity = this.scoreTime > 0 ? "1" : "0";
    $("hitmarker").style.opacity = clamp(this.hitTime * 12, 0, 1);
    $("damageDirection").style.opacity = clamp(this.damageTime * 2, 0, 0.85);
    for (let i = this.feed.length - 1; i >= 0; i--) {
      this.feed[i].time -= dt;
      if (this.feed[i].time <= 0) {
        this.feed[i].el.remove();
        this.feed.splice(i, 1);
      }
    }
    const p = g.player,
      w = WEAPONS[p.weapon],
      ammo = p.inventory[p.weapon],
      jeep = g.world.jeep;
    $("damageVignette").style.opacity = Math.max(
      this.damageTime * 0.5,
      p.health < 35 && !p.dead ? (35 - p.health) / 70 : 0,
    );
    $("healthValue").textContent = Math.ceil(
      p.vehicle ? jeep.health : p.health,
    );
    $("healthBar").style.width =
      `${clamp(p.vehicle ? jeep.health / 2.5 : p.health, 0, 100)}%`;
    $("healthBar").style.background =
      p.health < 30 && !p.vehicle ? "#eaa28a" : "";
    $("staminaBar").style.width = `${p.stamina}%`;
    $("lifeState").textContent = p.vehicle
      ? "侦察车 / SCOUT"
      : p.dead
        ? "失去信号 / DOWN"
        : p.crouched
          ? "蹲伏 / CROUCHED"
          : "步兵 / INFANTRY";
    $("ammoValue").textContent = p.vehicle
      ? Math.round((1 - jeep.heat) * 100)
      : ammo.mag;
    $("reserveValue").textContent = p.vehicle ? "∞" : ammo.reserve;
    $("weaponName").textContent = p.vehicle ? "HMG-50" : w.name;
    $("fireMode").textContent = p.vehicle
      ? "车载机枪 / TURRET"
      : w.auto
        ? "全自动 / AUTO"
        : w.id === "sg"
          ? "泵动 / PUMP"
          : "半自动 / SEMI";
    $("grenadeCount").textContent = p.grenades;
    document
      .querySelector(".ammunition")
      .classList.toggle(
        "low",
        p.vehicle ? jeep.heat > 0.8 : ammo.mag <= w.mag * 0.2,
      );
    for (const slot of document.querySelectorAll("[data-slot]"))
      slot.classList.toggle(
        "active",
        Number(slot.dataset.slot) === p.weapon && !p.vehicle,
      );
    const reload = p.reloadTime > 0 ? 1 - p.reloadTime / w.reload : 0;
    $("reloadStatus").querySelector("span").textContent =
      p.reloadTime > 0
        ? "换弹中 / RELOADING"
        : p.vehicle
          ? jeep.overheated
            ? "机枪冷却 / COOLING"
            : "热容量 / HEAT CAPACITY"
          : ammo.mag === 0
            ? ammo.reserve > 0
              ? "R 换弹 / RELOAD"
              : "E 补给 / RESUPPLY"
            : "";
    $("reloadStatus").querySelector("i").style.width =
      `${p.vehicle ? jeep.heat * 100 : reload * 100}%`;
    $("crosshair").style.setProperty(
      "--gap",
      `${3 + (1 - p.ads) * 5 + p.bloom * 450 + Math.hypot(p.vx, p.vz) * 0.6}px`,
    );
    $("crosshair").classList.toggle("ads", p.ads > 0.6);
    show(
      "crosshair",
      !p.dead && (p.vehicle || !(p.weapon === 3 && p.ads > 0.8)),
    );
    show("scope", !p.dead && p.weapon === 3 && p.ads > 0.85 && !p.vehicle);
    $("blueTickets").textContent = Math.max(0, Math.ceil(g.tickets.blue));
    $("redTickets").textContent = Math.max(0, Math.ceil(g.tickets.red));
    $("blueTicketBar").style.width =
      `${(g.tickets.blue / START_TICKETS) * 100}%`;
    $("redTicketBar").style.width = `${(g.tickets.red / START_TICKETS) * 100}%`;
    const seconds = Math.max(0, Math.ceil(g.remaining));
    $("matchTime").textContent =
      g.mode === "training"
        ? "∞"
        : `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
    $("modeLabel").textContent =
      g.mode === "training" ? "自由靶场 / RANGE" : "据点争夺 / CONQUEST";
    const degrees = ((((-p.yaw * 180) / Math.PI) % 360) + 360) % 360,
      dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    $("compass").innerHTML =
      `${dirs[(Math.round(degrees / 45) + 7) % 8]}　 ┊　 ${Math.round((degrees + 330) % 360)}　 ┊　 <b>${dirs[Math.round(degrees / 45) % 8]} ${Math.round(degrees)}°</b>　 ┊　 ${Math.round((degrees + 30) % 360)}　 ┊　 ${dirs[(Math.round(degrees / 45) + 1) % 8]}`;
    let capture = null;
    for (const point of g.world.points) {
      const badge = $("badge" + point.id);
      badge.className = `point-badge${point.owner === 1 ? " owned" : point.owner === -1 ? " enemy" : ""}${point.contested ? " contested" : ""}`;
      if (distance(p, point) < 8) capture = point;
      const marker = $("marker" + point.id);
      marker.className = `objective-marker${point.owner === 1 ? " owned" : point.owner === -1 ? " enemy" : ""}`;
      const v = new window.THREE.Vector3(point.x, 5.7, point.z).project(
        g.camera,
      );
      marker.style.display =
        v.z > 1 ||
        v.x < -1.1 ||
        v.x > 1.1 ||
        v.y < -1 ||
        v.y > 1 ||
        g.mode === "training"
          ? "none"
          : "flex";
      marker.style.left = `${(v.x * 0.5 + 0.5) * innerWidth}px`;
      marker.style.top = `${(-v.y * 0.5 + 0.5) * innerHeight}px`;
      marker.querySelector("span").textContent =
        `${Math.round(distance(p, point))} m`;
    }
    show("captureStatus", !!capture && !p.dead && g.mode !== "training");
    if (capture) {
      $("captureLabel").textContent = capture.contested
        ? `${capture.id} · 争夺中 / CONTESTED`
        : capture.owner === 1 && capture.progress >= 0.99
          ? `${capture.id} · 已控制 / SECURED`
          : `${capture.id} · 占领中 / CAPTURING`;
      $("captureBar").style.width = `${(capture.progress + 1) * 50}%`;
    }
    show("interaction", !!g.interaction && !p.dead);
    if (g.interaction)
      $("interaction").querySelector("span").textContent = g.interaction;
    document
      .querySelector(".match-header")
      .classList.toggle("range", g.mode === "training");
    if (!$("scoreboard").classList.contains("hidden")) {
      const row = (b) =>
        `<div class="roster-row${b.you ? " you" : ""}"><span>${b.name}</span><b>${b.kills || 0}</b><b>${b.deaths || 0}</b><i>${b.alive ? "●" : "−"}</i></div>`;
      const you = {
        name: "你 / YOU",
        kills: g.stats.kills,
        deaths: g.stats.deaths,
        alive: !p.dead,
        you: true,
      };
      const blue = [
        you,
        ...(g.mode === "training" ? [] : g.bots.filter((b) => b.team === 1)),
      ].sort((a, b) => b.kills - a.kills);
      $("blueRoster").innerHTML = blue.map(row).join("");
      $("redRoster").innerHTML =
        g.mode === "training"
          ? "<p>靶场无敌军 / NO HOSTILES IN RANGE</p>"
          : g.bots
              .filter((b) => b.team === -1)
              .sort((a, b) => b.kills - a.kills)
              .map(row)
              .join("");
      $("scoreboardScore").textContent =
        `得分 / SCORE ${g.stats.score} · 占领 / CAPTURES ${g.stats.captures}`;
    }
    this.drawMap(g);
    if (p.dead) {
      const available = g.world.points.filter(
          (q) => q.owner === 1 && !q.contested,
        ),
        select = $("spawnSelect"),
        signature = available.map((q) => q.id).join("");
      if (select.dataset.points !== signature) {
        const previous = select.value;
        select.innerHTML =
          '<option value="base">联军基地 / ALLIED BASE</option>' +
          available
            .map(
              (q) =>
                `<option value="${q.id}">${q.id} · ${q.name} / ${q.en}</option>`,
            )
            .join("");
        select.value = available.some((q) => q.id === previous)
          ? previous
          : "base";
        select.dataset.points = signature;
      }
      $("respawnTimer").textContent = Math.ceil(p.respawn);
      $("redeployButton").disabled = p.respawn > 0;
      $("redeployButton").textContent =
        p.respawn > 0
          ? "等待增援 / AWAITING REINFORCEMENT"
          : "重新部署 / REDEPLOY ↗";
    }
  }
  drawMap(g) {
    const c = this.map,
      s = 224,
      scale = 1.15,
      xy = (v) => v * scale + s / 2;
    c.clearRect(0, 0, s, s);
    c.fillStyle = "#163c44";
    c.fillRect(0, 0, s, s);
    c.fillStyle = "#576b5d";
    c.beginPath();
    c.ellipse(s / 2, s / 2, 107, 114, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "#bbd1b014";
    c.lineWidth = 0.5;
    for (let i = 0; i < 224; i += 28) {
      c.beginPath();
      c.moveTo(i, 0);
      c.lineTo(i, 224);
      c.moveTo(0, i);
      c.lineTo(224, i);
      c.stroke();
    }
    c.fillStyle = "#acb79644";
    c.fillRect(xy(-5), xy(-70), 11 * scale, 142 * scale);
    c.fillRect(xy(-52), xy(-16), 103 * scale, 8 * scale);
    c.fillStyle = "#bcc3a78c";
    for (const b of g.world.staticMap)
      c.fillRect(
        xy(b.minX),
        xy(b.minZ),
        (b.maxX - b.minX) * scale,
        Math.max(1, (b.maxZ - b.minZ) * scale),
      );
    for (const p of g.world.points) {
      c.strokeStyle =
        p.owner === 1 ? "#8fdfcc" : p.owner === -1 ? "#f09c80" : "#e5ce9b";
      c.lineWidth = 1;
      c.beginPath();
      c.arc(xy(p.x), xy(p.z), 10, 0, Math.PI * 2);
      c.stroke();
      c.fillStyle = c.strokeStyle;
      c.textAlign = "center";
      c.font = "bold 9px Arial";
      c.fillText(p.id, xy(p.x), xy(p.z) + 3);
    }
    for (const b of g.bots) {
      if (
        !b.alive ||
        g.mode === "training" ||
        (b.team === -1 && g.time - b.lastFired > 2.2)
      )
        continue;
      c.fillStyle = b.team === 1 ? "#9be4ca" : "#ee9c7d";
      c.beginPath();
      c.arc(xy(b.x), xy(b.z), b.team === 1 ? 2 : 2.8, 0, Math.PI * 2);
      c.fill();
    }
    const j = g.world.jeep;
    if (!j.destroyed) {
      c.fillStyle = "#d3c69a";
      c.fillRect(xy(j.x) - 2, xy(j.z) - 3, 4, 6);
    }
    for (const supply of g.world.supplies) {
      c.fillStyle = "#afcfab";
      c.font = "10px Arial";
      c.fillText("+", xy(supply.x), xy(supply.z) + 3);
    }
    for (const grenade of g.grenades) {
      c.fillStyle = "#f6be71";
      c.beginPath();
      c.arc(
        xy(grenade.mesh.position.x),
        xy(grenade.mesh.position.z),
        2,
        0,
        Math.PI * 2,
      );
      c.fill();
    }
    const p = g.player;
    c.save();
    c.translate(xy(p.x), xy(p.z));
    c.rotate(-p.yaw);
    c.fillStyle = p.dead ? "#c9b18c" : "#f3e3bc";
    c.beginPath();
    c.moveTo(0, -6);
    c.lineTo(-4, 4);
    c.lineTo(0, 2);
    c.lineTo(4, 4);
    c.closePath();
    c.fill();
    c.restore();
  }
  record(stats, won) {
    let old = { matches: 0, wins: 0, bestScore: 0 };
    try {
      const v = JSON.parse(
        localStorage.getItem("frontline.record.v2") || "null",
      );
      if (v && Number.isFinite(v.bestScore)) old = v;
    } catch {}
    const record = {
      matches: (old.matches || 0) + 1,
      wins: (old.wins || 0) + (won ? 1 : 0),
      bestScore: Math.max(old.bestScore || 0, stats.score),
    };
    try {
      localStorage.setItem("frontline.record.v2", JSON.stringify(record));
      $("bestRecord").textContent =
        `本机最佳 / PERSONAL BEST ${record.bestScore}　 ·　 胜场 / WINS ${record.wins}`;
    } catch {
      $("bestRecord").textContent =
        "本次成绩未保存：浏览器存储不可用。 / Result not saved: browser storage unavailable.";
    }
  }
}
