// ============================================================================
// AGENT: PULSE - Types & Schema
// Trend Connection (Nullable with Dad Joke Fallback)
// ============================================================================

export interface DurableTrend {
  trend_or_hashtag: string;
  why_it_connects: string;
  best_platforms: string[]; // 2-3 platforms
  timing_strategy: string;
  confidence: 'High' | 'Medium';
}

export interface ViralMoment {
  trend_or_hashtag: string;
  why_it_connects: string;
  best_platforms: string[];
  timing_window: string; // "Post within 24-48 hours"
  confidence: 'High' | 'Medium';
}

export interface PulseOutput {
  durable_trend?: DurableTrend | null;
  viral_moment?: ViralMoment | null;
  dad_joke?: string | null; // Only if both trends are null
}

export const PULSE_SCHEMA = {
  name: 'pulse_output',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      durable_trend: {
        type: ['object', 'null'],
        properties: {
          trend_or_hashtag: {
            type: 'string',
            description: 'Ongoing trend or hashtag (e.g., #HabitStacking)'
          },
          why_it_connects: {
            type: 'string',
            description: 'Semantic match explanation showing underlying connection'
          },
          best_platforms: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: '2-3 platforms where this trend lives'
          },
          timing_strategy: {
            type: 'string',
            description: 'When to post within trend lifecycle'
          },
          confidence: {
            type: 'string',
            enum: ['High', 'Medium'],
            description: 'Confidence in relevance'
          }
        },
        required: ['trend_or_hashtag', 'why_it_connects', 'best_platforms', 'timing_strategy', 'confidence'],
        additionalProperties: false
      },
      viral_moment: {
        type: ['object', 'null'],
        properties: {
          trend_or_hashtag: {
            type: 'string',
            description: 'Current viral trend or hashtag'
          },
          why_it_connects: {
            type: 'string',
            description: 'How episode connects to this moment'
          },
          best_platforms: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: 'Platforms where trend is hot'
          },
          timing_window: {
            type: 'string',
            description: 'How quickly to act (e.g., "Post within 48 hours")'
          },
          confidence: {
            type: 'string',
            enum: ['High', 'Medium'],
            description: 'Confidence in relevance'
          }
        },
        required: ['trend_or_hashtag', 'why_it_connects', 'best_platforms', 'timing_window', 'confidence'],
        additionalProperties: false
      },
      dad_joke: {
        type: ['string', 'null'],
        description: 'Encouraging dad joke if no strong trend connections exist'
      }
    },
    required: [],
    additionalProperties: false
  }
};