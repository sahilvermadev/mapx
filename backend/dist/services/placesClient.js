"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.slugifyCity = void 0;
exports.getPlaceDetails = getPlaceDetails;
exports.deriveAdmin = deriveAdmin;
exports.enrichPlaceFromGoogle = enrichPlaceFromGoogle;
const node_fetch_1 = __importDefault(require("node-fetch"));
const API_BASE = 'https://places.googleapis.com/v1/places';
async function getPlaceDetails(placeId) {
    const apiKey = process.env.PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey)
        throw new Error('PLACES_API_KEY/GOOGLE_MAPS_API_KEY is not configured');
    const url = `${API_BASE}/${encodeURIComponent(placeId)}`;
    const res = await (0, node_fetch_1.default)(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,addressComponents,primaryType,types',
        },
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.warn('[PlaceDetails] HTTP', res.status, res.statusText, 'placeId=', placeId, 'body=', text?.slice(0, 500));
        return null;
    }
    console.log('[PlaceDetails] fetched for placeId=', placeId);
    return (await res.json());
}
function deriveAdmin(components) {
    let city;
    let admin1;
    let countryCode;
    for (const c of components || []) {
        const t = c.types || [];
        if (!city && (t.includes('locality') || t.includes('postal_town')))
            city = c.longText || c.shortText;
        if (!admin1 && t.includes('administrative_area_level_1'))
            admin1 = c.longText || c.shortText;
        if (!countryCode && t.includes('country'))
            countryCode = (c.shortText || c.longText || '').toUpperCase();
    }
    return { city, admin1, countryCode };
}
const slugifyCity = (s) => (s ? s.trim().toLowerCase().replace(/\s+/g, '-') : undefined);
exports.slugifyCity = slugifyCity;
/**
 * Fetch Place Details and return normalized fields for persistence.
 * Accepts optional fallbacks (name/address/lat/lng) and only overrides when present in the response.
 */
async function enrichPlaceFromGoogle(googlePlaceId, fallbacks) {
    const details = await getPlaceDetails(googlePlaceId);
    if (!details)
        return null;
    const { city, admin1, countryCode } = deriveAdmin(details.addressComponents);
    const enriched = {
        name: details.displayName?.text || fallbacks?.name,
        address: details.formattedAddress || fallbacks?.address,
        lat: details.location?.latitude ?? fallbacks?.lat,
        lng: details.location?.longitude ?? fallbacks?.lng,
        city_name: city,
        city_slug: (0, exports.slugifyCity)(city),
        admin1_name: admin1,
        country_code: countryCode,
        primary_type: details.primaryType,
        types: details.types,
    };
    return enriched;
}
