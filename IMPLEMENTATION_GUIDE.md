# 🔧 구현 가이드

## 실제 악보 인식 구현 방법

현재 프로젝트는 기본 구조만 구현되어 있습니다. 실제 악보 인식을 위해서는 다음 중 하나를 선택하여 구현해야 합니다.

### 옵션 1: OpenSheetMusicDisplay (OSMD) 사용

**장점:**
- MusicXML 파일 직접 지원
- 브라우저에서 완전히 동작
- 오프라인 가능

**구현 예시:**

```typescript
// utils/scoreParser.ts 수정
import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";

export async function parseMusicXML(xmlString: string): Promise<ScoreAnalysis> {
  const osmd = new OpenSheetMusicDisplay("osmd-container");
  await osmd.load(xmlString);
  
  // 음표 추출
  const notes: Note[] = [];
  osmd.sheet.sourceMeasures.forEach((measure) => {
    measure.staffEntries.forEach((entry) => {
      entry.voiceEntries.forEach((voice) => {
        voice.notes.forEach((osmdNote) => {
          notes.push({
            name: osmdNote.pitch.name,
            octave: osmdNote.pitch.octave,
            x: osmdNote.sourceNote.x,
            y: osmdNote.sourceNote.y,
          });
        });
      });
    });
  });
  
  // 조표 추출
  const keySignature = osmd.sheet.sourceMeasures[0]?.keySignature;
  const sharps = keySignature?.sharps || 0;
  const flats = keySignature?.flats || 0;
  
  // ... 나머지 로직
}
```

### 옵션 2: TensorFlow.js ML 모델

**장점:**
- 이미지에서 직접 인식
- 높은 정확도 가능

**구현 예시:**

```typescript
// utils/mlScoreRecognition.ts
import * as tf from "@tensorflow/tfjs";

export async function loadModel() {
  // 사전 학습된 모델 로드
  const model = await tf.loadLayersModel("/models/score-recognition/model.json");
  return model;
}

export async function recognizeNotes(image: HTMLImageElement) {
  const model = await loadModel();
  
  // 이미지를 텐서로 변환
  const tensor = tf.browser.fromPixels(image)
    .resizeNearestNeighbor([224, 224])
    .expandDims(0)
    .div(255.0);
  
  // 예측
  const predictions = await model.predict(tensor) as tf.Tensor;
  const results = await predictions.data();
  
  // 결과 파싱
  // ...
}
```

### 옵션 3: Tesseract.js OCR + 규칙 기반 파싱

**장점:**
- 구현이 상대적으로 간단
- 오프라인 가능

**구현 예시:**

```typescript
import { createWorker } from "tesseract.js";

export async function extractNotesWithOCR(image: HTMLImageElement) {
  const worker = await createWorker("eng");
  
  // OCR 실행
  const { data } = await worker.recognize(image);
  
  // 악보 구조 규칙 적용
  // 음표 위치, 조표 위치 등 파싱
  // ...
  
  await worker.terminate();
}
```

## 조성 판별 개선

현재는 조표만으로 판별하지만, 단조 판별을 개선하려면:

```typescript
// utils/keyDetection.ts 개선

export function detectKeyWithMode(
  sharps: number,
  flats: number,
  firstNote?: Note,
  lastNote?: Note
): KeyInfo {
  const keyInfo = detectKeyFromSignature(sharps, flats);
  
  // 첫 음표와 마지막 음표로 단조 판별
  if (firstNote && lastNote) {
    const relativeMinor = getRelativeMinor(keyInfo.key);
    if (firstNote.name === relativeMinor || lastNote.name === relativeMinor) {
      keyInfo.mode = "minor";
      keyInfo.key = relativeMinor;
    }
  }
  
  return keyInfo;
}
```

## 운지 계산 개선

### 다중 포지션 옵션 제공

```typescript
// utils/fingeringCalculator.ts 개선

export function calculateAllPossibleFingerings(
  note: Note,
  keyInfo: KeyInfo
): Fingering[] {
  const actualNoteName = getActualNote(note.name, keyInfo);
  const normalizedNote = normalizeNoteName(actualNoteName);
  const targetSemitones = getAbsoluteSemitones(normalizedNote, note.octave);
  
  const strings: ViolinString[] = ["E", "A", "D", "G"];
  const allOptions: Fingering[] = [];
  
  for (const string of strings) {
    const fingering = calculateFingeringOnString(targetSemitones, string);
    if (fingering) {
      allOptions.push({
        string,
        ...fingering,
        note: { ...note, name: normalizedNote as any },
      });
    }
  }
  
  return allOptions; // 모든 가능한 운지 반환
}
```

### 연속 음표 고려 (Position Shifting)

```typescript
export function calculateFingeringsWithShifting(
  notes: Note[],
  keyInfo: KeyInfo
): Fingering[] {
  const fingerings: Fingering[] = [];
  let currentPosition: Position = "1st";
  
  for (let i = 0; i < notes.length; i++) {
    const note = notes[i];
    const options = calculateAllPossibleFingerings(note, keyInfo);
    
    // 현재 포지션과 가까운 운지 선택
    const best = options.find(
      (opt) => opt.position === currentPosition
    ) || options[0];
    
    fingerings.push(best);
    currentPosition = best.position;
  }
  
  return fingerings;
}
```

## 이미지 처리 개선

### 대용량 이미지 리사이징

```typescript
// utils/imageUtils.ts
export function resizeImage(
  file: File,
  maxWidth: number = 2000,
  maxHeight: number = 2000
): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;
      
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width *= ratio;
        height *= ratio;
      }
      
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob((blob) => {
        resolve(blob!);
      }, "image/jpeg", 0.9);
    };
    
    img.src = URL.createObjectURL(file);
  });
}
```

## 성능 최적화

### Web Worker 사용

```typescript
// workers/scoreAnalysis.worker.ts
import { analyzeScore } from "../utils/scoreParser";

self.onmessage = async (e) => {
  const { file } = e.data;
  
  try {
    const result = await analyzeScore(file);
    self.postMessage({ success: true, result });
  } catch (error) {
    self.postMessage({ success: false, error: error.message });
  }
};

// pages/index.tsx에서 사용
const worker = new Worker(new URL("../workers/scoreAnalysis.worker.ts", import.meta.url));
worker.postMessage({ file });
worker.onmessage = (e) => {
  if (e.data.success) {
    setAnalysis(e.data.result);
  }
};
```

## 테스트 작성

### 유닛 테스트 예시

```typescript
// __tests__/fingeringCalculator.test.ts
import { calculateFingering } from "@/utils/fingeringCalculator";
import { detectKeyFromSignature } from "@/utils/keyDetection";

describe("Fingering Calculator", () => {
  it("should calculate correct fingering for G4 on A string", () => {
    const note = { name: "G", octave: 4, x: 100, y: 200 };
    const keyInfo = detectKeyFromSignature(0, 0);
    
    const result = calculateFingering(note, keyInfo);
    
    expect(result).not.toBeNull();
    expect(result?.string).toBe("A");
    expect(result?.finger).toBe(0); // 개방현
  });
  
  it("should apply key signature correctly", () => {
    const note = { name: "F", octave: 4, x: 100, y: 200 };
    const keyInfo = detectKeyFromSignature(1, 0); // G major (F#)
    
    const result = calculateFingering(note, keyInfo);
    
    // F#으로 계산되어야 함
    expect(result?.note.name).toBe("F#");
  });
});
```

## 배포 체크리스트

- [ ] `next.config.ts`에서 `output: "export"` 확인
- [ ] `basePath` 설정 (서브디렉토리 배포 시)
- [ ] 환경 변수 확인
- [ ] PWA 매니페스트 아이콘 생성
- [ ] Service Worker 등록 확인
- [ ] GitHub Actions 워크플로우 테스트
- [ ] 404 페이지 설정 (SPA 라우팅)
