import { describe, expect, it } from "vitest";
import { inTrip, relativeAmbiguous, relativeTarget, relativeUnsupported, travelClock } from "../src/server/travel-clock";

const fields = (zone: string, selectedZone?: string, start = "2030-01-01", end = "2030-01-10") => ({
  start: { stringValue: start }, end: { stringValue: end }, timezone: { stringValue: zone },
  dayCities: { mapValue: { fields: { "2030-01-02": { mapValue: { fields: {
    timezone: { stringValue: selectedZone ?? zone },
  } } } } } },
});

describe("trusted destination clock", () => {
  it("gives Tokyo, Honolulu and Los Angeles different local days for the same instant", () => {
    const instant = new Date("2030-01-02T01:15:00Z");
    expect(travelClock(fields("Asia/Tokyo"), "2030-01-02", instant)?.destinationLocalDate).toBe("2030-01-02");
    expect(travelClock(fields("Pacific/Honolulu"), "2030-01-02", instant)?.destinationLocalDate).toBe("2030-01-01");
    expect(travelClock(fields("America/Los_Angeles"), "2030-01-02", instant)?.destinationLocalDate).toBe("2030-01-01");
  });
  it("uses selected-day city zone before trip default, and rejects invalid IANA zones", () => {
    const instant = new Date("2030-01-02T01:15:00Z");
    const crossCity = travelClock(fields("Asia/Tokyo", "Pacific/Honolulu"), "2030-01-02", instant)!;
    expect(crossCity.timezone).toBe("Asia/Tokyo");
    expect(crossCity.selectedDayTimezone).toBe("Pacific/Honolulu");
    expect(relativeTarget("今天去東京塔", crossCity)?.day).toBe("2030-01-02");
    expect(relativeTarget("畫面這一天去海邊", crossCity)?.timezone).toBe("Pacific/Honolulu");
    const boundary = travelClock(fields("Asia/Tokyo", "Pacific/Honolulu"), "2030-01-02",
      new Date("2029-12-31T16:15:00Z"))!;
    expect(relativeTarget("今天加晚餐", boundary)?.day).toBe("2030-01-01");
    expect(travelClock(fields("Invalid/Zone", "Invalid/Zone"), "2030-01-02", instant)).toBeNull();
  });
  it("distinguishes today, tomorrow and selected day across midnight and DST", () => {
    const before = travelClock(fields("America/Los_Angeles"), "2030-01-02", new Date("2030-03-10T07:59:00Z"))!;
    const after = travelClock(fields("America/Los_Angeles"), "2030-01-02", new Date("2030-03-10T10:01:00Z"))!;
    expect(before.destinationLocalDate).toBe("2030-03-09");
    expect(after.destinationLocalDate).toBe("2030-03-10");
    expect(relativeTarget("今天吃飯", after)?.day).toBe("2030-03-10");
    expect(relativeTarget("明天吃飯", after)?.day).toBe("2030-03-11");
    expect(relativeTarget("明早吃飯", after)?.day).toBe("2030-03-11");
    expect(relativeTarget("明日吃飯", after)?.day).toBe("2030-03-11");
    expect(relativeTarget("今晚吃飯", after)?.day).toBe("2030-03-10");
    expect(relativeTarget("畫面這一天吃飯", after)?.day).toBe("2030-01-02");
    expect(relativeAmbiguous("今晚或明早吃飯")).toBe(true);
    expect(relativeUnsupported("後天把行程移到下午")).toBe(true);
  });
  it("does not silently turn a historical demo or future trip into today", () => {
    const historical = travelClock(fields("Asia/Tokyo", undefined, "2023-01-06", "2023-01-15"), "2023-01-08", new Date("2026-10-03T12:00:00Z"))!;
    const future = travelClock(fields("Asia/Tokyo"), "2030-01-02", new Date("2026-10-03T12:00:00Z"))!;
    expect(inTrip(relativeTarget("今天加餐廳", historical)!.day, historical)).toBe(false);
    expect(inTrip(relativeTarget("今天加餐廳", future)!.day, future)).toBe(false);
    expect(inTrip(relativeTarget("畫面這一天加餐廳", future)!.day, future)).toBe(true);
    expect(relativeAmbiguous("今天或畫面這一天加餐廳")).toBe(true);
  });
});
