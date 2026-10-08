export type AssistantAudio = { mime: "audio/webm" | "audio/mp4" | "audio/wav"; base64: string };

async function decodableAudio(bytes: Uint8Array): Promise<void> {
  if (typeof AudioContext === "undefined") throw new Error("此瀏覽器無法驗證音訊檔，請使用錄音功能");
  const context = new AudioContext();
  try {
    const decoded = await context.decodeAudioData(bytes.slice().buffer);
    if (!decoded.numberOfChannels || !decoded.length) throw new Error("音訊檔沒有可播放內容");
  } catch { throw new Error("音訊檔無法解碼或沒有音軌，未送出"); }
  finally { await context.close(); }
}

/** A selected file uses the same private, authenticated audio request as the recorder. */
export async function assistantAudioFromFile(file: File,
  verifyPlayable: (bytes: Uint8Array) => Promise<void> = decodableAudio): Promise<AssistantAudio> {
  if (!file.size || file.size > 200_000) throw new Error("音訊需小於 200 KB；請選較短的語音檔");
  if (file.type.startsWith("video/")) throw new Error("請選擇音訊檔，不可上傳影片");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
  const mime = bytes.length > 44 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WAVE" ? "audio/wav"
    : bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3 ? "audio/webm"
      : ascii(4, 8) === "ftyp" && ["M4A ", "M4B "].includes(ascii(8, 12)) ? "audio/mp4" : null;
  if (!mime) throw new Error("請選擇 WAV、WebM 或 M4A 音訊檔");
  await verifyPlayable(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return { mime, base64: btoa(binary) };
}

/** Closing the dialog while the file is decoding must never begin a paid request. */
export async function sendPreparedAudio(file: File, isCancelled: () => boolean,
  send: (audio: AssistantAudio) => Promise<boolean>,
  prepare: (file: File) => Promise<AssistantAudio> = assistantAudioFromFile): Promise<boolean> {
  const audio = await prepare(file);
  if (isCancelled()) return false;
  return send(audio);
}
