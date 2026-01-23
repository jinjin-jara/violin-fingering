/**
 * 음표 좌표 추출 유틸리티
 * 
 * MusicXML에서 추출한 음표 정보와 원본 이미지를 매칭하여
 * 실제 화면 좌표를 추출합니다.
 */

import { Note } from "@/types/music";
import * as fs from "fs/promises";
import * as path from "path";

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
  imagePath: string | Buffer
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
    // 실제 구현에서는 MusicXML의 <print> 요소나
    // Audiveris의 좌표 정보를 사용해야 합니다.
    const notesWithCoordinates = notes.map((note, index) => {
      // 간단한 배치 알고리즘 (실제로는 OMR 엔진의 좌표 사용)
      const x = 100 + (index % 8) * 80; // 8개씩 한 줄
      const y = 200 + Math.floor(index / 8) * 100; // 줄 간격
      
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
  omrFilePath: string
): Promise<Map<string, { x: number; y: number }>> {
  const coordinateMap = new Map<string, { x: number; y: number }>();

  try {
    // Audiveris의 .omr 파일 형식에 따라 파싱
    // 실제 구현은 Audiveris 문서 참조 필요
    
    // 예시: JSON 형식의 좌표 파일
    const coordData = await fs.readFile(omrFilePath, "utf-8");
    const coords = JSON.parse(coordData);
    
    for (const [noteId, coord] of Object.entries(coords)) {
      if (coord && typeof coord === "object" && "x" in coord && "y" in coord) {
        coordinateMap.set(noteId, { x: coord.x, y: coord.y });
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
