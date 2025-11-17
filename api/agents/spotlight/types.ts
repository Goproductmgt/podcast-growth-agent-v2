// ============================================================================
// AGENT: SPOTLIGHT - Types & Schema
// Quotes + Ready-to-Post Caption
// ============================================================================

export interface ShareableQuote {
  quote: string; // Under 280 characters
  timestamp: string; // HH:MM:SS format
  hashtags: string[]; // Exactly 2
  platform_notes: string; // Video creation guidance
}

export interface SpotlightOutput {
  shareable_quotes: ShareableQuote[]; // Exactly 3
  ready_to_post_caption: string; // Under 500 characters with CTA
}

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
              description: 'Lightly refined quote under 280 characters'
            },
            timestamp: {
              type: 'string',
              description: 'Exact timestamp in HH:MM:SS format'
            },
            hashtags: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Exactly 2 targeted hashtags',
              minItems: 2,
              maxItems: 2
            },
            platform_notes: {
              type: 'string',
              description: 'Visual treatment and platform recommendations for video/reel'
            }
          },
          required: ['quote', 'timestamp', 'hashtags', 'platform_notes'],
          additionalProperties: false
        },
        description: 'Exactly 3 shareable quotes optimized for video',
        minItems: 3,
        maxItems: 3
      },
      ready_to_post_caption: {
        type: 'string',
        description: 'Complete social caption under 500 chars with hook, quote reference, and CTA'
      }
    },
    required: ['shareable_quotes', 'ready_to_post_caption'],
    additionalProperties: false
  }
};