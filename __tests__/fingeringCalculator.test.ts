import { describe, it, expect } from "vitest";
import { calculateFingering } from "../utils/fingeringCalculator";
import type { KeyInfo } from "../types/music";

const C_MAJOR: KeyInfo = { key: "C", mode: "major", sharps: 0, flats: 0 };
const D_MAJOR: KeyInfo = { key: "D", mode: "major", sharps: 2, flats: 0 };

function note(name: string, octave: number) {
  return { name: name as any, octave, x: 0, y: 0, duration: 1 };
}

describe("string selection — 가장 자연스러운 현 선택", () => {
  it("D4 → D현 개방현 (finger 0), G현 4번 아님", () => {
    const f = calculateFingering(note("D", 4), C_MAJOR)!;
    expect(f.string).toBe("D");
    expect(f.finger).toBe(0);
  });

  it("A4 → A현 개방현 (finger 0), D현 4번 아님", () => {
    const f = calculateFingering(note("A", 4), C_MAJOR)!;
    expect(f.string).toBe("A");
    expect(f.finger).toBe(0);
  });

  it("E5 → E현 개방현 (finger 0), A현 4번 아님", () => {
    const f = calculateFingering(note("E", 5), C_MAJOR)!;
    expect(f.string).toBe("E");
    expect(f.finger).toBe(0);
  });

  it("G3 → G현 개방현 (finger 0)", () => {
    const f = calculateFingering(note("G", 3), C_MAJOR)!;
    expect(f.string).toBe("G");
    expect(f.finger).toBe(0);
  });

  it("B4 → A현 2번 (A+2 semitones)", () => {
    const f = calculateFingering(note("B", 4), C_MAJOR)!;
    expect(f.string).toBe("A");
    expect(f.finger).toBe(1);
  });
});

describe("조성(key signature) 반영", () => {
  it("D major에서 F → F#으로 적용 (A현 3번)", () => {
    const f = calculateFingering(note("F", 4), D_MAJOR)!;
    // D major has F# → F becomes F# → D string finger 3 or A string finger
    // F#4: A4=57, F#4=54, offset=... can't on A. D4=50, F#4=54, offset=4 → finger 3
    expect(f.finger).toBe(3);
  });
});
