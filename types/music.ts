/**
 * 음악 관련 타입 정의
 */

// 음표 이름 (계이름)
export type NoteName = "C" | "C#" | "D" | "D#" | "E" | "F" | "F#" | "G" | "G#" | "A" | "A#" | "B";

// 조성 (Key)
export type KeySignature = 
  | "C" | "G" | "D" | "A" | "E" | "B" | "F#" | "C#" // 샤프 계열
  | "F" | "Bb" | "Eb" | "Ab" | "Db" | "Gb" | "Cb"; // 플랫 계열

// 조성 모드 (장조/단조)
export type KeyMode = "major" | "minor";

// 바이올린 현
export type ViolinString = "E" | "A" | "D" | "G";

// 포지션
export type Position = "half" | "1st" | "2nd" | "3rd" | "4th";

// 손가락 번호 (0 = 개방현, 1-4 = 손가락)
export type FingerNumber = 0 | 1 | 2 | 3 | 4;

// 음표 정보
export interface Note {
  name: NoteName; // 실제 연주되는 음 (조성 반영)
  octave: number; // 옥타브
  x: number; // 악보상 x 좌표
  y: number; // 악보상 y 좌표
  duration?: number; // 음표 길이 (4분음표 = 1, 8분음표 = 0.5 등)
}

// 운지 정보
export interface Fingering {
  string: ViolinString; // 현
  finger: FingerNumber; // 손가락 번호
  position: Position; // 포지션
  note: Note; // 원본 음표 정보
}

// 조성 정보
export interface KeyInfo {
  key: KeySignature;
  mode: KeyMode;
  sharps: number; // 샤프 개수
  flats: number; // 플랫 개수
}

// 악보 분석 결과
export interface ScoreAnalysis {
  keyInfo: KeyInfo;
  notes: Note[];
  fingerings: Fingering[];
  timeSignature?: {
    numerator: number;
    denominator: number;
  };
}
