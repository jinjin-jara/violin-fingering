# 🚀 OMR 기반 시스템 빠른 시작 가이드

> 이 가이드는 **macOS + Audiveris 5.x** 기준으로
> 최소 단계로 OMR 시스템을 실행하는 것을 목표로 합니다.

---

## 1️⃣ Audiveris 설치

> ⚠️ Audiveris는 **Homebrew로 설치할 수 없습니다**.
> 반드시 공식 릴리즈 DMG를 사용하세요.

1. Audiveris 릴리즈 페이지 접속

   - [https://github.com/Audiveris/audiveris/releases](https://github.com/Audiveris/audiveris/releases)

2. Mac CPU에 맞는 DMG 다운로드

| Mac 종류                          | 파일                                |
| --------------------------------- | ----------------------------------- |
| Apple Silicon (M1 / M2 / M3 / M4) | `Audiveris-5.9.0-macosx-arm64.dmg`  |
| Intel Mac                         | `Audiveris-5.9.0-macosx-x86_64.dmg` |

3. DMG 실행 → `Audiveris.app`을 **Applications** 폴더로 이동

---

## 2️⃣ Audiveris 실행 확인

```bash
/Applications/Audiveris.app/Contents/MacOS/Audiveris
```

GUI 창이 나타나면 정상입니다.

---

## 3️⃣ 환경 변수 설정

```bash
export AUDIVERIS_PATH="/Applications/Audiveris.app/Contents/MacOS/Audiveris"
```

---

## 4️⃣ 의존성 설치

```bash
npm install
```

---

## 5️⃣ 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:3000` 접속 후 악보 파일을 업로드하세요.

---

## 문제 해결

### ❌ "Audiveris를 찾을 수 없습니다"

1. Homebrew로 설치를 시도하지 않았는지 확인
2. `/Applications/Audiveris.app` 존재 여부 확인
3. Audiveris GUI 직접 실행
4. `AUDIVERIS_PATH` 경로 재확인

---

## 다음 단계

- [OMR_SETUP.md](./OMR_SETUP.md) – 상세 설치 가이드
- MusicXML 파싱 및 운지 계산 로직 확인
