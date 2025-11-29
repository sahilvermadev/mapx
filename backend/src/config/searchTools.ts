/**
 * Function Calling Tool Definitions for Structured Search
 * 
 * Defines the search_my_network tool for Groq/OpenAI function calling.
 */

export const SEARCH_MY_NETWORK_TOOL = {
  name: 'search_my_network',
  description: 'Search private recommendations with perfect filters. Use this to find places and services from your trusted network with guaranteed accuracy for location, freshness, trust, and price.',
  parameters: {
    type: 'object',
    properties: {
      intent: {
        type: 'string',
        description: 'Core need or search intent, e.g. "sandwich", "quiet café", "plumber", "romantic dinner spot"'
      },
      location: {
        oneOf: [
          {
            type: 'string',
            description: 'Area name like "bandra", "goa", "lisbon", "hauz khas". Will be geocoded to coordinates.'
          },
          {
            type: 'null',
            description: 'Search near the user\'s current GPS coordinates (provided separately in the request). Use this when user says "near me", "nearby", "close to me", etc.'
          }
        ]
      },
      user_lat: {
        type: ['number', 'null'],
        description: 'User\'s current latitude (from browser geolocation). Use a number (e.g., 28.6139) or JSON null (not the string "null"). Required when location is null for "near me" searches.'
      },
      user_lng: {
        type: ['number', 'null'],
        description: 'User\'s current longitude (from browser geolocation). Use a number (e.g., 77.2090) or JSON null (not the string "null"). Required when location is null for "near me" searches.'
      },
      max_price_inr: {
        type: ['integer', 'null'],
        description: 'Maximum price in INR. Example anchors: 500 = budget, 1000 = moderate, 2000 = higher-end, 5000 = luxury. null = no price filter.'
      },
      min_rating: {
        type: ['number', 'null'],
        description: 'Minimum rating threshold. Example anchors: 4.0 = good, 4.5 = very good, 4.7 = excellent. null = no rating filter.'
      },
      require_fresh: {
        type: 'boolean',
        description: 'If true, only return recommendations visited within the last 90 days (fresh experiences).'
      },
      require_high_trust: {
        type: 'boolean',
        description: 'If true, only return recommendations from users with trust_score >= 0.75 (highly trusted reviewers).'
      },
      content_type: {
        type: ['string', 'null'],
        enum: ['place', 'service', null],
        description: 'Filter results by content type. "place" for physical locations (restaurants, cafes, shops, venues). "service" for service providers (plumbers, tutors, instructors, contractors). Use null to search both types.'
      },
      limit: {
        type: 'integer',
        enum: [1, 2, 3],
        default: 2,
        description: 'Maximum number of results to return. 1 = single best match, 2 = top two, 3 = top three.'
      }
    },
    required: ['intent']
  }
} as const;

export const ASK_MY_NETWORK_TOOL = {
  name: 'ask_my_network',
  description: 'Use when the network lacks fresh answers. Draft the exact ask you want to send to trusted friends so they can respond.',
  parameters: {
    type: 'object',
    properties: {
      intent: {
        type: 'string',
        description: 'Restate the user’s need in plain language, e.g. "Need a killer vegetarian tasting menu in Bandra this week".'
      },
      reason: {
        type: 'string',
        description: 'Explain why existing data is insufficient (e.g. stale, outside radius, low trust).'
      },
      urgency: {
        type: 'string',
        enum: ['low', 'normal', 'high'],
        description: 'How soon the user needs help.'
      },
      preferred_circle: {
        type: ['string', 'null'],
        description: 'Optional list or short description of who should be pinged (e.g. "coffee crew").'
      }
    },
    required: ['intent', 'reason']
  }
} as const;

export type AskMyNetworkArgs = {
  intent: string;
  reason: string;
  urgency?: 'low' | 'normal' | 'high';
  preferred_circle?: string | null;
};

