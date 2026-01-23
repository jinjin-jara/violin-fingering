/**
 * 바이올린 운지 계산 유틸리티
 * 
 * 음표를 바이올린 지판 위치(현, 포지션, 손가락)로 변환합니다.
 */

import { Note, Fingering, ViolinString, Position, FingerNumber, KeyInfo } from "@/types/music";
import { getActualNote, normalizeNoteName } from "./keyDetection";

/**
 * 바이올린 현별 개방현 음
 */
const OPEN_STRINGS: Record<ViolinString, string> = {
  E: "E5",
  A: "A4",
  D: "D4",
  G: "G3",
};

/**
 * 포지션별 손가락 간격 (반음 단위)
 * Half Position: 반음 아래
 * 1st Position: 개방현 기준 1음 위
 * 2nd Position: 개방현 기준 2음 위
 * 3rd Position: 개방현 기준 3음 위
 */
const POSITION_OFFSETS: Record<Position, number> = {
  half: -0.5,
  "1st": 1,
  "2nd": 2,
  "3rd": 3,
  "4th": 4,
};

/**
 * 음표 이름을 반음 단위로 변환 (C = 0, C# = 1, D = 2, ...)
 */
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

/**
 * 반음 단위를 음표 이름으로 변환
 */
function semitonesToNote(semitones: number): string {
  const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  return notes[semitones % 12];
}

/**
 * 옥타브를 고려한 절대 반음 수 계산
 */
function getAbsoluteSemitones(noteName: string, octave: number): number {
  const semitones = noteToSemitones(noteName);
  return octave * 12 + semitones;
}

/**
 * 개방현 음의 절대 반음 수
 */
function getOpenStringSemitones(string: ViolinString): number {
  const [note, octave] = OPEN_STRINGS[string].split(/(\d+)/);
  return getAbsoluteSemitones(note, parseInt(octave));
}

/**
 * 특정 현에서 특정 음을 연주할 수 있는지 확인
 * @param targetSemitones 목표 음의 절대 반음 수
 * @param string 현
 * @param maxPosition 최대 포지션 (기본 3rd)
 */
function canPlayOnString(
  targetSemitones: number,
  string: ViolinString,
  maxPosition: Position = "3rd"
): boolean {
  const openSemitones = getOpenStringSemitones(string);
  const maxOffset = POSITION_OFFSETS[maxPosition] + 4; // 손가락 4번까지
  const maxSemitones = openSemitones + maxOffset;

  return targetSemitones >= openSemitones && targetSemitones <= maxSemitones;
}

/**
 * 특정 현에서 음을 연주하기 위한 포지션과 손가락 계산
 */
function calculateFingeringOnString(
  targetSemitones: number,
  string: ViolinString
): { position: Position; finger: FingerNumber } | null {
  const openSemitones = getOpenStringSemitones(string);
  const semitoneOffset = targetSemitones - openSemitones;

  if (semitoneOffset < 0) {
    return null; // 개방현보다 낮은 음은 연주 불가
  }

  // 개방현
  if (semitoneOffset === 0) {
    return { position: "1st", finger: 0 };
  }

  // 포지션별로 확인
  const positions: Position[] = ["half", "1st", "2nd", "3rd", "4th"];
  
  for (const position of positions) {
    const positionOffset = POSITION_OFFSETS[position];
    
    // 각 손가락 (1-4) 확인
    for (let finger = 1; finger <= 4; finger++) {
      const totalOffset = positionOffset + finger;
      if (Math.abs(totalOffset - semitoneOffset) < 0.1) {
        return { position, finger: finger as FingerNumber };
      }
    }
  }

  return null;
}

/**
 * 음표에 대한 최적의 운지 계산
 * 여러 현에서 연주 가능한 경우, 가장 편한 위치를 선택합니다.
 */
export function calculateFingering(
  note: Note,
  keyInfo: KeyInfo
): Fingering | null {
  // 조성에 따른 실제 음 계산
  const actualNoteName = getActualNote(note.name, keyInfo);
  const normalizedNote = normalizeNoteName(actualNoteName);
  const targetSemitones = getAbsoluteSemitones(normalizedNote, note.octave);

  // 각 현에서 연주 가능한지 확인
  const strings: ViolinString[] = ["E", "A", "D", "G"];
  const candidates: Array<{ string: ViolinString; position: Position; finger: FingerNumber }> = [];

  for (const string of strings) {
    const fingering = calculateFingeringOnString(targetSemitones, string);
    if (fingering) {
      candidates.push({
        string,
        ...fingering,
      });
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  // 최적의 운지 선택 (우선순위: 낮은 현 > 낮은 포지션 > 낮은 손가락)
  candidates.sort((a, b) => {
    const stringOrder: Record<ViolinString, number> = { G: 0, D: 1, A: 2, E: 3 };
    const positionOrder: Record<Position, number> = { half: 0, "1st": 1, "2nd": 2, "3rd": 3, "4th": 4 };
    
    if (stringOrder[a.string] !== stringOrder[b.string]) {
      return stringOrder[a.string] - stringOrder[b.string];
    }
    if (positionOrder[a.position] !== positionOrder[b.position]) {
      return positionOrder[a.position] - positionOrder[b.position];
    }
    return a.finger - b.finger;
  });

  const best = candidates[0];

  return {
    string: best.string,
    finger: best.finger,
    position: best.position,
    note: {
      ...note,
      name: normalizedNote as any,
    },
  };
}

/**
 * 여러 음표에 대한 운지 계산
 */
export function calculateFingerings(
  notes: Note[],
  keyInfo: KeyInfo
): Fingering[] {
  return notes
    .map((note) => calculateFingering(note, keyInfo))
    .filter((fingering): fingering is Fingering => fingering !== null);
}
