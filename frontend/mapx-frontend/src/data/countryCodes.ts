export interface CountryCode {
  code: string; // e.g., "+1", "+91"
  name: string; // e.g., "United States", "India"
  flag?: string; // Optional emoji flag
  isoCode?: string; // Optional ISO 3166-1 alpha-2 code
}

export const COMMON_COUNTRY_CODES: CountryCode[] = [
  { code: "+1", name: "United States", flag: "🇺🇸", isoCode: "US" },
  { code: "+1", name: "Canada", flag: "🇨🇦", isoCode: "CA" },
  { code: "+91", name: "India", flag: "🇮🇳", isoCode: "IN" },
  { code: "+44", name: "United Kingdom", flag: "🇬🇧", isoCode: "GB" },
  { code: "+61", name: "Australia", flag: "🇦🇺", isoCode: "AU" },
  { code: "+49", name: "Germany", flag: "🇩🇪", isoCode: "DE" },
  { code: "+33", name: "France", flag: "🇫🇷", isoCode: "FR" },
  { code: "+81", name: "Japan", flag: "🇯🇵", isoCode: "JP" },
  { code: "+86", name: "China", flag: "🇨🇳", isoCode: "CN" },
  { code: "+55", name: "Brazil", flag: "🇧🇷", isoCode: "BR" },
  { code: "+52", name: "Mexico", flag: "🇲🇽", isoCode: "MX" },
  { code: "+34", name: "Spain", flag: "🇪🇸", isoCode: "ES" },
  { code: "+39", name: "Italy", flag: "🇮🇹", isoCode: "IT" },
  { code: "+31", name: "Netherlands", flag: "🇳🇱", isoCode: "NL" },
  { code: "+46", name: "Sweden", flag: "🇸🇪", isoCode: "SE" },
  { code: "+47", name: "Norway", flag: "🇳🇴", isoCode: "NO" },
  { code: "+45", name: "Denmark", flag: "🇩🇰", isoCode: "DK" },
  { code: "+65", name: "Singapore", flag: "🇸🇬", isoCode: "SG" },
  { code: "+971", name: "UAE", flag: "🇦🇪", isoCode: "AE" },
  { code: "+966", name: "Saudi Arabia", flag: "🇸🇦", isoCode: "SA" },
  { code: "+27", name: "South Africa", flag: "🇿🇦", isoCode: "ZA" },
  { code: "+82", name: "South Korea", flag: "🇰🇷", isoCode: "KR" },
  { code: "+7", name: "Russia", flag: "🇷🇺", isoCode: "RU" },
  { code: "+90", name: "Turkey", flag: "🇹🇷", isoCode: "TR" },
  { code: "+41", name: "Switzerland", flag: "🇨🇭", isoCode: "CH" },
  { code: "+32", name: "Belgium", flag: "🇧🇪", isoCode: "BE" },
  { code: "+43", name: "Austria", flag: "🇦🇹", isoCode: "AT" },
  { code: "+351", name: "Portugal", flag: "🇵🇹", isoCode: "PT" },
  { code: "+353", name: "Ireland", flag: "🇮🇪", isoCode: "IE" },
  { code: "+64", name: "New Zealand", flag: "🇳🇿", isoCode: "NZ" },
];

// Default country code (India)
export const DEFAULT_COUNTRY_CODE = "+91";








