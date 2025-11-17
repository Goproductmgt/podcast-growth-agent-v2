// ============================================================================
// AGENT: HOOK - Types & Schema
// 3 Title Options with Personality Styles
// ============================================================================

export interface TitleOption {
  title: string; // Max 60 characters
  style: 'Authority' | 'Conversational' | 'Curiosity-Driven';
  primary_keyword: string;
  search_potential: '🟢 High' | '🟡 Typical' | '🔵 Cool';
}

export interface HookOutput {
  title_options: TitleOption[]; // Exactly 3
}

export const HOOK_SCHEMA = {
  name: 'hook_output',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      title_options: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'Episode title under 60 characters (strict limit)'
            },
            style: {
              type: 'string',
              enum: ['Authority', 'Conversational', 'Curiosity-Driven'],
              description: 'Title personality style'
            },
            primary_keyword: {
              type: 'string',
              description: 'Main keyword included in title'
            },
            search_potential: {
              type: 'string',
              enum: ['🟢 High', '🟡 Typical', '🔵 Cool'],
              description: 'Search demand for this approach'
            }
          },
          required: ['title', 'style', 'primary_keyword', 'search_potential'],
          additionalProperties: false
        },
        description: 'Exactly 3 title options (one per style)',
        minItems: 3,
        maxItems: 3
      }
    },
    required: ['title_options'],
    additionalProperties: false
  }
};