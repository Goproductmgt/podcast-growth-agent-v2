// ============================================================================
// TYPESCRIPT INTERFACES
// These define the shape of each agent's output for type safety
// ============================================================================

export interface InsightOutput {
  episode_summary: string;
}

export interface HookOutput {
  optimized_title: string;
}

export interface SpotlightQuote {
  quote: string;
  timestamp: string;
}

export interface SpotlightOutput {
  tweetable_quotes: SpotlightQuote[];
}

export interface SignalOutput {
  topics_keywords: string[];
}

export interface CommunitySuggestion {
  name: string;
  platform: string;
  url: string;
  why: string;
  post_angle: string;
  member_size: string;
  engagement_strategy: string;
}

export interface CompassOutput {
  community_suggestions: CommunitySuggestion[];
}

export interface CrossPromoMatch {
  podcast_name: string;
  host_name: string;
  contact_info: string;
  collaboration_angle: string;
  suggested_approach: string;
}

export interface BridgeOutput {
  cross_promo_matches: CrossPromoMatch[];
}

export interface TrendPiggyback {
  trend: string;
  why: string;
  platforms: string[];
  timing: string;
}

export interface PulseOutput {
  trend_piggyback: TrendPiggyback;
}

export interface PersonaOutput {
  social_caption: string;
}

// ============================================================================
// GROWTH PLAN - Combines all 8 agent outputs
// ============================================================================

export interface GrowthPlan {
  insight: InsightOutput;
  hook: HookOutput;
  spotlight: SpotlightOutput;
  signal: SignalOutput;
  compass: CompassOutput;
  bridge: BridgeOutput;
  pulse: PulseOutput;
  persona: PersonaOutput;
  metadata: {
    transcript_length: number;
    processing_time_seconds: number;
    timestamp: string;
  };
}

// ============================================================================
// JSON SCHEMAS FOR STRUCTURED OUTPUTS
// These guarantee GPT-5 returns exactly the right format
// ============================================================================

export const INSIGHT_SCHEMA = {
  name: 'episode_insight',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      episode_summary: {
        type: 'string',
        description: '2-3 sentence episode summary that captures themes and emotional depth'
      }
    },
    required: ['episode_summary'],
    additionalProperties: false
  }
};

export const HOOK_SCHEMA = {
  name: 'optimized_title',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      optimized_title: {
        type: 'string',
        description: 'SEO-optimized episode title under 60 characters'
      }
    },
    required: ['optimized_title'],
    additionalProperties: false
  }
};

export const SPOTLIGHT_SCHEMA = {
  name: 'tweetable_quotes',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      tweetable_quotes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            quote: {
              type: 'string',
              description: 'Quote under 280 characters'
            },
            timestamp: {
              type: 'string',
              description: 'Timestamp in MM:SS or HH:MM:SS format'
            }
          },
          required: ['quote', 'timestamp'],
          additionalProperties: false
        },
        description: 'Exactly 3 shareable quotes with timestamps'
      }
    },
    required: ['tweetable_quotes'],
    additionalProperties: false
  }
};

export const SIGNAL_SCHEMA = {
  name: 'topics_keywords',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      topics_keywords: {
        type: 'array',
        items: {
          type: 'string'
        },
        description: 'Exactly 5 SEO keywords: longtail, question-based, problem-solution, semantic, platform-specific'
      }
    },
    required: ['topics_keywords'],
    additionalProperties: false
  }
};

export const COMPASS_SCHEMA = {
  name: 'community_suggestions',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      community_suggestions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Community name'
            },
            platform: {
              type: 'string',
              description: 'Platform (Reddit/Facebook/Discord/LinkedIn/Forum)'
            },
            url: {
              type: 'string',
              description: 'ACTUAL working URL to the community'
            },
            why: {
              type: 'string',
              description: 'Why this community is a match'
            },
            post_angle: {
              type: 'string',
              description: 'What to say and how to frame it'
            },
            member_size: {
              type: 'string',
              description: 'e.g., "15K members"'
            },
            engagement_strategy: {
              type: 'string',
              description: 'e.g., "answer a popular thread, share value before links"'
            }
          },
          required: ['name', 'platform', 'url', 'why', 'post_angle', 'member_size', 'engagement_strategy'],
          additionalProperties: false
        },
        description: 'Exactly 3 niche community recommendations'
      }
    },
    required: ['community_suggestions'],
    additionalProperties: false
  }
};

export const BRIDGE_SCHEMA = {
  name: 'cross_promo_matches',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      cross_promo_matches: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            podcast_name: {
              type: 'string',
              description: 'Podcast title'
            },
            host_name: {
              type: 'string',
              description: 'Host name'
            },
            contact_info: {
              type: 'string',
              description: 'Twitter handle, email, or contact URL'
            },
            collaboration_angle: {
              type: 'string',
              description: 'Why the content overlaps'
            },
            suggested_approach: {
              type: 'string',
              description: 'How to start the conversation'
            }
          },
          required: ['podcast_name', 'host_name', 'contact_info', 'collaboration_angle', 'suggested_approach'],
          additionalProperties: false
        },
        description: 'Exactly 3 podcast cross-promo matches'
      }
    },
    required: ['cross_promo_matches'],
    additionalProperties: false
  }
};

export const PULSE_SCHEMA = {
  name: 'trend_piggyback',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      trend_piggyback: {
        type: 'object',
        properties: {
          trend: {
            type: 'string',
            description: 'Trend name or hashtag'
          },
          why: {
            type: 'string',
            description: 'Why it fits the episode'
          },
          platforms: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: 'Best platforms for this trend'
          },
          timing: {
            type: 'string',
            description: 'When to post for best results'
          }
        },
        required: ['trend', 'why', 'platforms', 'timing'],
        additionalProperties: false
      }
    },
    required: ['trend_piggyback'],
    additionalProperties: false
  }
};

export const PERSONA_SCHEMA = {
  name: 'social_caption',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      social_caption: {
        type: 'string',
        description: 'Ready-to-post social caption under 500 characters with hook, insight, and CTA'
      }
    },
    required: ['social_caption'],
    additionalProperties: false
  }
};