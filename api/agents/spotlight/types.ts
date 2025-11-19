// ============================================================================
// AGENT: SPOTLIGHT - Types & Schema
// Shareable quotes optimized for video/reels + ready-to-post caption
// ============================================================================

// ============================================================================
// TypeScript Interface (for type safety in code)
// ============================================================================

export interface ShareableQuote {
  quote: string;
  timestamp: string; // HH:MM:SS format
  hashtags: string[]; // Exactly 2
  platform_notes: string;
}

export interface SpotlightOutput {
  shareable_quotes: ShareableQuote[]; // Exactly 3 quotes
  ready_to_post_caption: string;
}

// ============================================================================
// JSON Schema (for OpenAI Structured Outputs)
// CRITICAL: unwrap properties at top level (name, schema, strict)
// ============================================================================

export const SPOTLIGHT_SCHEMA = {
  name: 'spotlight_output',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      shareable_quotes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            quote: {
              type: 'string',
              description: 'Shareable quote under 280 characters',
              maxLength: 280
            },
            timestamp: {
              type: 'string',
              description: 'Timestamp in HH:MM:SS format',
              pattern: '^[0-9]{2}:[0-9]{2}:[0-9]{2}$'
            },
            hashtags: {
              type: 'array',
              items: {
                type: 'string'
              },
              minItems: 2,
              maxItems: 2,
              description: 'Exactly 2 hashtags (one broad, one specific)'
            },
            platform_notes: {
              type: 'string',
              description: 'Video creation guidance for social platforms'
            }
          },
          required: ['quote', 'timestamp', 'hashtags', 'platform_notes'],
          additionalProperties: false
        },
        minItems: 3,
        maxItems: 3,
        description: 'Exactly 3 shareable quotes'
      },
      ready_to_post_caption: {
        type: 'string',
        description: 'Ready-to-post caption under 500 characters',
        maxLength: 500
      }
    },
    required: ['shareable_quotes', 'ready_to_post_caption'],
    additionalProperties: false
  }
} as const;