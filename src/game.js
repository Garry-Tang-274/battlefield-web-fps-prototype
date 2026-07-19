/* 群岛前线：可读性优先的 Three.js FPS 垂直切片。 */
/* Archipelago Frontline: a readability-first Three.js FPS vertical slice. */
(() => {
  'use strict';

  if (!window.THREE) {
    document.querySelector('.panel').innerHTML = `
      <h1>引擎加载失败 / Engine Load Failed</h1>
      <p>无法从 CDN 加载 Three.js，请检查网络连接。</p>
      <p>Three.js could not be loaded from the CDN. Check your network connection.</p>`;
    return;
  }

  const ui = {
    overlay: document.getElementById('overlay'),
    start: document.getElementById('startButton'),
    hud: document.getElementById('hud'),
    score: document.getElementById('scoreValue'),
    objective: document.getElementById('objectiveValue'),
    health: document.getElementById('healthValue'),
    ammo: document.getElementById('ammoValue'),
    vehicle: document.getElementById('vehicleValue'),
    message: document.getElementById('message')
  };

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87b8cd);
  scene.fog = new THREE.FogExp2(0xa6c4ce, 0.006);

  const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.1, 900);
  camera.rotation.order = 'YXZ';

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  document.getElementById('game').appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xdff6ff, 0x405233, 1.25));
  const sun = new THREE.DirectionalLight(0xfff0d3, 1.1);
  sun.position.set(-100, 180, -100);
  sun.castShadow = true;
  scene.add(sun);

  const clock = new THREE.Clock();
  const keys = Object.create(null);
  const enemies = [];
  const projectiles = [];
  const raycaster = new THREE.Raycaster();
  const center = new THREE.Vector2(0, 0);

  const player = {
    position: new THREE.Vector3(0, 2.1, 72),
    velocity: new THREE.Vector3(),
    yaw: Math.PI,
    pitch: 0,
    health: 100,
    score: 0,
    ammo: 30,
    reserve: 120,
    reloading: false,
    reloadTimer: 0,
    cooldown: 0,
    vehicle: null,
    dead: false
  };

  function terrainHeight(x, z) {
    return Math.sin(x * 0.035) * 1.3 + Math.cos(z * 0.03) * 1.1 + Math.sin((x + z) * 0.017) * 0.7;
  }

  function addBox(x, z, sx, sy, sz, color, rotation = 0) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(sx, sy, sz),
      new THREE.MeshStandardMaterial({ color, roughness: 0.8 })
    );
    mesh.position.set(x, terrainHeight(x, z) + sy / 2, z);
    mesh.rotation.y = rotation;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }

  function buildWorld() {
    const geometry = new THREE.PlaneGeometry(320, 320, 80, 80);
    geometry.rotateX(-Math.PI / 2);
    const positions = geometry.attributes.position;
    const colors = [];
    const color = new THREE.Color();
    for (let i = 0; i < positions.count; i += 1) {
      const x = positions.getX(i);
      const z = positions.getZ(i);
      const y = terrainHeight(x, z);
      positions.setY(i, y);
      color.set(y > 1.2 ? 0x506c3d : 0x718753);
      colors.push(color.r, color.g, color.b);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    const terrain = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
    terrain.receiveShadow = true;
    scene.add(terrain);

    for (let i = 0; i < 34; i += 1) {
      const x = THREE.MathUtils.randFloatSpread(260);
      const z = THREE.MathUtils.randFloatSpread(260);
      if (Math.hypot(x, z) < 25) continue;
      addBox(x, z, THREE.MathUtils.randFloat(3, 10), THREE.MathUtils.randFloat(2, 7), THREE.MathUtils.randFloat(3, 10), 0x68706b, Math.random() * Math.PI);
    }

    const road = addBox(0, 0, 18, 0.25, 230, 0x454b4e);
    road.position.y = 0.2;

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(12, 14, 48),
      new THREE.MeshBasicMaterial({ color: 0xf0c85a, side: THREE.DoubleSide, transparent: true, opacity: 0.75 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = terrainHeight(0, 0) + 0.15;
    scene.add(ring);

    for (let i = 0; i < 36; i += 1) {
      const x = THREE.MathUtils.randFloatSpread(280);
      const z = THREE.MathUtils.randFloatSpread(280);
      if (Math.hypot(x, z) < 20) continue;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.35, .5, 4, 6), new THREE.MeshStandardMaterial({ color: 0x5d452f }));
      const crown = new THREE.Mesh(new THREE.ConeGeometry(2.2, 5.5, 7), new THREE.MeshStandardMaterial({ color: 0x365a36 }));
      const y = terrainHeight(x, z);
      trunk.position.set(x, y + 2, z);
      crown.position.set(x, y + 6, z);
      trunk.castShadow = crown.castShadow = true;
      scene.add(trunk, crown);
    }
  }

  function createEnemy(x, z) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, .8), new THREE.MeshStandardMaterial({ color: 0xb44542 }));
    const head = new THREE.Mesh(new THREE.SphereGeometry(.42, 10, 8), new THREE.MeshStandardMaterial({ color: 0xd8b08b }));
    head.position.y = 1.55;
    group.add(body, head);
    group.position.set(x, terrainHeight(x, z) + 1.15, z);
    group.userData = { health: 70, cooldown: Math.random(), speed: THREE.MathUtils.randFloat(2.1, 3.0), alive: true };
    body.userData.enemy = group;
    head.userData.enemy = group;
    scene.add(group);
    enemies.push(group);
  }

  function createVehicle() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.2, 7), new THREE.MeshStandardMaterial({ color: 0x3d6c58, metalness: .2 }));
    body.position.y = 1.1;
    group.add(body);
    for (const x of [-2.2, 2.2]) {
      for (const z of [-2.3, 2.3]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(.75, .75, .55, 12), new THREE.MeshStandardMaterial({ color: 0x202326 }));
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(x, .65, z);
        group.add(wheel);
      }
    }
    group.position.set(18, terrainHeight(18, 52), 52);
    group.userData = { speed: 0, yaw: Math.PI };
    scene.add(group);
    return group;
  }

  buildWorld();
  for (let i = 0; i < 12; i += 1) {
    const angle = (i / 12) * Math.PI * 2;
    createEnemy(Math.cos(angle) * THREE.MathUtils.randFloat(35, 110), Math.sin(angle) * THREE.MathUtils.randFloat(35, 110));
  }
  const jeep = createVehicle();

  function flash(text, seconds = 1.2) {
    ui.message.textContent = text;
    ui.message.dataset.time = String(seconds);
  }

  function updateHud() {
    ui.score.textContent = String(player.score);
    ui.health.textContent = String(Math.max(0, Math.round(player.health)));
    ui.ammo.textContent = `${player.ammo} / ${player.reserve}`;
    ui.vehicle.textContent = player.vehicle ? '侦察车 / Scout Vehicle' : '步兵 / Infantry';
    const inZone = Math.hypot(player.position.x, player.position.z) < 14;
    ui.objective.textContent = inZone ? '占领中 / Capturing' : '中立 / Neutral';
  }

  function reload() {
    if (player.reloading || player.ammo === 30 || player.reserve === 0) return;
    player.reloading = true;
    player.reloadTimer = 1.35;
    flash('换弹中 / Reloading');
  }

  function fire() {
    if (player.dead || player.reloading || player.cooldown > 0 || player.ammo <= 0) {
      if (player.ammo <= 0) reload();
      return;
    }
    player.ammo -= 1;
    player.cooldown = player.vehicle ? .11 : .16;
    raycaster.setFromCamera(center, camera);
    const meshes = [];
    for (const enemy of enemies) if (enemy.userData.alive) meshes.push(...enemy.children);
    const hit = raycaster.intersectObjects(meshes, false)[0];
    if (hit) {
      const enemy = hit.object.userData.enemy;
      enemy.userData.health -= hit.object.geometry.type === 'SphereGeometry' ? 55 : 30;
      flash('命中 / Hit', .35);
      if (enemy.userData.health <= 0) {
        enemy.userData.alive = false;
        enemy.visible = false;
        player.score += 100;
        flash('击杀 +100 / Elimination +100', 1.2);
        setTimeout(() => {
          enemy.position.set(THREE.MathUtils.randFloatSpread(220), 2, THREE.MathUtils.randFloatSpread(220));
          enemy.position.y = terrainHeight(enemy.position.x, enemy.position.z) + 1.15;
          enemy.userData.health = 70;
          enemy.userData.alive = true;
          enemy.visible = true;
        }, 3500);
      }
    }
    updateHud();
  }

  function damage(amount) {
    if (player.dead) return;
    player.health -= amount;
    if (player.health <= 0) {
      player.dead = true;
      flash('阵亡，3 秒后重新部署 / Down, redeploying in 3 seconds', 3);
      setTimeout(() => {
        player.position.set(0, 2.1, 72);
        player.health = 100;
        player.dead = false;
        if (player.vehicle) player.vehicle = null;
        flash('重新部署 / Redeployed', 1);
      }, 3000);
    }
  }

  function updatePlayer(dt) {
    if (player.dead) return;
    player.cooldown = Math.max(0, player.cooldown - dt);
    if (player.reloading) {
      player.reloadTimer -= dt;
      if (player.reloadTimer <= 0) {
        const need = 30 - player.ammo;
        const moved = Math.min(need, player.reserve);
        player.ammo += moved;
        player.reserve -= moved;
        player.reloading = false;
      }
    }

    if (player.vehicle) {
      const v = player.vehicle.userData;
      if (keys.KeyW) v.speed += 14 * dt;
      if (keys.KeyS) v.speed -= 18 * dt;
      v.speed *= Math.pow(.25, dt);
      v.speed = THREE.MathUtils.clamp(v.speed, -8, 22);
      if (keys.KeyA) v.yaw += 1.5 * dt * Math.sign(v.speed || 1);
      if (keys.KeyD) v.yaw -= 1.5 * dt * Math.sign(v.speed || 1);
      player.vehicle.rotation.y = v.yaw;
      player.vehicle.position.x -= Math.sin(v.yaw) * v.speed * dt;
      player.vehicle.position.z -= Math.cos(v.yaw) * v.speed * dt;
      player.vehicle.position.y = terrainHeight(player.vehicle.position.x, player.vehicle.position.z);
      player.position.copy(player.vehicle.position).add(new THREE.Vector3(0, 3.1, 0));
      player.yaw = v.yaw;
    } else {
      const forward = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
      const right = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
      const wish = new THREE.Vector3();
      if (keys.KeyW) wish.add(forward);
      if (keys.KeyS) wish.sub(forward);
      if (keys.KeyD) wish.add(right);
      if (keys.KeyA) wish.sub(right);
      const speed = keys.ShiftLeft ? 12 : 7;
      if (wish.lengthSq()) wish.normalize().multiplyScalar(speed);
      player.velocity.x = THREE.MathUtils.damp(player.velocity.x, wish.x, 10, dt);
      player.velocity.z = THREE.MathUtils.damp(player.velocity.z, wish.z, 10, dt);
      player.velocity.y -= 19 * dt;
      const ground = terrainHeight(player.position.x, player.position.z) + 2.1;
      if (player.position.y <= ground + .05) {
        player.position.y = ground;
        player.velocity.y = 0;
        if (keys.Space) player.velocity.y = 8;
      }
      player.position.addScaledVector(player.velocity, dt);
      player.position.x = THREE.MathUtils.clamp(player.position.x, -150, 150);
      player.position.z = THREE.MathUtils.clamp(player.position.z, -150, 150);
    }

    camera.position.copy(player.position);
    camera.rotation.set(player.pitch, player.yaw, 0);
  }

  function updateEnemies(dt) {
    for (const enemy of enemies) {
      if (!enemy.userData.alive || player.dead) continue;
      const delta = player.position.clone().sub(enemy.position);
      const distance = delta.length();
      enemy.lookAt(player.position.x, enemy.position.y, player.position.z);
      if (distance > 12) {
        delta.y = 0;
        delta.normalize();
        enemy.position.addScaledVector(delta, enemy.userData.speed * dt);
        enemy.position.y = terrainHeight(enemy.position.x, enemy.position.z) + 1.15;
      }
      enemy.userData.cooldown -= dt;
      if (distance < 58 && enemy.userData.cooldown <= 0) {
        enemy.userData.cooldown = THREE.MathUtils.randFloat(.65, 1.2);
        if (Math.random() < .48) damage(THREE.MathUtils.randFloat(5, 12));
      }
    }
  }

  function interaction() {
    if (player.vehicle) {
      player.position.copy(player.vehicle.position).add(new THREE.Vector3(5, 2.1, 0));
      player.vehicle = null;
      flash('已离开载具 / Exited vehicle');
      return;
    }
    if (player.position.distanceTo(jeep.position) < 8) {
      player.vehicle = jeep;
      flash('已进入侦察车 / Entered scout vehicle');
    } else {
      flash('附近没有载具 / No vehicle nearby');
    }
  }

  document.addEventListener('keydown', (event) => {
    keys[event.code] = true;
    if (event.code === 'KeyR') reload();
    if (event.code === 'KeyE') interaction();
  });
  document.addEventListener('keyup', (event) => { keys[event.code] = false; });
  document.addEventListener('mousemove', (event) => {
    if (document.pointerLockElement !== renderer.domElement) return;
    const dx = THREE.MathUtils.clamp(event.movementX, -80, 80);
    const dy = THREE.MathUtils.clamp(event.movementY, -80, 80);
    player.yaw -= dx * .0022;
    player.pitch -= dy * .0022;
    player.pitch = THREE.MathUtils.clamp(player.pitch, -1.35, 1.35);
  });
  document.addEventListener('mousedown', (event) => {
    if (event.button === 0 && document.pointerLockElement === renderer.domElement) fire();
  });
  renderer.domElement.addEventListener('click', () => {
    if (!document.pointerLockElement) renderer.domElement.requestPointerLock();
  });
  document.addEventListener('pointerlockchange', () => {
    if (!document.pointerLockElement && !ui.overlay.classList.contains('visible')) {
      flash('鼠标已释放，单击画面继续 / Pointer released, click the game to continue', 2);
    }
  });
  ui.start.addEventListener('click', () => {
    ui.overlay.classList.remove('visible');
    ui.hud.classList.remove('hidden');
    renderer.domElement.requestPointerLock();
  });
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), .05);
    if (!ui.overlay.classList.contains('visible')) {
      updatePlayer(dt);
      updateEnemies(dt);
      if (ui.message.dataset.time) {
        const remaining = Number(ui.message.dataset.time) - dt;
        ui.message.dataset.time = String(remaining);
        if (remaining <= 0) ui.message.textContent = '';
      }
      updateHud();
    }
    renderer.render(scene, camera);
  }
  updateHud();
  animate();
})();
