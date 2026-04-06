/**
 * musicXmlParser와 audiverisNoteLayout의 pitchToNoteName/pitchToName 함수
 * 내부 함수이므로, 파일을 직접 복사해서 테스트하지 않고
 * 실제 파서 출력으로부터 음이름이 올바른지 검증합니다.
 */
import { describe, it, expect } from "vitest";
import { parseMusicXML } from "../utils/musicXmlParser";

/** 최소한의 MusicXML — 단일 음표 하나 */
function makeMusicXml(
  step: string,
  alter: number | undefined,
  octave: number
): string {
  const alterEl = alter !== undefined ? `<alter>${alter}</alter>` : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note>
        <pitch>
          <step>${step}</step>
          ${alterEl}
          <octave>${octave}</octave>
        </pitch>
        <duration>1</duration>
        <type>quarter</type>
      </note>
    </measure>
  </part>
</score-partwise>`;
}

describe("pitchToNoteName — alter에 따른 음이름 변환", () => {
  it("alter 없음 (natural C) → 'C'", () => {
    const result = parseMusicXML(makeMusicXml("C", undefined, 4));
    expect(result.success).toBe(true);
    expect(result.notes![0].name).toBe("C");
  });

  it("alter=0 (natural D) → 'D'", () => {
    const result = parseMusicXML(makeMusicXml("D", 0, 4));
    expect(result.success).toBe(true);
    expect(result.notes![0].name).toBe("D");
  });

  it("alter=1 (C sharp) → 'C#'", () => {
    const result = parseMusicXML(makeMusicXml("C", 1, 4));
    expect(result.success).toBe(true);
    expect(result.notes![0].name).toBe("C#");
  });

  it("alter=-1 (D flat) → 'C#' (enharmonic 정규화)", () => {
    // Db normalizes to C# via normalizeNoteName
    const result = parseMusicXML(makeMusicXml("D", -1, 4));
    expect(result.success).toBe(true);
    expect(result.notes![0].name).toBe("C#");
  });

  it("alter=1 (F sharp) → 'F#'", () => {
    const result = parseMusicXML(makeMusicXml("F", 1, 4));
    expect(result.success).toBe(true);
    expect(result.notes![0].name).toBe("F#");
  });

  it("alter=1 (G sharp) → 'G#'", () => {
    const result = parseMusicXML(makeMusicXml("G", 1, 4));
    expect(result.success).toBe(true);
    expect(result.notes![0].name).toBe("G#");
  });
});
