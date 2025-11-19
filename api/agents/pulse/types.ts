// ============================================================================
// AGENT: PULSE - Types & Schema
// Connects episodes to cultural trends (durable + viral) with semantic matching
// Returns dad joke if no trends fit
// ============================================================================

// ============================================================================
// TypeScript Interface (for type safety in code)
// ============================================================================

export interface DurableTrend {
  trend_or_hashtag: string;
  why_it_connects: string;
  best_platforms: string[];
  timing_strategy: string;
  confidence: 'High' | 'Medium';
}

export interface ViralMoment {
  trend_or_hashtag: string;
  why_it_connects: string;
  best_platforms: string[];
  timing_window: string;
  confidence: 'High' | 'Medium';
}

export interface PulseOutput {
  durable_trend: DurableTrend | null;
  viral_moment: ViralMoment | null;
  dad_joke: string | null;
}

// ============================================================================
// JSON Schema (for OpenAI Structured Outputs)
// CRITICAL: All fields required but nullable with anyOf pattern
// ============================================================================

export const PULSE_SCHEMA = {
  name: 'pulse_output',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      durable_trend: {
        anyOf: [
          {
            type: 'object',
            properties: {
              trend_or_hashtag: {
                type: 'string',
                description: 'Hashtag or trend name'
              },
              why_it_connects: {
                type: 'string',
                description: 'Semantic connection explanation'
              },
              best_platforms: {
                type: 'array',
                items: { type: 'string' },
                minItems: 2,
                maxItems: 3,
                description: '2-3 platforms where trend lives'
              },
              timing_strategy: {
                type: 'string',
                description: 'When to post within trend lifecycle'
              },
              confidence: {
                type: 'string',
                enum: ['High', 'Medium'],
                description: 'Connection confidence level'
              }
            },
            required: ['trend_or_hashtag', 'why_it_connects', 'best_platforms', 'timing_strategy', 'confidence'],
            additionalProperties: false
          },
          {
            type: 'null'
          }
        ]
      },
      viral_moment: {
        anyOf: [
          {
            type: 'object',
            properties: {
              trend_or_hashtag: {
                type: 'string',
                description: 'Current trending hashtag'
              },
              why_it_connects: {
                type: 'string',
                description: 'Why episode fits this viral moment'
              },
              best_platforms: {
                type: 'array',
                items: { type: 'string' },
                minItems: 2,
                maxItems: 3,
                description: '2-3 platforms for viral posting'
              },
              timing_window: {
                type: 'string',
                description: 'How quickly to act (e.g., within 24-48 hours)'
              },
              confidence: {
                type: 'string',
                enum: ['High', 'Medium'],
                description: 'Connection confidence level'
              }
            },
            required: ['trend_or_hashtag', 'why_it_connects', 'best_platforms', 'timing_window', 'confidence'],
            additionalProperties: false
          },
          {
            type: 'null'
          }
        ]
      },
      dad_joke: {
        type: ['string', 'null'],
        description: 'Dad joke when no trends fit (nullable)'
      }
    },
    required: ['durable_trend', 'viral_moment', 'dad_joke'],
    additionalProperties: false
  }
} as const;