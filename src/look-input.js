import { clamp } from "./core.js?rev=20261028-r3";

// Mouse deltas are displacement, not velocity: never clamp them per event or
// multiply by frame time. One render consumes every sample exactly once.
export class LookInput {
  constructor() {
    this.reset();
  }
  reset(ignoreNextRelative = false) {
    this.dx = 0;
    this.dy = 0;
    this.events = 0;
    this.anchor = null;
    this.ignoreNextRelative = ignoreNextRelative;
    this.packets = [];
    this.lastPackets = [];
  }
  relative(dx, dy) {
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
    if (this.ignoreNextRelative) {
      this.ignoreNextRelative = false;
      return;
    }
    this.dx += dx;
    this.dy += dy;
    this.events++;
    if (this.packets.length < 64) this.packets.push([dx, dy]);
  }
  beginDrag(x, y) {
    this.anchor = { x, y };
  }
  drag(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (this.anchor) {
      this.dx += x - this.anchor.x;
      this.dy += y - this.anchor.y;
      this.events++;
      if (this.packets.length < 64)
        this.packets.push([x - this.anchor.x, y - this.anchor.y]);
    }
    this.anchor = { x, y };
  }
  endDrag() {
    this.anchor = null;
  }
  consume() {
    const result = { dx: this.dx, dy: this.dy, events: this.events };
    this.dx = this.dy = this.events = 0;
    this.lastPackets = this.packets;
    this.packets = [];
    return result;
  }
}
export function applyLook(
  yaw,
  pitch,
  dx,
  dy,
  sensitivity = 1,
  invertY = false,
  adsFactor = 1,
) {
  const scale = 0.002 * sensitivity * adsFactor;
  const angle = yaw - dx * scale;
  return {
    yaw: Math.atan2(Math.sin(angle), Math.cos(angle)),
    pitch: clamp(pitch - dy * scale * (invertY ? -1 : 1), -1.45, 1.45),
  };
}
