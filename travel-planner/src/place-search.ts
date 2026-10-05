import type { Place } from "./model";

export type PhotonPlace = {
  name: string;
  city: string;
  localityCity: string;
  county: string;
  state: string;
  administrativeArea: string;
  address: string;
  category: Place["category"];
  lat: number;
  lng: number;
  source: string;
  osmUrl: string;
  mapsUrl: string;
};
const cityKey = (value: string) => value.normalize("NFKD").toLocaleLowerCase()
  .replace(/\p{M}/gu, "").replace(/[^\p{L}\p{N}]/gu, "");
const cityNames: Record<string, string[]> = { 東京: ["東京", "Tokyo"], 大阪: ["大阪", "Osaka"],
  京都: ["京都", "Kyoto"], 名古屋: ["名古屋", "Nagoya"] };
const tokyoWards = new Set(["adachi", "arakawa", "bunkyo", "chiyoda", "chuo", "edogawa",
  "itabashi", "katsushika", "kita", "koto", "meguro", "minato", "nakano", "nerima",
  "ota", "setagaya", "shibuya", "shinagawa", "shinjuku", "suginami", "sumida", "taito", "toshima"]);
/** Require the city itself, not a broad state/county substring (York != New York). */
export function placeInCity(place: PhotonPlace, requestedCity: string): boolean {
  const aliases = (cityNames[requestedCity] ?? [requestedCity]).map(cityKey);
  const local = cityKey(place.localityCity);
  if (local && aliases.includes(local)) return true;
  if (local) return aliases.includes("tokyo") && cityKey(place.state) === "tokyo" &&
    tokyoWards.has(local.replace(/(?:city|ward)$/u, ""));
  return aliases.includes(cityKey(place.county));
}
type Feature = {
  geometry?: { coordinates?: unknown };
  properties?: Record<string, unknown>;
};

const category = (value: unknown): Place["category"] => {
  const kind = String(value ?? "").toLowerCase();
  if (["restaurant", "cafe", "fast_food", "bar", "food_court"].includes(kind)) return "美食";
  if (["hotel", "hostel", "guest_house", "motel"].includes(kind)) return "住宿";
  if (["station", "bus_stop", "airport", "tram_stop"].includes(kind)) return "交通";
  return "景點";
};
export function parsePhoton(input: unknown, checkedAt = new Date().toISOString(), term = "", maxResults = 5): PhotonPlace[] {
  const features = (input as { features?: unknown })?.features;
  if (!Array.isArray(features)) return [];
  const normalizedTerm = term.trim().toLocaleLowerCase();
  const ranked = [...features].sort((a: Feature, b: Feature) => {
    const score = (feature: Feature) => {
      const kind = String(feature?.properties?.osm_value ?? "");
      const name = String(feature?.properties?.name ?? "").toLocaleLowerCase();
      const kindScore = ["theme_park", "museum", "attraction", "restaurant", "cafe"].includes(kind) ? 20 :
        ["bus_stop", "stop", "station", "retail", "toys"].includes(kind) ? -8 : 0;
      return kindScore + (normalizedTerm && name === normalizedTerm ? 12 : 0);
    };
    return score(b) - score(a);
  });
  const seen = new Set<string>();
  return ranked.flatMap((feature: Feature) => {
    const p = feature?.properties;
    const coords = feature?.geometry?.coordinates;
    if (!p || !Array.isArray(coords) || coords.length < 2 ||
      typeof p.name !== "string" || !p.name.trim() ||
      !Number.isFinite(Number(coords[0])) || !Number.isFinite(Number(coords[1]))) return [];
    const lng = Number(coords[0]), lat = Number(coords[1]);
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) return [];
    const type = ({ N: "node", W: "way", R: "relation" } as Record<string, string>)[String(p.osm_type ?? "")];
    if (!type || !/^\d+$/.test(String(p.osm_id ?? ""))) return [];
    const localityCity = String(p.city ?? "").slice(0, 200);
    const county = String(p.county ?? "").slice(0, 200);
    const state = String(p.state ?? "").slice(0, 200);
    const city = localityCity || county || state;
    const administrativeArea = [p.city, p.county, p.state].filter((x) => typeof x === "string").join(" · ").slice(0, 300);
    const osmUrl = `https://www.openstreetmap.org/${type}/${p.osm_id}`;
    const identity = osmUrl;
    if (seen.has(identity)) return [];
    seen.add(identity);
    const address = [p.street, p.housenumber, p.postcode, city, p.country].filter((x) => typeof x === "string" && x.trim()).join(" · ").slice(0, 2000);
    return [{
      name: p.name.trim().slice(0, 200), city, localityCity, county, state, administrativeArea, address,
      category: category(p.osm_value), lat, lng,
      osmUrl, source: `OpenStreetMap / Photon · ${osmUrl} · ${checkedAt}`,
      mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`,
    }];
  }).slice(0, maxResults);
}

export async function searchPhoton(term: string, cityHint: string, broaden = false, http: typeof fetch = fetch,
  layer?: "city", maxResults = 5) {
  const clean = term.trim();
  if (clean.length < (layer === "city" ? 2 : 3) || clean.length > 100) return [];
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", !broaden && cityHint && !clean.toLocaleLowerCase().includes(cityHint.toLocaleLowerCase()) ? `${cityHint} ${clean}` : clean);
  url.searchParams.set("limit", "20");
  url.searchParams.set("lang", "en");
  if (layer === "city") for (const value of ["city", "state", "locality"]) url.searchParams.append("layer", value);
  const response = await http(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("外部地點搜尋暫時無法使用；仍可手動儲存地點。");
  return parsePhoton(await response.json(), new Date().toISOString(), clean, maxResults);
}

export function fillPlaceFromPhoton(place: Place, found: PhotonPlace): Place {
  return {
    ...place,
    name: found.name,
    city: found.city,
    address: found.address,
    category: found.category,
    lat: found.lat,
    lng: found.lng,
    mapsUrl: found.mapsUrl,
    source: found.source,
  };
}
