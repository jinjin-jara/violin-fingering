/**
 * MusicXML 파서
 * 
 * MusicXML 파일을 파싱하여 음표, 조성, 박자 정보를 추출합니다.
 */

import { XMLParser } from "fast-xml-parser";
import { Note, KeyInfo, KeySignature } from "@/types/music";

export interface ParsedMusicXML {
  success: boolean;
  notes?: Note[];
  keyInfo?: KeyInfo;
  keySignature?: { sharps: number; flats: number };
  timeSignature?: { numerator: number; denominator: number };
  error?: string;
  logs?: string[];
}

/**
 * MusicXML의 pitch 요소를 NoteName으로 변환
 */
function pitchToNoteName(pitch: any): string {
  if (!pitch) return "C";
  
  const step = pitch.step || "C";
  const alter = pitch.alter ? parseInt(pitch.alter) : 0;
  
  const noteNames: Record<string, string[]> = {
    C: ["C", "C#", "D"],
    D: ["D", "D#", "E"],
    E: ["E", "F", "F#"],
    F: ["F", "F#", "G"],
    G: ["G", "G#", "A"],
    A: ["A", "A#", "B"],
    B: ["B", "C", "C#"],
  };

  const baseNotes = noteNames[step] || ["C", "C#", "D"];
  const index = Math.max(0, Math.min(2, alter + 1));
  return baseNotes[index];
}

/**
 * 옥타브 번호 추출
 */
function getOctave(pitch: any): number {
  if (!pitch || !pitch.octave) return 4;
  return parseInt(pitch.octave);
}

/**
 * 조표(Key Signature) 파싱
 */
function parseKeySignature(key: any): { sharps: number; flats: number; fifths?: number } {
  if (!key) return { sharps: 0, flats: 0 };
  
  const fifths = key.fifths ? parseInt(key.fifths) : 0;
  
  if (fifths > 0) {
    return { sharps: fifths, flats: 0, fifths };
  } else if (fifths < 0) {
    return { sharps: 0, flats: Math.abs(fifths), fifths };
  }
  
  return { sharps: 0, flats: 0, fifths: 0 };
}

/**
 * 조성(Key) 판별
 */
function determineKey(fifths: number, mode: string = "major"): KeyInfo {
  const keyMap: Record<number, { major: string; minor: string }> = {
    0: { major: "C", minor: "A" },
    1: { major: "G", minor: "E" },
    2: { major: "D", minor: "B" },
    3: { major: "A", minor: "F#" },
    4: { major: "E", minor: "C#" },
    5: { major: "B", minor: "G#" },
    6: { major: "F#", minor: "D#" },
    7: { major: "C#", minor: "A#" },
    "-1": { major: "F", minor: "D" },
    "-2": { major: "Bb", minor: "G" },
    "-3": { major: "Eb", minor: "C" },
    "-4": { major: "Ab", minor: "F" },
    "-5": { major: "Db", minor: "Bb" },
    "-6": { major: "Gb", minor: "Eb" },
    "-7": { major: "Cb", minor: "Ab" },
  };

  const keyInfo = keyMap[fifths] || keyMap[0];
  const key = mode === "minor" ? keyInfo.minor : keyInfo.major;
  
  const keySig = parseKeySignature({ fifths });
  
  return {
    key: key as KeySignature,
    mode: mode as "major" | "minor",
    sharps: keySig.sharps,
    flats: keySig.flats,
  };
}

/**
 * 박자(Time Signature) 파싱
 */
function parseTimeSignature(time: any): { numerator: number; denominator: number } | undefined {
  if (!time || !time.beats || !time["beat-type"]) return undefined;
  
  return {
    numerator: parseInt(time.beats) || 4,
    denominator: parseInt(time["beat-type"]) || 4,
  };
}

/**
 * 음표 duration을 숫자로 변환
 */
function parseDuration(duration: any, divisions: number = 1): number {
  if (!duration) return 1;
  
  const dur = parseInt(duration);
  if (isNaN(dur)) return 1;
  
  // divisions 기준으로 정규화 (4분음표 = divisions)
  return dur / divisions;
}

/**
 * MusicXML 파싱 메인 함수
 */
export function parseMusicXML(musicXml: string): ParsedMusicXML {
  const logs: string[] = [];
  const addLog = (message: string) => {
    logs.push(`[${new Date().toISOString()}] ${message}`);
    console.log(message);
  };

  try {
    addLog("MusicXML 파싱 시작");
    addLog(`MusicXML 길이: ${musicXml.length} bytes`);
    addLog(`MusicXML 시작 부분: ${musicXml.substring(0, 200)}`);

    // XML 파서 설정 (더 관대한 설정)
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      textNodeName: "#text",
      parseAttributeValue: false, // 속성 값을 자동 파싱하지 않음
      trimValues: true,
      ignoreNameSpace: true, // 네임스페이스 무시
      removeNSPrefix: true, // 네임스페이스 접두사 제거
      parseTrueNumberOnly: false,
      arrayMode: false, // 단일 요소도 배열로 변환하지 않음
      alwaysCreateTextNode: false,
      isArray: () => false, // 모든 것을 배열로 만들지 않음
      stopNodes: [], // 중지 노드 없음
    });

    let parsed: any;
    try {
      parsed = parser.parse(musicXml);
      addLog("XML 파싱 완료");
    } catch (parseError: any) {
      addLog(`XML 파싱 오류: ${parseError.message}`);
      addLog(`오류 스택: ${parseError.stack?.substring(0, 500)}`);
      
      // 대체 파서 설정 시도
      addLog("대체 파서 설정으로 재시도...");
      const altParser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        parseAttributeValue: false,
        trimValues: true,
        ignoreNameSpace: true,
        removeNSPrefix: true,
      });
      
      try {
        parsed = altParser.parse(musicXml);
        addLog("대체 파서로 파싱 성공");
      } catch (altError: any) {
        return {
          success: false,
          error: `XML 파싱 실패: ${parseError.message}. 대체 파서도 실패: ${altError.message}`,
          logs,
        };
      }
    }
    
    if (!parsed || typeof parsed !== "object") {
      return {
        success: false,
        error: "파싱된 결과가 객체가 아닙니다",
        logs,
      };
    }
    
    addLog(`파싱된 루트 키: ${Object.keys(parsed).join(", ")}`);

    // MusicXML 구조 확인 (다양한 형식 지원)
    let scorePartwise = 
      parsed["score-partwise"] || 
      parsed["score-timewise"] || 
      parsed["scorePartwise"] || 
      parsed["scoreTimewise"] ||
      parsed["score-partwise"]?.[0] || // 배열인 경우
      parsed["score-timewise"]?.[0];
    
    // 루트가 직접 score-partwise인 경우
    if (!scorePartwise) {
      // 루트 키 확인
      const rootKeys = Object.keys(parsed);
      addLog(`사용 가능한 루트 키: ${rootKeys.join(", ")}`);
      
      // 첫 번째 키를 시도
      if (rootKeys.length > 0) {
        const firstKey = rootKeys[0];
        scorePartwise = parsed[firstKey];
        addLog(`첫 번째 루트 키 사용: ${firstKey}`);
      }
    }
    
    if (!scorePartwise) {
      // 디버깅: 파싱된 구조 출력
      const structureSample = JSON.stringify(parsed, null, 2).substring(0, 1000);
      addLog(`파싱된 구조 샘플:\n${structureSample}`);
      return {
        success: false,
        error: `유효한 MusicXML 구조를 찾을 수 없습니다. 루트 요소: ${Object.keys(parsed)[0] || "없음"}`,
        logs,
      };
    }
    
    addLog(`scorePartwise 타입: ${typeof scorePartwise}`);
    if (Array.isArray(scorePartwise)) {
      addLog(`scorePartwise는 배열입니다. 길이: ${scorePartwise.length}`);
      scorePartwise = scorePartwise[0];
    }

    // Part와 Measure 추출 (다양한 형식 지원)
    let parts = scorePartwise.part || scorePartwise["part"] || [];
    
    // 단일 part 객체인 경우 배열로 변환
    if (!Array.isArray(parts) && parts && typeof parts === "object") {
      parts = [parts];
    }
    
    if (!Array.isArray(parts) || parts.length === 0) {
      addLog(`Part 구조: ${JSON.stringify(scorePartwise).substring(0, 300)}`);
      return {
        success: false,
        error: "Part를 찾을 수 없습니다",
        logs,
      };
    }

    addLog(`Part 개수: ${parts.length}`);

    // Attributes (조성, 박자 등) 추출
    const firstPart = parts[0];
    let measures = firstPart.measure || firstPart["measure"] || [];
    
    // 단일 measure 객체인 경우 배열로 변환
    if (!Array.isArray(measures) && measures && typeof measures === "object") {
      measures = [measures];
    }
    
    if (!Array.isArray(measures) || measures.length === 0) {
      addLog(`Measure 구조: ${JSON.stringify(firstPart).substring(0, 300)}`);
      return {
        success: false,
        error: "Measure를 찾을 수 없습니다",
        logs,
      };
    }

    addLog(`Measure 개수: ${measures.length}`);

    // 첫 번째 measure에서 attributes 추출
    const firstMeasure = measures[0];
    const attributes = firstMeasure.attributes || firstMeasure["attributes"];
    
    let keyInfo: KeyInfo | undefined;
    let keySignature = { sharps: 0, flats: 0 };
    let timeSignature: { numerator: number; denominator: number } | undefined;
    let divisions = 1;

    if (attributes) {
      // Divisions (음표 길이 단위)
      if (attributes.divisions) {
        divisions = parseInt(String(attributes.divisions)) || 1;
      } else if (attributes["divisions"]) {
        divisions = parseInt(String(attributes["divisions"])) || 1;
      }

      // Key Signature
      const key = attributes.key || attributes["key"];
      if (key) {
        const keySig = parseKeySignature(key);
        keySignature = keySig;
        const mode = (key.mode || key["mode"] || "major") as string;
        keyInfo = determineKey(keySig.fifths || 0, mode);
        addLog(`조성: ${keyInfo.key} ${keyInfo.mode}`);
      }

      // Time Signature
      timeSignature = parseTimeSignature(attributes.time || attributes["time"]);
      if (timeSignature) {
        addLog(`박자: ${timeSignature.numerator}/${timeSignature.denominator}`);
      }
    }

    // 모든 음표 추출
    const notes: Note[] = [];
    let currentX = 100; // 기본 x 좌표 (나중에 실제 좌표로 대체)
    let currentY = 200; // 기본 y 좌표 (나중에 실제 좌표로 대체)

    for (const measure of measures) {
      let measureNotes = measure.note || measure["note"] || [];
      
      // 단일 note 객체인 경우 배열로 변환
      if (!Array.isArray(measureNotes) && measureNotes && typeof measureNotes === "object") {
        measureNotes = [measureNotes];
      }
      
      if (!Array.isArray(measureNotes)) {
        addLog(`Measure의 note 구조가 예상과 다릅니다: ${typeof measureNotes}`);
        continue;
      }

      for (const noteElement of measureNotes) {
        if (!noteElement || typeof noteElement !== "object") continue;
        
        // Rest는 건너뛰기
        if (noteElement.rest || noteElement["rest"]) continue;

        // Pitch 추출
        const pitch = noteElement.pitch || noteElement["pitch"];
        if (!pitch) {
          addLog("Pitch가 없는 음표 건너뛰기");
          continue;
        }

        try {
          const noteName = pitchToNoteName(pitch);
          const octave = getOctave(pitch);
          const duration = parseDuration(noteElement.duration || noteElement["duration"], divisions);

          // 음표 추가
          notes.push({
            name: noteName as any,
            octave,
            x: currentX,
            y: currentY,
            duration,
          });

          // 다음 음표 위치 (간단한 오프셋)
          currentX += 50;
        } catch (noteError) {
          addLog(`음표 처리 오류: ${noteError}`);
          continue;
        }
      }
    }

    addLog(`음표 추출 완료: ${notes.length}개`);

    if (notes.length === 0) {
      return {
        success: false,
        error: "음표를 찾을 수 없습니다",
        logs,
      };
    }

    return {
      success: true,
      notes,
      keyInfo: keyInfo || determineKey(0, "major"),
      keySignature,
      timeSignature,
      logs,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류";
    addLog(`파싱 오류: ${errorMessage}`);
    
    return {
      success: false,
      error: errorMessage,
      logs,
    };
  }
}
