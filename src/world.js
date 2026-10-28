import { box, rng, terrainHeight, clamp } from "./core.js?rev=20261028-r3";
import { POINTS } from "./config.js?rev=20261028-r3";

const T = window.THREE;
const unitBox = new T.BoxGeometry(1, 1, 1);
const sphere = new T.SphereGeometry(1, 10, 8);
const cylinder = new T.CylinderGeometry(1, 1, 1, 10);
const materials = new Map();
export function material(color, metalness = 0, roughness = 0.82) {
  const key = `${color}-${metalness}-${roughness}`;
  if (!materials.has(key))
    materials.set(
      key,
      new T.MeshStandardMaterial({ color, metalness, roughness }),
    );
  return materials.get(key);
}
export function cube(parent, x, y, z, w, h, d, color, shadow = true) {
  const m = new T.Mesh(
    unitBox,
    typeof color === "number" ? material(color) : color,
  );
  m.position.set(x, y, z);
  m.scale.set(w, h, d);
  m.castShadow = shadow;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
export function tube(parent, x, y, z, r, h, color) {
  const m = new T.Mesh(cylinder, material(color));
  m.position.set(x, y, z);
  m.scale.set(r, h, r);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
function ball(parent, x, y, z, r, color) {
  const m = new T.Mesh(sphere, material(color));
  m.position.set(x, y, z);
  m.scale.setScalar(r);
  m.castShadow = true;
  parent.add(m);
  return m;
}
function labelTexture(
  text,
  fg = "#e9e7c9",
  bg = "#253e40",
  width = 512,
  height = 128,
) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = fg;
  ctx.font = `700 ${height * 0.48}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, width / 2, height / 2);
  const texture = new T.CanvasTexture(canvas);
  texture.anisotropy = 4;
  return texture;
}
function sign(parent, text, x, y, z, w, h, rotation = 0, bg) {
  const m = new T.Mesh(
    new T.PlaneGeometry(w, h),
    new T.MeshStandardMaterial({
      map: labelTexture(text, "#ede9cf", bg),
      roughness: 0.9,
      side: T.DoubleSide,
    }),
  );
  m.position.set(x, y, z);
  m.rotation.y = rotation;
  parent.add(m);
  return m;
}
function sandTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d");
  const r = rng(18);
  ctx.fillStyle = "#b8b291";
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 11000; i++) {
    const v = Math.floor(125 + r() * 65);
    ctx.fillStyle = `rgba(${v + 12},${v + 8},${v - 8},${0.1 + r() * 0.2})`;
    ctx.fillRect(r() * 256, r() * 256, 1 + r() * 2, 1 + r() * 2);
  }
  const texture = new T.CanvasTexture(c);
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.repeat.set(48, 48);
  texture.anisotropy = 8;
  return texture;
}

export function buildWorld(scene) {
  const colliders = [],
    destructibles = [],
    supplies = [],
    animated = [],
    staticMap = [];
  const root = new T.Group();
  scene.add(root);
  function solid(x, z, w, h, d, color, y = 0, extra = {}) {
    const mesh = cube(root, x, y + h / 2, z, w, h, d, color);
    const b = box(x, z, w, h, d, y, { surface: "concrete", ...extra });
    colliders.push(b);
    staticMap.push(b);
    return { mesh, collider: b };
  }
  function container(x, z, w = 5, d = 11, color = 0x507476) {
    solid(x, z, w, 3.1, d, color, 0, { surface: "metal" });
    for (let i = -w / 2 + 0.25; i < w / 2; i += 0.55)
      cube(
        root,
        x + i,
        1.55,
        z + d / 2 + 0.035,
        0.055,
        2.9,
        0.08,
        0x29494c,
        false,
      );
    for (const side of [-1, 1])
      for (let i = -d / 2 + 0.3; i < d / 2; i += 0.65)
        cube(
          root,
          x + side * (w / 2 + 0.035),
          1.55,
          z + i,
          0.07,
          2.9,
          0.045,
          color,
          false,
        );
    cube(root, x, 3.13, z, w + 0.12, 0.12, d + 0.1, 0x334d4e);
    sign(root, "AF / LOGISTICS", x, 2.3, z + d / 2 + 0.09, w * 0.8, 0.42);
  }
  function barricade(x, z, w = 5, alongZ = false) {
    const a = solid(x, z, alongZ ? 1 : w, 1.15, alongZ ? w : 1, 0xa7a68e);
    cube(
      root,
      x,
      0.93,
      z,
      alongZ ? 1.08 : w + 0.1,
      0.12,
      alongZ ? w + 0.1 : 1.08,
      0x555d51,
    );
    return a;
  }
  function crate(x, z, w = 1.4) {
    const m = solid(x, z, w, 1.05, w, 0x7c8261, 0, { surface: "wood" });
    for (const side of [-1, 1])
      cube(root, x + side * w * 0.36, 0.55, z, 0.08, 1.1, w + 0.05, 0x424f43);
    return m;
  }
  function building(x, z, w, d, color, name) {
    // Separate wall colliders leave a real walkable doorway and interior.
    solid(x - w / 2, z, 0.55, 4.5, d, color);
    solid(x + w / 2, z, 0.55, 4.5, d, color);
    solid(x, z - d / 2, w, 4.5, 0.55, color);
    solid(x - w * 0.32, z + d / 2, w * 0.36, 4.5, 0.55, color);
    solid(x + w * 0.32, z + d / 2, w * 0.36, 4.5, 0.55, color);
    solid(x, z + d / 2, w * 0.28, 1.1, 0.55, color, 3.4);
    solid(x, z, w + 1, 0.35, d + 1, 0x44585a, 4.5, { surface: "metal" });
    cube(root, x, 0.025, z, w, 0.05, d, 0x858d7e, false);
    sign(root, name, x, 3.87, z + d / 2 + 0.31, w * 0.72, 0.63);
    for (const side of [-1, 1]) {
      cube(
        root,
        x + side * (w / 2 + 0.29),
        2.6,
        z,
        0.035,
        1.2,
        d * 0.45,
        0x29474c,
        false,
      );
      cube(
        root,
        x + side * (w / 2 + 0.31),
        2.6,
        z,
        0.04,
        0.07,
        d * 0.47,
        0xb6b797,
        false,
      );
    }
    cube(root, x, 4.73, z, w * 0.6, 0.15, d * 0.55, 0x637978);
  }
  function barrel(x, z) {
    const g = new T.Group();
    root.add(g);
    g.position.set(x, 0, z);
    tube(g, 0, 0.7, 0, 0.48, 1.4, 0x975a3c);
    tube(g, 0, 0.12, 0, 0.5, 0.09, 0x353e3c);
    tube(g, 0, 1.28, 0, 0.5, 0.09, 0x353e3c);
    sign(g, "!", 0, 0.8, 0.485, 0.3, 0.4, 0, "#975a3c");
    const b = box(x, z, 1, 1.4, 1, 0, { surface: "metal" });
    const item = { group: g, collider: b, x, z, health: 45, exploded: false };
    b.barrel = item;
    colliders.push(b);
    destructibles.push(item);
  }
  function supply(x, z) {
    const group = new T.Group();
    group.position.set(x, 0, z);
    root.add(group);
    cube(group, 0, 0.6, 0, 2, 1.2, 1.4, 0x405f50);
    cube(group, 0, 1.25, 0, 2.1, 0.12, 1.5, 0x78836a);
    for (const a of [-0.75, 0.75])
      cube(group, a, 0.65, 0, 0.08, 1.2, 1.48, 0x213e38);
    sign(group, "+  AMMO", 0, 0.65, 0.715, 1.6, 0.4, 0, "#405f50");
    const b = box(x, z, 2, 1.25, 1.5);
    colliders.push(b);
    supplies.push({ x, z, group });
  }

  // Atmosphere and a large, softly coloured sea — no remote texture dependencies.
  scene.fog = new T.Fog(0xb0b9a6, 85, 300);
  const sky = new T.Mesh(
    new T.SphereGeometry(900, 24, 16),
    new T.ShaderMaterial({
      side: T.BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: new T.Color(0x477b8e) },
        horizon: { value: new T.Color(0xe5ca9f) },
      },
      vertexShader:
        "varying vec3 vWorld;void main(){vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      fragmentShader:
        "uniform vec3 top;uniform vec3 horizon;varying vec3 vWorld;void main(){float h=normalize(vWorld).y;gl_FragColor=vec4(mix(horizon,top,pow(max(0.,h),.55)),1.);}",
    }),
  );
  scene.add(sky);
  const sea = new T.Mesh(
    new T.PlaneGeometry(1800, 1800, 1, 1),
    new T.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        deep: { value: new T.Color(0x256776) },
        light: { value: new T.Color(0x82b8ac) },
      },
      vertexShader:
        "varying vec3 vPos;void main(){vPos=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      fragmentShader:
        "uniform float time;uniform vec3 deep;uniform vec3 light;varying vec3 vPos;void main(){float w=sin(vPos.x*.25+time*.6+sin(vPos.z*.1))*sin(vPos.z*.3-time*.4);float stripe=pow(max(0.,sin(vPos.x*.3+vPos.z*.12+time*.7)),18.);gl_FragColor=vec4(mix(deep,light,w*.12+.16)+stripe*.065,1.);}",
    }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -1.8;
  scene.add(sea);
  scene.add(new T.HemisphereLight(0xc1d8dc, 0x666747, 0.55));
  const sun = new T.DirectionalLight(0xffdb9a, 1.05);
  sun.position.set(-100, 130, -90);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -105;
  sun.shadow.camera.right = 105;
  sun.shadow.camera.top = 105;
  sun.shadow.camera.bottom = -105;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 340;
  sun.shadow.normalBias = 0.035;
  sun.shadow.bias = -0.00015;
  sun.target.position.set(0, 0, -5);
  scene.add(sun, sun.target);
  const sunDisc = new T.Mesh(
    new T.SphereGeometry(14, 16, 16),
    new T.MeshBasicMaterial({ color: 0xffdfad }),
  );
  sunDisc.position.set(-280, 185, -310);
  scene.add(sunDisc);
  const groundGeo = new T.PlaneGeometry(254, 274, 96, 96);
  groundGeo.rotateX(-Math.PI / 2);
  const p = groundGeo.attributes.position,
    colors = [],
    c = new T.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      z = p.getZ(i),
      y = terrainHeight(x, z);
    p.setY(i, y);
    c.set(y < -0.6 ? 0xc6b78f : 0xb2b198);
    colors.push(c.r, c.g, c.b);
  }
  groundGeo.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
  groundGeo.computeVertexNormals();
  const ground = new T.Mesh(
    groundGeo,
    new T.MeshStandardMaterial({
      map: sandTexture(),
      vertexColors: true,
      roughness: 1,
    }),
  );
  ground.receiveShadow = true;
  root.add(ground);
  // Distant islands form a silhouette beyond the playable shoreline.
  const random = rng(9401);
  for (const [x, z, s] of [
    [-230, -190, 75],
    [240, -230, 90],
    [310, 50, 60],
    [-240, 140, 45],
  ]) {
    const island = new T.Mesh(new T.ConeGeometry(s, 28, 9), material(0x607d72));
    island.position.set(x, 4, z);
    island.scale.z = 0.55;
    root.add(island);
  }
  // Connected road spine and readable, open flanking routes.
  cube(root, 0, 0.018, 4, 11, 0.035, 148, 0x6b736b, false);
  cube(root, 0, 0.022, -12, 101, 0.04, 9, 0x6b736b, false);
  for (let z = -62; z < 73; z += 9)
    cube(root, 0, 0.045, z, 0.15, 0.025, 3, 0xc5bfa0, false);
  for (const x of [-5.4, 5.4])
    cube(root, x, 0.044, 3, 0.12, 0.025, 148, 0xc2baa0, false);
  for (let x = -45; x <= 45; x += 9)
    cube(root, x, 0.05, -12, 3, 0.02, 0.13, 0xbeb99c, false);
  // The three objectives have different cover rhythms.
  building(-46, 8, 11, 15, 0xb4b293, "A / TIDAL STATION");
  cube(root, -46, 5.15, 8, 5, 0.55, 9, 0x3b6065);
  sign(root, "01", -40.18, 2.3, 8, 1.5, 1.5, Math.PI / 2);
  barricade(-29, 27, 7);
  barricade(-25, 9, 6, true);
  crate(-43, 22);
  crate(-41, 25);
  container(-23, -16, 5, 13, 0x507a7b);
  container(-25, -2, 5, 10, 0x9d805c);
  container(20, -17, 5, 12, 0x98785a);
  container(23, -2, 5, 10, 0x577671);
  for (const [x, z, w, az] of [
    [-7, 10, 5, false],
    [8, -31, 6, false],
    [-11, -24, 5, true],
    [12, 8, 4, true],
    [-14, 38, 5, false],
    [15, 41, 6, false],
    [-31, -43, 8, false],
    [42, 2, 8, false],
    [50, -14, 6, true],
  ])
    barricade(x, z, w, az);
  // Relay tower: slender geometry and a low skirt leave the capture circle open.
  solid(0, -8, 2.8, 0.65, 2.8, 0x8a927b);
  for (const x of [-0.8, 0.8])
    for (const z of [-8.8, -7.2]) solid(x, z, 0.16, 15, 0.16, 0x465a59);
  for (let y = 2; y < 15; y += 2) {
    const beam = cube(root, 0, y, -8, 2.4, 0.09, 0.09, 0x68756a);
    beam.rotation.z = 0.85;
    cube(root, 0, y, -8, 1.8, 0.08, 1.8, 0x68756a);
  }
  const dish = new T.Group();
  dish.position.set(0, 14, -8);
  root.add(dish);
  animated.push({ kind: "radar", group: dish });
  const bowl = new T.Mesh(
    new T.SphereGeometry(2.4, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.48),
    material(0xc5c6a7),
  );
  bowl.rotation.x = Math.PI * 0.7;
  bowl.scale.y = 0.35;
  dish.add(bowl);
  cube(dish, 0, 0.3, 0.7, 0.12, 0.12, 4, 0x526568);
  ball(dish, 0, 0.5, 2.1, 0.2, 0xce9272);
  building(47, -43, 22, 23, 0x939f8d, "C / AIR STATION");
  for (const x of [35.6, 58.4])
    for (let z = -53; z < -32; z += 2)
      cube(root, x, 2.5, z, 0.07, 4.8, 0.08, 0x596f69, false);
  cube(root, 47, 5, -43, 23, 0.3, 24, 0x4a6e73);
  container(52, -16, 5, 9, 0x9b7c56);
  crate(38, -50, 2);
  crate(42, -51, 2);
  crate(48, -50, 2);
  sign(root, "03", 35.68, 2.7, -43, 2, 2, -Math.PI / 2);
  // An empty helipad is a landmark, not an unimplemented aircraft interaction.
  const pad = new T.Mesh(
    new T.CylinderGeometry(11.5, 11.5, 0.12, 48),
    material(0x717f73),
  );
  pad.position.set(38, 0.065, 28);
  pad.receiveShadow = true;
  root.add(pad);
  const padRing = new T.Mesh(
    new T.RingGeometry(9.5, 9.7, 48),
    new T.MeshBasicMaterial({ color: 0xc7b98e, side: T.DoubleSide }),
  );
  padRing.rotation.x = -Math.PI / 2;
  padRing.position.set(38, 0.14, 28);
  root.add(padRing);
  for (const x of [35.3, 40.7])
    cube(root, x, 0.15, 28, 0.5, 0.03, 6, 0xd6c69a, false);
  cube(root, 38, 0.15, 28, 5.7, 0.03, 0.5, 0xd6c69a, false);
  for (const [x, z] of [
    [-13, 27],
    [17, 20],
    [-36, -28],
    [29, -47],
    [48, -25],
  ]) {
    crate(x, z);
    crate(x + 1.7, z + 0.4);
    crate(x + 0.7, z, 1.1);
  }
  for (const [x, z] of [
    [-18, 17],
    [16, -8],
    [-32, -36],
    [30, -23],
    [55, 8],
  ])
    barrel(x, z);
  supply(-8, 62);
  supply(-38, 29);
  supply(11, -2);
  supply(43, -27);
  // Bases have equipment, radio masts and faction banners.
  for (const [z, color, text] of [
    [74, 0x477e78, "ALLIED / 01"],
    [-73, 0x9a6652, "GARRISON / 02"],
  ]) {
    for (const x of [-26, 26]) container(x, z, 5, 10, color);
    sign(
      root,
      text,
      0,
      3,
      z,
      9,
      1.4,
      0,
      color === 0x477e78 ? "#315f5b" : "#7a503f",
    );
    for (const x of [-5, 5]) tube(root, x, 1.5, z, 0.07, 3, 0x414f48);
  }
  // Shooting lane on the west flank; targets are active only in range mode.
  cube(root, -65, 0.025, 13, 16, 0.05, 73, 0x8b9481, false);
  solid(-74, 12, 0.7, 2.8, 76, 0x727f6c);
  solid(-65, -26, 18, 4, 0.7, 0x727f6c);
  sign(root, "RANGE / 50 M", -65, 3.1, -25.6, 10, 0.9);
  for (let z = -20; z < 46; z += 10)
    cube(root, -65, 0.06, z, 14, 0.02, 0.1, 0xc2c0a1, false);
  // Rocks and palms sit outside lanes, giving cover without random spawn traps.
  function palm(x, z, h) {
    const trunk = tube(root, x, h / 2, z, 0.22, h, 0x827459);
    trunk.rotation.z = 0.06;
    const crown = new T.Group();
    crown.position.set(x + 0.15, h, z);
    root.add(crown);
    for (let j = 0; j < 6; j++) {
      const leaf = new T.Mesh(
        new T.ConeGeometry(0.7, 5.5, 3),
        material(j % 2 ? 0x527c63 : 0x698468),
      );
      leaf.rotation.z = Math.PI * 0.42;
      leaf.position.x = 1.9;
      const pivot = new T.Group();
      pivot.rotation.y = (j * Math.PI) / 3;
      pivot.add(leaf);
      crown.add(pivot);
    }
    colliders.push(box(x, z, 0.6, h, 0.6, 0, { surface: "wood" }));
  }
  for (const [x, z] of [
    [-78, 57],
    [-81, 30],
    [-83, -10],
    [-63, -49],
    [-55, -65],
    [-38, -77],
    [-9, -80],
    [16, -80],
    [62, -66],
    [76, -48],
    [81, -10],
    [79, 15],
    [71, 43],
    [60, 65],
    [43, 75],
    [14, 83],
    [-16, 83],
    [-48, 77],
    [-69, 69],
  ])
    palm(x, z, 7 + random() * 4);
  for (let i = 0; i < 37; i++) {
    const angle = (i / 37) * Math.PI * 2,
      rad = 93 + random() * 8,
      x = Math.sin(angle) * rad,
      z = Math.cos(angle) * rad;
    const rock = new T.Mesh(
      new T.DodecahedronGeometry(1, 0),
      material(i % 2 ? 0x808b7d : 0x939b85),
    );
    const sx = 1 + random() * 3,
      sy = 1 + random() * 2;
    rock.position.set(x, terrainHeight(x, z) + sy * 0.3, z);
    rock.scale.set(sx, sy, sx * 1.3);
    rock.rotation.set(random(), random() * 6, random());
    rock.castShadow = true;
    root.add(rock);
  }
  // Instanced scrub avoids hundreds of separate foliage draw calls.
  const scrub = new T.InstancedMesh(
    new T.ConeGeometry(0.65, 0.75, 4),
    material(0x818e62),
    250,
  );
  const dummy = new T.Object3D();
  let count = 0;
  for (let i = 0; i < 600 && count < 250; i++) {
    const x = (random() - 0.5) * 182,
      z = (random() - 0.5) * 190;
    if (Math.abs(x) < 57 && Math.abs(z) < 76) continue;
    dummy.position.set(x, terrainHeight(x, z) + 0.2, z);
    dummy.rotation.y = random() * Math.PI;
    dummy.scale.set(1 + random(), 0.5 + random(), 1 + random());
    dummy.updateMatrix();
    scrub.setMatrixAt(count++, dummy.matrix);
  }
  scrub.count = count;
  root.add(scrub);
  const points = POINTS.map((p) => {
    const ring = new T.Mesh(
      new T.RingGeometry(7.7, 8, 64),
      new T.MeshBasicMaterial({
        color: 0xdfcba0,
        transparent: true,
        opacity: 0.65,
        side: T.DoubleSide,
        depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(p.x, 0.08, p.z);
    root.add(ring);
    const flag = new T.Group();
    flag.position.set(p.x + 3.2, 0, p.z + 2.2);
    root.add(flag);
    tube(flag, 0, 2.5, 0, 0.055, 5, 0x536361);
    const cloth = cube(
      flag,
      0.7,
      4.4,
      0,
      1.4,
      0.7,
      0.035,
      material(0xa9ac8d),
      false,
    );
    return { ...p, ring, flag, cloth, owner: 0, progress: 0, contested: false };
  });
  const jeep = createJeep(scene);
  // Batch static, untextured scenery by material. Animated flags, barrels and
  // radar stay separate; collision geometry and source transforms are retained.
  for (const d of destructibles) d.group.userData.dynamic = true;
  for (const a of animated) a.group.userData.dynamic = true;
  for (const p of points) p.flag.userData.dynamic = true;
  batchStatic(root);
  function update(time, dt) {
    sea.material.uniforms.time.value = time;
    for (const a of animated)
      if (a.kind === "radar") a.group.rotation.y += dt * 0.18;
    for (const p of points) {
      const color =
        p.owner === 1 ? 0x83d5c8 : p.owner === -1 ? 0xe59a7e : 0xdfcba0;
      p.ring.material.color.setHex(color);
      p.cloth.material = material(color);
      p.cloth.rotation.y = Math.sin(time * 2) * 0.08;
    }
  }
  function reset() {
    for (const item of destructibles) {
      item.health = 45;
      item.exploded = false;
      item.group.visible = true;
      item.collider.disabled = false;
    }
    for (const p of points) {
      p.owner = 0;
      p.progress = 0;
      p.contested = false;
    }
    jeep.reset();
  }
  return {
    root,
    colliders,
    destructibles,
    supplies,
    points,
    staticMap,
    jeep,
    sun,
    update,
    reset,
  };
}

function batchStatic(root) {
  root.updateMatrixWorld(true);
  const groups = new Map();
  root.traverse((m) => {
    if (
      !m.isMesh ||
      m.isInstancedMesh ||
      m.material.map ||
      m.material.transparent ||
      Array.isArray(m.material)
    )
      return;
    for (let parent = m; parent && parent !== root; parent = parent.parent)
      if (parent.userData.dynamic) return;
    if (!groups.has(m.material)) groups.set(m.material, []);
    groups.get(m.material).push(m);
  });
  for (const [mat, meshes] of groups) {
    if (meshes.length < 2) continue;
    const positions = [],
      normals = [];
    for (const mesh of meshes) {
      const geo = mesh.geometry.index
        ? mesh.geometry.toNonIndexed()
        : mesh.geometry.clone();
      geo.applyMatrix4(mesh.matrixWorld);
      positions.push(...geo.attributes.position.array);
      normals.push(...geo.attributes.normal.array);
      geo.dispose();
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
    geo.setAttribute("normal", new T.Float32BufferAttribute(normals, 3));
    geo.computeBoundingSphere();
    const merged = new T.Mesh(geo, mat);
    merged.castShadow = meshes.some((m) => m.castShadow);
    merged.receiveShadow = true;
    for (const mesh of meshes) mesh.parent.remove(mesh);
    root.add(merged);
  }
}

export function createSoldier(scene, team = 1, target = false) {
  const group = new T.Group();
  scene.add(group);
  const cloth = target ? 0x9d9279 : team === 1 ? 0x516f63 : 0x9b7560,
    vest = target ? 0x777d68 : team === 1 ? 0x304d49 : 0x625e4e;
  const torso = cube(group, 0, 1.16, 0, 0.58, 0.7, 0.35, cloth);
  cube(group, 0, 1.19, -0.2, 0.51, 0.49, 0.12, vest);
  cube(group, 0, 1.18, 0.22, 0.42, 0.5, 0.18, vest);
  for (const x of [-0.16, 0.04, 0.2])
    cube(group, x, 1.06, -0.3, 0.14, 0.2, 0.1, 0x6b7760);
  ball(group, 0, 1.71, 0, 0.205, 0xbaa488);
  const helmet = ball(group, 0, 1.82, 0, 0.235, vest);
  helmet.scale.y = 0.145;
  cube(group, 0, 1.73, -0.18, 0.31, 0.1, 0.09, 0x293e40);
  cube(
    group,
    0.26,
    1.47,
    -0.01,
    0.06,
    0.12,
    0.39,
    team === 1 ? 0x7cc9bb : 0xd59b78,
  );
  const legs = [];
  for (const x of [-0.17, 0.17]) {
    const pivot = new T.Group();
    pivot.position.set(x, 0.83, 0);
    group.add(pivot);
    cube(pivot, 0, -0.34, 0, 0.23, 0.65, 0.26, cloth);
    cube(pivot, 0, -0.72, -0.08, 0.24, 0.22, 0.39, 0x303f3b);
    legs.push(pivot);
  }
  const arms = [];
  for (const x of [-0.41, 0.41]) {
    const pivot = new T.Group();
    pivot.position.set(x, 1.45, 0);
    group.add(pivot);
    cube(pivot, 0, -0.25, -0.06, 0.21, 0.48, 0.23, cloth);
    cube(pivot, 0, -0.43, -0.21, 0.18, 0.18, 0.4, vest);
    arms.push(pivot);
  }
  const gun = new T.Group();
  gun.position.set(0.25, 1.15, -0.42);
  group.add(gun);
  cube(gun, 0, 0, 0, 0.16, 0.16, 0.65, 0x2d3d3c);
  cube(gun, 0, 0.01, -0.47, 0.055, 0.055, 0.4, 0x344544);
  cube(gun, 0, -0.16, 0.05, 0.1, 0.23, 0.13, 0x273836);
  const muzzle = new T.Mesh(
    new T.OctahedronGeometry(0.16),
    new T.MeshBasicMaterial({ color: 0xffd497 }),
  );
  muzzle.position.set(0.25, 1.17, -1.12);
  muzzle.visible = false;
  group.add(muzzle);
  const marker = new T.Mesh(
    new T.OctahedronGeometry(0.075),
    new T.MeshBasicMaterial({
      color: team === 1 ? 0x99e4ce : 0xefaa88,
      depthTest: false,
    }),
  );
  marker.position.y = 2.25;
  marker.renderOrder = 2;
  marker.visible = team === 1;
  group.add(marker);
  // Keep limb pivots and transient signals separate, batch the rigid torso,
  // helmet and rifle. This removes small draw-call bursts during fast turns.
  for (const part of [...legs, ...arms, muzzle, marker])
    part.userData.dynamic = true;
  batchStatic(group);
  return { group, torso, legs, arms, muzzle, marker };
}

function createJeep(scene) {
  const group = new T.Group();
  scene.add(group);
  const wheels = [];
  cube(group, 0, 0.76, 0, 2.3, 0.65, 4.1, 0x4b675a);
  cube(group, 0, 1.16, -1.15, 2.15, 0.35, 1.5, 0x637869);
  cube(group, 0, 0.45, 0, 1.65, 0.25, 4.4, 0x303d37);
  for (const x of [-1.12, 1.12]) {
    cube(group, x, 1.45, 0.3, 0.07, 0.85, 2.1, 0x465b52);
    cube(group, x, 1.91, 0.3, 0.07, 0.08, 2.3, 0x465b52);
    cube(group, x, 1.55, 1.3, 0.07, 0.85, 0.07, 0x465b52);
  }
  cube(group, 0, 1.94, 0.25, 2.3, 0.12, 2.4, 0x526c5e);
  for (const x of [-0.58, 0.58]) {
    cube(group, x, 1.04, 0.25, 0.7, 0.25, 0.8, 0x2a413b);
    cube(group, x, 1.35, 0.65, 0.7, 0.55, 0.18, 0x2a413b);
    ball(group, x, 0.96, -2.08, 0.19, 0xc9c69a);
  }
  for (const x of [-1.2, 1.2])
    for (const z of [-1.28, 1.3]) {
      const pivot = new T.Group();
      pivot.position.set(x, 0.48, z);
      group.add(pivot);
      const wheel = new T.Mesh(cylinder, material(0x293630));
      wheel.rotation.z = Math.PI / 2;
      wheel.scale.set(0.5, 0.34, 0.5);
      pivot.add(wheel);
      const hub = new T.Mesh(cylinder, material(0x80877a, 0.4));
      hub.rotation.z = Math.PI / 2;
      hub.scale.set(0.23, 0.36, 0.23);
      pivot.add(hub);
      wheels.push(pivot);
    }
  const turret = new T.Group();
  turret.position.set(0, 2.05, 0.15);
  group.add(turret);
  tube(turret, 0, 0.1, 0, 0.12, 0.55, 0x263d38);
  cube(turret, 0, 0.4, -0.2, 0.3, 0.22, 0.9, 0x34483f);
  cube(turret, 0, 0.41, -0.95, 0.09, 0.09, 0.85, 0x263a36);
  const flash = new T.Mesh(
    new T.OctahedronGeometry(0.25),
    new T.MeshBasicMaterial({ color: 0xffce7a }),
  );
  flash.position.set(0, 0.42, -1.45);
  flash.visible = false;
  turret.add(flash);
  const collider = box(10, 61, 2.7, 2.15, 4.5, 0, { surface: "metal" });
  const state = {
    group,
    turret,
    wheels,
    flash,
    collider,
    x: 10,
    z: 61,
    yaw: 0,
    speed: 0,
    health: 250,
    destroyed: false,
    respawn: 0,
    heat: 0,
    cooldown: 0,
    flashTime: 0,
    reset() {
      this.x = 10;
      this.z = 61;
      this.yaw = 0;
      this.speed = 0;
      this.health = 250;
      this.destroyed = false;
      this.respawn = 0;
      this.heat = 0;
      this.group.visible = true;
      this.sync();
    },
    sync() {
      this.group.position.set(this.x, 0, this.z);
      this.group.rotation.y = this.yaw;
      const w =
          Math.abs(Math.cos(this.yaw)) * 2.7 +
          Math.abs(Math.sin(this.yaw)) * 4.5,
        d =
          Math.abs(Math.sin(this.yaw)) * 2.7 +
          Math.abs(Math.cos(this.yaw)) * 4.5;
      Object.assign(this.collider, box(this.x, this.z, w, 2.15, d), {
        disabled: this.destroyed,
      });
    },
  };
  state.reset();
  return state;
}
