import { describe, expect, it } from 'vitest';
import { shouldAutoStartBackground } from '../src/TripBackground';
import { cityFromSearch } from '../src/city';
import { parsePhoton } from '../src/place-search';

describe('new-trip city and persistent background intent', () => {
  it('retains a selected Osaka identity, actual search coordinates and IANA zone', () => {
    const [found] = parsePhoton({ features: [{ geometry: { coordinates: [135.5, 34.7] },
      properties: { name: 'Osaka', country: 'Japan', countrycode: 'JP', state: 'Osaka',
        osm_type: 'R', osm_id: 123, osm_value: 'city' } }] });
    expect(cityFromSearch(found)).toMatchObject({ name: 'Osaka', country: 'Japan',
      countryCode: 'JP', sourceId: 'https://www.openstreetmap.org/relation/123',
      timezone: 'Asia/Tokyo', lat: 34.7, lng: 135.5 });
  });
  it('does not guess a timezone for an ambiguous multi-zone country', () => {
    const [found] = parsePhoton({ features: [{ geometry: { coordinates: [-89, 39] },
      properties: { name: 'Springfield', country: 'United States', countrycode: 'US',
        osm_type: 'R', osm_id: 124 } }] });
    expect(cityFromSearch(found).timezone).toBe('');
  });
  it('auto-starts a new v2 intent on the persistent preview, but never an old intent or saved image', () => {
    expect(shouldAutoStartBackground('preview-v1', true, 'none', true, false, 2)).toBe(true);
    expect(shouldAutoStartBackground('v1', true, 'none', true, false, undefined)).toBe(false);
    expect(shouldAutoStartBackground('preview-v1', true, 'ready', true, false, 2)).toBe(false);
    expect(shouldAutoStartBackground('preview-v1', true, 'none', true, true, 2)).toBe(false);
  });
});
