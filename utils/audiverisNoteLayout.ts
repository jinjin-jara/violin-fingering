/**
 * Audiveris/MusicXML 기반 음표 페이지 좌표 계산
 *
 * MusicXML의 Page / System / Staff 계층과 default-x, default-y(tenths)를
 * 원본 악보 이미지 기준 절대 좌표(픽셀)로 변환합니다.
 * - staff/system 기준 상대 좌표 ❌
 * - page 기준 절대 좌표 ✅
 */

import { XMLParser } from "fast-xml-parser";
import type { NoteLayout, PageLayoutInfo, MeasureLayout } from "@/types/music";

/** MusicXML 파싱용 옵션 (속성 @_ 접두사) */
const PARSER_OPTIONS = {
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseAttributeValue: false,
  trimValues: true,
  ignoreNameSpace: true,
  removeNSPrefix: true,
};

/** 음표 머리 기본 크기 (tenths). bounding box에 사용 */
const DEFAULT_NOTEHEAD_WIDTH_TENTHS = 12;
const DEFAULT_NOTEHEAD_HEIGHT_TENTHS = 8;

/** MusicXML 표준: 오선 하나 높이 = 40 tenths (5선 = 4 space, 1 space = 10 tenths) */
const STAFF_HEIGHT_TENTHS = 40;

/** 파싱 결과: tenths 단위 레이아웃 + 마디 좌표 */
export interface AudiverisNoteLayoutResult {
  noteLayouts: NoteLayout[];
  pageLayout: PageLayoutInfo;
  /** 마디별 경계 (tenths). MusicXML measure 내 음표 좌표로부터 추출 */
  measureLayouts: MeasureLayout[];
  /** tenths 단위 원시 좌표 (디버깅/폴백용) */
  rawNotePositions: Array<{
    id: string;
    pitch: string;
    pageXTenths: number;
    pageYTenths: number;
    widthTenths: number;
    heightTenths: number;
    staffIndex: number;
    voiceIndex?: number;
    duration?: number;
  }>;
}

/**
 * MusicXML에서 defaults / print 레이아웃 추출
 * - scaling: tenths, millimeters
 * - page-layout: page-width, page-height (tenths)
 * - system-layout: top-system-distance, system-distance (tenths)
 * - staff-layout: staff-distance (tenths)
 */
function extractPageLayout(scorePartwise: any): {
  pageWidthTenths: number;
  pageHeightTenths: number;
  tenthsPerMm: number;
  leftMarginTenths: number;
  rightMarginTenths: number;
  topMarginTenths: number;
  /** 이전 시스템 하단으로부터의 거리(delta). 첫 시스템은 pageTopMargin 다음에 이만큼 띄고 시작 */
  topSystemDistanceTenths: number;
  /** 시스템 간 거리(delta): 이전 시스템 하단 ~ 다음 시스템 상단 */
  systemDistanceTenths: number;
  staffDistancesTenths: number[];
} {
  const defaults = scorePartwise.defaults ?? scorePartwise["defaults"] ?? {};
  const scaling = defaults.scaling ?? defaults["scaling"] ?? {};
  const tenths =
    parseFloat(String(scaling.tenths ?? scaling["tenths"] ?? 40)) || 40;
  const mm =
    parseFloat(String(scaling.millimeters ?? scaling["millimeters"] ?? 7)) || 7;
  const tenthsPerMm = tenths / mm;

  let pageWidthTenths = 1680;
  let pageHeightTenths = 2376;
  let leftMarginTenths = 40;
  let rightMarginTenths = 40;
  let topMarginTenths = 70;
  let topSystemDistanceTenths = 70;
  let systemDistanceTenths = 120;
  const staffDistancesTenths: number[] = [0];

  // page-layout (defaults 내부)
  const pageLayout = defaults["page-layout"] ?? defaults.pageLayout;
  if (pageLayout) {
    const pw = pageLayout["page-width"] ?? pageLayout.pageWidth;
    const ph = pageLayout["page-height"] ?? pageLayout.pageHeight;
    const lm = pageLayout["left-margin"] ?? pageLayout.leftMargin;
    const rm = pageLayout["right-margin"] ?? pageLayout.rightMargin;
    const tm = pageLayout["top-margin"] ?? pageLayout.topMargin;
    if (pw != null) pageWidthTenths = parseFloat(String(pw)) || pageWidthTenths;
    if (ph != null)
      pageHeightTenths = parseFloat(String(ph)) || pageHeightTenths;
    if (lm != null)
      leftMarginTenths = parseFloat(String(lm)) || leftMarginTenths;
    if (rm != null)
      rightMarginTenths = parseFloat(String(rm)) || rightMarginTenths;
    if (tm != null)
      topMarginTenths = parseFloat(String(tm)) || topMarginTenths;
  }

  // system-layout: top-system-distance = 이전 시스템 하단으로부터의 delta (첫 시스템은 page top margin + 이 값으로 첫 시스템 상단)
  const systemLayout = defaults["system-layout"] ?? defaults.systemLayout;
  if (systemLayout) {
    const tsd =
      systemLayout["top-system-distance"] ?? systemLayout.topSystemDistance;
    const sd = systemLayout["system-distance"] ?? systemLayout.systemDistance;
    if (tsd != null)
      topSystemDistanceTenths =
        parseFloat(String(tsd)) || topSystemDistanceTenths;
    if (sd != null)
      systemDistanceTenths = parseFloat(String(sd)) || systemDistanceTenths;
  }

  // staff-layout (복수 가능): staff-distance만 사용, note 미사용
  const staffLayout = defaults["staff-layout"] ?? defaults.staffLayout;
  if (staffLayout) {
    const arr = Array.isArray(staffLayout) ? staffLayout : [staffLayout];
    for (let i = 0; i < arr.length; i++) {
      const dist = arr[i]?.["staff-distance"] ?? arr[i]?.staffDistance;
      if (dist != null)
        staffDistancesTenths.push(parseFloat(String(dist)) || 0);
    }
  }
  // 단일 스태프 악기(바이올린 등): staffDistancesTenths = [0] 그대로 유지 (staffCount = 1)

  return {
    pageWidthTenths,
    pageHeightTenths,
    tenthsPerMm,
    leftMarginTenths,
    rightMarginTenths,
    topMarginTenths,
    topSystemDistanceTenths,
    systemDistanceTenths,
    staffDistancesTenths,
  };
}

/**
 * system-layout + staff-layout만으로 system 세로 범위 계산 (note 미사용).
 */
function getSystemStaffHeightTenths(staffDistancesTenths: number[]): number {
  const staffCount = Math.max(1, staffDistancesTenths.length);
  const sumDistances = staffDistancesTenths.reduce((a, b) => a + b, 0);
  return staffCount * STAFF_HEIGHT_TENTHS + sumDistances;
}

interface MeasureSystemData {
  measureToSystem: number[];
  /** 첫 시스템: topMargin 이후 실제 거리 (Audiveris <print><system-layout><top-system-distance>). null이면 global default 사용 */
  firstSystemTopDistance: number | null;
  /** 시스템 인덱스별 실제 system-distance (이전 시스템 bottom ~ 현 시스템 top). 없으면 global default */
  systemDistances: Map<number, number>;
}

/**
 * part 0의 measure 목록에서 시스템 경계 및 실제 Y 위치 정보를 추출.
 * - <print new-system="yes"/> / new-page 로 시스템 경계 감지
 * - <print><system-layout> 에서 top-system-distance / system-distance 읽기
 */
function getMeasureSystemData(measureList: any[]): MeasureSystemData {
  const measureToSystem: number[] = [];
  let systemIndex = 0;
  let firstSystemTopDistance: number | null = null;
  const systemDistances = new Map<number, number>();

  for (let i = 0; i < measureList.length; i++) {
    const measure = measureList[i];
    const print = measure.print ?? measure["print"];
    const prints = print == null ? [] : Array.isArray(print) ? print : [print];

    for (const p of prints) {
      const sysLayout = p["system-layout"] ?? p.systemLayout;

      if (i === 0 && sysLayout) {
        // 첫 마디: top-system-distance (topMargin 이후 첫 시스템까지의 거리)
        const tsd = sysLayout["top-system-distance"] ?? sysLayout.topSystemDistance;
        if (tsd != null) {
          const v = parseFloat(String(tsd));
          if (!isNaN(v) && v > 0) firstSystemTopDistance = v;
        }
      }

      if (i > 0) {
        const newSystem =
          p["@_new-system"] ?? p["new-system"] ?? p["@_newSystem"] ?? p.newSystem;
        const newPage =
          p["@_new-page"] ?? p["new-page"] ?? p["@_newPage"] ?? p.newPage;
        if (newSystem === "yes" || newSystem === true || newPage === "yes" || newPage === true) {
          systemIndex++;
          if (sysLayout) {
            // system-distance: 이전 시스템 하단 ~ 현 시스템 상단 거리
            const sd = sysLayout["system-distance"] ?? sysLayout.systemDistance;
            if (sd != null) {
              const v = parseFloat(String(sd));
              if (!isNaN(v) && v > 0) systemDistances.set(systemIndex, v);
            }
          }
          break;
        }
      }
    }

    measureToSystem.push(systemIndex);
  }

  return { measureToSystem, firstSystemTopDistance, systemDistances };
}

/**
 * systemIndex별 누적 Y 계산.
 * - firstSystemTopDistance: <print><system-layout><top-system-distance> (없으면 global default)
 * - systemDistances: 시스템별 <system-distance> (없으면 global default)
 */
function buildSystemPageYs(
  systemCount: number,
  staffHeightTenths: number,
  globalSystemDistanceTenths: number,
  pageTopMarginTenths: number,
  globalTopSystemDistanceTenths: number,
  firstSystemTopDistance: number | null,
  systemDistances: Map<number, number>
): number[] {
  const pageYs: number[] = [];
  const topDist = firstSystemTopDistance ?? globalTopSystemDistanceTenths;
  let currentSystemY = pageTopMarginTenths + topDist;
  for (let s = 0; s < systemCount; s++) {
    pageYs.push(currentSystemY);
    currentSystemY += staffHeightTenths;
    const sysDist = systemDistances.get(s + 1) ?? globalSystemDistanceTenths;
    currentSystemY += sysDist;
  }
  return pageYs;
}

function pitchToName(pitch: any): string {
  if (!pitch) return "C";
  const step = (pitch.step ?? pitch["step"] ?? "C") as string;
  const alter = pitch.alter != null ? parseInt(String(pitch.alter), 10) : 0;
  const names: Record<string, string[]> = {
    C: ["Cb", "C", "C#"],
    D: ["Db", "D", "D#"],
    E: ["Eb", "E", "E#"],
    F: ["Fb", "F", "F#"],
    G: ["Gb", "G", "G#"],
    A: ["Ab", "A", "A#"],
    B: ["Bb", "B", "B#"],
  };
  const base = names[step] ?? ["C", "C#", "D"];
  const index = Math.max(0, Math.min(2, alter + 1));
  return base[index];
}

function getOctave(pitch: any): number {
  if (!pitch?.octave && pitch?.["octave"] == null) return 4;
  return parseInt(String(pitch.octave ?? pitch["octave"]), 10) || 4;
}

/**
 * MusicXML + (선택) 이미지 크기로 NoteLayout[] 및 PageLayoutInfo 계산
 * - musicXml: Audiveris 등이 출력한 MusicXML 문자열
 * - imageSize: 원본 악보 이미지 크기(픽셀). 주어지면 tenths → 픽셀 변환하여 pageX/pageY/width/height 반환
 * - imageSize가 없으면 pageX/pageY/width/height는 tenths 값을 그대로 사용(호출측에서 스케일 적용)
 */
export function computeNoteLayoutsFromMusicXML(
  musicXml: string,
  imageSize?: { width: number; height: number },
): AudiverisNoteLayoutResult {
  const parser = new XMLParser(PARSER_OPTIONS);
  const parsed = parser.parse(musicXml) as any;
  if (!parsed || typeof parsed !== "object") {
    return {
      noteLayouts: [],
      pageLayout: {
        pageWidthTenths: 1680,
        pageHeightTenths: 2376,
        tenthsPerMm: 40 / 7,
      },
      measureLayouts: [],
      rawNotePositions: [],
    };
  }

  let scorePartwise =
    parsed["score-partwise"] ??
    parsed["score-timewise"] ??
    parsed.scorePartwise ??
    parsed.scoreTimewise;
  if (Array.isArray(scorePartwise)) scorePartwise = scorePartwise[0];
  if (!scorePartwise) {
    return {
      noteLayouts: [],
      pageLayout: {
        pageWidthTenths: 1680,
        pageHeightTenths: 2376,
        tenthsPerMm: 40 / 7,
      },
      measureLayouts: [],
      rawNotePositions: [],
    };
  }

  const layout = extractPageLayout(scorePartwise);
  const {
    pageWidthTenths,
    pageHeightTenths,
    tenthsPerMm,
    leftMarginTenths,
    rightMarginTenths,
    topMarginTenths,
    topSystemDistanceTenths,
    systemDistanceTenths,
    staffDistancesTenths,
  } = layout;

  const systemStaffHeightTenths = getSystemStaffHeightTenths(staffDistancesTenths);
  const systemWidthTenths = Math.max(
    0,
    pageWidthTenths - leftMarginTenths - rightMarginTenths
  );

  // noteLayouts는 항상 tenths로 저장. 픽셀 변환은 syncNotesFromNoteLayouts/렌더러에서 한 번만 수행
  const scaleX = 1;
  const scaleY = 1;

  const pageLayoutInfo: PageLayoutInfo = {
    pageWidthTenths,
    pageHeightTenths,
    tenthsPerMm,
  };

  const rawNotePositions: AudiverisNoteLayoutResult["rawNotePositions"] = [];
  const noteLayouts: NoteLayout[] = [];
  let noteIndex = 0;

  const parts = scorePartwise.part ?? scorePartwise["part"] ?? [];
  const partList = Array.isArray(parts) ? parts : [parts];

  const firstPart = partList[0];
  const firstPartMeasures = firstPart?.measure ?? firstPart?.["measure"] ?? [];
  const measureList = Array.isArray(firstPartMeasures)
    ? firstPartMeasures
    : [firstPartMeasures];
  const numMeasures = measureList.length;

  const {
    measureToSystem: measureToSystemIndex,
    firstSystemTopDistance,
    systemDistances,
  } = getMeasureSystemData(measureList);
  const systemCount =
    measureToSystemIndex.length > 0
      ? Math.max(...measureToSystemIndex) + 1
      : 1;
  const systemPageYs = buildSystemPageYs(
    systemCount,
    systemStaffHeightTenths,
    systemDistanceTenths,
    topMarginTenths,
    topSystemDistanceTenths,
    firstSystemTopDistance,
    systemDistances
  );

  const measuresPerSystem = new Map<number, number>();
  for (let i = 0; i < measureToSystemIndex.length; i++) {
    const s = measureToSystemIndex[i];
    measuresPerSystem.set(s, (measuresPerSystem.get(s) ?? 0) + 1);
  }

  const measureLayouts: MeasureLayout[] = [];
  for (let i = 0; i < numMeasures; i++) {
    const sysIdx = measureToSystemIndex[i] ?? 0;
    const systemPageY = systemPageYs[sysIdx] ?? systemPageYs[0];
    const measuresInThisSystem = measuresPerSystem.get(sysIdx) ?? 1;
    const measureWidthTenths =
      measuresInThisSystem > 0
        ? systemWidthTenths / measuresInThisSystem
        : systemWidthTenths;
    const measureOffsetInSystem = measureList
      .slice(0, i)
      .filter((_, j) => measureToSystemIndex[j] === sysIdx).length;
    measureLayouts.push({
      measureIndex: i,
      pageX: leftMarginTenths + measureOffsetInSystem * measureWidthTenths,
      pageY: systemPageY,
      width: measureWidthTenths,
      height: systemStaffHeightTenths,
    });
  }

  for (let partIdx = 0; partIdx < partList.length; partIdx++) {
    const part = partList[partIdx];
    const measures = part.measure ?? part["measure"] ?? [];
    const partMeasureList = Array.isArray(measures) ? measures : [measures];

    for (let measureIdx = 0; measureIdx < partMeasureList.length; measureIdx++) {
      const measure = partMeasureList[measureIdx];
      const notes = measure.note ?? measure["note"] ?? [];
      const noteList = Array.isArray(notes) ? notes : [notes];

      for (const noteEl of noteList) {
        if (!noteEl || typeof noteEl !== "object") continue;
        if (noteEl.rest ?? noteEl["rest"]) continue;

        const pitch = noteEl.pitch ?? noteEl["pitch"];
        if (!pitch) continue;

        const noteName = pitchToName(pitch);
        const octave = getOctave(pitch);
        const pitchStr = `${noteName}${octave}`;

        const staffNum =
          parseInt(
            String(noteEl["@_staff"] ?? noteEl["@_Staff"] ?? noteEl.staff ?? 1),
            10,
          ) || 1;
        const staffIndex = Math.max(0, staffNum - 1);
        const voiceIndex =
          noteEl["@_voice"] ?? noteEl["@_Voice"] ?? noteEl.voice;

        const defaultX = noteEl["@_default-x"] ?? noteEl["default-x"];
        const defaultY = noteEl["@_default-y"] ?? noteEl["default-y"];
        const durationEl = noteEl.duration ?? noteEl["duration"];
        const divisions =
          measure.attributes?.divisions ??
          measure.attributes?.["divisions"] ??
          1;
        const duration =
          durationEl != null
            ? Number(durationEl) / Number(divisions)
            : undefined;

        const xTenths = defaultX != null ? parseFloat(String(defaultX)) : 0;
        const yTenths = defaultY != null ? parseFloat(String(defaultY)) : 0;

        const widthTenths = DEFAULT_NOTEHEAD_WIDTH_TENTHS;
        const heightTenths = DEFAULT_NOTEHEAD_HEIGHT_TENTHS;

        const meas = measureLayouts[measureIdx];
        const pageXTenths =
          meas != null ? meas.pageX + xTenths : leftMarginTenths + xTenths;
        const staffTopFromSystem = staffDistancesTenths
          .slice(0, staffIndex + 1)
          .reduce((a, b) => a + b, 0);
        // MusicXML default-y: 스태프 상단선 기준, 위=양수. 페이지 Y축은 아래=양수이므로 부호 반전.
        const systemPageY = meas != null ? meas.pageY : (topMarginTenths + topSystemDistanceTenths);
        const pageYTenths = systemPageY + staffTopFromSystem - yTenths;

        const id = `note-${partIdx}-${noteIndex}`;
        noteIndex++;

        rawNotePositions.push({
          id,
          pitch: pitchStr,
          pageXTenths,
          pageYTenths,
          widthTenths,
          heightTenths,
          staffIndex,
          voiceIndex: voiceIndex != null ? Number(voiceIndex) : undefined,
          duration,
        });

        noteLayouts.push({
          id,
          pitch: pitchStr,
          pageX: pageXTenths * scaleX,
          pageY: pageYTenths * scaleY,
          width: widthTenths * scaleX,
          height: heightTenths * scaleY,
          staffIndex,
          voiceIndex: voiceIndex != null ? Number(voiceIndex) : undefined,
          duration,
          measureIndex: measureIdx,
        });
      }
    }
  }

  return {
    noteLayouts,
    pageLayout: pageLayoutInfo,
    measureLayouts,
    rawNotePositions,
  };
}

/**
 * tenths 좌표를 이미지 픽셀 좌표로 변환
 * (클라이언트에서 이미지 크기를 알 때 사용)
 */
export function tenthsToPixel(
  pageXTenths: number,
  pageYTenths: number,
  pageLayout: PageLayoutInfo,
  imageWidth: number,
  imageHeight: number,
): { x: number; y: number } {
  const scaleX = imageWidth / pageLayout.pageWidthTenths;
  const scaleY = imageHeight / pageLayout.pageHeightTenths;
  return {
    x: pageXTenths * scaleX,
    y: pageYTenths * scaleY,
  };
}
