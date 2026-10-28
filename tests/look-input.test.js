import test from "node:test";
import assert from "node:assert/strict";
import { LookInput, applyLook } from "../src/look-input.js";
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test("a fast swipe is not truncated at the old 160-count limit", () => {
  const input = new LookInput();
  input.relative(720, -310);
  assert.deepEqual(input.consume(), { dx: 720, dy: -310, events: 1 });
  const angle = applyLook(0, 0, 720, -310);
  near(angle.yaw, -1.44);
  near(angle.pitch, 0.62);
});
test("one large report and 1000 high-polling reports yield the same angle", () => {
  const a = new LookInput(),
    b = new LookInput();
  a.relative(1800, 100);
  for (let i = 0; i < 1000; i++) b.relative(1.8, 0.1);
  const x = a.consume(),
    y = b.consume(),
    pa = applyLook(0, 0, x.dx, x.dy),
    pb = applyLook(0, 0, y.dx, y.dy);
  near(pa.yaw, pb.yaw);
  near(pa.pitch, pb.pitch);
});
test("different render-frame partitions preserve complete rotations", () => {
  let one = { yaw: 0, pitch: 0 },
    many = { yaw: 0, pitch: 0 };
  one = applyLook(one.yaw, one.pitch, 6000, 0);
  for (let i = 0; i < 240; i++) many = applyLook(many.yaw, many.pitch, 25, 0);
  near(one.yaw, many.yaw);
});
test("rapid reversals cancel without smoothing lag or a delayed tail", () => {
  const input = new LookInput();
  input.relative(900, 100);
  input.relative(-900, -100);
  assert.deepEqual(input.consume(), { dx: 0, dy: 0, events: 2 });
  assert.deepEqual(input.consume(), { dx: 0, dy: 0, events: 0 });
});
test("windowed dragging uses stable client positions, not recenter deltas", () => {
  const input = new LookInput();
  input.beginDrag(500, 300);
  input.drag(900, 290);
  input.drag(200, 310);
  assert.deepEqual(input.consume(), { dx: -300, dy: 10, events: 2 });
  input.endDrag();
  input.beginDrag(100, 100);
  input.drag(110, 100);
  assert.deepEqual(input.consume(), { dx: 10, dy: 0, events: 1 });
});
test("lock transitions discard the recenter packet and stale queued movement", () => {
  const input = new LookInput();
  input.relative(100, 0);
  input.reset(true);
  input.relative(-1280, 720);
  input.relative(17, -4);
  assert.deepEqual(input.consume(), { dx: 17, dy: -4, events: 1 });
});
test("invalid events never poison the camera", () => {
  const input = new LookInput();
  input.relative(NaN, 0);
  input.relative(0, Infinity);
  input.relative(6, 2);
  assert.deepEqual(input.consume(), { dx: 6, dy: 2, events: 1 });
});
test("pitch remains upright at its limit while yaw can turn freely", () => {
  const angle = applyLook(0, 1.4, 4000, -5000);
  assert.equal(angle.pitch, 1.45);
  assert.ok(angle.yaw >= -Math.PI && angle.yaw <= Math.PI);
  assert.equal(applyLook(0, 0, 0, 100, 1, true).pitch, 0.2);
});
test("ADS and sensitivity scale displacement, with no frame-time dependency", () => {
  const angle = applyLook(0, 0, 100, 50, 1.5, false, 0.4);
  near(angle.yaw, -0.12);
  near(angle.pitch, -0.06);
});
