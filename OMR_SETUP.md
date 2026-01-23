# 🎼 OMR (Optical Music Recognition) 설정 가이드

## 개요

이 프로젝트는 **Audiveris** OMR 엔진을 사용하여 악보 이미지/PDF를 **MusicXML**로 변환하고, 이후 바이올린 운지를 계산합니다.

---

## 필수 요구사항

### 1. Audiveris 설치 (macOS)

> ⚠️ **중요**: Audiveris는 더 이상 Homebrew Cask로 제공되지 않습니다.
> 반드시 **공식 GitHub 릴리즈 DMG**를 통해 설치해야 합니다.

#### 1-1. 설치 파일 다운로드

Audiveris 공식 릴리즈 페이지:
[https://github.com/Audiveris/audiveris/releases](https://github.com/Audiveris/audiveris/releases)

사용 중인 Mac CPU에 맞는 DMG 파일을 다운로드하세요.

| Mac 종류                          | 다운로드 파일                       |
| --------------------------------- | ----------------------------------- |
| Apple Silicon (M1 / M2 / M3 / M4) | `Audiveris-5.9.0-macosx-arm64.dmg`  |
| Intel Mac                         | `Audiveris-5.9.0-macosx-x86_64.dmg` |

> CPU 확인 방법:
>
> ```bash
> uname -m
> ```
>
> - `arm64` → Apple Silicon
> - `x86_64` → Intel

---

#### 1-2. 설치 방법

1. DMG 파일 실행
2. `Audiveris.app`을 **Applications** 폴더로 드래그
3. 설치 후 실행 파일 존재 여부 확인

```bash
ls -la /Applications/Audiveris.app/Contents/MacOS/
```

정상 설치 시 다음 중 하나가 존재해야 합니다:

- `Audiveris`
- `audiveris`

---

### 2. Audiveris 실행 테스트 (필수)

```bash
/Applications/Audiveris.app/Contents/MacOS/Audiveris
```

GUI 창이 실행되면 Audiveris 설치는 정상입니다.

---

### 3. Java 요구사항

Audiveris 5.x 버전은 **Java 17 이상**이 필요합니다.

```bash
java -version
```

Java 17이 설치되어 있지 않다면:

```bash
brew install openjdk@17
export JAVA_HOME=$(/usr/libexec/java_home -v17)
```

---

### 4. 환경 변수 설정 (권장)

Audiveris 실행 경로를 명시적으로 지정하는 것을 권장합니다.

```bash
export AUDIVERIS_PATH="/Applications/Audiveris.app/Contents/MacOS/Audiveris"
```

또는 프로젝트 루트에 `.env.local` 파일 생성:

```env
AUDIVERIS_PATH=/Applications/Audiveris.app/Contents/MacOS/Audiveris
```

---

### 5. Node.js 패키지 설치

```bash
npm install fast-xml-parser
```

---

## Audiveris 자동 탐색 경로

환경 변수가 설정되지 않은 경우, 시스템은 아래 경로를 순차적으로 탐색합니다:

- `/Applications/Audiveris.app/Contents/MacOS/Audiveris`
- `/usr/local/bin/audiveris`
- `/opt/homebrew/bin/audiveris`

필요한 경우 심볼릭 링크를 추가할 수 있습니다:

```bash
sudo ln -s /Applications/Audiveris.app/Contents/MacOS/Audiveris /usr/local/bin/audiveris
```

---

## 문제 해결

### ❌ "Audiveris를 찾을 수 없습니다" 오류

> 아래 방법은 **사용하지 마세요**.

```bash
brew install --cask audiveris  # ❌ 지원되지 않음
```

#### 올바른 해결 순서

1. `/Applications/Audiveris.app` 존재 여부 확인
2. Audiveris를 GUI로 한 번 실행
3. `AUDIVERIS_PATH` 환경 변수 설정 확인
4. Java 17 이상 설치 여부 확인

---

## 참고 자료

- Audiveris GitHub: [https://github.com/Audiveris/audiveris](https://github.com/Audiveris/audiveris)
- MusicXML 스펙: [https://www.musicxml.com/](https://www.musicxml.com/)
