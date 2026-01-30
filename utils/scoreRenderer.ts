/**
 * 악보 렌더링 유틸리티
 *
 * 원본 악보 이미지에 바이올린 운지 숫자를 오버레이하여
 * 최종 결과 이미지를 생성합니다.
 */

import { ScoreAnalysis, Fingering } from "@/types/music";

export interface RenderOptions {
  /** 고해상도 렌더링을 위한 스케일 (기본: 2) */
  scale?: number;
  /** 운지 숫자 폰트 크기 (기본: 24) */
  fontSize?: number;
  /** 음표와 숫자 사이의 오프셋 (기본: 40) */
  offsetY?: number;
  /** 숫자 배경 원의 반지름 (기본: 18) */
  circleRadius?: number;
  /** 숫자 색상 (기본: #1f2937 - 진한 회색) */
  textColor?: string;
  /** 배경 원 색상 (기본: #ffffff - 흰색) */
  backgroundColor?: string;
  /** 배경 원 테두리 색상 (기본: #1f2937) */
  borderColor?: string;
  /** 배경 원 테두리 두께 (기본: 2) */
  borderWidth?: number;
  /** 운지 번호를 음표 위에도 표시할지 여부 (기본: true) */
  showAbove?: boolean;
  /** 운지 번호를 음표 아래에도 표시할지 여부 (기본: true) */
  showBelow?: boolean;
  /** X 좌표 오프셋 (음표 머리 중심 정렬 보정, 기본: 0) */
  offsetX?: number;
  /** Y 좌표 오프셋 (음표 수직 정렬 보정, 기본: 0) */
  offsetYBase?: number;
}

const DEFAULT_OPTIONS: Required<RenderOptions> = {
  scale: 2,
  fontSize: 24,
  offsetY: 40,
  circleRadius: 18,
  textColor: "#1f2937",
  backgroundColor: "#ffffff",
  borderColor: "#1f2937",
  borderWidth: 2,
  showAbove: true,
  showBelow: true,
  offsetX: 0,
  offsetYBase: 0,
};

/**
 * Canvas에 운지 숫자를 그리는 함수
 * 주의: 이 함수는 이미 스케일된 Canvas context에서 호출되므로,
 * 원본 좌표를 그대로 사용하면 자동으로 스케일이 적용됩니다.
 */
function drawFingeringNumber(
  ctx: CanvasRenderingContext2D,
  fingering: Fingering,
  y: number,
  options: Required<RenderOptions>
): void {
  const { note, finger } = fingering;
  const {
    fontSize,
    circleRadius,
    textColor,
    backgroundColor,
    borderColor,
    borderWidth,
    offsetX,
  } = options;

  // 원본 좌표 (스케일된 context이므로 자동으로 스케일 적용됨)
  // X 좌표 오프셋은 이미 renderScoreWithFingerings에서 적용됨
  const x = note.x + offsetX;

  // 배경 원 그리기 (원본 크기 사용, context 스케일에 의해 자동 확대)
  ctx.beginPath();
  ctx.arc(x, y, circleRadius, 0, 2 * Math.PI);
  ctx.fillStyle = backgroundColor;
  ctx.fill();
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = borderWidth;
  ctx.stroke();

  // 숫자 그리기 (원본 폰트 크기 사용, context 스케일에 의해 자동 확대)
  // 이미지 표시 시 내부 계산값에서 1을 빼서 표시 (개방현 0도 표시)
  const displayNumber = finger > 0 ? finger - 1 : 0;

  ctx.fillStyle = textColor;
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(displayNumber.toString(), x, y);
}

/**
 * 원본 이미지에 운지 숫자를 오버레이하여 Canvas에 렌더링
 *
 * @param image 원본 이미지 (HTMLImageElement 또는 ImageData)
 * @param analysis 악보 분석 결과
 * @param canvas 렌더링할 Canvas 요소
 * @param options 렌더링 옵션
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

  // 고해상도를 위한 캔버스 크기 설정
  const displayWidth = image.width;
  const displayHeight = image.height;
  const canvasWidth = displayWidth * opts.scale;
  const canvasHeight = displayHeight * opts.scale;

  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  // 고해상도 렌더링을 위한 스케일링
  ctx.scale(opts.scale, opts.scale);

  // 원본 이미지 그리기
  if (image instanceof HTMLImageElement || image instanceof HTMLCanvasElement) {
    ctx.drawImage(image, 0, 0, displayWidth, displayHeight);
  }

  // 운지 숫자 오버레이 (스케일된 context에서 원본 좌표 사용)
  analysis.fingerings.forEach((fingering) => {
    // 원본 좌표 (스케일된 context이므로 원본 좌표 그대로 사용)
    // X 좌표 오프셋 적용
    const x = fingering.note.x + opts.offsetX;
    // Y 좌표 기본 오프셋 적용 (음표 y 좌표 자체를 보정)
    const noteY = fingering.note.y + opts.offsetYBase;

    // 좌표 유효성 검사 강화
    // 0,0 근처의 잘못된 좌표 필터링
    if (x < 10 || x > displayWidth - 10) {
      return; // 화면 밖이거나 잘못된 좌표
    }
    if (noteY < 10 || noteY > displayHeight - 10) {
      return; // 화면 밖이거나 잘못된 좌표
    }

    // 음표 위에 운지 번호 표시 (기본적으로 위에만 표시)
    if (opts.showAbove) {
      const yAbove = noteY - opts.offsetY;
      if (yAbove >= 0 && yAbove <= displayHeight) {
        drawFingeringNumber(ctx, fingering, yAbove, opts);
      }
    }

    // 음표 아래에 운지 번호 표시 (위에 표시하지 않을 때만)
    if (opts.showBelow && !opts.showAbove) {
      const yBelow = noteY + opts.offsetY;
      if (yBelow >= 0 && yBelow <= displayHeight) {
        drawFingeringNumber(ctx, fingering, yBelow, opts);
      }
    }
  });
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
