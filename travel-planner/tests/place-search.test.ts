import { describe, expect, it } from "vitest";
import { blankPlace } from "../src/model";
import { fillPlaceFromPhoton, parsePhoton, searchPhoton } from "../src/place-search";

const raw = { features: [{
  geometry: { coordinates: [139.8814172, 35.6326586] },
  properties: { name: "Tokyo Disneyland", city: "Urayasu", country: "Japan", osm_type: "N", osm_id: 1282875870, osm_value: "theme_park" },
}] };
describe("Photon place results", () => {
  it("copies only real coordinates and source fields into an editable place", () => {
    const found = parsePhoton(raw, "2030-01-01T00:00:00Z")[0];
    expect(found).toMatchObject({ name: "Tokyo Disneyland", lat: 35.6326586, lng: 139.8814172 });
    expect(found.source).toContain("https://www.openstreetmap.org/node/1282875870");
    const place = fillPlaceFromPhoton(blankPlace("owner", crypto.randomUUID(), "DISNEY"), found);
    expect(place).toMatchObject({ name: "Tokyo Disneyland", address: "Urayasu · Japan", lat: 35.6326586 });
    expect(parsePhoton({ features: [{ ...raw.features[0], geometry: { coordinates: [0, 0] } }] })).toEqual([]);
  });
  it("biases Tokyo but offers broader search and preserves manual fallback on network error", async () => {
    const calls: string[] = [];
    const http = (async (url: URL) => { calls.push(url.toString()); return new Response(JSON.stringify(raw)); }) as typeof fetch;
    expect(await searchPhoton("DISNEY", "Tokyo", false, http)).toHaveLength(1);
    await searchPhoton("DISNEY", "Tokyo", true, http);
    expect(new URL(calls[0]).searchParams.get("q")).toBe("Tokyo DISNEY");
    expect(new URL(calls[1]).searchParams.get("q")).toBe("DISNEY");
    expect(await searchPhoton("Di", "Tokyo", false, http)).toEqual([]);
    await searchPhoton("東京", "", false, http, "city");
    expect(new URL(calls[2]).searchParams.getAll("layer")).toEqual(["city", "state", "locality"]);
  });
  it("surfaces distinct parks ahead of similarly named hotels in an ambiguous Disney query", () => {
    const hotels = Array.from({ length: 10 }, (_, index) => ({
      geometry: { coordinates: [139.8 + index / 1000, 35.6] },
      properties: { name: `Tokyo Disney Hotel ${index}`, city: "Urayasu", osm_type: "N", osm_id: index + 10, osm_value: "hotel" },
    }));
    const parks = ["Tokyo DisneySea", "Tokyo Disneyland"].map((name, index) => ({
      geometry: { coordinates: [139.88 + index / 1000, 35.63] },
      properties: { name, city: "Urayasu", osm_type: "N", osm_id: index + 100, osm_value: "theme_park" },
    }));
    expect(parsePhoton({ features: [...hotels, ...parks] }, "2030-01-01T00:00:00Z", "DISNEY").slice(0, 2).map((x) => x.name))
      .toEqual(["Tokyo DisneySea", "Tokyo Disneyland"]);
  });
});
