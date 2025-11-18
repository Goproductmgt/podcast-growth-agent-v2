// ============================================================================
// AGENT: INSIGHT - Types & Schema
// Summary + Keywords with Semantic Intelligence
// ============================================================================

export interface KeywordItem {
  keyword: string;
  category: 'Main Topic' | 'SEO Search' | 'Community Language';
  search_potential: '🟢 High' | '🟡 Typical' | '🔵 Cool';
  semantic_note?: string | null;
}

export interface InsightOutput {
  episode_summary: string;
  key_discovery_phrases: string[]; // Exactly 3
  keywords: KeywordItem[]; // Exactly 5
}

// JSON Schema for Structured Outputs with strict: true
export const INSIGHT_SCHEMA = {
  name: 'insight_output',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      episode_summary: {
        type: 'string',
        description: '2-3 sentence summary capturing what was said and why it matters'
      },
      key_discovery_phrases: {
        type: 'array',
        items: {
          type: 'string'
        },
        description: 'Exactly 3 long-tail phrases with highest discoverability (3-6 words each)',
        minItems: 3,
        maxItems: 3
      },
      keywords: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            keyword: {
              type: 'string',
              description: 'The keyword or phrase'
            },
            category: {
              type: 'string',
              enum: ['Main Topic', 'SEO Search', 'Community Language'],
              description: 'Category of keyword'
            },
            search_potential: {
              type: 'string',
              enum: ['🟢 High', '🟡 Typical', '🔵 Cool'],
              description: 'Search demand level'
            },
            semantic_note: {
              type: ['string', 'null'],
              description: 'Optional explanation when translating regional variations or jargon'
            }
          },
          required: ['keyword', 'category', 'search_potential', 'semantic_note'],
          additionalProperties: false
        },
        description: 'Exactly 5 keywords',
        minItems: 5,
        maxItems: 5
      }
    },
    required: ['episode_summary', 'key_discovery_phrases', 'keywords'],
    additionalProperties: false
  }
};