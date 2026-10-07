export type AssistantAudio = { mime: "audio/webm" | "audio/mp4" | "audio/wav"; base64: string };

/** A selected file uses the same private, authenticated audio request as the recorder. */
export async function assistantAudioFromFile(file: File): Promise<AssistantAudio> {
  if (!file.size || file.size > 200_000) throw new Error("音訊需小於 200 KB；請選較短的語音檔");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
  const mime = ascii(0, 4) === "RIFF" && ascii(8, 12) === "WAVE" ? "audio/wav"
    : bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3 ? "audio/webm"
      : ascii(4, 8) === "ftyp" ? "audio/mp4" : null;
  if (!mime) throw new Error("請選擇 WAV、WebM 或 MP4 音訊檔");
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return { mime, base64: btoa(binary) };
}
