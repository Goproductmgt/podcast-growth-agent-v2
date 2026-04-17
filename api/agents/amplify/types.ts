// ============================================================================
// AGENT: AMPLIFY - Types & Schema
// Finds 1-4 niche communities with REAL URLs across all platforms
// ============================================================================

// ============================================================================
// TypeScript Interface (for type safety in code)
// ============================================================================

export interface Community {
  name: string;
  platform: 'Reddit' | 'Facebook' | 'LinkedIn' | 'Discord';
  url: string;
  member_size: string;
  why_this_fits: string;
  engagement_tip: string;
}

export interface AmplifyOutput {
  communities: Community[]; // 1-4 communities
}

// ============================================================================
// JSON Schema (for OpenAI Structured Outputs)
// ============================================================================

export const AMPLIFY_SCHEMA = {
  name: 'amplify_output',
  strict: true,
  schema: {
    type: 'object',
    properties: {
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
        description: '1-4 niche communities across all platforms (only Very High confidence)'
      }
    },
    required: ['communities'],
    additionalProperties: false
  }
} as const;
