/**
 * 바이올린 운지 계산 유틸리티 (이미지 운지표 기준, 1st position)
 *
 * - 각 현에서 개방현(open=0)부터 완전5도(+7 semitones)까지를 1포지션 범위로 보고,
 * - 반음 위치에 따라 low/high finger 패턴을 적용합니다.
 *
 * 이미지 기준 패턴:
 * - E/A/D 현: 1(저/고), 2(저/고), 3(저), 4(저/고)  → +6, +7은 4번
 * - G 현:     1(저/고), 2(저/고), 3(저/고)        → +5, +6은 3번, +7은 4번
 */

import {
  Note,
  Fingering,
  ViolinString,
  Position,
  FingerNumber,
  KeyInfo,
} from "@/types/music";
import { getActualNote, normalizeNoteName } from "./keyDetection";

/** 개방현(절대 음표) */
const OPEN_STRINGS: Record<ViolinString, { note: string; octave: number }> = {
  E: { note: "E", octave: 5 },
  A: { note: "A", octave: 4 },
  D: { note: "D", octave: 4 },
  G: { note: "G", octave: 3 },
};

/** C=0 ~ B=11 */
function noteToSemitones(noteName: string): number {
  const baseNotes: Record<string, number> = {
    C: 0,
    "C#": 1,
    D: 2,
    "D#": 3,
    E: 4,
    F: 5,
    "F#": 6,
    G: 7,
    "G#": 8,
    A: 9,
    "A#": 10,
    B: 11,
  };
  return baseNotes[normalizeNoteName(noteName)] ?? 0;
}

function getAbsoluteSemitones(noteName: string, octave: number): number {
  return octave * 12 + noteToSemitones(noteName);
}

function getOpenStringSemitones(string: ViolinString): number {
  const os = OPEN_STRINGS[string];
  return getAbsoluteSemitones(os.note, os.octave);
}

/**
 * 이미지 운지표 기준: 1포지션에서의 "반음 오프셋 → 손가락" 매핑
 * (오프셋은 개방현 대비 반음 수)
 *
 * E/A/D:
 *  0:0
 *  1:1 (low1)   2:1 (high1)
 *  3:2 (low2)   4:2 (high2)
 *  5:3 (3)
 *  6:4 (low4)   7:4 (high4)
 *
 * G:
 *  0:0
 *  1:1 (low1)   2:1 (high1)
 *  3:2 (low2)   4:2 (high2)
 *  5:3 (low3)   6:3 (high3)
 *  7:4 (4)
 */
const FIRST_POSITION_FINGERING_MAP: Record<
  ViolinString,
  Record<number, FingerNumber>
> = {
  E: { 0: 0, 1: 1, 2: 1, 3: 2, 4: 2, 5: 3, 6: 4, 7: 4 },
  A: { 0: 0, 1: 1, 2: 1, 3: 2, 4: 2, 5: 3, 6: 4, 7: 4 },
  D: { 0: 0, 1: 1, 2: 1, 3: 2, 4: 2, 5: 3, 6: 4, 7: 4 },
  G: { 0: 0, 1: 1, 2: 1, 3: 2, 4: 2, 5: 3, 6: 3, 7: 4 },
};

/** 1포지션 범위 체크: open(0) ~ 완전5도(+7) */
function canPlayInFirstPosition(
  targetAbs: number,
  string: ViolinString
): boolean {
  const openAbs = getOpenStringSemitones(string);
  const offset = targetAbs - openAbs;
  return offset >= 0 && offset <= 7;
}

/** 특정 현에서 1포지션 운지 계산 (이미지 기준) */
function calculateFirstPositionOnString(
  targetAbs: number,
  string: ViolinString
): { position: Position; finger: FingerNumber } | null {
  const openAbs = getOpenStringSemitones(string);
  const offset = targetAbs - openAbs;

  if (offset < 0 || offset > 7) return null;

  const finger = FIRST_POSITION_FINGERING_MAP[string][offset];
  if (finger === undefined) return null;

  return { position: "1st", finger };
}

/**
 * 음표에 대한 최적 운지 계산
 * - 여러 현에서 가능하면 "낮은 현 우선(G→D→A→E)"을 기본으로 선택
 *   (기존 코드의 정책과 일치)
 */
export function calculateFingering(
  note: Note,
  keyInfo: KeyInfo
): Fingering | null {
  const actualNoteName = getActualNote(note.name, keyInfo);
  const normalized = normalizeNoteName(actualNoteName);
  const targetAbs = getAbsoluteSemitones(normalized, note.octave);

  const stringsByPreference: ViolinString[] = ["G", "D", "A", "E"];
  const candidates: Array<{
    string: ViolinString;
    position: Position;
    finger: FingerNumber;
  }> = [];

  for (const string of stringsByPreference) {
    if (!canPlayInFirstPosition(targetAbs, string)) continue;
    const fingering = calculateFirstPositionOnString(targetAbs, string);
    if (fingering) candidates.push({ string, ...fingering });
  }

  if (candidates.length === 0) return null;

  // 이미 G→D→A→E 순으로 넣었으니 첫 후보가 기본 최적
  const best = candidates[0];

  return {
    string: best.string,
    finger: best.finger,
    position: best.position,
    note: {
      ...note,
      name: normalized as any,
    },
  };
}

export function calculateFingerings(
  notes: Note[],
  keyInfo: KeyInfo
): Fingering[] {
  return notes
    .map((n) => calculateFingering(n, keyInfo))
    .filter((x): x is Fingering => x !== null);
}
