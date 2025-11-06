import fetch from 'node-fetch';
import { setTimeout as delay } from 'timers/promises';

const API_BASE = 'https://places.googleapis.com/v1/places';

export type PlaceDetails = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  addressComponents?: Array<{ types?: string[]; shortText?: string; longText?: string }>;
  primaryType?: string;
  types?: string[];
};

export async function getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  const apiKey = process.env.PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new Error('PLACES_API_KEY/GOOGLE_MAPS_API_KEY is not configured');
  const url = `${API_BASE}/${encodeURIComponent(placeId)}`;

  const doFetch = async (abortSignal: AbortSignal) =>
    fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,addressComponents,primaryType,types',
      },
      signal: abortSignal,
    });

  const maxAttempts = 2; // one retry for transient failures
  const timeoutMs = 7000;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await doFetch(controller.signal);
      clearTimeout(timeout);
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        const status = res.status;
        const transient = status === 429 || (status >= 500 && status < 600);
        console.warn('[PlaceDetails] HTTP', status, res.statusText, 'placeId=', placeId, 'body=', text?.slice(0, 500));
        if (transient && attempt < maxAttempts) {
          await delay(250 * attempt);
          continue;
        }
        return null;
      }
      console.log('[PlaceDetails] fetched for placeId=', placeId);
      try {
        return (await res.json()) as PlaceDetails;
      } catch (e) {
        console.warn('[PlaceDetails] Failed to parse JSON for', placeId, e);
        return null;
      }
    } catch (e: any) {
      clearTimeout(timeout);
      const isAbort = e?.name === 'AbortError';
      console.warn('[PlaceDetails] fetch error for', placeId, isAbort ? 'timeout' : e?.message);
      if (attempt < maxAttempts) {
        await delay(200 * attempt);
        continue;
      }
      return null;
    }
  }
  return null;
}

export function deriveAdmin(components?: PlaceDetails['addressComponents']) {
  let city: string | undefined;
  let admin1: string | undefined;
  let countryCode: string | undefined;
  for (const c of components || []) {
    const t = c.types || [];
    if (!city && (t.includes('locality') || t.includes('postal_town'))) city = c.longText || c.shortText;
    // Fallback to admin level 2 if locality is absent (common in some countries)
    if (!city && t.includes('administrative_area_level_2')) city = c.longText || c.shortText;
    if (!admin1 && t.includes('administrative_area_level_1')) admin1 = c.longText || c.shortText;
    if (!countryCode && t.includes('country')) countryCode = (c.shortText || c.longText || '').toUpperCase();
  }
  return { city, admin1, countryCode };
}

export const slugifyCity = (s?: string) => (s ? s.trim().toLowerCase().replace(/\s+/g, '-') : undefined);

type NormalizedFromDetails = {
  name?: string;
  address?: string;
  lat?: number;
  lng?: number;
  city_name?: string;
  city_slug?: string;
  admin1_name?: string;
  country_code?: string;
  primary_type?: string;
  types?: string[];
  category_name?: string;
};

export function normalizeFromPlaceDetails(
  details: PlaceDetails | null,
  fallbacks?: { name?: string; address?: string; lat?: number; lng?: number; category_name?: string }
): NormalizedFromDetails | null {
  if (!details) return null;
  const name = details.displayName?.text || fallbacks?.name;
  const address = details.formattedAddress || fallbacks?.address;
  const lat = details.location?.latitude ?? fallbacks?.lat;
  const lng = details.location?.longitude ?? fallbacks?.lng;
  const admin = deriveAdmin(details.addressComponents);
  const city_name = admin.city;
  const city_slug = slugifyCity(admin.city);
  const admin1_name = admin.admin1;
  const country_code = admin.countryCode;
  const primary_type = details.primaryType;
  const types = details.types;
  const category_name = fallbacks?.category_name || primary_type;
  return { name, address, lat, lng, city_name, city_slug, admin1_name, country_code, primary_type, types, category_name };
}



