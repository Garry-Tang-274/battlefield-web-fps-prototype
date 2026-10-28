import test from "node:test";
import assert from "node:assert/strict";
import {
  box,
  moveCircle,
  circleFree,
  rayBox,
  raySphere,
  castWorld,
  lineOfSight,
  transferAmmo,
  damageAtRange,
  updateCapture,
  ticketDrain,
  createNav,
  damp,
  rng,
  terrainHeight,
} from "../src/core.js";
import { WEAPONS, FIXED_DT } from "../src/config.js";

test("high-speed movement cannot tunnel through thin cover", () => {
  const wall = box(0, 0, 0.25, 3, 12),
    p = { x: -8, z: 0 };
  moveCircle(p, 25, 0, 0.4, [wall]);
  assert.ok(p.x < -0.52);
  assert.ok(circleFree(p.x, p.z, 0.4, [wall]));
});
test("cover collision slides instead of stopping both axes", () => {
  const p = { x: -2, z: -3 };
  moveCircle(p, 5, 4, 0.4, [box(0, 0, 1, 3, 20)]);
  assert.ok(p.x < -0.89);
  assert.ok(p.z > 0.9);
});
test("crouch height fits under a lintel while standing is blocked", () => {
  const lintel = box(0, 0, 4, 1, 1, 1.5);
  assert.equal(circleFree(0, 0, 0.4, [lintel], 0, 1.2), true);
  assert.equal(circleFree(0, 0, 0.4, [lintel], 0, 1.85), false);
});
test("disabled cover no longer obstructs movement or bullets", () => {
  const b = box(0, 0, 1, 2, 1, 0, { disabled: true });
  assert.equal(circleFree(0, 0, 0.4, [b]), true);
  assert.equal(
    castWorld({ x: 0, y: 1, z: 5 }, { x: 0, y: 0, z: -1 }, [b], 10),
    null,
  );
});
test("rays choose the near face and report a usable bounce normal", () => {
  const b = box(0, 0, 2, 3, 2);
  const h = rayBox({ x: 0, y: 1, z: 5 }, { x: 0, y: 0, z: -1 }, b, 10);
  assert.equal(h.distance, 4);
  assert.deepEqual(h.normal, { x: 0, y: 0, z: 1 });
  assert.equal(
    rayBox({ x: 4, y: 1, z: 5 }, { x: 0, y: 0, z: -1 }, b, 10),
    null,
  );
  assert.equal(
    rayBox({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 }, b, 10).distance,
    0,
  );
});
test("closest wall wins regardless of collider array order", () => {
  const near = box(0, 2, 2, 3, 1),
    far = box(0, -2, 2, 3, 1);
  const h = castWorld(
    { x: 0, y: 1, z: 10 },
    { x: 0, y: 0, z: -1 },
    [far, near],
    20,
  );
  assert.equal(h.collider, near);
  assert.equal(h.distance, 7.5);
});
test("walls prevent enemy line of sight; a doorway remains open", () => {
  const a = { x: 0, y: 1.5, z: 5 },
    b = { x: 0, y: 1.5, z: -5 };
  assert.equal(lineOfSight(a, b, [box(0, 0, 6, 3, 1)]), false);
  assert.equal(
    lineOfSight(a, b, [box(-3, 0, 2, 3, 1), box(3, 0, 2, 3, 1)]),
    true,
  );
});
test("ground intersections are bounded to the ray segment", () => {
  assert.equal(
    castWorld({ x: 0, y: 2, z: 0 }, { x: 0, y: -1, z: 0 }, [], 3).distance,
    2,
  );
  assert.equal(
    castWorld({ x: 0, y: 2, z: 0 }, { x: 0, y: -1, z: 0 }, [], 1),
    null,
  );
});
test("head and body spheres only register in front of the ray", () => {
  const c = { x: 0, y: 1.7, z: -10 },
    o = { x: 0, y: 1.7, z: 0 },
    d = { x: 0, y: 0, z: -1 };
  assert.ok(Math.abs(raySphere(o, d, c, 0.23, 20) - 9.77) < 1e-5);
  assert.equal(raySphere(o, { x: 0, y: 0, z: 1 }, c, 0.23, 20), null);
  assert.equal(raySphere(o, d, c, 0.23, 5), null);
});
test("each weapon reload conserves ammunition, including partial reserves", () => {
  for (const w of WEAPONS)
    for (const reserve of [0, 3, w.reserve])
      for (const mag of [0, w.mag - 1, w.mag]) {
        const result = transferAmmo(mag, reserve, w.mag);
        assert.equal(result.mag + result.reserve, mag + reserve);
        assert.ok(result.mag <= w.mag);
        assert.ok(result.reserve >= 0);
      }
});
test("weapon damage falls with range and head multipliers stay distinct", () => {
  for (const w of WEAPONS) {
    assert.equal(damageAtRange(w, 1), w.damage);
    assert.ok(damageAtRange(w, w.range) < w.damage);
    assert.ok(damageAtRange(w, w.range + 100) >= w.damage * 0.399);
    assert.equal(damageAtRange(w, 1, true), w.damage * w.head);
  }
  assert.equal(WEAPONS.filter((w) => w.auto).length, 2);
  assert.equal(WEAPONS[2].pellets, 9);
});
test("neutral objective takes nine seconds for one player to capture", () => {
  const p = { owner: 0, progress: 0 };
  for (let i = 0; i < 1081; i++) updateCapture(p, 1, 0, FIXED_DT);
  assert.equal(p.owner, 1);
  assert.equal(p.progress, 1);
});
test("a contested point freezes, then must neutralize before flipping", () => {
  const p = { owner: -1, progress: -1 };
  updateCapture(p, 2, 1, 20);
  assert.equal(p.progress, -1);
  assert.equal(p.contested, true);
  updateCapture(p, 1, 0, 9.01);
  assert.equal(p.owner, 0);
  updateCapture(p, 1, 0, 9);
  assert.equal(p.owner, 1);
});
test("empty objectives do not capture themselves or reset their progress", () => {
  const p = { owner: 0, progress: 0.5 };
  updateCapture(p, 0, 0, 200);
  assert.equal(p.owner, 0);
  assert.equal(p.progress, 0.5);
});
test("only the losing side bleeds tickets; equal holdings do not drain", () => {
  assert.deepEqual(ticketDrain(2, 1), { blue: 0, red: 1 });
  assert.deepEqual(ticketDrain(0, 3), { blue: 3, red: 0 });
  assert.deepEqual(ticketDrain(1, 1), { blue: 0, red: 0 });
});
test("A* walks around a solid obstacle and all waypoints are collision-free", () => {
  const wall = box(0, 0, 3, 3, 15),
    nav = createNav([wall], 24, 2),
    start = { x: -12, z: 0 },
    end = { x: 12, z: 0 },
    path = nav.path(start, end);
  assert.ok(path.length > 12);
  assert.ok(path.some((p) => Math.abs(p.z) > 8));
  for (const p of path) assert.ok(circleFree(p.x, p.z, 0.6, [wall]));
  assert.ok(Math.hypot(path.at(-1).x - end.x, path.at(-1).z - end.z) < 2);
});
test("navigation rejects a completely blocked arena", () => {
  const nav = createNav([box(0, 0, 100, 3, 100)], 12, 2);
  assert.deepEqual(nav.path({ x: 0, z: 0 }, { x: 8, z: 8 }), []);
});
test("smoothing is consistent across frame rates", () => {
  let a = 0,
    b = 0;
  for (let i = 0; i < 30; i++) a = damp(a, 1, 10, 1 / 30);
  for (let i = 0; i < 120; i++) b = damp(b, 1, 10, 1 / 120);
  assert.ok(Math.abs(a - b) < 1e-10);
});
test("procedural layout random source is reproducible", () => {
  const a = rng(42),
    b = rng(42);
  for (let i = 0; i < 50; i++) {
    const v = a();
    assert.equal(v, b());
    assert.ok(v >= 0 && v < 1);
  }
});
test("playable corners remain above the sea", () => {
  for (const x of [-83, 0, 83])
    for (const z of [-83, 0, 83]) assert.ok(terrainHeight(x, z) > -1.8);
});
