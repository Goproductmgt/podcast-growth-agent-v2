// ============================================================================
// AGENT: AMPLIFY - Types & Schema
// Finds podcast collaboration match + niche communities with REAL URLs
// ============================================================================

// ============================================================================
// TypeScript Interface (for type safety in code)
// ============================================================================

export interface PodcastMatch {
  podcast_name: string;
  host_name: string;
  contact_info: string;
  why_collaborate: string;
  suggested_approach: string;
}

export interface Community {
  name: string;
  platform: 'Reddit' | 'Facebook' | 'LinkedIn' | 'Discord';
  url: string;
  member_size: string;
  why_this_fits: string;
  engagement_tip: string;
}

export interface AmplifyOutput {
  podcast_match: PodcastMatch;
  communities: Community[]; // 1-4 communities
}

// ============================================================================
// JSON Schema (for OpenAI Structured Outputs)
// CRITICAL: podcast_match always required, communities flexible 1-4
// ============================================================================

export const AMPLIFY_SCHEMA = {
  name: 'amplify_output',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      podcast_match: {
        type: 'object',
        properties: {
          podcast_name: {
            type: 'string',
            description: 'Name of podcast for collaboration'
          },
          host_name: {
            type: 'string',
            description: 'Name of podcast host'
          },
          contact_info: {
            type: 'string',
            description: 'Twitter handle, email, or website for outreach'
          },
          why_collaborate: {
            type: 'string',
            description: 'Why this is a good collaboration match'
          },
          suggested_approach: {
            type: 'string',
            description: 'How to start the conversation'
          }
        },
        required: ['podcast_name', 'host_name', 'contact_info', 'why_collaborate', 'suggested_approach'],
        additionalProperties: false
      },
      communities: {
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
              enum: ['Reddit', 'Facebook', 'LinkedIn', 'Discord'],
              description: 'Platform where community exists'
            },
            url: {
              type: 'string',
              description: 'REAL working URL to the community'
            },
            member_size: {
              type: 'string',
              description: 'Number of members (e.g., "50K members")'
            },
            why_this_fits: {
              type: 'string',
              description: 'Why this community matches the episode'
            },
            engagement_tip: {
              type: 'string',
              description: 'Specific strategy for engaging with this community'
            }
          },
          required: ['name', 'platform', 'url', 'member_size', 'why_this_fits', 'engagement_tip'],
          additionalProperties: false
        },
        minItems: 1,
        maxItems: 4,
        description: '1-4 niche communities (only Very High confidence)'
      }
    },
    required: ['podcast_match', 'communities'],
    additionalProperties: false
  }
} as const;