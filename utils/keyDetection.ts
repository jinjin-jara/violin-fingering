/**
 * 조성(Key) 판별 유틸리티
 * 
 * 조표(Key Signature)를 기반으로 조성을 판별합니다.
 */

import { KeySignature, KeyMode, KeyInfo } from "@/types/music";

/**
 * 조표 샤프/플랫 개수에 따른 조성 매핑
 */
const KEY_SIGNATURE_MAP: Record<number, { major: KeySignature; minor: KeySignature }> = {
  0: { major: "C", minor: "A" },
  1: { major: "G", minor: "E" },
  2: { major: "D", minor: "B" },
  3: { major: "A", minor: "F#" },
  4: { major: "E", minor: "C#" },
  5: { major: "B", minor: "G#" },
  6: { major: "F#", minor: "D#" },
  7: { major: "C#", minor: "A#" },
  [-1]: { major: "F", minor: "D" },
  [-2]: { major: "Bb", minor: "G" },
  [-3]: { major: "Eb", minor: "C" },
  [-4]: { major: "Ab", minor: "F" },
  [-5]: { major: "Db", minor: "Bb" },
  [-6]: { major: "Gb", minor: "Eb" },
  [-7]: { major: "Cb", minor: "Ab" },
};

/**
 * 조표에서 샤프/플랫 개수 추출
 * @param sharps 샤프 개수 (양수)
 * @param flats 플랫 개수 (양수)
 * @returns 조성 정보
 */
export function detectKeyFromSignature(
  sharps: number = 0,
  flats: number = 0
): KeyInfo {
  const signatureCount = sharps > 0 ? sharps : -flats;
  const keyMap = KEY_SIGNATURE_MAP[signatureCount];
  
  if (!keyMap) {
    // 기본값: C major
    return {
      key: "C",
      mode: "major",
      sharps: 0,
      flats: 0,
    };
  }

  // 기본적으로 장조로 판별 (단조는 추가 분석 필요)
  return {
    key: keyMap.major,
    mode: "major",
    sharps: sharps,
    flats: flats,
  };
}

/**
 * 조성에 따른 실제 음표 변환
 * 조표에 따라 표기되지 않은 샤프/플랫을 반영하여 실제 연주 음을 계산합니다.
 */
export function getActualNote(
  noteName: string,
  keyInfo: KeyInfo
): string {
  // 조성에 따른 샤프/플랫 적용 규칙
  const keyAccidentals: Record<KeySignature, string[]> = {
    C: [],
    G: ["F#"],
    D: ["F#", "C#"],
    A: ["F#", "C#", "G#"],
    E: ["F#", "C#", "G#", "D#"],
    B: ["F#", "C#", "G#", "D#", "A#"],
    "F#": ["F#", "C#", "G#", "D#", "A#", "E#"],
    "C#": ["F#", "C#", "G#", "D#", "A#", "E#", "B#"],
    F: ["Bb"],
    Bb: ["Bb", "Eb"],
    Eb: ["Bb", "Eb", "Ab"],
    Ab: ["Bb", "Eb", "Ab", "Db"],
    Db: ["Bb", "Eb", "Ab", "Db", "Gb"],
    Gb: ["Bb", "Eb", "Ab", "Db", "Gb", "Cb"],
    Cb: ["Bb", "Eb", "Ab", "Db", "Gb", "Cb", "Fb"],
  };

  const accidentals = keyAccidentals[keyInfo.key] || [];
  const baseNote = noteName.replace(/[#b]/, ""); // 기본 음이름 추출

  // 조표에 해당하는 음이면 샤프/플랫 적용
  if (accidentals.includes(`${baseNote}#`)) {
    return `${baseNote}#`;
  }
  if (accidentals.includes(`${baseNote}b`)) {
    return `${baseNote}b`;
  }

  // 조표에 없는 음이면 원래대로
  return noteName;
}

/**
 * 음표 이름을 표준화 (C#, Db 등 통일)
 */
export function normalizeNoteName(noteName: string): string {
  const enharmonicMap: Record<string, string> = {
    "Cb": "B",
    "Db": "C#",
    "Eb": "D#",
    "Fb": "E",
    "Gb": "F#",
    "Ab": "G#",
    "Bb": "A#",
  };

  return enharmonicMap[noteName] || noteName;
}
