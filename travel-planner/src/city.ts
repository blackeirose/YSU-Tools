import type { DayCity } from './model';
import type { PhotonPlace } from './place-search';

// Only unambiguous single-zone countries. Other selections require an explicit
// IANA zone in the same form; coordinates and multi-zone countries are not guessed.
const zones: Record<string, string> = { JP: 'Asia/Tokyo', TW: 'Asia/Taipei',
  HK: 'Asia/Hong_Kong', SG: 'Asia/Singapore', KR: 'Asia/Seoul',
  GB: 'Europe/London', DE: 'Europe/Berlin', IT: 'Europe/Rome' };
export function cityFromSearch(found: PhotonPlace): DayCity {
  return { name: found.name, region: found.state || found.county, country: found.country,
    countryCode: found.countryCode, sourceId: found.osmUrl, source: found.source,
    lat: found.lat, lng: found.lng, timezone: zones[found.countryCode ?? ''] ?? '' };
}
export function cityConfirmed(city: DayCity | undefined) {
  return !!(city?.name && city.timezone && (city.sourceId ||
    (city.lat != null && city.lng != null && Number.isFinite(city.lat) && Number.isFinite(city.lng))));
}
