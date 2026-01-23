# 🎼 바이올린 운지 오버레이 구현 문서

## 📋 구현 개요

악보 이미지/PDF에 바이올린 운지 숫자를 시각적으로 오버레이하여 최종 결과 이미지/PDF를 생성하는 기능을 구현했습니다.

## 🏗️ 아키텍처 설계

### 렌더링 방식 선택: **HTML Canvas**

**선정 이유:**
1. **오프라인 동작**: 브라우저 네이티브 API로 외부 의존성 없음
2. **고해상도 지원**: Canvas의 고해상도 렌더링으로 인쇄 품질 확보
3. **PDF 변환 용이**: Canvas → 이미지 → PDF 변환이 간단
4. **PWA 호환**: Service Worker와 완벽 호환
5. **성능**: 하드웨어 가속 지원으로 빠른 렌더링

### 파일 구조

```
utils/
  └── scoreRenderer.ts    # 렌더링 로직 (도메인 레이어)
components/
  └── ScorePreview.tsx    # UI 컴포넌트
```

## 🔧 핵심 구현 내용

### 1. 렌더링 파이프라인

```
[원본 이미지] 
  ↓
[Canvas에 원본 이미지 그리기]
  ↓
[음표 좌표 기반 운지 숫자 오버레이]
  ↓
[고해상도 Canvas 결과물]
  ↓
[PNG/JPG/PDF 변환]
```

### 2. 고해상도 렌더링

- **스케일**: 2배 (기본값)
- **Canvas 크기**: 원본 크기 × 스케일
- **CSS 표시**: 원본 크기로 표시 (고해상도 유지)

```typescript
// 고해상도 Canvas 생성
canvas.width = image.width * scale;  // 실제 픽셀 크기
canvas.height = image.height * scale;

// CSS로 원본 크기 표시
style={{ width: `${image.width}px`, height: `${image.height}px` }}
```

### 3. 운지 숫자 배치 전략

- **위치**: 음표 바로 아래 (`offsetY: 35px`)
- **스타일**: 
  - 흰색 배경 원
  - 진한 회색 테두리 및 숫자
  - 가독성 최우선
- **좌표 변환**: 원본 좌표 → 스케일된 Canvas 좌표

### 4. 결과물 생성

#### PNG/JPG
```typescript
const dataUrl = canvas.toDataURL("image/png", 1.0);
downloadImage(dataUrl, filename);
```

#### PDF
```typescript
// jsPDF 사용
const pdf = new jsPDF({
  orientation: width > height ? "landscape" : "portrait",
  unit: "mm",
  format: [width, height],
});
pdf.addImage(canvas.toDataURL("image/png", 1.0), "PNG", 0, 0, width, height);
pdf.save(filename);
```

## 📦 주요 함수

### `renderScoreWithFingerings()`
원본 이미지에 운지 숫자를 오버레이하여 Canvas에 렌더링

**파라미터:**
- `image`: 원본 이미지 (HTMLImageElement | HTMLCanvasElement)
- `analysis`: 악보 분석 결과 (ScoreAnalysis)
- `canvas`: 렌더링할 Canvas 요소
- `options`: 렌더링 옵션 (스케일, 폰트 크기, 색상 등)

### `canvasToPNG()` / `canvasToJPG()`
Canvas를 이미지 데이터 URL로 변환

### `canvasToPDF()`
Canvas를 PDF 파일로 변환 (jsPDF 사용)

### `downloadImage()`
이미지 다운로드 실행

## 🎨 시각적 스타일

### 운지 숫자 디자인
- **배경**: 흰색 원 (`#ffffff`)
- **테두리**: 진한 회색 (`#1f2937`, 2px)
- **숫자**: 진한 회색 (`#1f2937`), 볼드체
- **크기**: 반지름 16px (스케일 적용 시 32px)
- **폰트**: Arial, 20px (스케일 적용 시 40px)

### 배치 규칙
- 음표 좌표 `(x, y)` 기준
- 숫자 위치: `(x, y + offsetY)`
- 음표와 겹치지 않도록 충분한 오프셋

## 🔄 처리 흐름

1. **파일 업로드** (`FileUpload.tsx`)
   - 이미지/PDF 파일 선택
   - 파일 검증

2. **악보 분석** (`scoreParser.ts`)
   - 음표 인식 및 좌표 추출
   - 조성 판별
   - 운지 계산

3. **렌더링** (`scoreRenderer.ts`)
   - 원본 이미지 로드
   - Canvas에 원본 그리기
   - 운지 숫자 오버레이
   - 고해상도 결과물 생성

4. **미리보기** (`ScorePreview.tsx`)
   - Canvas 표시
   - 다운로드 버튼 제공

5. **다운로드**
   - PNG/JPG/PDF 형식 선택
   - 파일 저장

## ⚙️ 설정 옵션

```typescript
interface RenderOptions {
  scale?: number;              // 고해상도 스케일 (기본: 2)
  fontSize?: number;           // 폰트 크기 (기본: 24)
  offsetY?: number;            // 음표와 숫자 사이 거리 (기본: 40)
  circleRadius?: number;       // 배경 원 반지름 (기본: 18)
  textColor?: string;          // 숫자 색상 (기본: #1f2937)
  backgroundColor?: string;     // 배경 색상 (기본: #ffffff)
  borderColor?: string;         // 테두리 색상 (기본: #1f2937)
  borderWidth?: number;        // 테두리 두께 (기본: 2)
}
```

## 🚀 사용 예시

```typescript
import { renderScoreWithFingerings, canvasToPNG, downloadImage } from "@/utils/scoreRenderer";

// 렌더링
renderScoreWithFingerings(image, analysis, canvas, {
  scale: 2,
  fontSize: 20,
  offsetY: 35,
});

// PNG 다운로드
const dataUrl = canvasToPNG(canvas);
downloadImage(dataUrl, "violin-fingering.png");
```

## 📝 향후 확장 가능성

1. **다양한 스타일 옵션**
   - 색상 테마 선택
   - 숫자 크기 조절
   - 배치 위치 선택 (위/아래)

2. **고급 렌더링**
   - 현 표시 (E/A/D/G)
   - 포지션 표시
   - 다중 운지 옵션 표시

3. **배치 최적화**
   - 숫자 겹침 방지 알고리즘
   - 자동 위치 조정

4. **성능 최적화**
   - Web Workers를 통한 비동기 렌더링
   - 큰 이미지 청크 단위 처리

## ✅ 구현 완료 항목

- [x] Canvas 기반 렌더링 유틸리티
- [x] 고해상도 렌더링 지원
- [x] 운지 숫자 시각적 오버레이
- [x] PNG/JPG 다운로드
- [x] PDF 다운로드
- [x] UI 컴포넌트 통합
- [x] 오프라인 동작 지원 (PWA)
- [x] 가독성 최적화된 스타일

## 🎯 핵심 포인트

✅ **결과 이미지에 숫자가 영구적으로 포함됨**
- Canvas에 직접 그려지므로 저장/출력/인쇄 가능
- CSS 오버레이가 아닌 실제 픽셀 데이터

✅ **오프라인 동작 가능**
- 브라우저 네이티브 API만 사용
- 외부 CDN 의존성 없음

✅ **고해상도 지원**
- 인쇄 품질 확보
- 스케일 조절 가능

✅ **확장 가능한 구조**
- 렌더링 로직과 UI 분리
- 옵션 기반 커스터마이징
