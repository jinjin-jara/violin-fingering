"use client";

import React, { useEffect, useRef, useState } from "react";
import { ScoreAnalysis } from "@/types/music";
import {
  renderScoreWithFingerings,
  canvasToPNG,
  canvasToJPG,
  canvasToPDF,
  downloadImage,
} from "@/utils/scoreRenderer";

interface ScorePreviewProps {
  analysis: ScoreAnalysis;
  originalImage?: HTMLImageElement | string;
  onExport?: (format: "png" | "pdf") => void;
}

export default function ScorePreview({
  analysis,
  originalImage,
  onExport,
}: ScorePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [displaySize, setDisplaySize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !originalImage) return;

    const canvas = canvasRef.current;
    setIsRendering(true);

    // 이미 HTMLImageElement인 경우
    if (originalImage instanceof HTMLImageElement) {
      // 이미지가 로드되었는지 확인
      const handleImageReady = (img: HTMLImageElement) => {
        try {
          const scale = 2; // 고해상도 렌더링
          
          // 렌더링 유틸리티 사용
          renderScoreWithFingerings(img, analysis, canvas, {
            scale,
            fontSize: 20,
            offsetY: 35, // 음표 아래에 배치
            offsetX: 15, // X 좌표 보정 (음표 머리 중심 정렬)
            offsetYBase: 0, // Y 좌표 기본 보정 (음표 수직 정렬)
            circleRadius: 16,
            textColor: "#1f2937", // 진한 회색 (가독성 향상)
            backgroundColor: "#ffffff",
            borderColor: "#1f2937",
            borderWidth: 2,
          });

          // CSS로 표시할 크기 설정 (고해상도 Canvas를 원본 크기로 표시)
          setDisplaySize({
            width: img.width,
            height: img.height,
          });

          setImageLoaded(true);
          setIsRendering(false);
        } catch (error) {
          console.error("이미지 렌더링 오류:", error);
          setImageLoaded(false);
          setIsRendering(false);
        }
      };

      if (originalImage.complete && originalImage.naturalWidth > 0) {
        // 이미 로드된 경우
        handleImageReady(originalImage);
      } else {
        // 로딩 대기
        originalImage.onload = () => handleImageReady(originalImage);
        originalImage.onerror = () => {
          console.error("이미지 로딩 실패");
          setImageLoaded(false);
          setIsRendering(false);
        };
      }
      return;
    }

    // 새로 로드해야 하는 경우 (string인 경우만)
    if (typeof originalImage === "string") {
      const img = new Image();
      const isBlobOrDataUrl = originalImage.startsWith("blob:") || originalImage.startsWith("data:");
      if (!isBlobOrDataUrl) {
        img.crossOrigin = "anonymous";
      }

      img.onload = () => {
        try {
          const scale = 2; // 고해상도 렌더링
          
          // 렌더링 유틸리티 사용
          renderScoreWithFingerings(img, analysis, canvas, {
            scale,
            fontSize: 20,
            offsetY: 35, // 음표 아래에 배치
            offsetX: 15, // X 좌표 보정 (음표 머리 중심 정렬)
            offsetYBase: 0, // Y 좌표 기본 보정 (음표 수직 정렬)
            circleRadius: 16,
            textColor: "#1f2937", // 진한 회색 (가독성 향상)
            backgroundColor: "#ffffff",
            borderColor: "#1f2937",
            borderWidth: 2,
          });

          // CSS로 표시할 크기 설정 (고해상도 Canvas를 원본 크기로 표시)
          setDisplaySize({
            width: img.width,
            height: img.height,
          });

          setImageLoaded(true);
        } catch (error) {
          console.error("이미지 렌더링 오류:", error);
          setImageLoaded(false);
        } finally {
          setIsRendering(false);
        }
      };

      img.onerror = (error) => {
        console.error("이미지 로딩 실패:", error);
        setImageLoaded(false);
        setIsRendering(false);
      };

      img.src = originalImage;
    }
  }, [analysis, originalImage]);

  const handleExport = async (format: "png" | "pdf" | "jpg") => {
    if (!canvasRef.current || !imageLoaded) return;

    try {
      if (format === "png") {
        const dataUrl = canvasToPNG(canvasRef.current, 1.0);
        downloadImage(dataUrl, `violin-fingering-${Date.now()}.png`);
      } else if (format === "jpg") {
        const dataUrl = canvasToJPG(canvasRef.current, 0.95);
        downloadImage(dataUrl, `violin-fingering-${Date.now()}.jpg`);
      } else if (format === "pdf") {
        if (onExport) {
          onExport("pdf");
        } else {
          await canvasToPDF(canvasRef.current);
        }
      }
    } catch (error) {
      console.error("파일 저장 오류:", error);
      alert("파일 저장 중 오류가 발생했습니다.");
    }
  };

  return (
    <div className="card">
      <div className="mb-4">
        <h2 className="text-xl font-bold mb-2">분석 결과</h2>
        <div className="text-sm text-gray-600">
          <p>
            조성: <span className="font-semibold">{analysis.keyInfo.key} {analysis.keyInfo.mode}</span>
          </p>
          <p>
            음표 수: {analysis.notes.length}개
          </p>
          <p>
            운지 계산 완료: {analysis.fingerings.length}개
          </p>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden bg-gray-100 relative">
        <canvas
          ref={canvasRef}
          className="max-w-full h-auto"
          style={{
            display: imageLoaded ? "block" : "none",
            width: displaySize ? `${displaySize.width}px` : "auto",
            height: displaySize ? `${displaySize.height}px` : "auto",
          }}
        />
        {(!imageLoaded || isRendering) && (
          <div className="p-12 text-center text-gray-500">
            {isRendering ? "운지를 표시하는 중..." : "이미지 로딩 중..."}
          </div>
        )}
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex gap-2">
          <button
            onClick={() => handleExport("png")}
            className="btn-primary flex-1"
            disabled={!imageLoaded || isRendering}
          >
            PNG로 저장
          </button>
          <button
            onClick={() => handleExport("jpg")}
            className="btn-primary flex-1"
            disabled={!imageLoaded || isRendering}
          >
            JPG로 저장
          </button>
        </div>
        <button
          onClick={() => handleExport("pdf")}
          className="btn-primary w-full"
          disabled={!imageLoaded || isRendering}
        >
          PDF로 저장
        </button>
      </div>
    </div>
  );
}
