# 🎼 OMR 기반 바이올린 운지 분석 시스템 구현 문서

## 📋 구현 개요

실제 OMR(Optical Music Recognition) 엔진을 사용하여 악보를 인식하고, 바이올린 운지를 계산하여 원본 악보에 오버레이하는 완전한 파이프라인을 구현했습니다.

## 🏗️ 아키텍처

### 전체 흐름

```
[Client - Next.js]
  ↓ 파일 업로드 (PDF/Image)
[API Route - /api/omr]
  ↓
[OMR Processor - Audiveris]
  ↓ PDF/Image → MusicXML
[MusicXML Parser]
  ↓ 음표, 조성, 박자 추출
[Note Coordinate Extractor]
  ↓ 화면 좌표 계산
[Fingering Calculator]
  ↓ 바이올린 운지 계산
[Score Renderer]
  ↓ 원본 + 운지 오버레이
[Client]
  ↓ PNG/PDF 다운로드
```

### 기술 스택 선택 이유

#### 1. Next.js (프론트엔드 + API)
- **선택 이유**: 
  - 서버 사이드 렌더링 지원
  - API Routes로 백엔드 로직 통합 가능
  - 단일 프로젝트로 풀스택 개발 가능
  - TypeScript 네이티브 지원

#### 2. Audiveris (OMR 엔진)
- **선택 이유**:
  - 오픈소스, 무료
  - MusicXML 출력 지원
  - 배치 모드 실행 가능
  - 높은 정확도

#### 3. Canvas (렌더링)
- **선택 이유**:
  - 고해상도 렌더링 가능
  - 픽셀 단위 정밀 제어
  - PNG/PDF 변환 용이
  - 브라우저 네이티브 지원

## 📁 파일 구조

```
violin-fingering/
├── pages/
│   ├── api/
│   │   └── omr.ts              # OMR API 엔드포인트
│   └── index.tsx               # 메인 페이지
├── utils/
│   ├── omrProcessor.ts         # Audiveris 실행
│   ├── musicXmlParser.ts       # MusicXML 파싱
│   ├── noteCoordinateExtractor.ts  # 좌표 추출
│   ├── fingeringCalculator.ts  # 운지 계산
│   ├── scoreRenderer.ts        # 렌더링
│   └── scoreParser.ts          # 메인 파서 (OMR 호출)
├── components/
│   └── ScorePreview.tsx        # 결과 미리보기
└── OMR_SETUP.md                # 설정 가이드
```

## 🔧 핵심 구현

### 1. OMR 처리 (`utils/omrProcessor.ts`)

```typescript
export async function processOMR(
  fileData: string | Buffer,
  fileName: string,
  fileType: string
): Promise<OMRResult>
```

**기능:**
- 임시 파일 저장
- Audiveris 실행 (배치 모드)
- MusicXML 파일 생성
- 결과 반환

**Audiveris 실행:**
```bash
audiveris -batch -export -output <output_dir> <input_file>
```

### 2. MusicXML 파싱 (`utils/musicXmlParser.ts`)

```typescript
export function parseMusicXML(musicXml: string): ParsedMusicXML
```

**추출 정보:**
- 음표 (pitch, octave, duration)
- 조성 (key signature, mode)
- 박자 (time signature)
- 음표 순서

**파싱 라이브러리:** `fast-xml-parser` (MusicXML 타입은 직접 정의)

### 3. 좌표 추출 (`utils/noteCoordinateExtractor.ts`)

```typescript
export async function extractNoteCoordinates(
  notes: Note[],
  imagePath: string | Buffer
): Promise<Note[]>
```

**방법:**
1. Audiveris의 .omr 파일에서 좌표 정보 추출 (권장)
2. MusicXML의 <print> 요소 활용
3. 음표 순서 기반 배치 (폴백)

### 4. 운지 계산 (`utils/fingeringCalculator.ts`)

기존 로직 사용 - 실제 음표 데이터로 계산

### 5. 렌더링 (`utils/scoreRenderer.ts`)

기존 로직 사용 - 실제 좌표로 오버레이

## 🔄 처리 파이프라인 상세

### Step 1: 파일 업로드
```typescript
// pages/index.tsx
const handleFileSelect = async (selectedFile: File) => {
  // 파일을 Base64로 인코딩하여 API에 전송
  const fileData = await selectedFile.arrayBuffer();
  const base64Data = Buffer.from(fileData).toString("base64");
  
  const response = await fetch("/api/omr", {
    method: "POST",
    body: JSON.stringify({
      file: base64Data,
      fileName: selectedFile.name,
      fileType: selectedFile.type,
    }),
  });
};
```

### Step 2: OMR 실행
```typescript
// utils/omrProcessor.ts
const result = await processOMR(fileData, fileName, fileType);
// → MusicXML 생성
```

### Step 3: MusicXML 파싱
```typescript
// utils/musicXmlParser.ts
const parsedData = parseMusicXML(result.musicXml);
// → { notes, keyInfo, timeSignature }
```

### Step 4: 좌표 추출
```typescript
// utils/noteCoordinateExtractor.ts
const notesWithCoordinates = await extractNoteCoordinates(
  parsedData.notes,
  result.imagePath
);
// → { ...note, x, y }
```

### Step 5: 운지 계산
```typescript
// utils/fingeringCalculator.ts
const fingerings = calculateFingerings(notesWithCoordinates, keyInfo);
// → [{ string, finger, position, note }]
```

### Step 6: 렌더링
```typescript
// utils/scoreRenderer.ts
renderScoreWithFingerings(image, analysis, canvas, options);
// → Canvas에 원본 + 운지 숫자
```

## ✅ 체크리스트: 원본만 반환되는 문제 방지

- [x] OMR 엔진 연동 (Audiveris)
- [x] MusicXML 파싱 구현
- [x] 음표 데이터 추출
- [x] 좌표 추출 로직
- [x] 운지 계산 (실제 데이터 사용)
- [x] 좌표 기반 오버레이 렌더링
- [x] PNG/PDF export
- [x] 에러 처리 및 로깅

## 🚀 실행 방법

### 1. Audiveris 설치
```bash
# macOS
brew install --cask audiveris

# 환경 변수 설정
export AUDIVERIS_PATH="/Applications/Audiveris.app/Contents/MacOS/Audiveris"
```

### 2. 패키지 설치
```bash
npm install fast-xml-parser musicxml-interfaces
```

### 3. 개발 서버 실행
```bash
npm run dev
```

### 4. 테스트
1. 악보 PDF/이미지 업로드
2. OMR 처리 대기
3. 결과 확인 (운지 숫자 포함)
4. PNG/PDF 다운로드

## 📊 로그 확인

API 응답에 `logs` 배열이 포함되어 처리 단계를 확인할 수 있습니다:

```json
{
  "success": true,
  "analysis": { ... },
  "logs": [
    "[timestamp] OMR 처리 시작",
    "[timestamp] Audiveris 실행 중...",
    "[timestamp] MusicXML 파싱 완료",
    "[timestamp] 음표 추출: 24개",
    "[timestamp] 운지 계산 완료: 24개"
  ]
}
```

## ⚠️ 주의사항

1. **Audiveris 필수**: OMR 처리를 위해 Audiveris가 설치되어 있어야 합니다.
2. **서버 환경**: API Routes는 서버에서만 실행되므로 Node.js 환경이 필요합니다.
3. **파일 크기**: 대용량 파일 지원을 위해 `bodyParser.sizeLimit` 설정 확인
4. **타임아웃**: OMR 처리 시간이 길 수 있으므로 타임아웃 설정 확인

## 🔮 향후 개선

1. **다중 OMR 엔진 지원**: Audiveris 외 다른 엔진 추가
2. **좌표 정확도 향상**: Audiveris의 상세 좌표 정보 활용
3. **배치 처리**: 여러 파일 동시 처리
4. **캐싱**: 동일 파일 재처리 방지
5. **진행률 표시**: WebSocket을 통한 실시간 진행률

## 📚 참고 자료

- [Audiveris GitHub](https://github.com/Audiveris/audiveris)
- [MusicXML 스펙](https://www.musicxml.com/)
- [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction)
- [Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
