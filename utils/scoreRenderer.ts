/**
 * 악보 렌더링 유틸리티
 *
 * ✅ 요구사항 반영:
 * - 운지 숫자는 "노트별"로 배치한다 (x = noteLayout 기준)
 * - y는 "시스템(한 줄)" 단위로 고정한다 (같은 줄은 항상 같은 y)
 */

import { ScoreAnalysis, Fingering } from "@/types/music";

export interface RenderOptions {
  scale?: number;
  fontSize?: number;
  circleRadius?: number;
  textColor?: string;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;

  /** 시스템 상단에서 운지까지의 오프셋 px (위로 띄우는 거리, 양수 = 위) */
  offsetAboveMeasure?: number;

  /**
   * 시스템을 나누기 위한 measure.pageY 클러스터링 임계값(tenths)
   * 악보/해상도에 따라 달라질 수 있어 기본값 제공
   */
  systemClusterThresholdTenths?: number;

  /**
   * 손가락 숫자 변환.
   * 기존 코드가 (finger>0 ? finger-1 : 0) 이었는데,
   * 여기서 커스터마이즈 가능하도록 옵션화.
   */
  fingerTransform?: (finger: number) => number;
}

const DEFAULT_OPTIONS: Required<RenderOptions> = {
  scale: 2,
  fontSize: 24,
  circleRadius: 18,
  textColor: "#1f2937",
  backgroundColor: "#ffffff",
  borderColor: "#1f2937",
  borderWidth: 2,
  offsetAboveMeasure: 15,
  systemClusterThresholdTenths: 80,
  fingerTransform: (finger) => finger,
};

type NoteFingeringLabel = {
  measureIndex: number;
  systemIndex: number;
  renderX: number;
  renderY: number;
  label: string; // single digit typically
};

/**
 * measureLayouts를 system(한 줄) 단위로 묶고,
 * 각 system의 "하단 y"를 계산한다.
 */
function computeSystemBounds(
  analysis: ScoreAnalysis,
  thresholdTenths: number
): {
  measureToSystem: Map<number, number>;
  systemTopTenths: number[];
  systemBottomTenths: number[];
} {
  const { measureLayouts } = analysis;
  const sorted = [...(measureLayouts ?? [])].sort((a, b) => a.pageY - b.pageY);

  const measureToSystem = new Map<number, number>();
  const systemTopTenths: number[] = [];
  const systemBottomTenths: number[] = [];

  let currentSystem = -1;
  let currentRefY = Number.NEGATIVE_INFINITY;

  for (const m of sorted) {
    if (
      currentSystem === -1 ||
      Math.abs(m.pageY - currentRefY) > thresholdTenths
    ) {
      currentSystem += 1;
      currentRefY = m.pageY;
      systemTopTenths[currentSystem] = m.pageY;
      systemBottomTenths[currentSystem] = m.pageY + m.height;
    } else {
      systemTopTenths[currentSystem] = Math.min(
        systemTopTenths[currentSystem],
        m.pageY
      );
      systemBottomTenths[currentSystem] = Math.max(
        systemBottomTenths[currentSystem],
        m.pageY + m.height
      );
    }

    measureToSystem.set(m.measureIndex, currentSystem);
  }

  return { measureToSystem, systemTopTenths, systemBottomTenths };
}

/**
 * ✅ 핵심: 노트별 운지 라벨을 만든다.
 * - x: noteLayout.pageX (tenths) 기반
 * - y: systemTop - offsetAboveMeasure (px) — 마디 상단에서 위로 배치
 */
export function buildNoteFingeringLabels(
  analysis: ScoreAnalysis,
  displayWidth: number,
  displayHeight: number,
  opts: Required<RenderOptions>
): NoteFingeringLabel[] {
  const { pageLayout, fingerings, noteLayouts, measureLayouts } = analysis;
  if (
    !pageLayout ||
    !fingerings?.length ||
    !noteLayouts?.length ||
    !measureLayouts?.length
  )
    return [];

  const scaleX = displayWidth / pageLayout.pageWidthTenths;
  const scaleY = displayHeight / pageLayout.pageHeightTenths;

  const { measureToSystem, systemTopTenths, systemBottomTenths } = computeSystemBounds(
    analysis,
    opts.systemClusterThresholdTenths
  );

  // noteLayouts를 빠르게 찾기 위한 map
  const noteLayoutById = new Map(noteLayouts.map((l: any) => [l.id, l]));

  const labels: NoteFingeringLabel[] = [];

  for (const f of fingerings as Fingering[]) {
    const layout: any = f.note.layoutId
      ? noteLayoutById.get(f.note.layoutId)
      : null;
    if (!layout) continue;

    const measureIndex: number = layout.measureIndex ?? 0;
    const systemIndex = measureToSystem.get(measureIndex) ?? 0;

    // x 좌표는 노트 중심이 가장 자연스럽다.
    const noteXtenths: number =
      typeof layout.pageX === "number"
        ? layout.pageX +
          (typeof layout.width === "number" ? layout.width / 2 : 0)
        : typeof layout.x === "number"
        ? layout.x + (typeof layout.width === "number" ? layout.width / 2 : 0)
        : 0;

    const systemBottom = systemBottomTenths[systemIndex] ?? 0;

    const renderX = noteXtenths * scaleX;
    const renderY = systemBottom * scaleY - opts.offsetAboveMeasure;

    const digit = opts.fingerTransform(f.finger);
    labels.push({
      measureIndex,
      systemIndex,
      renderX,
      renderY,
      label: String(digit),
    });
  }

  // 같은 시스템 내에서는 x 오름차순으로 그려야 자연스럽다
  labels.sort((a, b) =>
    a.systemIndex !== b.systemIndex
      ? a.systemIndex - b.systemIndex
      : a.renderX - b.renderX
  );

  return labels;
}

function drawFingeringCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  options: Required<RenderOptions>
): void {
  const {
    fontSize,
    circleRadius,
    textColor,
    backgroundColor,
    borderColor,
    borderWidth,
  } = options;

  ctx.save();
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // circle
  ctx.beginPath();
  ctx.arc(x, y, circleRadius, 0, Math.PI * 2);
  ctx.closePath();

  ctx.fillStyle = backgroundColor;
  ctx.fill();

  ctx.lineWidth = borderWidth;
  ctx.strokeStyle = borderColor;
  ctx.stroke();

  ctx.fillStyle = textColor;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/**
 * ✅ 진입점: 이미지 그린 후 "노트별 운지"를 시스템 하단에 고정해서 찍는다.
 */
export function renderScoreWithFingerings(
  image: HTMLImageElement | HTMLCanvasElement,
  analysis: ScoreAnalysis,
  canvas: HTMLCanvasElement,
  options: RenderOptions = {}
): void {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context를 가져올 수 없습니다.");

  const displayWidth = image.width;
  const displayHeight = image.height;

  canvas.width = displayWidth * opts.scale;
  canvas.height = displayHeight * opts.scale;

  ctx.setTransform(opts.scale, 0, 0, opts.scale, 0, 0); // scale 리셋+적용

  ctx.drawImage(image, 0, 0, displayWidth, displayHeight);

  // 노트별 라벨 생성
  const labels = buildNoteFingeringLabels(
    analysis,
    displayWidth,
    displayHeight,
    opts
  );

  for (const l of labels) {
    // 안전 범위 체크
    if (l.renderY < -200 || l.renderY > displayHeight + 200) continue;
    if (l.renderX < -200 || l.renderX > displayWidth + 200) continue;

    drawFingeringCircle(ctx, l.renderX, l.renderY, l.label, opts);
  }
}
