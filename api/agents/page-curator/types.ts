import type { PageCuratorOutput } from '../../site-builder/types';

export type { PageCuratorOutput };

export const PAGE_CURATOR_SCHEMA = {
  name: 'page_curator_output',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      pageGoal: {
        type: 'string',
        description: 'One sentence describing how this episode page becomes an audience magnet.'
      },
      seoTitle: {
        type: 'string',
        description: 'SEO-friendly page title for this episode website.'
      },
      heroTitle: {
        type: 'string',
        description: 'Optional human-facing hero headline. Can match the episode title when that is best.'
      },
      audienceMagnet: {
        type: 'object',
        properties: {
          eyebrow: {
            type: 'string',
            description: 'Short label for the audience magnet section.'
          },
          heading: {
            type: 'string',
            description: 'Public section heading focused on discoverability and audience pull.'
          },
          blurb: {
            type: 'string',
            description: 'Warm public copy explaining why this episode connects to a wider audience conversation.'
          },
          trendLabel: {
            type: 'string',
            description: 'Short label for the trend or cultural lens.'
          }
        },
        required: ['eyebrow', 'heading', 'blurb', 'trendLabel'],
        additionalProperties: false
      },
      creatorGuide: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            label: {
              type: 'string',
              description: 'Source agent name or content lane.'
            },
            title: {
              type: 'string',
              description: 'Action-oriented creator guidance title.'
            },
            body: {
              type: 'string',
              description: 'Creator-only instruction for using the growth-plan output.'
            },
            url: {
              type: 'string',
              description: 'Optional source or target URL, empty string when not available.'
            }
          },
          required: ['label', 'title', 'body', 'url'],
          additionalProperties: false
        },
        minItems: 3,
        maxItems: 7
      },
      sectionPlan: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Stable section identifier.'
            },
            label: {
              type: 'string',
              description: 'Human-readable section label.'
            },
            purpose: {
              type: 'string',
              description: 'Why this section exists on the episode website.'
            },
            sourceAgents: {
              type: 'array',
              items: { type: 'string' },
              description: 'Agent outputs used by this section.'
            },
            visibility: {
              type: 'string',
              enum: ['public', 'creator-only', 'both']
            }
          },
          required: ['id', 'label', 'purpose', 'sourceAgents', 'visibility'],
          additionalProperties: false
        },
        minItems: 4,
        maxItems: 10
      },
      llmSummary: {
        type: 'string',
        description: 'Concise AI-readable summary of the page strategy for llm.txt and downstream automation.'
      }
    },
    required: ['pageGoal', 'seoTitle', 'heroTitle', 'audienceMagnet', 'creatorGuide', 'sectionPlan', 'llmSummary'],
    additionalProperties: false
  }
} as const;
