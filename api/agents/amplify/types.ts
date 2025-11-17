// ============================================================================
// AGENT: AMPLIFY - Types & Schema
// Podcast Match + Community Suggestions (1-4 flexible)
// ============================================================================

export interface PodcastMatch {
  podcast_name: string;
  host_name: string;
  contact_info: string; // Real Twitter handle, email, or website
  why_collaborate: string;
  suggested_approach: string;
}

export interface CommunitySuggestion {
  name: string;
  platform: 'Reddit' | 'Facebook' | 'LinkedIn' | 'Discord';
  url: string; // REAL working URL
  member_size: string;
  why_this_fits: string;
  engagement_tip: string;
  confidence: 'Very High'; // Only suggest when very high confidence
}

export interface AmplifyOutput {
  podcast_match: PodcastMatch; // Always required
  communities: CommunitySuggestion[]; // 1-4 communities (flexible)
}

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
            description: 'Podcast title'
          },
          host_name: {
            type: 'string',
            description: 'Host name'
          },
          contact_info: {
            type: 'string',
            description: 'Real Twitter handle (@username), email, or working website URL'
          },
          why_collaborate: {
            type: 'string',
            description: 'Why the content and audiences overlap'
          },
          suggested_approach: {
            type: 'string',
            description: 'Specific outreach strategy to start the conversation'
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
              description: 'Community name (e.g., r/getdisciplined)'
            },
            platform: {
              type: 'string',
              enum: ['Reddit', 'Facebook', 'LinkedIn', 'Discord'],
              description: 'Platform where community exists'
            },
            url: {
              type: 'string',
              description: 'REAL working URL (not placeholder)'
            },
            member_size: {
              type: 'string',
              description: 'Approximate member count (e.g., "85K members")'
            },
            why_this_fits: {
              type: 'string',
              description: 'Why this niche community is a match'
            },
            engagement_tip: {
              type: 'string',
              description: 'Specific strategy for posting (not just "share here")'
            },
            confidence: {
              type: 'string',
              enum: ['Very High'],
              description: 'All suggestions must be Very High confidence'
            }
          },
          required: ['name', 'platform', 'url', 'member_size', 'why_this_fits', 'engagement_tip', 'confidence'],
          additionalProperties: false
        },
        description: 'Between 1-4 niche communities with working URLs',
        minItems: 1,
        maxItems: 4
      }
    },
    required: ['podcast_match', 'communities'],
    additionalProperties: false
  }
};