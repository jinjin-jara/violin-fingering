# 📋 프로젝트 요약

## ✅ 구현 완료 항목

### 1. 프로젝트 구조 및 설정
- ✅ Next.js 15 프로젝트 초기화
- ✅ TypeScript 설정
- ✅ Tailwind CSS 설정
- ✅ GitHub Pages 배포 설정 (`output: "export"`)

### 2. 핵심 로직 구현
- ✅ **조성 판별** (`utils/keyDetection.ts`)
  - 조표(샤프/플랫) 기반 조성 자동 판별
  - 조성에 따른 실제 음표 계산 (조표 반영)
  
- ✅ **운지 계산** (`utils/fingeringCalculator.ts`)
  - 음표 → 바이올린 지판 위치 변환
  - 현(E/A/D/G), 포지션(Half/1st/2nd/3rd), 손가락(0-4) 계산
  - 최적 운지 선택 알고리즘

- ✅ **악보 파싱 구조** (`utils/scoreParser.ts`)
  - 이미지/PDF 파일 처리 기본 구조
  - 분석 파이프라인 구현

### 3. UI 컴포넌트
- ✅ 파일 업로드 컴포넌트 (Drag & Drop 지원)
- ✅ 로딩 스피너
- ✅ 결과 미리보기 (Canvas 기반 오버레이)
- ✅ PNG/PDF 저장 기능

### 4. PWA 설정
- ✅ Service Worker 기본 구현
- ✅ Manifest 파일 설정
- ✅ 오프라인 캐싱 전략

### 5. 문서화
- ✅ README.md (프로젝트 개요, 설치, 배포)
- ✅ ARCHITECTURE.md (아키텍처 상세 설명)
- ✅ IMPLEMENTATION_GUIDE.md (실제 구현 가이드)

## ⚠️ 추가 구현 필요 항목

### 1. 실제 악보 인식
현재는 더미 데이터를 반환합니다. 다음 중 하나를 선택하여 구현해야 합니다:

**옵션 A: OpenSheetMusicDisplay (OSMD)**
- MusicXML 파일 지원
- 브라우저에서 완전 동작
- 오프라인 가능

**옵션 B: TensorFlow.js ML 모델**
- 이미지에서 직접 인식
- 높은 정확도 필요
- 모델 학습/배포 필요

**옵션 C: Tesseract.js OCR**
- 구현이 상대적으로 간단
- 규칙 기반 파싱 추가 필요

### 2. 음표 위치 정확도
- 현재는 더미 좌표 사용
- 실제 악보 인식 시 정확한 x, y 좌표 추출 필요

### 3. 단조 판별 개선
- 현재는 조표만으로 판별 (기본 장조)
- 첫 음표/마지막 음표 분석으로 단조 판별 추가 가능

## 🎯 핵심 기능 설명

### 조성 판별 로직
```typescript
// 조표 샤프 개수 → 조성 매핑
0 샤프 → C major
1 샤프 → G major (F#)
2 샤프 → D major (F#, C#)
3 샤프 → A major (F#, C#, G#)
...

// 조성에 따른 실제 음표 계산
getActualNote("F", { key: "G", mode: "major" })
// → "F#" (G major는 F#이 샤프)
```

### 운지 계산 로직
```typescript
// 1. 음표의 절대 반음 수 계산
G4 → 67 반음

// 2. 각 현에서 연주 가능 여부 확인
E string: E5 (76) ~ E5+7 (83) → 불가
A string: A4 (69) ~ A4+7 (76) → 가능 (G4 = 67)

// 3. 포지션과 손가락 계산
A string에서 G4는:
- 개방현 A4 (69)보다 낮음
- Half Position -0.5 + 손가락 1 = 68.5
- 실제 G4는 67이므로 다른 현 필요

// 4. 최적 운지 선택
여러 가능한 운지 중 가장 편한 것 선택
(낮은 현 > 낮은 포지션 > 낮은 손가락)
```

## 📁 주요 파일 구조

```
violin-fingering/
├── components/
│   ├── FileUpload.tsx      # 파일 업로드 UI
│   ├── ScorePreview.tsx     # 결과 미리보기
│   └── LoadingSpinner.tsx   # 로딩 표시
├── pages/
│   ├── index.tsx            # 메인 페이지
│   ├── _app.tsx            # 앱 루트
│   └── _document.tsx       # HTML 구조
├── utils/
│   ├── keyDetection.ts      # 조성 판별 ⭐
│   ├── fingeringCalculator.ts # 운지 계산 ⭐
│   └── scoreParser.ts       # 악보 파싱
├── types/
│   └── music.ts            # 타입 정의
└── public/
    ├── manifest.json       # PWA 매니페스트
    └── sw.js              # Service Worker
```

## 🚀 다음 단계

1. **악보 인식 라이브러리 선택 및 통합**
   - OSMD, TensorFlow.js, 또는 Tesseract.js 중 선택
   - `extractNotes()`, `extractKeySignature()` 함수 구현

2. **테스트 데이터 준비**
   - 샘플 악보 이미지
   - 예상 결과와 비교

3. **정확도 개선**
   - 음표 위치 좌표 정확도 향상
   - 다양한 조성 테스트

4. **사용자 경험 개선**
   - 운지 수동 수정 기능
   - 여러 포지션 옵션 제공
   - 에러 메시지 개선

## 📝 기술 스택 선택 이유

### Next.js 선택 이유
- ✅ 정적 사이트 생성으로 GitHub Pages 배포 최적화
- ✅ TypeScript 네이티브 지원
- ✅ PWA 통합 용이
- ✅ 자동 코드 스플리팅

### Tailwind CSS 선택 이유
- ✅ 빠른 UI 개발
- ✅ 반응형 디자인 용이
- ✅ 작은 번들 크기

## 🔍 핵심 알고리즘 요약

### 조성 판별
- 입력: 조표 샤프/플랫 개수
- 출력: 조성 (Key, Mode)
- 복잡도: O(1)

### 운지 계산
- 입력: 음표 (name, octave), 조성 정보
- 출력: 운지 (string, finger, position)
- 복잡도: O(1) per note
- 최적화: 각 현별로 연주 가능 여부 확인 후 최적 선택

## 📊 프로젝트 상태

| 항목 | 상태 | 비고 |
|------|------|------|
| 프로젝트 구조 | ✅ 완료 | |
| 조성 판별 | ✅ 완료 | |
| 운지 계산 | ✅ 완료 | |
| UI 컴포넌트 | ✅ 완료 | |
| PWA 설정 | ✅ 완료 | |
| 악보 인식 | ⚠️ 미구현 | 실제 라이브러리 통합 필요 |
| 단조 판별 | ⚠️ 기본만 | 개선 가능 |
| 테스트 | ⚠️ 미구현 | 유닛 테스트 추가 권장 |

## 🎓 학습 포인트

이 프로젝트를 통해 다음을 학습할 수 있습니다:

1. **음악 이론 적용**
   - 조표와 조성의 관계
   - 바이올린 지판 구조
   - 포지션과 손가락 매핑

2. **알고리즘 설계**
   - 최적 운지 선택 알고리즘
   - 음표 → 지판 위치 변환

3. **웹 기술**
   - Next.js 정적 사이트 생성
   - PWA 구현
   - Canvas API 활용

4. **이미지 처리**
   - PDF → 이미지 변환
   - Canvas 오버레이 렌더링
