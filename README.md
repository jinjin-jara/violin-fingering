# 바이올린 운지 분석기

악보 이미지 또는 PDF 파일을 업로드하면 Audiveris OMR로 음표를 인식하고, 조성을 자동 판별하여 바이올린 운지 번호를 악보 위에 오버레이하는 웹 애플리케이션입니다.

## 기능

- **악보 업로드**: 이미지(JPG, PNG) 또는 PDF 파일 업로드
- **OMR 처리**: Audiveris를 통해 악보 이미지 → MusicXML 변환
- **조성 자동 판별**: 조표(sharps/flats) 기반 Key 자동 판별
- **운지 계산**: 각 음표에 대해 바이올린 현(E/A/D/G)과 손가락 번호(0–4) 계산 (1st position)
- **오버레이 렌더링**: 계산된 운지 번호를 오선 상단 위에 원 형태로 표시
- **저장**: PNG, JPG, PDF 형식으로 내보내기

## 프로젝트 구조

```
violin-fingering/
├── components/
│   ├── FileUpload.tsx        # 파일 업로드
│   ├── ScorePreview.tsx      # 결과 미리보기 및 내보내기
│   └── LoadingSpinner.tsx
├── pages/
│   ├── index.tsx             # 메인 페이지
│   ├── _app.tsx
│   ├── _document.tsx
│   └── api/                  # Next.js API 라우트
├── types/
│   └── music.ts              # 공통 타입 정의
├── utils/
│   ├── audiverisNoteLayout.ts  # MusicXML → 음표 페이지 좌표(tenths) 계산
│   ├── fingeringCalculator.ts  # 바이올린 운지 계산
│   ├── keyDetection.ts         # 조성 판별
│   ├── musicXmlParser.ts       # MusicXML 파싱
│   ├── noteCoordinateExtractor.ts
│   ├── omrProcessor.ts         # Audiveris OMR 실행
│   ├── scoreParser.ts          # 악보 파싱 진입점
│   └── scoreRenderer.ts        # Canvas 기반 운지 오버레이 렌더링
├── __tests__/
│   ├── fingeringCalculator.test.ts
│   └── pitchToNoteName.test.ts
└── vitest.config.ts
```

## 데이터 흐름

```
파일 업로드
  ↓
omrProcessor.ts — Audiveris 실행 → MusicXML 생성
  ↓
musicXmlParser.ts — 음표/조성/박자 추출
audiverisNoteLayout.ts — 음표별 페이지 좌표(tenths) 계산
  ↓
keyDetection.ts — 조표 → 조성 변환, 임시표 반영
fingeringCalculator.ts — 음표 → 현 + 손가락 번호
  ↓
scoreRenderer.ts — 원본 이미지 + 운지 번호 오버레이 (Canvas)
  ↓
PNG / JPG / PDF 저장
```

## 좌표 시스템

음표 위치는 MusicXML 표준 단위인 **tenths**로 처리됩니다.

- `default-x`, `default-y` → 마디(measure) 기준 상대 좌표
- 시스템(System)별 Y 위치는 `<print><system-layout>`, `top-system-distance`, `system-distance`로 계산
- 렌더링 시 `pageWidthTenths / imageWidth` 비율로 픽셀 변환
- 운지 번호는 각 시스템 상단(systemTop)에서 위로 `offsetAboveMeasure`(기본 15px)만큼 올린 위치에 표시

## 운지 계산 로직

1st position 기준, 각 현의 개방현에서 완전5도(+7 semitones) 범위를 담당합니다.

| 현 | 개방현 | 1번 | 2번 | 3번 | 4번 |
|---|---|---|---|---|---|
| E | E5 | F/F# | G/G# | A | B♭/B |
| A | A4 | B♭/B | C/C# | D | E♭/E |
| D | D4 | E♭/E | F/F# | G | A♭/A |
| G | G3 | A♭/A | B♭/B | C | D♭/D |

조성에 따른 임시표(#/♭)는 `keyDetection.ts`에서 적용 후 운지 계산에 반영됩니다.

## 기술 스택

| 항목 | 내용 |
|---|---|
| 프레임워크 | Next.js 15 |
| 언어 | TypeScript |
| 스타일 | Tailwind CSS 3 |
| OMR | Audiveris (로컬 실행, `AUDIVERIS_PATH` 환경 변수) |
| XML 파싱 | fast-xml-parser |
| PDF 처리 | pdfjs-dist |
| PDF 생성 | jspdf |
| 악보 렌더링 | Canvas API |
| 테스트 | Vitest |

## 설치 및 실행

### 사전 요구사항

- Node.js 20+
- [Audiveris](https://github.com/Audiveris/audiveris) 설치 후 경로 설정

```bash
export AUDIVERIS_PATH=/path/to/audiveris
```

### 개발 서버

```bash
npm install
npm run dev
# http://localhost:3700
```

### 빌드

```bash
npm run build
```

### 테스트

```bash
npx vitest
```

## 구현 현황

- [x] Audiveris OMR 연동 (MusicXML 변환)
- [x] MusicXML 파싱 (음표, 조성, 박자)
- [x] MusicXML 페이지 좌표 계산 (tenths 기반, 시스템/마디 레이아웃)
- [x] 조성 판별 및 임시표 반영
- [x] 1st position 운지 계산
- [x] Canvas 오버레이 렌더링 (오선 상단 기준 배치)
- [x] PNG / JPG / PDF 내보내기
- [x] 단위 테스트 (vitest)
- [ ] 다중 포지션 지원
- [ ] 운지 수동 수정
- [ ] 다성부(chord) 처리

## 라이선스

MIT
