// ============================================================================
// AGENT: BRIDGE - Types & Schema
// Finds 1-3 cross-promotion podcast matches with real, actionable links
// ============================================================================

// ============================================================================
// TypeScript Interface (for type safety in code)
// ============================================================================

export interface PodcastMatchItem {
  podcast_name: string;
  podcast_url: string;          // Apple Podcasts, Spotify, or podcast website
  host_name: string;
  contact_info: string | null;  // Twitter/X handle, email, or website. Null if not confidently known.
  why_collaborate: string;
  suggested_approach: string;
  confidence: 'Very High';
}

export interface BridgeOutput {
  podcast_matches: PodcastMatchItem[]; // 1-3 matches
}

// ============================================================================
// JSON Schema (for OpenAI Structured Outputs)
// CRITICAL: contact_info is nullable, all other fields are required strings
// ============================================================================

export const BRIDGE_SCHEMA = {
  name: 'bridge_output',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      podcast_matches: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            podcast_name: {
              type: 'string',
              description: 'Exact name of the podcast'
            },
            podcast_url: {
              type: 'string',
              description: 'Real link to the podcast — Apple Podcasts, Spotify, or the podcast website'
            },
            host_name: {
              type: 'string',
              description: 'Name of the host or hosts'
            },
            contact_info: {
              type: ['string', 'null'],
              description: 'Twitter/X handle, email, or website URL for outreach. Null if not confidently known.'
            },
            why_collaborate: {
              type: 'string',
              description: 'Why this podcast is a strong cross-promotion match — audience overlap, shared topics'
            },
            suggested_approach: {
              type: 'string',
              description: 'How to reach out and what to propose in the first message'
            },
            confidence: {
              type: 'string',
              enum: ['Very High'],
              description: 'Only include matches you are Very High confidence exist'
            }
          },
          required: ['podcast_name', 'podcast_url', 'host_name', 'contact_info', 'why_collaborate', 'suggested_approach', 'confidence'],
          additionalProperties: false
        },
        minItems: 1,
        maxItems: 3,
        description: '1-3 cross-promotion podcast matches (Very High confidence only)'
      }
    },
    required: ['podcast_matches'],
    additionalProperties: false
  }
} as const;
