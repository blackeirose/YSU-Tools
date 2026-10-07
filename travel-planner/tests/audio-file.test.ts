import { describe, expect, it } from "vitest";
import { assistantAudioFromFile } from "../src/audio-file";

describe("pre-recorded assistant audio", () => {
  it("accepts a short WAV by its bytes, even when the browser leaves MIME empty", async () => {
    const bytes = new Uint8Array(44);
    bytes.set(new TextEncoder().encode("RIFF"), 0);
    bytes.set(new TextEncoder().encode("WAVE"), 8);
    const result = await assistantAudioFromFile(new File([bytes], "synthetic.wav"));
    expect(result.mime).toBe("audio/wav");
    expect(result.base64).toBe(btoa(String.fromCharCode(...bytes)));
  });

  it("rejects empty, oversized and mislabeled files before a paid request", async () => {
    await expect(assistantAudioFromFile(new File([], "empty.wav"))).rejects.toThrow("200 KB");
    await expect(assistantAudioFromFile(new File([new Uint8Array(200_001)], "large.wav"))).rejects.toThrow("200 KB");
    await expect(assistantAudioFromFile(new File(["not audio"], "fake.wav", { type: "audio/wav" }))).rejects.toThrow("WAV");
  });
});
