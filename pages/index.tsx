"use client";

import React, { useState } from "react";
import FileUpload from "@/components/FileUpload";
import ScorePreview from "@/components/ScorePreview";
import LoadingSpinner from "@/components/LoadingSpinner";
import { ScoreAnalysis } from "@/types/music";
import { analyzeScore } from "@/utils/scoreParser";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<ScoreAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [originalImage, setOriginalImage] = useState<HTMLImageElement | string | null>(null);

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setAnalysis(null);
    setError(null);
    setIsLoading(true);

    try {
      // PDF 파일인 경우 먼저 이미지로 변환
      if (selectedFile.type === "application/pdf") {
        const { extractFromPDF } = await import("@/utils/scoreParser");
        const pdfResult = await extractFromPDF(selectedFile);
        
        // 첫 번째 페이지 이미지 사용
        if (pdfResult.images.length > 0) {
          // 이미지가 로드될 때까지 대기
          const firstImage = pdfResult.images[0];
          if (!firstImage.complete) {
            await new Promise((resolve, reject) => {
              firstImage.onload = resolve;
              firstImage.onerror = reject;
            });
          }
          setOriginalImage(firstImage);
        } else {
          throw new Error("PDF에서 이미지를 추출할 수 없습니다.");
        }
      } else if (selectedFile.type.startsWith("image/")) {
        // 이미지 파일인 경우
        const img = new Image();
        img.src = URL.createObjectURL(selectedFile);
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });
        setOriginalImage(img);
      } else {
        throw new Error("지원하지 않는 파일 형식입니다.");
      }

      // 악보 분석
      const result = await analyzeScore(selectedFile);
      setAnalysis(result);
    } catch (err) {
      console.error("분석 오류:", err);
      setError(
        err instanceof Error
          ? err.message
          : "악보 분석 중 오류가 발생했습니다."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setAnalysis(null);
    setError(null);
    setOriginalImage(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">
            🎻 바이올린 운지 분석기
          </h1>
          <p className="mt-2 text-gray-600">
            악보를 업로드하면 조성을 자동으로 판별하고 바이올린 운지를 계산합니다
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-grow">
        {!file ? (
          <div className="card">
            <FileUpload onFileSelect={handleFileSelect} />
          </div>
        ) : (
          <div className="space-y-6">
            {isLoading ? (
              <div className="card">
                <LoadingSpinner message="악보를 분석하고 운지를 계산하는 중..." />
              </div>
            ) : error ? (
              <div className="card">
                <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
                  <h3 className="text-lg font-semibold text-red-800 mb-2">
                    오류 발생
                  </h3>
                  <p className="text-red-700">{error}</p>
                  <button
                    onClick={handleReset}
                    className="mt-4 btn-secondary"
                  >
                    다시 시도
                  </button>
                </div>
              </div>
            ) : analysis && originalImage ? (
              <>
                <ScorePreview
                  analysis={analysis}
                  originalImage={originalImage}
                />
                <div className="flex justify-center">
                  <button onClick={handleReset} className="btn-secondary">
                    새 파일 업로드
                  </button>
                </div>
              </>
            ) : null}
          </div>
        )}

        {/* 사용 가이드 */}
        {!file && (
          <div className="mt-8 card">
            <h2 className="text-xl font-bold mb-4">사용 방법</h2>
            <ol className="list-decimal list-inside space-y-2 text-gray-700">
              <li>악보 이미지(JPG, PNG) 또는 PDF 파일을 업로드하세요</li>
              <li>조표를 자동으로 인식하여 조성을 판별합니다</li>
              <li>각 음표에 대해 바이올린 운지(현, 손가락 번호)를 계산합니다</li>
              <li>결과를 PNG 또는 PDF로 저장할 수 있습니다</li>
            </ol>
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>참고:</strong> 현재는 기본 구조만 구현되어 있습니다.
                실제 악보 인식을 위해서는 OCR 또는 ML 모델이 필요합니다.
              </p>
            </div>
          </div>
        )}
      </main>

      <footer className="mt-auto py-6 border-t bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-600 text-sm">
          <p>바이올린 운지 분석기 © 2025</p>
        </div>
      </footer>
    </div>
  );
}
