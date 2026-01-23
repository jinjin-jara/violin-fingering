/**
 * OMR (Optical Music Recognition) API 엔드포인트
 * 
 * 악보 이미지/PDF를 업로드받아 OMR 엔진을 통해 MusicXML을 생성하고,
 * 음표 좌표와 운지 정보를 반환합니다.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { processOMR } from "@/utils/omrProcessor";
import { parseMusicXML } from "@/utils/musicXmlParser";
import { extractNoteCoordinates } from "@/utils/noteCoordinateExtractor";
import { calculateFingerings } from "@/utils/fingeringCalculator";
import { detectKeyFromSignature } from "@/utils/keyDetection";
import { Note, ScoreAnalysis, KeyInfo } from "@/types/music";

interface OMRResponse {
  success: boolean;
  analysis?: ScoreAnalysis;
  error?: string;
  logs?: string[];
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "50mb", // 대용량 PDF/이미지 지원
    },
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<OMRResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed",
    });
  }

  const logs: string[] = [];
  const addLog = (message: string) => {
    logs.push(`[${new Date().toISOString()}] ${message}`);
    console.log(message);
  };

  try {
    addLog("OMR 처리 시작");

    // 파일 데이터 확인
    if (!req.body.file) {
      return res.status(400).json({
        success: false,
        error: "파일이 제공되지 않았습니다",
        logs,
      });
    }

    const fileDataBase64 = req.body.file;
    const fileName = req.body.fileName || "uploaded_file";
    const fileType = req.body.fileType || "application/pdf";

    addLog(`파일 수신: ${fileName} (${fileType})`);

    // Base64 디코딩
    const fileData = Buffer.from(fileDataBase64, "base64");

    // 1. OMR 처리 (PDF/Image → MusicXML)
    addLog("OMR 엔진 실행 중...");
    const omrResult = await processOMR(fileData, fileName, fileType);
    
    if (!omrResult.success || !omrResult.musicXml) {
      return res.status(500).json({
        success: false,
        error: omrResult.error || "OMR 처리 실패",
        logs: [...logs, ...(omrResult.logs || [])],
      });
    }

    addLog("OMR 처리 완료 - MusicXML 생성됨");
    addLog(`MusicXML 크기: ${omrResult.musicXml.length} bytes`);

    // 2. MusicXML 파싱
    addLog("MusicXML 파싱 중...");
    const parsedData = parseMusicXML(omrResult.musicXml);
    
    if (!parsedData.success || !parsedData.notes || parsedData.notes.length === 0) {
      return res.status(500).json({
        success: false,
        error: parsedData.error || "MusicXML 파싱 실패 또는 음표가 없습니다",
        logs: [...logs, ...(parsedData.logs || [])],
      });
    }

    addLog(`음표 추출 완료: ${parsedData.notes.length}개`);
    addLog(`조성: ${parsedData.keyInfo?.key || "Unknown"} ${parsedData.keyInfo?.mode || "major"}`);

    // 3. 음표 좌표 추출 (원본 이미지 기반)
    addLog("음표 좌표 추출 중...");
    const notesWithCoordinates = await extractNoteCoordinates(
      parsedData.notes,
      omrResult.imagePath || fileData
    );

    if (notesWithCoordinates.length === 0) {
      addLog("경고: 좌표 추출 실패, 기본 좌표 사용");
    } else {
      addLog(`좌표 추출 완료: ${notesWithCoordinates.length}개`);
    }

    // 4. 조성 판별
    const keyInfo: KeyInfo = parsedData.keyInfo || detectKeyFromSignature(
      parsedData.keySignature?.sharps || 0,
      parsedData.keySignature?.flats || 0
    );

    // 5. 운지 계산
    addLog("바이올린 운지 계산 중...");
    const fingerings = calculateFingerings(notesWithCoordinates, keyInfo);
    addLog(`운지 계산 완료: ${fingerings.length}개`);

    // 6. 결과 구성
    const analysis: ScoreAnalysis = {
      keyInfo,
      notes: notesWithCoordinates,
      fingerings,
      timeSignature: parsedData.timeSignature,
    };

    addLog("OMR 처리 완료");

    return res.status(200).json({
      success: true,
      analysis,
      logs,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류";
    addLog(`오류 발생: ${errorMessage}`);
    
    return res.status(500).json({
      success: false,
      error: errorMessage,
      logs,
    });
  }
}
