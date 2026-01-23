# 🎻 바이올린 운지 분석기

악보 이미지 또는 PDF 파일을 업로드하면 조성을 자동으로 판별하고 바이올린 운지를 계산하여 악보 위에 숫자로 표시하는 웹 애플리케이션입니다.

## 📋 프로젝트 개요

이 프로젝트는 다음 기능을 제공합니다:

1. **악보 업로드**: 이미지(JPG, PNG) 또는 PDF 파일 업로드
2. **조성 자동 판별**: 조표를 기반으로 Key(조성) 자동 판별
3. **운지 계산**: 각 음표에 대해 바이올린 현(E/A/D/G)과 손가락 번호(0-4) 계산
4. **결과 표시**: 계산된 운지 숫자를 악보 위에 오버레이 표시
5. **결과 저장**: PNG 또는 PDF 형식으로 저장

## 🏗️ 아키텍처

### 프로젝트 구조

```
violin-fingering/
├── components/          # React 컴포넌트
│   ├── FileUpload.tsx   # 파일 업로드 컴포넌트
│   ├── ScorePreview.tsx # 결과 미리보기 컴포넌트
│   └── LoadingSpinner.tsx
├── pages/              # Next.js 페이지
│   ├── _app.tsx        # 앱 루트
│   ├── _document.tsx   # HTML 문서 구조
│   └── index.tsx       # 메인 페이지
├── types/              # TypeScript 타입 정의
│   └── music.ts        # 음악 관련 타입
├── utils/              # 핵심 로직
│   ├── keyDetection.ts      # 조성 판별
│   ├── fingeringCalculator.ts # 운지 계산
│   └── scoreParser.ts        # 악보 파싱
├── styles/             # 스타일
│   └── globals.css     # 전역 스타일
└── public/             # 정적 파일
    ├── manifest.json   # PWA 매니페스트
    └── sw.js          # Service Worker
```

### 데이터 흐름

```
1. 파일 업로드
   ↓
2. 악보 파싱 (scoreParser.ts)
   - 이미지/PDF에서 음표 추출
   - 조표 추출
   ↓
3. 조성 판별 (keyDetection.ts)
   - 조표 → 조성 변환
   - 실제 음표 계산 (조성 반영)
   ↓
4. 운지 계산 (fingeringCalculator.ts)
   - 음표 → 바이올린 지판 위치
   - 현, 포지션, 손가락 번호 결정
   ↓
5. 결과 렌더링 (ScorePreview.tsx)
   - 원본 악보 + 운지 숫자 오버레이
   ↓
6. 저장 (PNG/PDF)
```

## 🛠️ 기술 스택

### 프레임워크: Next.js 15

**선정 이유:**
- ✅ **정적 사이트 생성(SSG)**: GitHub Pages 배포에 최적화
- ✅ **PWA 지원**: Service Worker 통합 용이
- ✅ **TypeScript 네이티브 지원**: 타입 안정성
- ✅ **이미지 최적화**: 내장 이미지 최적화 기능
- ✅ **SEO 친화적**: 서버 사이드 렌더링 지원

**장점:**
- 빠른 개발 환경 설정
- 자동 코드 스플리팅
- API 라우트 지원 (필요시)

**단점:**
- 정적 export 시 일부 기능 제한 (API 라우트 불가)

### 스타일링: Tailwind CSS 4

- 유틸리티 기반 빠른 개발
- 반응형 디자인 용이
- 작은 번들 크기

### 악보 인식 전략

현재는 기본 구조만 구현되어 있으며, 실제 악보 인식을 위해서는 다음 중 하나를 선택해야 합니다:

1. **OpenSheetMusicDisplay (OSMD)**
   - MusicXML 파일 지원
   - 브라우저에서 렌더링 및 파싱 가능
   - 오프라인 동작 가능

2. **VexFlow**
   - JavaScript 기반 악보 렌더링
   - 악보 생성에 특화

3. **ML 모델 (TensorFlow.js)**
   - 이미지에서 직접 음표 인식
   - 오프라인 동작 가능
   - 높은 정확도 필요

4. **OCR + 규칙 기반 파싱**
   - Tesseract.js 등 OCR 사용
   - 악보 구조 규칙 적용

**권장 사항**: 초기에는 MusicXML 파일을 직접 입력받는 방식으로 시작하고, 점진적으로 이미지 인식 기능을 추가하는 것을 권장합니다.

## 🎯 핵심 로직 설명

### 1. 조성 판별 (`keyDetection.ts`)

```typescript
// 조표의 샤프/플랫 개수로 조성 판별
detectKeyFromSignature(sharps: 3, flats: 0)
// → { key: "A", mode: "major", sharps: 3, flats: 0 }

// 조성에 따른 실제 음표 계산
getActualNote("F", { key: "A", mode: "major" })
// → "F#" (A major는 F#, C#, G#이 샤프)
```

### 2. 운지 계산 (`fingeringCalculator.ts`)

```typescript
// 음표를 바이올린 지판 위치로 변환
calculateFingering(note, keyInfo)
// → {
//     string: "A",
//     finger: 2,
//     position: "1st",
//     note: { ... }
//   }
```

**계산 과정:**
1. 음표의 절대 반음 수 계산 (옥타브 포함)
2. 각 현(E/A/D/G)에서 연주 가능 여부 확인
3. 포지션별 손가락 위치 계산
4. 최적의 운지 선택 (낮은 현, 낮은 포지션 우선)

### 3. 바이올린 지판 매핑

- **개방현**: E5, A4, D4, G3
- **포지션별 손가락 간격**:
  - Half Position: 개방현 -0.5음
  - 1st Position: 개방현 +1음 (손가락 1번)
  - 2nd Position: 개방현 +2음 (손가락 1번)
  - 3rd Position: 개방현 +3음 (손가락 1번)

## 🚀 설치 및 실행

### 개발 환경

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 브라우저에서 http://localhost:3000 열기
```

### 프로덕션 빌드

```bash
# 빌드
npm run build

# 정적 파일 생성 (out/ 디렉토리)
# next.config.ts의 output: "export" 설정으로 자동 생성
```

## 📦 배포 (GitHub Pages)

### 1. GitHub 저장소 생성

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/your-username/violin-fingering.git
git push -u origin main
```

### 2. GitHub Actions 설정

`.github/workflows/deploy.yml` 파일 생성:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm install
      - run: npm run build
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./out
```

### 3. GitHub 저장소 설정

1. Settings → Pages
2. Source: GitHub Actions 선택
3. 저장소 푸시 시 자동 배포

### 주의사항

- `next.config.ts`에서 `output: "export"` 설정 필수
- 이미지 최적화 비활성화 (`images.unoptimized: true`)
- 절대 경로 사용 시 `basePath` 설정 고려

## 🔧 주요 기능 구현 상태

- [x] 프로젝트 구조 설계
- [x] 조성 판별 로직
- [x] 운지 계산 로직
- [x] UI 컴포넌트 (업로드, 미리보기)
- [x] PWA 기본 설정
- [x] 이미지/PDF 저장 기능
- [ ] 실제 악보 인식 (OCR/ML)
- [ ] 음표 위치 정확도 개선
- [ ] 다중 포지션 선택 옵션

## 📝 향후 개선 사항

1. **악보 인식 정확도 향상**
   - ML 모델 통합
   - 음표 위치 좌표 정확도 개선

2. **사용자 경험 개선**
   - 운지 수동 수정 기능
   - 여러 포지션 옵션 제공
   - 악보 편집 기능

3. **성능 최적화**
   - Web Worker를 통한 백그라운드 처리
   - 대용량 파일 처리 최적화

4. **오프라인 지원 강화**
   - 모든 의존성 로컬 캐싱
   - IndexedDB를 통한 결과 저장

## 📄 라이선스

MIT License

## 🤝 기여

이슈 및 풀 리퀘스트 환영합니다!
