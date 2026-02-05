/**
 * 음표 좌표 추출 유틸리티
 *
 * Audiveris/MusicXML 결과를 바탕으로 **페이지 기준 절대 좌표**를 계산합니다.
 * - staff/system 상대 좌표 ❌ → page 절대 좌표 ✅
 * - scale/DPI/이미지 리사이즈 시에도 Canvas 오버레이가 정확히 일치하도록
 *   좌표 변환 계층을 명확히 분리합니다.
 */

import type { Note, NoteLayout, PageLayoutInfo } from "@/types/music";
import {
  computeNoteLayoutsFromMusicXML,
  type AudiverisNoteLayoutResult,
} from "./audiverisNoteLayout";
import * as fs from "fs/promises";

/** 바이올린 음역 (G3 ~ E7) 필터: 해당 범위만 허용할 때 사용 */
const VIOLIN_LOW_SEMI = 7 * 12 + 7; // G3
const VIOLIN_HIGH_SEMI = 7 * 12 + 16; // E7

function pitchToSemitones(pitch: string): number {
  const match = pitch.match(/^([A-G]#?)(\d+)$/);
  if (!match) return 0;
  const name = match[1];
  const octave = parseInt(match[2], 10) || 4;
  const base: Record<string, number> = {
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
  const semi = (octave + 1) * 12 + (base[name] ?? 0);
  return semi;
}

function inViolinRange(pitch: string): boolean {
  const s = pitchToSemitones(pitch);
  return s >= VIOLIN_LOW_SEMI && s <= VIOLIN_HIGH_SEMI;
}

/**
 * MusicXML + (선택) 이미지 크기로 NoteLayout[] 및 페이지 좌표 계산
 * - musicXml: Audiveris 등이 출력한 MusicXML
 * - imageSize: 원본 악보 이미지 크기(픽셀). 있으면 pageX/pageY를 픽셀으로 반환
 * - options.violinRangeOnly: true이면 G3~E7만 포함 (기본 false)
 */
export function extractNoteLayoutsFromMusicXML(
  musicXml: string,
  imageSize?: { width: number; height: number },
  options?: { violinRangeOnly?: boolean }
): AudiverisNoteLayoutResult {
  const result = computeNoteLayoutsFromMusicXML(musicXml, imageSize);
  if (options?.violinRangeOnly && result.noteLayouts.length > 0) {
    const filtered = result.noteLayouts.filter((n) => inViolinRange(n.pitch));
    const rawFiltered = result.rawNotePositions.filter((r) =>
      filtered.some((f) => f.id === r.id)
    );
    return {
      noteLayouts: filtered,
      pageLayout: result.pageLayout,
      measureLayouts: result.measureLayouts,
      rawNotePositions: rawFiltered,
    };
  }
  return result;
}

/**
 * NoteLayout[] + PageLayoutInfo를 이미지 픽셀 좌표로 변환
 * (클라이언트에서 이미지 로드 후 Canvas 오버레이 시 사용)
 */
export function noteLayoutsToPixel(
  noteLayouts: NoteLayout[],
  pageLayout: PageLayoutInfo,
  imageWidth: number,
  imageHeight: number
): Array<NoteLayout & { pixelX: number; pixelY: number }> {
  const scaleX = imageWidth / pageLayout.pageWidthTenths;
  const scaleY = imageHeight / pageLayout.pageHeightTenths;
  return noteLayouts.map((n) => ({
    ...n,
    pixelX: n.pageX * scaleX,
    pixelY: n.pageY * scaleY,
  }));
}

/**
 * 음표 목록(Note[])의 x, y를 NoteLayout 페이지 좌표와 동기화
 * - noteLayouts가 tenths인 경우 imageSize로 픽셀 변환 후 notes에 반영
 * - 순서는 동일하다고 가정 (notes[i] ↔ noteLayouts[i])
 */
export function syncNotesFromNoteLayouts(
  notes: Note[],
  noteLayouts: NoteLayout[],
  pageLayout: PageLayoutInfo,
  imageSize: { width: number; height: number }
): Note[] {
  if (noteLayouts.length === 0) return notes;
  const scaleX = imageSize.width / pageLayout.pageWidthTenths;
  const scaleY = imageSize.height / pageLayout.pageHeightTenths;
  return notes.map((note, i) => {
    const layout = noteLayouts[i];
    if (!layout) return note;
    return {
      ...note,
      x: layout.pageX * scaleX,
      y: layout.pageY * scaleY,
      layoutId: layout.id,
    };
  });
}

/**
 * 기존 파이프라인 호환: notes + imagePath만 받아 좌표 보정
 * - musicXml과 imageSize가 주어지면 Audiveris 페이지 좌표를 사용하고,
 *   그렇지 않으면 기존 추정 로직(음높이 기반 Y 등) 사용
 */
export async function extractNoteCoordinates(
  notes: Note[],
  imagePath: string | Buffer,
  context?: {
    musicXml?: string;
    imageSize?: { width: number; height: number };
    violinRangeOnly?: boolean;
  }
): Promise<Note[]> {
  if (context?.musicXml && notes.length > 0) {
    const result = extractNoteLayoutsFromMusicXML(
      context.musicXml,
      context.imageSize,
      { violinRangeOnly: context.violinRangeOnly }
    );
    if (result.noteLayouts.length > 0 && result.pageLayout) {
      let imageSize = context.imageSize;
      if (!imageSize && typeof imagePath === "string") {
        imageSize = await getImageDimensionsInternal(imagePath);
      }
      if (imageSize) {
        return syncNotesFromNoteLayouts(
          notes,
          result.noteLayouts,
          result.pageLayout,
          imageSize
        );
      }
      // 이미지 크기 없으면 tenths를 그대로 notes에 넣지 않고, 기존 로직으로 폴백
    }
  }

  // 폴백: 이미지 크기 추정 후 음높이 기반 Y 등
  let imageWidth = 1200;
  let imageHeight = 1600;
  if (typeof imagePath === "string") {
    try {
      const dim = await getImageDimensions(imagePath);
      imageWidth = dim.width;
      imageHeight = dim.height;
    } catch {
      // 기본값 유지
    }
  }

  const notesWithCoordinates = notes.map((note, index) => {
    const hasValidX = note.x !== undefined && !isNaN(note.x);
    const hasValidY = note.y !== undefined && !isNaN(note.y) && note.y !== 0;

    if (hasValidX && hasValidY) return note;

    const staffTopY = 150;
    const lineSpacing = 14;
    const semitones: Record<string, number> = {
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
    const c4Y = staffTopY + 1.5 * lineSpacing;
    const octaveOffset = (note.octave - 4) * 7 * lineSpacing;
    const semitoneOffset = (semitones[note.name] ?? 0) * (lineSpacing / 2);
    const y = c4Y - octaveOffset - semitoneOffset;
    const x = hasValidX ? note.x : 100 + (index % 8) * 80;

    return { ...note, x, y };
  });

  return notesWithCoordinates;
}

async function getImageDimensionsInternal(
  imagePath: string
): Promise<{ width: number; height: number }> {
  try {
    const buf = await fs.readFile(imagePath);
    return getImageDimensionsFromBuffer(buf);
  } catch {
    return { width: 1200, height: 1600 };
  }
}

/** Buffer에서 이미지 크기 추출 (PNG/JPEG 시그니처만 간단 처리) */
function getImageDimensionsFromBuffer(buf: Buffer): {
  width: number;
  height: number;
} {
  if (buf.length < 24) return { width: 1200, height: 1600 };
  // PNG: 8 bytes signature, then IHDR chunk (width 4, height 4 at offset 16)
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e) {
    if (buf.length >= 24) {
      const w = buf.readUInt32BE(16);
      const h = buf.readUInt32BE(20);
      if (w > 0 && w < 20000 && h > 0 && h < 20000)
        return { width: w, height: h };
    }
  }
  // JPEG: SOF0 (0xFF 0xC0) width/height at offset 5 and 7 (2 bytes each)
  let i = 0;
  while (i < buf.length - 9) {
    if (buf[i] === 0xff && buf[i + 1] === 0xc0) {
      const h = buf.readUInt16BE(i + 5);
      const w = buf.readUInt16BE(i + 7);
      if (w > 0 && w < 20000 && h > 0 && h < 20000)
        return { width: w, height: h };
    }
    i++;
  }
  return { width: 1200, height: 1600 };
}

/**
 * Audiveris .omr 파일에서 좌표 추출 (선택 구현)
 * 현재는 JSON 형식 좌표 파일만 지원.
 */
export async function extractCoordinatesFromOMR(
  omrFilePath: string
): Promise<Map<string, { x: number; y: number }>> {
  const coordinateMap = new Map<string, { x: number; y: number }>();
  try {
    const coordData = await fs.readFile(omrFilePath, "utf-8");
    const coords = JSON.parse(coordData);
    for (const [noteId, coord] of Object.entries(coords)) {
      const c = coord as { x?: number; y?: number };
      if (c && typeof c.x === "number" && typeof c.y === "number") {
        coordinateMap.set(noteId, { x: c.x, y: c.y });
      }
    }
  } catch {
    // 무시
  }
  return coordinateMap;
}

/**
 * MusicXML의 <defaults><page-layout> 등에서 페이지 정보 추출
 */
export function extractPageInfoFromMusicXML(musicXml: string): {
  pageWidth?: number;
  pageHeight?: number;
  pageNumber?: number;
} {
  try {
    const result = computeNoteLayoutsFromMusicXML(musicXml);
    return {
      pageWidth: result.pageLayout.pageWidthTenths,
      pageHeight: result.pageLayout.pageHeightTenths,
    };
  } catch {
    return {};
  }
}

/** 이미지 파일 경로에서 width/height 읽기 (Node). PNG/JPEG 지원. */
export async function getImageDimensions(
  imagePath: string
): Promise<{ width: number; height: number }> {
  const buf = await fs.readFile(imagePath);
  return getImageDimensionsFromBuffer(buf);
}
