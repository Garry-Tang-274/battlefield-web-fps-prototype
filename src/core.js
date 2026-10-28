// Engine-independent simulation primitives. Used by the live game and Node tests.
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt));
export const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export function rng(seed = 74219) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function terrainHeight(x, z) {
  const edge = Math.sqrt((x / 128) ** 2 + (z / 138) ** 2);
  return edge < 0.84 ? 0 : -Math.pow(Math.max(0, edge - 0.84) * 9, 1.25);
}
export function box(x, z, w, h, d, y = 0, extra = {}) {
  return {
    minX: x - w / 2,
    maxX: x + w / 2,
    minZ: z - d / 2,
    maxZ: z + d / 2,
    minY: y,
    maxY: y + h,
    ...extra,
  };
}
export function circleFree(x, z, radius, colliders, feet = 0, height = 1.8) {
  for (const b of colliders) {
    if (b.disabled || feet >= b.maxY - 0.02 || feet + height <= b.minY + 0.02)
      continue;
    const cx = clamp(x, b.minX, b.maxX),
      cz = clamp(z, b.minZ, b.maxZ);
    if ((x - cx) ** 2 + (z - cz) ** 2 < radius * radius) return false;
  }
  return true;
}
// Substeps prevent tunnelling; separate axes retain sliding along cover.
export function moveCircle(
  p,
  dx,
  dz,
  radius,
  colliders,
  feet = 0,
  height = 1.8,
  limit = 83,
) {
  const steps = Math.max(
    1,
    Math.ceil(Math.hypot(dx, dz) / Math.max(0.15, radius * 0.65)),
  );
  let hitX = false,
    hitZ = false;
  for (let i = 0; i < steps; i++) {
    const x = clamp(p.x + dx / steps, -limit, limit);
    if (circleFree(x, p.z, radius, colliders, feet, height)) p.x = x;
    else hitX = true;
    const z = clamp(p.z + dz / steps, -limit, limit);
    if (circleFree(p.x, z, radius, colliders, feet, height)) p.z = z;
    else hitZ = true;
  }
  return { hitX, hitZ };
}
// Ray / AABB slab test with the entry face normal, including an inside origin.
export function rayBox(origin, dir, b, maxDistance = Infinity) {
  let near = 0,
    far = maxDistance,
    normal = { x: 0, y: 0, z: 0 };
  for (const axis of ["x", "y", "z"]) {
    const min = b["min" + axis.toUpperCase()],
      max = b["max" + axis.toUpperCase()];
    if (Math.abs(dir[axis]) < 1e-9) {
      if (origin[axis] < min || origin[axis] > max) return null;
      continue;
    }
    let a = (min - origin[axis]) / dir[axis],
      c = (max - origin[axis]) / dir[axis];
    let sign = -Math.sign(dir[axis]);
    if (a > c) [a, c] = [c, a];
    if (a > near) {
      near = a;
      normal = { x: 0, y: 0, z: 0 };
      normal[axis] = sign;
    }
    far = Math.min(far, c);
    if (near > far) return null;
  }
  return far < 0 || near > maxDistance
    ? null
    : { distance: near, normal, collider: b };
}
export function raySphere(origin, dir, center, radius, maxDistance = Infinity) {
  const x = origin.x - center.x,
    y = origin.y - center.y,
    z = origin.z - center.z;
  const b = x * dir.x + y * dir.y + z * dir.z;
  const c = x * x + y * y + z * z - radius * radius,
    discriminant = b * b - c;
  if (discriminant < 0) return null;
  const t = -b - Math.sqrt(discriminant);
  return t >= 0 && t <= maxDistance ? t : c <= 0 ? 0 : null;
}
export function castWorld(origin, dir, colliders, maxDistance = Infinity) {
  let closest = null,
    range = maxDistance;
  for (const b of colliders) {
    if (b.disabled) continue;
    const hit = rayBox(origin, dir, b, range);
    if (hit && (!closest || hit.distance < range)) {
      closest = hit;
      range = hit.distance;
    }
  }
  if (dir.y < -0.00001) {
    const t = -origin.y / dir.y;
    if (t >= 0 && t < range)
      closest = {
        distance: t,
        normal: { x: 0, y: 1, z: 0 },
        collider: { surface: "sand" },
      };
  }
  return closest;
}
export function lineOfSight(a, b, colliders) {
  const d = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  if (d < 0.001) return true;
  return !castWorld(
    a,
    { x: (b.x - a.x) / d, y: (b.y - a.y) / d, z: (b.z - a.z) / d },
    colliders,
    d - 0.1,
  );
}
export function transferAmmo(mag, reserve, capacity) {
  const moved = Math.min(Math.max(0, capacity - mag), reserve);
  return { mag: mag + moved, reserve: reserve - moved };
}
export function damageAtRange(weapon, metres, headshot = false) {
  const falloff = clamp(
    1 -
      (Math.max(0, metres - weapon.falloff) / (weapon.range - weapon.falloff)) *
        0.6,
    0.4,
    1,
  );
  return weapon.damage * falloff * (headshot ? weapon.head : 1);
}
// Capture is -1 (red) ... 0 (neutral) ... 1 (blue). A contested point freezes.
export function updateCapture(point, blue, red, dt) {
  if (blue && red) {
    point.contested = true;
    return null;
  }
  point.contested = false;
  const old = point.owner;
  if (blue || red) {
    const side = blue ? 1 : -1;
    point.progress = clamp(
      point.progress +
        ((side * dt) / 9) * Math.min(1.6, 1 + ((blue || red) - 1) * 0.2),
      -1,
      1,
    );
    if (side === 1 && point.progress >= 1) point.owner = 1;
    else if (side === -1 && point.progress <= -1) point.owner = -1;
    else if (point.owner === -side && point.progress * side >= 0)
      point.owner = 0;
  }
  return point.owner !== old ? point.owner : null;
}
export function ticketDrain(bluePoints, redPoints) {
  return {
    blue: redPoints > bluePoints ? redPoints - bluePoints : 0,
    red: bluePoints > redPoints ? bluePoints - redPoints : 0,
  };
}
export function createNav(colliders, size = 83, cell = 3) {
  const n = Math.floor((size * 2) / cell) + 1;
  const cells = new Uint8Array(n * n);
  for (let z = 0; z < n; z++)
    for (let x = 0; x < n; x++)
      cells[z * n + x] = circleFree(
        x * cell - size,
        z * cell - size,
        0.65,
        colliders,
      )
        ? 1
        : 0;
  const index = (p) => ({
    x: clamp(Math.round((p.x + size) / cell), 0, n - 1),
    z: clamp(Math.round((p.z + size) / cell), 0, n - 1),
  });
  function nearest(p) {
    const q = index(p);
    for (let r = 0; r < 7; r++)
      for (let z = -r; z <= r; z++)
        for (let x = -r; x <= r; x++) {
          const xx = q.x + x,
            zz = q.z + z;
          if (xx >= 0 && zz >= 0 && xx < n && zz < n && cells[zz * n + xx])
            return zz * n + xx;
        }
    return -1;
  }
  return {
    cells,
    n,
    cell,
    size,
    path(from, to) {
      const start = nearest(from),
        end = nearest(to);
      if (start < 0 || end < 0) return [];
      const open = [],
        parent = new Int32Array(n * n).fill(-1),
        g = new Float32Array(n * n).fill(Infinity),
        closed = new Uint8Array(n * n);
      const heuristic = (i) =>
        Math.abs((i % n) - (end % n)) +
        Math.abs(Math.floor(i / n) - Math.floor(end / n));
      function push(index, priority) {
        const item = { index, priority };
        let i = open.length;
        open.push(item);
        while (i > 0) {
          const parent = (i - 1) >> 1;
          if (open[parent].priority <= priority) break;
          open[i] = open[parent];
          i = parent;
        }
        open[i] = item;
      }
      function pop() {
        const first = open[0],
          last = open.pop();
        if (!open.length) return first.index;
        let i = 0;
        while (i * 2 + 1 < open.length) {
          let child = i * 2 + 1;
          if (
            child + 1 < open.length &&
            open[child + 1].priority < open[child].priority
          )
            child++;
          if (open[child].priority >= last.priority) break;
          open[i] = open[child];
          i = child;
        }
        open[i] = last;
        return first.index;
      }
      g[start] = 0;
      push(start, heuristic(start));
      for (let count = 0; open.length && count < 3200; count++) {
        const cur = pop();
        if (closed[cur]) continue;
        if (cur === end) {
          const path = [];
          let c = end;
          while (c !== start && c !== -1) {
            path.push({
              x: (c % n) * cell - size,
              z: Math.floor(c / n) * cell - size,
            });
            c = parent[c];
          }
          return path.reverse();
        }
        closed[cur] = 1;
        const x = cur % n,
          z = Math.floor(cur / n);
        for (const [dx, dz] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const xx = x + dx,
            zz = z + dz;
          if (xx < 0 || zz < 0 || xx >= n || zz >= n) continue;
          const next = zz * n + xx;
          if (!cells[next] || closed[next]) continue;
          const cost = g[cur] + 1;
          if (cost >= g[next]) continue;
          parent[next] = cur;
          g[next] = cost;
          push(next, cost + heuristic(next));
        }
      }
      return [];
    },
  };
}
