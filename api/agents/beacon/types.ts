// ============================================================================
// AGENT: BEACON - Types & Schema
// Finds 1-3 Substack or Medium publications to pitch or cross-post
// ============================================================================

// ============================================================================
// TypeScript Interface (for type safety in code)
// ============================================================================

export interface PublicationItem {
  publication_name: string;
  platform: 'Substack' | 'Medium';
  url: string;
  topic_focus: string;
  why_this_fits: string;
  how_to_pitch: string;
}

export interface BeaconOutput {
  publications: PublicationItem[]; // 1-3 publications
}

// ============================================================================
// JSON Schema (for OpenAI Structured Outputs)
// CRITICAL: platform is a strict enum, all fields required and non-nullable
// ============================================================================

export const BEACON_SCHEMA = {
  name: 'beacon_output',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      publications: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            publication_name: {
              type: 'string',
              description: 'Exact name of the publication or newsletter'
            },
            platform: {
              type: 'string',
              enum: ['Substack', 'Medium'],
              description: 'Platform where this publication lives'
            },
            url: {
              type: 'string',
              description: 'Real, working URL to the publication — substack.com/[name] or medium.com/[publication]'
            },
            topic_focus: {
              type: 'string',
              description: 'What this publication covers and who reads it'
            },
            why_this_fits: {
              type: 'string',
              description: 'Semantic connection between this episode and this publication\'s readership'
            },
            how_to_pitch: {
              type: 'string',
              description: 'Specific pitch angle or swap proposal the host can act on immediately'
            }
          },
          required: ['publication_name', 'platform', 'url', 'topic_focus', 'why_this_fits', 'how_to_pitch'],
          additionalProperties: false
        },
        minItems: 1,
        maxItems: 3,
        description: '1-3 publications to pitch or cross-post (Very High confidence only)'
      }
    },
    required: ['publications'],
    additionalProperties: false
  }
} as const;
