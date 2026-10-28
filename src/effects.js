const T = window.THREE;
// Bounded reusable pools: combat does not continuously allocate GPU resources.
export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.cursor = 0;
    this.particles = [];
    this.tracers = [];
    this.decals = [];
    this.shells = [];
    const geometry = new T.BoxGeometry(1, 1, 1);
    for (let i = 0; i < 260; i++) {
      const mesh = new T.Mesh(
        geometry,
        new T.MeshBasicMaterial({
          color: 0xddba7e,
          transparent: true,
          depthWrite: false,
        }),
      );
      mesh.visible = false;
      scene.add(mesh);
      this.particles.push({
        mesh,
        life: 0,
        max: 1,
        v: new T.Vector3(),
        gravity: 0,
      });
    }
    for (let i = 0; i < 50; i++) {
      const g = new T.BufferGeometry();
      g.setAttribute("position", new T.BufferAttribute(new Float32Array(6), 3));
      const mesh = new T.Line(
        g,
        new T.LineBasicMaterial({
          color: 0xffcf8d,
          transparent: true,
          opacity: 0.9,
        }),
      );
      mesh.visible = false;
      scene.add(mesh);
      this.tracers.push({ mesh, life: 0 });
    }
    const decalGeo = new T.CircleGeometry(0.075, 6);
    for (let i = 0; i < 55; i++) {
      const mesh = new T.Mesh(
        decalGeo,
        new T.MeshBasicMaterial({
          color: 0x263b36,
          transparent: true,
          opacity: 0.7,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -2,
        }),
      );
      mesh.visible = false;
      scene.add(mesh);
      this.decals.push({ mesh, life: 0 });
    }
    const shellGeo = new T.CylinderGeometry(0.025, 0.025, 0.1, 5),
      shellMat = new T.MeshStandardMaterial({
        color: 0xb49a51,
        metalness: 0.65,
        roughness: 0.35,
      });
    for (let i = 0; i < 24; i++) {
      const mesh = new T.Mesh(shellGeo, shellMat);
      mesh.visible = false;
      scene.add(mesh);
      this.shells.push({
        mesh,
        life: 0,
        v: new T.Vector3(),
        spin: new T.Vector3(),
      });
    }
    this.light = new T.PointLight(0xffb168, 0, 18);
    scene.add(this.light);
    this.lightTime = 0;
  }
  particle(pos, v, color, size, life, gravity = 0) {
    const p = this.particles[this.cursor++ % this.particles.length];
    p.smoke = false;
    p.mesh.position.copy(pos);
    p.mesh.scale.setScalar(size);
    p.mesh.material.color.setHex(color);
    p.mesh.material.opacity = 1;
    p.mesh.visible = true;
    p.v.copy(v);
    p.gravity = gravity;
    p.life = p.max = life;
    return p;
  }
  tracer(from, to, enemy = false) {
    const p = this.tracers.find((x) => x.life <= 0) || this.tracers[0],
      a = p.mesh.geometry.attributes.position;
    a.setXYZ(0, from.x, from.y, from.z);
    a.setXYZ(1, to.x, to.y, to.z);
    a.needsUpdate = true;
    p.mesh.geometry.computeBoundingSphere();
    p.mesh.material.color.setHex(enemy ? 0xffa979 : 0xffdfac);
    p.life = 0.06;
    p.mesh.visible = true;
  }
  impact(pos, normal, surface = "concrete") {
    const color =
      surface === "metal" ? 0xffcf7d : surface === "wood" ? 0xaf9968 : 0xc0b991;
    for (let i = 0; i < 6; i++) {
      const v = new T.Vector3(
        normal.x * 3 + (Math.random() - 0.5) * 3,
        normal.y * 3 + Math.random() * 2,
        normal.z * 3 + (Math.random() - 0.5) * 3,
      );
      this.particle(
        pos,
        v,
        color,
        surface === "metal" ? 0.035 : 0.05,
        0.16 + Math.random() * 0.22,
        7,
      );
    }
    if (surface !== "sand") {
      const p =
        this.decals.find((x) => x.life <= 0) ||
        this.decals[Math.floor(Math.random() * this.decals.length)];
      p.mesh.position.copy(pos).addScaledVector(normal, 0.012);
      p.mesh.quaternion.setFromUnitVectors(
        new T.Vector3(0, 0, 1),
        new T.Vector3(normal.x, normal.y, normal.z),
      );
      p.mesh.visible = true;
      p.life = 18;
    }
  }
  hit(pos, head = false) {
    for (let i = 0; i < 5; i++)
      this.particle(
        pos,
        new T.Vector3(
          (Math.random() - 0.5) * 2,
          Math.random() * 2,
          (Math.random() - 0.5) * 2,
        ),
        head ? 0xe7cf9f : 0xb59f7c,
        0.06,
        0.24,
        4,
      );
  }
  explosion(pos) {
    this.light.position.copy(pos);
    this.light.intensity = 5;
    this.lightTime = 0.25;
    for (let i = 0; i < 38; i++) {
      const dir = new T.Vector3(
        Math.random() - 0.5,
        Math.random() * 0.8,
        Math.random() - 0.5,
      )
        .normalize()
        .multiplyScalar(3 + Math.random() * 10);
      this.particle(
        pos,
        dir,
        i % 3 ? 0xe0a45c : 0xecd3a2,
        0.12 + Math.random() * 0.2,
        0.35 + Math.random() * 0.7,
        8,
      );
    }
    for (let i = 0; i < 24; i++) {
      const p = this.particle(
        pos,
        new T.Vector3(
          (Math.random() - 0.5) * 2,
          1 + Math.random() * 3,
          (Math.random() - 0.5) * 2,
        ),
        i % 2 ? 0x6c7066 : 0x8e8c77,
        0.5 + Math.random(),
        2 + Math.random() * 2,
        -0.3,
      );
      p.smoke = true;
    }
  }
  dust(pos) {
    this.particle(
      pos,
      new T.Vector3(
        (Math.random() - 0.5) * 0.4,
        0.5,
        (Math.random() - 0.5) * 0.4,
      ),
      0xb8b098,
      0.16,
      0.6,
      -0.1,
    );
  }
  shell(pos, yaw) {
    const p = this.shells.find((x) => x.life <= 0) || this.shells[0];
    p.mesh.position.copy(pos);
    p.v.set(Math.cos(yaw) * 2, 2, -Math.sin(yaw) * 2);
    p.spin.set(Math.random() * 8, Math.random() * 12, Math.random() * 10);
    p.life = 2;
    p.mesh.visible = true;
  }
  update(dt) {
    for (const p of this.particles) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.v.y -= p.gravity * dt;
      p.mesh.position.addScaledVector(p.v, dt);
      p.mesh.material.opacity = Math.max(0, p.life / p.max);
      if (p.smoke) p.mesh.scale.multiplyScalar(1 + dt * 0.45);
      if (p.life <= 0) {
        p.mesh.visible = false;
        p.smoke = false;
      }
    }
    for (const p of this.tracers)
      if (p.life > 0) {
        p.life -= dt;
        p.mesh.visible = p.life > 0;
      }
    for (const p of this.decals)
      if (p.life > 0) {
        p.life -= dt;
        p.mesh.visible = p.life > 0;
        p.mesh.material.opacity = Math.min(0.7, p.life * 0.2);
      }
    for (const p of this.shells)
      if (p.life > 0) {
        p.life -= dt;
        p.v.y -= 13 * dt;
        p.mesh.position.addScaledVector(p.v, dt);
        p.mesh.rotation.x += p.spin.x * dt;
        p.mesh.rotation.z += p.spin.z * dt;
        if (p.mesh.position.y < 0.04) {
          p.mesh.position.y = 0.04;
          p.v.y = Math.abs(p.v.y) * 0.25;
          p.v.x *= 0.65;
          p.v.z *= 0.65;
        }
        p.mesh.visible = p.life > 0;
      }
    if (this.lightTime > 0) {
      this.lightTime -= dt;
      this.light.intensity = Math.max(0, this.lightTime) * 20;
    }
  }
  reset() {
    for (const list of [this.particles, this.tracers, this.decals, this.shells])
      for (const p of list) {
        p.life = 0;
        p.mesh.visible = false;
        p.smoke = false;
      }
    this.light.intensity = 0;
    this.lightTime = 0;
  }
}
