/**
 * 음표 좌표 추출 유틸리티
 *
 * MusicXML에서 추출한 음표 정보와 원본 이미지를 매칭하여
 * 실제 화면 좌표를 추출합니다.
 */

import { Note } from "@/types/music";
import * as fs from "fs/promises";
import * as path from "path";

/** 음이름 → 반음 오프셋 (C=0, C#=1, ...) */
const NOTE_SEMITONES: Record<string, number> = {
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

/**
 * 음높이(이름+옥타브)로 오선 위 Y 좌표 계산
 * Audiveris MusicXML에 default-y가 없을 때 사용
 */
function yFromPitch(name: string, octave: number): number {
  const semitones = NOTE_SEMITONES[name] ?? 0;
  const staffTopY = 150;
  const lineSpacing = 14;
  const c4Y = staffTopY + 1.5 * lineSpacing;
  const octaveOffset = (octave - 4) * 7 * lineSpacing;
  const semitoneOffset = semitones * (lineSpacing / 2);
  return c4Y - octaveOffset - semitoneOffset;
}

/**
 * MusicXML의 위치 정보를 기반으로 좌표 추출
 *
 * 실제 구현에서는:
 * 1. Audiveris의 출력 파일에서 좌표 정보 추출
 * 2. 또는 MusicXML의 <print> 요소에서 페이지 정보 활용
 * 3. 또는 별도의 좌표 매핑 파일 사용
 */
export async function extractNoteCoordinates(
  notes: Note[],
  imagePath: string | Buffer,
): Promise<Note[]> {
  try {
    // 이미지 로드하여 크기 확인
    let imageWidth = 1200; // 기본값
    let imageHeight = 1600; // 기본값

    if (typeof imagePath === "string") {
      // 파일 경로인 경우
      try {
        const stats = await fs.stat(imagePath);
        // 실제로는 이미지 메타데이터를 읽어야 함
        // 여기서는 기본값 사용
      } catch (error) {
        console.warn("이미지 파일 정보를 읽을 수 없습니다:", error);
      }
    }

    // 음표를 악보상 위치에 배치
    // MusicXML에서 이미 좌표가 추출된 경우 그대로 사용 (Audiveris 좌표 우선)
    // Y가 전부 0이면 Audiveris가 default-y를 넣지 않은 것이므로 음높이로 Y 계산
    const notesWithCoordinates = notes.map((note, index) => {
      const hasValidX = note.x !== undefined && !isNaN(note.x);
      // Y가 0이거나 없으면 유효하지 않은 것으로 간주 (악보에서 모든 음표가 같은 Y는 비정상)
      const hasValidY = note.y !== undefined && !isNaN(note.y) && note.y !== 0;

      if (hasValidX && hasValidY) {
        console.log(
          `[좌표 보존] ${note.name}${note.octave}: (${note.x.toFixed(1)}, ${note.y.toFixed(1)}) - MusicXML에서 추출`,
        );
        return note;
      }

      const x = hasValidX ? note.x : 100 + (index % 8) * 80;
      const y = hasValidY ? note.y : yFromPitch(note.name, note.octave);

      if (!hasValidY) {
        console.log(
          `[좌표 보정] ${note.name}${note.octave}: Y=${y.toFixed(1)} (음높이 기반, 기존 Y=${note.y})`,
        );
      } else if (!hasValidX) {
        console.log(`[좌표 추정] ${note.name}${note.octave}: 기본값 사용`);
      }

      return {
        ...note,
        x,
        y,
      };
    });

    return notesWithCoordinates;
  } catch (error) {
    console.error("좌표 추출 오류:", error);
    // 좌표 추출 실패 시 기본 좌표 반환
    return notes.map((note, index) => ({
      ...note,
      x: 100 + index * 50,
      y: 200,
    }));
  }
}

/**
 * Audiveris 출력 파일에서 좌표 정보 추출
 *
 * Audiveris는 .omr 파일에 좌표 정보를 저장합니다.
 * 이 함수는 해당 정보를 파싱합니다.
 */
export async function extractCoordinatesFromOMR(
  omrFilePath: string,
): Promise<Map<string, { x: number; y: number }>> {
  const coordinateMap = new Map<string, { x: number; y: number }>();

  try {
    // Audiveris의 .omr 파일 형식에 따라 파싱
    // 실제 구현은 Audiveris 문서 참조 필요

    // 예시: JSON 형식의 좌표 파일
    const coordData = await fs.readFile(omrFilePath, "utf-8");
    const coords = JSON.parse(coordData);

    for (const [noteId, coord] of Object.entries(coords)) {
      if (
        coord &&
        typeof coord === "object" &&
        "x" in coord &&
        "y" in coord &&
        typeof (coord as any).x === "number" &&
        typeof (coord as any).y === "number"
      ) {
        coordinateMap.set(noteId, {
          x: (coord as any).x as number,
          y: (coord as any).y as number,
        });
      }
    }
  } catch (error) {
    console.warn("OMR 좌표 파일을 읽을 수 없습니다:", error);
  }

  return coordinateMap;
}

/**
 * MusicXML의 <print> 요소에서 페이지 정보 추출
 */
export function extractPageInfoFromMusicXML(musicXml: string): {
  pageWidth?: number;
  pageHeight?: number;
  pageNumber?: number;
} {
  try {
    // fast-xml-parser로 <print> 요소 파싱
    // 실제 구현 필요
    return {};
  } catch (error) {
    console.warn("페이지 정보 추출 실패:", error);
    return {};
  }
}
