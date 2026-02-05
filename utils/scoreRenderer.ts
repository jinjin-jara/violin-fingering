/**
 * 악보 렌더링 유틸리티
 *
 * 운지 숫자는 **measure bounding box 기준**으로만 배치합니다.
 * note.y / staff.y / system 상대 좌표는 사용하지 않습니다.
 */

import {
  ScoreAnalysis,
  MeasureLayout,
  MeasureLabel,
  Fingering,
} from "@/types/music";

export interface RenderOptions {
  /** 고해상도 렌더링을 위한 스케일 (기본: 2) */
  scale?: number;
  /** 운지 라벨 폰트 크기 (기본: 24) */
  fontSize?: number;
  /** 숫자 배경 원의 반지름 (기본: 18) */
  circleRadius?: number;
  /** 숫자 색상 (기본: #1f2937) */
  textColor?: string;
  /** 배경 원 색상 (기본: #ffffff) */
  backgroundColor?: string;
  /** 배경 원 테두리 색상 (기본: #1f2937) */
  borderColor?: string;
  /** 배경 원 테두리 두께 (기본: 2) */
  borderWidth?: number;
  /** 마디 bbox 하단에서 라벨까지의 고정 오프셋 픽셀 (기본: 30) */
  offsetBelowMeasure?: number;
}

const DEFAULT_OPTIONS: Required<RenderOptions> = {
  scale: 2,
  fontSize: 24,
  circleRadius: 18,
  textColor: "#1f2937",
  backgroundColor: "#ffffff",
  borderColor: "#1f2937",
  borderWidth: 2,
  offsetBelowMeasure: 30,
};

/**
 * analysis에서 MeasureLabel[] 생성.
 * - fingerings를 noteLayout.measureIndex로 마디별 그룹화
 * - x = measure bbox 중앙 (pageX + width/2), y = measure bbox 하단 (pageY + height) + offset
 * - note.y / staff.y / 상대 좌표 미사용
 */
export function buildMeasureLabels(
  analysis: ScoreAnalysis,
  displayWidth: number,
  displayHeight: number,
  offsetBelowMeasurePx: number
): MeasureLabel[] {
  const { measureLayouts, pageLayout, fingerings, noteLayouts } = analysis;
  if (
    !measureLayouts?.length ||
    !pageLayout ||
    !fingerings?.length ||
    !noteLayouts?.length
  )
    return [];

  const scaleX = displayWidth / pageLayout.pageWidthTenths;
  const scaleY = displayHeight / pageLayout.pageHeightTenths;

  const byMeasure = new Map<number, Fingering[]>();
  for (const f of fingerings) {
    const layout = f.note.layoutId
      ? noteLayouts.find((l) => l.id === f.note.layoutId)
      : null;
    const measureIndex = layout?.measureIndex ?? 0;
    if (!byMeasure.has(measureIndex)) byMeasure.set(measureIndex, []);
    byMeasure.get(measureIndex)!.push(f);
  }

  const labels: MeasureLabel[] = [];
  for (const meas of measureLayouts) {
    const list = byMeasure.get(meas.measureIndex) ?? [];
    const digits = list.map((f) => (f.finger > 0 ? f.finger - 1 : 0));
    const label = digits.join(" ");
    const renderX = (meas.pageX + meas.width / 2) * scaleX;
    const renderY = (meas.pageY + meas.height) * scaleY + offsetBelowMeasurePx;
    labels.push({
      measureIndex: meas.measureIndex,
      label,
      renderX,
      renderY,
    });
  }
  return labels;
}

/**
 * 마디 라벨 한 개 그리기 (measure bbox 기준 좌표만 사용)
 */
function drawMeasureLabel(
  ctx: CanvasRenderingContext2D,
  label: MeasureLabel,
  options: Required<RenderOptions>
): void {
  const { fontSize, textColor, backgroundColor, borderColor, borderWidth } =
    options;
  if (!label.label.trim()) return;

  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const metrics = ctx.measureText(label.label);
  const padding = 8;
  const w = metrics.width + padding * 2;
  const h = fontSize + padding;
  const x = label.renderX - w / 2;
  const y = label.renderY - h / 2;

  ctx.fillStyle = backgroundColor;
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = borderWidth;
  ctx.strokeRect(x, y, w, h);
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = textColor;
  ctx.fillText(label.label, label.renderX, label.renderY);
}

/**
 * 원본 이미지에 운지 숫자를 오버레이하여 Canvas에 렌더링.
 * 배치는 measure bounding box만 사용 (note.y / staff.y / 상대 좌표 미사용).
 */
export function renderScoreWithFingerings(
  image: HTMLImageElement | HTMLCanvasElement,
  analysis: ScoreAnalysis,
  canvas: HTMLCanvasElement,
  options: RenderOptions = {}
): void {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas context를 가져올 수 없습니다.");
  }

  const displayWidth = image.width;
  const displayHeight = image.height;
  const canvasWidth = displayWidth * opts.scale;
  const canvasHeight = displayHeight * opts.scale;

  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  ctx.scale(opts.scale, opts.scale);

  if (image instanceof HTMLImageElement || image instanceof HTMLCanvasElement) {
    ctx.drawImage(image, 0, 0, displayWidth, displayHeight);
  }

  const hasMeasureLayout =
    analysis.measureLayouts?.length &&
    analysis.pageLayout &&
    analysis.noteLayouts?.length;

  if (!hasMeasureLayout) {
    return;
  }

  const measureLabels = buildMeasureLabels(
    analysis,
    displayWidth,
    displayHeight,
    opts.offsetBelowMeasure
  );

  for (const ml of measureLabels) {
    if (ml.renderY < 0 || ml.renderY > displayHeight + 100) continue;
    if (ml.renderX < -100 || ml.renderX > displayWidth + 100) continue;
    drawMeasureLabel(ctx, ml, opts);
  }
}

/**
 * Canvas를 PNG 이미지로 변환
 */
export function canvasToPNG(
  canvas: HTMLCanvasElement,
  quality: number = 1.0
): string {
  return canvas.toDataURL("image/png", quality);
}

/**
 * Canvas를 JPG 이미지로 변환
 */
export function canvasToJPG(
  canvas: HTMLCanvasElement,
  quality: number = 0.95
): string {
  return canvas.toDataURL("image/jpeg", quality);
}

/**
 * Canvas를 Blob으로 변환 (다운로드용)
 */
export async function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string = "image/png",
  quality: number = 1.0
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Blob 변환 실패"));
        }
      },
      mimeType,
      quality
    );
  });
}

/**
 * Canvas를 PDF로 변환 (jsPDF 사용)
 */
export async function canvasToPDF(
  canvas: HTMLCanvasElement,
  filename: string = `violin-fingering-${Date.now()}.pdf`
): Promise<void> {
  const { default: jsPDF } = await import("jspdf");

  // PDF 크기 계산 (mm 단위)
  const width = canvas.width;
  const height = canvas.height;
  const pdfWidth = (width * 0.264583).toFixed(2); // px to mm
  const pdfHeight = (height * 0.264583).toFixed(2);

  const pdf = new jsPDF({
    orientation: width > height ? "landscape" : "portrait",
    unit: "mm",
    format: [parseFloat(pdfWidth), parseFloat(pdfHeight)],
  });

  // 고해상도 이미지 데이터
  const imgData = canvas.toDataURL("image/png", 1.0);
  pdf.addImage(
    imgData,
    "PNG",
    0,
    0,
    parseFloat(pdfWidth),
    parseFloat(pdfHeight)
  );
  pdf.save(filename);
}

/**
 * 이미지 파일을 다운로드
 */
export function downloadImage(dataUrl: string, filename: string): void {
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  link.click();
}
