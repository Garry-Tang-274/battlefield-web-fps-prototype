import { cube, tube, material } from "./world.js?rev=20261028-r3";
import { damp, lerp } from "./core.js?rev=20261028-r3";

const T = window.THREE;
function cylinderZ(parent, x, y, z, r, length, color) {
  const m = tube(parent, x, y, z, r, length, color);
  m.rotation.x = Math.PI / 2;
  return m;
}
function arm(parent, from, to, r, color) {
  const a = new T.Vector3(...from),
    b = new T.Vector3(...to),
    m = tube(parent, 0, 0, 0, r, a.distanceTo(b), color);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), b.sub(a).normalize());
  return m;
}

export class WeaponView {
  constructor() {
    this.scene = new T.Scene();
    this.camera = new T.PerspectiveCamera(
      70,
      innerWidth / innerHeight,
      0.01,
      12,
    );
    this.scene.add(new T.HemisphereLight(0xdde7d7, 0x43574d, 0.65));
    const sun = new T.DirectionalLight(0xffdcad, 1.05);
    sun.position.set(-3, 6, -3);
    this.scene.add(sun);
    this.root = new T.Group();
    this.scene.add(this.root);
    this.models = [];
    this.kick = 0;
    this.kickVelocity = 0;
    this.swayX = 0;
    this.swayY = 0;
    this.phase = 0;
    this.flashTime = 0;
    this.index = 0;
    const colors = [0x4e5a49, 0x3a4b45, 0x665338, 0x41574d, 0x394741];
    for (let i = 0; i < 5; i++) {
      const group = new T.Group();
      this.root.add(group);
      const body = new T.Group();
      group.add(body);
      const pistol = i === 4,
        shotgun = i === 2,
        dmr = i === 3,
        smg = i === 1;
      const length = pistol ? 0.27 : smg ? 0.34 : shotgun ? 0.52 : 0.48,
        metal = material(0x303e3b, 0.65, 0.3),
        finish = material(colors[i], 0.3, 0.55),
        dark = material(0x243631, 0.1, 0.65);
      cube(
        body,
        0,
        0,
        0,
        pistol ? 0.105 : 0.135,
        pistol ? 0.13 : 0.16,
        length,
        finish,
      );
      cube(body, 0, 0.073, -0.015, 0.1, 0.028, length * 0.94, metal);
      if (!pistol) {
        cube(body, 0, 0.005, 0.38, 0.11, 0.15, 0.3, dark);
        cube(body, 0, -0.045, 0.52, 0.145, 0.25, 0.06, dark);
        cylinderZ(body, 0, 0.018, -0.45, 0.045, 0.49, metal);
        cylinderZ(body, 0, 0.018, -0.73, 0.055, 0.11, metal);
      } else {
        cylinderZ(body, 0, 0.015, -0.18, 0.023, 0.1, metal);
        cube(body, 0, 0.015, -0.05, 0.11, 0.09, 0.29, metal);
      }
      const grip = cube(
        body,
        0,
        -0.16,
        pistol ? 0.06 : 0.14,
        0.09,
        0.22,
        0.12,
        dark,
      );
      grip.rotation.x = -0.22;
      const trigger = cube(body, 0, -0.13, 0.005, 0.08, 0.018, 0.14, metal);
      cube(body, 0, -0.09, -0.05, 0.08, 0.08, 0.02, metal);
      let mag = null;
      if (!pistol && !shotgun) {
        mag = cube(body, 0, -0.23, -0.065, 0.08, smg ? 0.3 : 0.27, 0.13, dark);
        mag.rotation.x = smg ? -0.08 : 0.16;
      }
      if (shotgun) {
        cylinderZ(body, 0, -0.025, -0.32, 0.065, 0.43, finish);
        cylinderZ(body, 0, -0.09, -0.43, 0.032, 0.66, metal);
        for (let k = 0; k < 5; k++)
          cylinderZ(body, 0, -0.025, -0.18 - k * 0.05, 0.069, 0.012, dark);
      }
      if (!pistol && !shotgun) {
        cube(body, 0, 0.015, -0.34, 0.14, 0.12, 0.32, finish);
        for (let k = 0; k < 6; k++) {
          cube(body, 0.074, 0.018, -0.22 - k * 0.035, 0.01, 0.037, 0.017, dark);
          cube(
            body,
            -0.074,
            0.018,
            -0.22 - k * 0.035,
            0.01,
            0.037,
            0.017,
            dark,
          );
        }
        for (let k = 0; k < 10; k++)
          cube(body, 0, 0.108, 0.13 - k * 0.047, 0.08, 0.015, 0.017, metal);
      }
      // Front and rear iron sights share the centre axis at ADS.
      cube(body, 0, 0.15, pistol ? 0.095 : 0.12, 0.055, 0.025, 0.035, metal);
      cube(
        body,
        -0.027,
        0.168,
        pistol ? 0.095 : 0.12,
        0.013,
        0.03,
        0.025,
        metal,
      );
      cube(
        body,
        0.027,
        0.168,
        pistol ? 0.095 : 0.12,
        0.013,
        0.03,
        0.025,
        metal,
      );
      cube(body, 0, 0.145, pistol ? -0.16 : -0.56, 0.017, 0.07, 0.027, metal);
      cube(
        body,
        0,
        0.176,
        pistol ? -0.16 : -0.56,
        0.009,
        0.012,
        0.02,
        0xabc1a8,
      );
      if (dmr) {
        for (const z of [-0.12, 0.13])
          cube(body, 0, 0.17, z, 0.07, 0.12, 0.05, dark);
        cylinderZ(body, 0, 0.245, -0.04, 0.075, 0.43, metal);
        cylinderZ(body, 0, 0.245, 0.19, 0.09, 0.11, dark);
        cylinderZ(body, 0, 0.245, -0.29, 0.1, 0.12, dark);
        cylinderZ(
          body,
          0,
          0.245,
          0.25,
          0.074,
          0.004,
          material(0x517f7a, 0.7, 0.15),
        );
        tube(body, 0.06, 0.25, -0.03, 0.042, 0.09, 0x263b34);
        cube(body, 0, -0.06, 0.43, 0.12, 0.06, 0.4, finish);
      }
      // Gloved hands and sleeves remain articulated independently on reload.
      const right = new T.Group();
      group.add(right);
      arm(right, [0.15, -0.48, 0.44], [0.07, -0.17, 0.17], 0.075, 0x526d61);
      cube(right, 0.015, -0.14, 0.15, 0.14, 0.15, 0.17, 0x334c43);
      const left = new T.Group();
      group.add(left);
      arm(
        left,
        [-0.42, -0.45, 0.4],
        [-0.15, -0.14, pistol ? 0.05 : -0.37],
        0.073,
        0x60776a,
      );
      cube(
        left,
        -0.08,
        -0.09,
        pistol ? 0.025 : -0.36,
        0.15,
        0.12,
        0.18,
        0x3b5145,
      );
      const flash = new T.Mesh(
        new T.OctahedronGeometry(1, 0),
        new T.MeshBasicMaterial({
          color: 0xffd998,
          transparent: true,
          opacity: 0.95,
          depthWrite: false,
        }),
      );
      flash.position.set(0, 0.02, pistol ? -0.245 : -0.82);
      flash.scale.set(0.07, 0.07, 0.18);
      flash.visible = false;
      body.add(flash);
      const flash2 = flash.clone();
      flash2.material = new T.MeshBasicMaterial({
        color: 0xffb45c,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
      });
      flash2.scale.set(0.11, 0.035, 0.13);
      body.add(flash2);
      this.models.push({
        group,
        body,
        left,
        right,
        mag,
        flash,
        flash2,
        magY: mag?.position.y || 0,
      });
      group.visible = i === 0;
    }
  }
  select(index) {
    this.index = index;
    this.models.forEach((m, i) => (m.group.visible = i === index));
    this.kick = 0;
    this.kickVelocity = 0;
  }
  fire(strength = 1) {
    this.kickVelocity += 1.7 * strength;
    this.flashTime = 0.045;
  }
  look(dx, dy) {
    this.swayX = Math.max(-0.035, Math.min(0.035, this.swayX + dx * 0.00005));
    this.swayY = Math.max(-0.025, Math.min(0.025, this.swayY + dy * 0.00005));
  }
  update(
    dt,
    {
      ads = 0,
      sprint = 0,
      speed = 0,
      time = 0,
      reload = 0,
      switching = 0,
      land = 0,
      melee = 0,
      grenade = 0,
      scoped = false,
      alive = true,
    },
  ) {
    this.root.visible = alive && !scoped;
    this.flashTime = Math.max(0, this.flashTime - dt);
    this.kickVelocity += (-80 * this.kick - 14 * this.kickVelocity) * dt;
    this.kick += this.kickVelocity * dt;
    this.swayX = damp(this.swayX, 0, 8, dt);
    this.swayY = damp(this.swayY, 0, 8, dt);
    this.phase += speed * dt * 1.65;
    const bob = Math.min(1, speed / 5) * (1 - ads * 0.8),
      reloadWave = reload > 0 ? Math.sin(Math.PI * reload) : 0;
    this.root.position.set(
      lerp(0.25, 0, ads) +
        Math.sin(this.phase) * 0.009 * bob -
        this.swayX +
        reloadWave * 0.08,
      -0.265 +
        ads * 0.09 +
        Math.cos(this.phase * 2) * 0.007 * bob -
        this.kick * 0.07 -
        Math.sin((sprint * Math.PI) / 2) * 0.11 -
        reloadWave * 0.17 -
        switching * 0.25 -
        land * 0.018,
      -0.43 + this.kick * 0.16 + reloadWave * 0.15,
    );
    this.root.rotation.set(
      this.kick * 0.6 -
        sprint * 0.4 -
        reloadWave * 0.42 +
        Math.sin(melee * Math.PI) * 1.1,
      -0.02 * (1 - ads) + this.swayX * 2 + Math.sin(melee * Math.PI) * 0.5,
      Math.sin(this.phase) * 0.008 * bob +
        this.swayY +
        reloadWave * 0.3 +
        sprint * 0.25,
    );
    if (grenade > 0) {
      this.root.position.y -= Math.sin(grenade * Math.PI) * 0.3;
      this.root.rotation.z -= Math.sin(grenade * Math.PI) * 0.5;
    }
    const m = this.models[this.index];
    m.left.position.set(
      -reloadWave * 0.07,
      -reloadWave * 0.25,
      reloadWave * 0.17,
    );
    m.left.rotation.z = -reloadWave * 0.8;
    if (m.mag) {
      m.mag.position.y = m.magY - reloadWave * 0.22;
      m.mag.rotation.z = reloadWave * 0.18;
    }
    m.flash.visible = m.flash2.visible = this.flashTime > 0;
    m.flash.rotation.z = time * 47;
    m.flash2.rotation.z = time * 35;
  }
  render(renderer) {
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
    renderer.autoClear = true;
  }
  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }
}
