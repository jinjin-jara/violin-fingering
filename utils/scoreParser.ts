/**
 * 악보 파싱 유틸리티
 * 
 * 실제 구현에서는 OCR 또는 악보 인식 라이브러리를 사용해야 합니다.
 * 여기서는 기본 구조와 예시를 제공합니다.
 */

import { Note, KeyInfo, ScoreAnalysis } from "@/types/music";
import { detectKeyFromSignature } from "./keyDetection";
import { calculateFingerings } from "./fingeringCalculator";

/**
 * 악보 이미지에서 조표 추출 (예시)
 * 실제로는 OCR 또는 ML 모델을 사용해야 합니다.
 */
export async function extractKeySignature(
  imageData: ImageData | HTMLImageElement | HTMLCanvasElement
): Promise<{ sharps: number; flats: number }> {
  // TODO: 실제 OCR/ML 구현
  // 예시: 기본값 반환
  return { sharps: 0, flats: 0 };
}

/**
 * 악보 이미지에서 음표 추출 (예시)
 * 실제로는 OpenSheetMusicDisplay, VexFlow, 또는 ML 모델을 사용해야 합니다.
 */
export async function extractNotes(
  imageData: ImageData | HTMLImageElement | HTMLCanvasElement
): Promise<Note[]> {
  // TODO: 실제 악보 인식 구현
  // 예시: 더미 데이터 반환
  return [
    {
      name: "G",
      octave: 4,
      x: 100,
      y: 200,
      duration: 1,
    },
    {
      name: "A",
      octave: 4,
      x: 150,
      y: 180,
      duration: 1,
    },
  ];
}

/**
 * PDF에서 악보 추출
 */
export async function extractFromPDF(pdfFile: File): Promise<{
  images: HTMLImageElement[];
  notes: Note[];
  keySignature: { sharps: number; flats: number };
}> {
  try {
    // PDF.js를 사용하여 PDF를 이미지로 변환
    const pdfjs = await import("pdfjs-dist");
    
    // Worker 경로 설정 (로컬 패키지 사용)
    if (typeof window !== "undefined") {
      // Next.js에서 로컬 worker 파일 사용
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    }

    const arrayBuffer = await pdfFile.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

    const images: HTMLImageElement[] = [];
    const allNotes: Note[] = [];

    // 각 페이지를 이미지로 변환
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 });

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) continue;

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise;

      const img = new Image();
      const dataUrl = canvas.toDataURL("image/png");
      img.src = dataUrl;
      
      // 이미지가 로드될 때까지 대기
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });
      
      images.push(img);

      // 각 페이지에서 음표 추출
      const pageNotes = await extractNotes(canvas);
      allNotes.push(...pageNotes);
    }

    // 첫 페이지에서 조표 추출
    const keySignature = images.length > 0 
      ? await extractKeySignature(images[0])
      : { sharps: 0, flats: 0 };

    return {
      images,
      notes: allNotes,
      keySignature,
    };
  } catch (error) {
    console.error("PDF 처리 오류:", error);
    throw new Error("PDF 파일을 처리하는 중 오류가 발생했습니다.");
  }
}

/**
 * 이미지에서 악보 분석
 * 
 * OMR 서버를 사용하여 실제 악보 인식을 수행합니다.
 */
export async function analyzeScore(
  file: File
): Promise<ScoreAnalysis> {
  try {
    // OMR API 호출
    const fileData = await file.arrayBuffer();
    // ArrayBuffer를 Base64로 변환
    const base64Data = btoa(
      String.fromCharCode(...new Uint8Array(fileData))
    );

    const response = await fetch("/api/omr", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        file: base64Data,
        fileName: file.name,
        fileType: file.type,
      }),
    });

    // 응답이 JSON인지 확인
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      console.error("API 응답이 JSON이 아닙니다:", text.substring(0, 200));
      throw new Error("서버 응답 오류: JSON이 아닌 응답을 받았습니다. API Routes가 활성화되어 있는지 확인하세요.");
    }

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "OMR 처리 실패");
    }

    if (!result.success || !result.analysis) {
      throw new Error(result.error || "분석 결과를 가져올 수 없습니다");
    }

    // 로그 출력 (개발용)
    if (result.logs && process.env.NODE_ENV === "development") {
      console.log("OMR 처리 로그:", result.logs);
    }

    return result.analysis;
  } catch (error) {
    console.error("OMR 분석 오류:", error);
    
    // OMR 실패 시 기존 방식으로 폴백 (개발용)
    if (process.env.NODE_ENV === "development") {
      console.warn("OMR 실패, 기본 방식으로 폴백");
      return analyzeScoreFallback(file);
    }
    
    throw error;
  }
}

/**
 * OMR 실패 시 폴백 함수 (개발/테스트용)
 */
async function analyzeScoreFallback(file: File): Promise<ScoreAnalysis> {
  let notes: Note[] = [];
  let keySignature = { sharps: 0, flats: 0 };

  if (file.type === "application/pdf") {
    const result = await extractFromPDF(file);
    notes = result.notes;
    keySignature = result.keySignature;
  } else {
    // 이미지 파일 처리
    const img = new Image();
    img.src = URL.createObjectURL(file);
    await new Promise((resolve) => {
      img.onload = resolve;
    });

    notes = await extractNotes(img);
    keySignature = await extractKeySignature(img);
  }

  // 조성 판별
  const keyInfo = detectKeyFromSignature(keySignature.sharps, keySignature.flats);

  // 운지 계산
  const fingerings = calculateFingerings(notes, keyInfo);

  return {
    keyInfo,
    notes,
    fingerings,
  };
}
