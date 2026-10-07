import { describe, expect, it } from "vitest";
import { assistantAudioFromFile, sendPreparedAudio } from "../src/audio-file";

describe("pre-recorded assistant audio", () => {
  it("accepts a short WAV by its bytes, even when the browser leaves MIME empty", async () => {
    const bytes = new Uint8Array(48);
    bytes.set(new TextEncoder().encode("RIFF"), 0);
    bytes.set(new TextEncoder().encode("WAVE"), 8);
    let checked = false;
    const result = await assistantAudioFromFile(new File([bytes], "synthetic.wav"), async () => { checked = true; });
    expect(checked).toBe(true);
    expect(result.mime).toBe("audio/wav");
    expect(result.base64).toBe(btoa(String.fromCharCode(...bytes)));
  });

  it("rejects empty, oversized and mislabeled files before a paid request", async () => {
    await expect(assistantAudioFromFile(new File([], "empty.wav"))).rejects.toThrow("200 KB");
    await expect(assistantAudioFromFile(new File([new Uint8Array(200_001)], "large.wav"))).rejects.toThrow("200 KB");
    await expect(assistantAudioFromFile(new File(["not audio"], "fake.wav", { type: "audio/wav" }))).rejects.toThrow("WAV");
    const video = new Uint8Array(32); video.set(new TextEncoder().encode("ftypisom"), 4);
    await expect(assistantAudioFromFile(new File([video], "clip.mp4", { type: "video/mp4" }))).rejects.toThrow("影片");
    await expect(assistantAudioFromFile(new File([video], "clip.mp4"))).rejects.toThrow("M4A");
  });

  it("does not start a request when the dialog closes during file decoding", async () => {
    let finish!: (value: { mime: "audio/wav"; base64: string }) => void;
    let cancelled = false, calls = 0;
    const promise = sendPreparedAudio(new File(["synthetic"], "sample.wav"), () => cancelled,
      async () => { calls++; return true; },
      async () => new Promise(resolve => { finish = resolve; }));
    cancelled = true;
    finish({ mime: "audio/wav", base64: "dGVzdA==" });
    expect(await promise).toBe(false);
    expect(calls).toBe(0);
  });

  it("does not upload an old trip's audio after route teardown and remount", async () => {
    let finish!: (value: { mime: "audio/wav"; base64: string }) => void;
    let generation = 0, calls = 0;
    const startedOn = generation;
    const promise = sendPreparedAudio(new File(["synthetic"], "sample.wav"), () => generation !== startedOn,
      async () => { calls++; return true; },
      async () => new Promise(resolve => { finish = resolve; }));
    generation += 1;
    finish({ mime: "audio/wav", base64: "dGVzdA==" });
    expect(await promise).toBe(false);
    expect(calls).toBe(0);
  });

  it("does not send audio decoded for an earlier day or selected item", async () => {
    let finish!: (value: { mime: "audio/wav"; base64: string }) => void;
    let contextVersion = 0, calls = 0;
    const startedOn = contextVersion;
    const promise = sendPreparedAudio(new File(["synthetic"], "sample.wav"), () => contextVersion !== startedOn,
      async () => { calls++; return true; },
      async () => new Promise(resolve => { finish = resolve; }));
    contextVersion += 1; // Browser Back or another card changes the assistant context before decoding ends.
    finish({ mime: "audio/wav", base64: "dGVzdA==" });
    expect(await promise).toBe(false);
    expect(calls).toBe(0);
  });
});
