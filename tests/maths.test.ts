import { describe, expect, it } from "vitest";
import { atan2, cos, hypot, sin } from "../src/sim/maths";

describe("maths identiques partout", () => {
  it("collent à Math à 1e-11 près", () => {
    for (let i = 0; i < 20000; i++) {
      const x = (i - 10000) * 0.00731;
      expect(Math.abs(sin(x) - Math.sin(x))).toBeLessThan(1e-11);
      expect(Math.abs(cos(x) - Math.cos(x))).toBeLessThan(1e-11);
      const y = Math.sin(i * 1.7) * 50;
      const z = Math.cos(i * 0.3) * 50;
      expect(Math.abs(atan2(y, z) - Math.atan2(y, z))).toBeLessThan(1e-11);
      expect(Math.abs(hypot(y, z) - Math.hypot(y, z))).toBeLessThan(1e-11);
    }
    for (const [y, x] of [[0, 1], [1, 0], [0, -1], [-1, 0], [1, -1e-9], [-1, -1e-9], [0, 0]]) expect(Math.abs(atan2(y, x) - Math.atan2(y, x))).toBeLessThan(1e-11);
  });
});
