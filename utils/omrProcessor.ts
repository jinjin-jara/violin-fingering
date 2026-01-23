/**
 * OMR (Optical Music Recognition) 처리 유틸리티
 * 
 * Audiveris 또는 기타 OMR 엔진을 사용하여
 * PDF/이미지를 MusicXML로 변환합니다.
 */

import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

const execAsync = promisify(exec);

export interface OMRResult {
  success: boolean;
  musicXml?: string;
  imagePath?: string;
  error?: string;
  logs?: string[];
}

/**
 * Audiveris 실행 경로 설정
 * 환경 변수에서 가져오거나 기본값 사용
 */
async function getAudiverisPath(): Promise<string> {
  // 환경 변수에서 Audiveris 경로 확인
  const audiverisPath = process.env.AUDIVERIS_PATH;
  if (audiverisPath) {
    // 경로가 존재하는지 확인
    try {
      await fs.access(audiverisPath);
      return audiverisPath;
    } catch {
      throw new Error(`AUDIVERIS_PATH 환경 변수에 지정된 경로가 존재하지 않습니다: ${audiverisPath}`);
    }
  }

  // 기본 경로 (시스템에 따라 수정 필요)
  const platform = os.platform();
  let possiblePaths: string[] = [];

  if (platform === "darwin") {
    // macOS - 여러 가능한 경로 확인
    possiblePaths = [
      "/Applications/Audiveris.app/Contents/MacOS/Audiveris",
      "/Applications/Audiveris.app/Contents/MacOS/audiveris",
      "/usr/local/bin/audiveris",
      "/opt/homebrew/bin/audiveris",
    ];
  } else if (platform === "win32") {
    // Windows
    possiblePaths = [
      "C:\\Program Files\\Audiveris\\Audiveris.exe",
      "C:\\Program Files (x86)\\Audiveris\\Audiveris.exe",
    ];
  } else {
    // Linux
    possiblePaths = [
      "/usr/bin/audiveris",
      "/usr/local/bin/audiveris",
      "/opt/audiveris/bin/audiveris",
    ];
  }

  // 가능한 경로 중 존재하는 것 찾기
  for (const possiblePath of possiblePaths) {
    try {
      await fs.access(possiblePath);
      return possiblePath;
    } catch {
      // 다음 경로 시도
      continue;
    }
  }

  // 모든 경로가 실패한 경우
  throw new Error(
    `Audiveris를 찾을 수 없습니다. 다음 중 하나를 수행하세요:\n` +
    `1. Audiveris를 설치하세요\n` +
    `2. AUDIVERIS_PATH 환경 변수를 설정하세요\n` +
    `3. 다음 경로 중 하나에 Audiveris를 설치하세요:\n` +
    possiblePaths.map(p => `   - ${p}`).join("\n")
  );
}

/**
 * 파일을 임시 디렉토리에 저장
 */
async function saveTemporaryFile(
  fileData: string | Buffer,
  fileName: string
): Promise<string> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "omr-"));
  const filePath = path.join(tempDir, fileName);
  
  if (Buffer.isBuffer(fileData)) {
    await fs.writeFile(filePath, fileData);
  } else {
    // Base64 디코딩
    const buffer = Buffer.from(fileData, "base64");
    await fs.writeFile(filePath, buffer);
  }
  
  return filePath;
}

/**
 * Audiveris를 사용하여 OMR 처리
 */
async function processWithAudiveris(
  inputPath: string,
  outputDir: string
): Promise<{ musicXmlPath?: string; imagePath?: string; error?: string; logs?: string[] }> {
  const logs: string[] = [];

  try {
    // Audiveris 경로 확인
    const audiverisPath = await getAudiverisPath();
    logs.push(`Audiveris 경로: ${audiverisPath}`);

    // Audiveris 실행 명령어
    // 참고: Audiveris의 실제 명령어 옵션은 버전에 따라 다를 수 있습니다
    // -batch: 배치 모드 (GUI 없이 실행)
    // -export: MusicXML로 내보내기
    // -output: 출력 디렉토리
    // -transcribe: OMR 수행 (일부 버전에서 필요)
    
    // 여러 가능한 명령어 형식 시도
    const possibleCommands = [
      `"${audiverisPath}" -batch -export -output "${outputDir}" "${inputPath}"`,
      `"${audiverisPath}" -batch -transcribe -export -output "${outputDir}" "${inputPath}"`,
      `"${audiverisPath}" -batch "${inputPath}" -export -output "${outputDir}"`,
      `"${audiverisPath}" -batch -export "${inputPath}" -output "${outputDir}"`,
    ];
    
    let command = possibleCommands[0]; // 기본 명령어
    logs.push(`시도할 명령어: ${command}`);
    
    logs.push(`Audiveris 실행: ${command}`);
    
    let stdout = "";
    let stderr = "";
    
    try {
      const result = await execAsync(command, {
        timeout: 120000, // 120초 타임아웃 (OMR 처리에 시간이 걸릴 수 있음)
        maxBuffer: 10 * 1024 * 1024, // 10MB
      });
      stdout = result.stdout || "";
      stderr = result.stderr || "";
    } catch (execError: any) {
      // execAsync는 에러가 발생해도 stdout/stderr를 반환할 수 있음
      stdout = execError.stdout || "";
      stderr = execError.stderr || "";
      logs.push(`명령 실행 중 경고 (계속 진행): ${execError.message}`);
    }

    if (stdout) logs.push(`stdout: ${stdout.substring(0, 500)}`); // 처음 500자만
    if (stderr) logs.push(`stderr: ${stderr.substring(0, 500)}`); // 처음 500자만

    // 출력 디렉토리 확인 (재귀적으로)
    const findMusicXmlFiles = async (dir: string): Promise<string[]> => {
      const files: string[] = [];
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory()) {
            // 하위 디렉토리도 검색
            const subFiles = await findMusicXmlFiles(fullPath);
            files.push(...subFiles);
          } else if (entry.isFile()) {
            // MusicXML 파일 찾기 (다양한 확장자)
            if (
              entry.name.endsWith(".musicxml") ||
              entry.name.endsWith(".xml") ||
              entry.name.endsWith(".mxl")
            ) {
              files.push(fullPath);
            }
          }
        }
      } catch (error) {
        logs.push(`디렉토리 읽기 오류 (${dir}): ${error}`);
      }
      return files;
    };

    // 출력 디렉토리에서 MusicXML 파일 찾기 (재귀적)
    logs.push(`출력 디렉토리 검색: ${outputDir}`);
    const musicXmlFiles = await findMusicXmlFiles(outputDir);
    
    // 입력 파일과 같은 이름의 파일도 확인
    const baseName = path.basename(inputPath, path.extname(inputPath));
    const possibleNames = [
      `${baseName}.musicxml`,
      `${baseName}.xml`,
      `${baseName}.mxl`,
      "score.musicxml",
      "score.xml",
    ];
    
    for (const possibleName of possibleNames) {
      const possiblePath = path.join(outputDir, possibleName);
      try {
        await fs.access(possiblePath);
        if (!musicXmlFiles.includes(possiblePath)) {
          musicXmlFiles.push(possiblePath);
        }
      } catch {
        // 파일 없음, 계속
      }
    }
    
    logs.push(`발견된 MusicXML 파일: ${musicXmlFiles.length}개`);
    if (musicXmlFiles.length > 0) {
      musicXmlFiles.forEach(f => logs.push(`  - ${f}`));
    }
    
    if (musicXmlFiles.length > 0) {
      const musicXmlPath = musicXmlFiles[0]; // 첫 번째 파일 사용
      logs.push(`사용할 MusicXML 파일: ${musicXmlPath}`);
      
      // 이미지 파일 찾기
      const imageExtensions = [".png", ".jpg", ".jpeg", ".tiff", ".tif"];
      let imagePath: string | undefined;
      
      for (const ext of imageExtensions) {
        const possibleImagePath = path.join(outputDir, baseName + ext);
        try {
          await fs.access(possibleImagePath);
          imagePath = possibleImagePath;
          break;
        } catch {
          // 계속
        }
      }
      
      // 이미지가 없으면 원본 입력 파일 사용
      if (!imagePath) {
        imagePath = inputPath;
      }
      
      return {
        musicXmlPath,
        imagePath,
        logs,
      };
    }

    // 출력 디렉토리의 모든 파일 목록 로깅
    try {
      const allFiles = await fs.readdir(outputDir, { recursive: true });
      logs.push(`출력 디렉토리 전체 파일 목록:`);
      allFiles.forEach(f => logs.push(`  - ${f}`));
    } catch (error) {
      logs.push(`파일 목록 읽기 실패: ${error}`);
    }

    return { 
      error: `MusicXML 파일을 찾을 수 없습니다. Audiveris가 성공적으로 실행되었는지 확인하세요.\n출력 디렉토리: ${outputDir}\n발견된 파일: ${musicXmlFiles.length}개`,
      logs,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류";
    logs.push(`오류: ${errorMessage}`);
    
    // 경로 관련 오류인 경우 더 자세한 메시지
    if (errorMessage.includes("No such file") || errorMessage.includes("ENOENT")) {
      return { 
        error: `Audiveris를 찾을 수 없습니다. 설치되어 있는지 확인하거나 AUDIVERIS_PATH 환경 변수를 설정하세요.\n원본 오류: ${errorMessage}`,
        logs,
      };
    }
    
    return { error: errorMessage, logs };
  }
}

/**
 * 대체 방법: VexFlow를 사용한 간단한 OMR (개발/테스트용)
 * 
 * 실제 프로덕션에서는 Audiveris를 사용해야 합니다.
 */
async function processWithVexFlow(
  inputPath: string
): Promise<{ musicXml?: string; imagePath?: string; error?: string }> {
  // VexFlow는 렌더링 라이브러리이므로 실제 OMR은 수행하지 않습니다.
  // 이는 개발/테스트용 플레이스홀더입니다.
  
  return {
    error: "VexFlow는 OMR 엔진이 아닙니다. Audiveris를 사용하세요.",
  };
}

/**
 * OMR 처리 메인 함수
 */
export async function processOMR(
  fileData: string | Buffer,
  fileName: string,
  fileType: string
): Promise<OMRResult> {
  const logs: string[] = [];
  const addLog = (message: string) => {
    logs.push(`[${new Date().toISOString()}] ${message}`);
    console.log(message);
  };

  let tempInputPath: string | undefined;
  let tempOutputDir: string | undefined;

  try {
    addLog("OMR 처리 시작");

    // 1. 임시 파일 저장
    addLog("임시 파일 저장 중...");
    tempInputPath = await saveTemporaryFile(fileData, fileName);
    addLog(`임시 파일: ${tempInputPath}`);

    // 2. 출력 디렉토리 생성
    tempOutputDir = await fs.mkdtemp(path.join(os.tmpdir(), "omr-output-"));
    addLog(`출력 디렉토리: ${tempOutputDir}`);

    // 3. OMR 엔진 실행
    addLog("Audiveris 실행 중...");
    const result = await processWithAudiveris(tempInputPath, tempOutputDir);

    if (result.logs) {
      logs.push(...result.logs);
    }

    if (result.error) {
      addLog(`OMR 실패: ${result.error}`);
      
      return {
        success: false,
        error: result.error,
        logs,
      };
    }

    // 4. MusicXML 읽기
    if (!result.musicXmlPath) {
      return {
        success: false,
        error: "MusicXML 파일 경로가 없습니다",
        logs,
      };
    }

    addLog(`MusicXML 파일 읽기: ${result.musicXmlPath}`);
    
    // 파일이 .mxl (압축된 MusicXML)인지 확인
    let musicXml: string;
    const fileExtension = path.extname(result.musicXmlPath).toLowerCase();
    
    if (fileExtension === ".mxl") {
      // .mxl 파일은 ZIP 압축 파일입니다
      addLog("압축된 MusicXML (.mxl) 파일 감지, 압축 해제 중...");
      
      try {
        // Node.js의 zlib과 adm-zip 사용
        const AdmZip = require("adm-zip");
        const zip = new AdmZip(result.musicXmlPath);
        const zipEntries = zip.getEntries();
        
        // MusicXML 파일 찾기 (보통 .xml 파일)
        const xmlEntry = zipEntries.find((entry: any) => 
          entry.entryName.endsWith(".xml") || entry.entryName.endsWith(".musicxml")
        );
        
        if (!xmlEntry) {
          return {
            success: false,
            error: ".mxl 파일 내부에서 XML 파일을 찾을 수 없습니다",
            logs,
          };
        }
        
        musicXml = xmlEntry.getData().toString("utf-8");
        addLog(`압축 해제 완료: ${xmlEntry.entryName}`);
      } catch (zipError: any) {
        addLog(`압축 해제 오류: ${zipError.message}`);
        return {
          success: false,
          error: `.mxl 파일 압축 해제 실패: ${zipError.message}`,
          logs,
        };
      }
    } else {
      // 일반 XML 파일
      const fileBuffer = await fs.readFile(result.musicXmlPath);
      
      // 파일이 실제로 텍스트인지 확인 (UTF-8 BOM 체크)
      const bom = fileBuffer[0] === 0xEF && fileBuffer[1] === 0xBB && fileBuffer[2] === 0xBF;
      const startOffset = bom ? 3 : 0;
      
      // 처음 몇 바이트를 확인하여 텍스트인지 판단
      const firstBytes = fileBuffer.slice(0, 10);
      const isText = firstBytes.every(byte => 
        (byte >= 0x20 && byte <= 0x7E) || // ASCII printable
        byte === 0x09 || byte === 0x0A || byte === 0x0D // tab, newline, carriage return
      );
      
      if (!isText && fileBuffer[0] === 0x50 && fileBuffer[1] === 0x4B) {
        // ZIP 파일 시그니처 (PK) - .mxl 파일이지만 확장자가 .xml인 경우
        addLog("ZIP 파일 시그니처 감지, 압축 해제 시도...");
        try {
          const AdmZip = require("adm-zip");
          const zip = new AdmZip(fileBuffer);
          const zipEntries = zip.getEntries();
          
          const xmlEntry = zipEntries.find((entry: any) => 
            entry.entryName.endsWith(".xml") || entry.entryName.endsWith(".musicxml")
          );
          
          if (xmlEntry) {
            musicXml = xmlEntry.getData().toString("utf-8");
            addLog(`압축 해제 완료: ${xmlEntry.entryName}`);
          } else {
            return {
              success: false,
              error: "ZIP 파일 내부에서 XML 파일을 찾을 수 없습니다",
              logs,
            };
          }
        } catch (zipError: any) {
          return {
            success: false,
            error: `파일이 압축되어 있지만 해제 실패: ${zipError.message}`,
            logs,
          };
        }
      } else {
        // 일반 텍스트 파일
        musicXml = fileBuffer.toString("utf-8", startOffset);
      }
    }
    
    // MusicXML이 유효한 XML인지 확인
    if (!musicXml || musicXml.trim().length === 0) {
      return {
        success: false,
        error: "MusicXML 파일이 비어있거나 읽을 수 없습니다",
        logs,
      };
    }
    
    // XML 시작 부분 확인
    const xmlStart = musicXml.trim().substring(0, 100);
    if (!xmlStart.startsWith("<?xml") && !xmlStart.startsWith("<")) {
      addLog(`경고: XML 시작 부분이 예상과 다릅니다: ${xmlStart}`);
    }
    
    addLog(`MusicXML 크기: ${musicXml.length} bytes`);
    addLog(`MusicXML 시작: ${xmlStart}`);

    // 5. 이미지 경로 설정
    const imagePath = result.imagePath || tempInputPath;

    addLog("OMR 처리 완료");

    return {
      success: true,
      musicXml,
      imagePath,
      logs,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류";
    addLog(`오류 발생: ${errorMessage}`);
    
    return {
      success: false,
      error: errorMessage,
      logs,
    };
  } finally {
    // 임시 파일 정리 (선택적 - 디버깅 시 주석 처리)
    try {
      if (tempInputPath) {
        // await fs.unlink(tempInputPath);
      }
      if (tempOutputDir) {
        // await fs.rm(tempOutputDir, { recursive: true, force: true });
      }
    } catch (cleanupError) {
      console.warn("임시 파일 정리 실패:", cleanupError);
    }
  }
}
