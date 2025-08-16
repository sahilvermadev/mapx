// export type Category = 'restaurant' | 'cafe' | 'bar' | 'park' | 'hiking' | 'beach' | 'museum' | 'shopping' | 'hotel' | 'other';

// export interface PlaceIcon {
//   category: Category;
//   rating: number;
//   name: string;
//   address?: string;
//   iconBaseUri?: string;
//   iconBackgroundColor?: string;
// }

// export const getCategoryFromTypes = (types: string[]): Category => {
//   if (types.includes('restaurant')) return 'restaurant';
//   if (types.includes('cafe')) return 'cafe';
//   if (types.includes('bar')) return 'bar';
//   if (types.includes('park')) return 'park';
//   if (types.includes('natural_feature')) return 'hiking';
//   if (types.includes('establishment')) return 'other';
//   return 'other';
// };

// export const getRatingColor = (rating: number): string => {
//   if (rating >= 4.5) return '#fbbf24'; // gold
//   if (rating >= 4.0) return '#34d399'; // green
//   if (rating >= 3.5) return '#60a5fa'; // blue
//   if (rating >= 3.0) return '#f59e0b'; // orange
//   return '#ef4444'; // red
// };

// export const getRatingDisplay = (rating: number): string => {
//   return rating.toFixed(1);
// };

// export const createCustomMarker = (place: PlaceIcon): google.maps.Marker => {
//   const ratingColor = getRatingColor(place.rating);
//   const ratingDisplay = getRatingDisplay(place.rating);
  
//   // Use Google Places API icon if available, otherwise fallback to custom SVG
//   let iconUrl: string;
  
//   if (place.iconBaseUri) {
//     // Use Google's official place icon
//     iconUrl = `${place.iconBaseUri}.svg`;
//   } else {
//     // Fallback to custom SVG with category icon
//     const svgContent = `
//       <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
//         <defs>
//           <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
//             <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="rgba(0,0,0,0.3)"/>
//           </filter>
//         </defs>
//         <g filter="url(#shadow)">
//           <circle cx="20" cy="20" r="16" fill="rgba(255,255,255,0.95)" stroke="${ratingColor}" stroke-width="2"/>
//           <g transform="translate(20, 20) scale(0.6)">
//             ${getCategoryIcon(place.category)}
//           </g>
//           <circle cx="28" cy="12" r="8" fill="${ratingColor}" stroke="white" stroke-width="1.5"/>
//           <text x="28" y="15" text-anchor="middle" fill="white" font-size="8" font-weight="bold">${ratingDisplay}</text>
//         </g>
//       </svg>
//     `;
//     iconUrl = `data:image/svg+xml;base64,${btoa(svgContent)}`;
//   }
  
//   return new google.maps.Marker({
//     icon: {
//       url: iconUrl,
//       scaledSize: new google.maps.Size(40, 40),
//       anchor: new google.maps.Point(20, 20),
//     },
//   });
// };

// // Fallback category icons (only used when Google Places API doesn't provide icons)
// export const getCategoryIcon = (category: Category): string => {
//   const icons = {
//     restaurant: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z"/></svg>`,
//     cafe: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 3H4v10c0 2.21 1.79 4 4 4h6c2.21 0 4-1.79 4-4v-3h2c1.11 0 2-.9 2-2V5c0-1.11-.89-2-2-2zM9.5 7.28l1.5 1.5V11H8V8.78l1.5-1.5zM16 13c0 1.1-.9 2-2 2H8c-1.1 0-2-.9-2-2V5h3v1.72l-1.5 1.5V11h4V8.22L12.5 6.72V5H16v8z"/></svg>`,
//     bar: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 5V3H3v2l8 9v5H6v2h12v-2h-5v-5l8-9zM7.43 7L5.66 5h12.69l-1.78 2H7.43z"/></svg>`,
//     park: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`,
//     hiking: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 6l-3.75 5 2.85 3.8-1.6 1.2C7.35 13.2 4 16.85 4 21h2c0-3.32 2.69-6 6-6s6 2.68 6 6h2c0-4.15-3.35-7.8-7.5-8.8l1.6-1.2L14 6z"/></svg>`,
//     beach: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.127 14.56l1.43-1.43 6.44 6.443L19.57 21l-6.44-6.44zM15 4a2 2 0 0 1 2 2 2 2 0 0 1-2 2 2 2 0 0 1-2-2 2 2 0 0 1 2-2m0-2a4 4 0 0 0-4 4 4 4 0 0 0 4 4 4 4 0 0 0 4-4 4 4 0 0 0-4-4z"/></svg>`,
//     museum: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`,
//     shopping: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12L8.1 13h7.45c.75 0 1.41-.41 1.75-1.03L21.7 4H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/></svg>`,
//     hotel: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 13c1.65 0 3-1.35 3-3S8.65 7 7 7s-3 1.35-3 3 1.35 3 3 3zm12-6h-8v7H3V5H1v15h2v-3h18v3h2v-9c0-2.21-1.79-4-4-4z"/></svg>`,
//     other: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`,
//   };
//   return icons[category] || icons.other;
// }; 