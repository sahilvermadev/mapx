"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapPrimaryTypeToCategoryName = mapPrimaryTypeToCategoryName;
/**
 * Lightweight mapping from Google Places primaryType to our category names.
 * Keep names aligned with your `categories` table values.
 */
function mapPrimaryTypeToCategoryName(primaryType, types) {
    if (!primaryType && (!types || types.length === 0))
        return undefined;
    const t = (primaryType || '').toLowerCase();
    const typeSet = new Set((types || []).map(s => String(s).toLowerCase()));
    const table = {
        restaurant: 'Restaurants',
        cafe: 'Cafes',
        bar: 'Bars',
        bakery: 'Bakeries',
        meal_takeaway: 'Takeaway',
        meal_delivery: 'Delivery',
        supermarket: 'Groceries',
        grocery_or_supermarket: 'Groceries',
        clothing_store: 'Shopping',
        shopping_mall: 'Shopping',
        electronics_store: 'Electronics',
        book_store: 'Books',
        movie_theater: 'Entertainment',
        museum: 'Museums',
        park: 'Parks',
        lodging: 'Hotels',
        gym: 'Fitness',
        spa: 'Wellness',
        pharmacy: 'Pharmacy',
        hospital: 'Healthcare',
        doctor: 'Healthcare',
        beauty_salon: 'Beauty',
    };
    // Direct match
    if (t && table[t])
        return table[t];
    // Cuisine-specific restaurants → Restaurants (e.g., italian_restaurant, chinese_restaurant)
    if (t.endsWith('_restaurant') || typeSet.has('restaurant'))
        return 'Restaurants';
    // Generic fallbacks from types[]
    for (const key of Object.keys(table)) {
        if (typeSet.has(key))
            return table[key];
    }
    return undefined;
}
