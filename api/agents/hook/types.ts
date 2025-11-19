// ============================================================================
// AGENT: HOOK - Types & Schema
// 3 personality-driven title options with search potential indicators
// ============================================================================

// ============================================================================
// TypeScript Interface (for type safety in code)
// ============================================================================

export interface TitleOption {
  title: string;
  style: 'Authority' | 'Conversational' | 'Curiosity-Driven';
  primary_keyword: string;
  search_potential: '🟢 High' | '🟡 Typical' | '🔵 Cool';
}

export interface HookOutput {
  title_options: TitleOption[]; // Exactly 3 options
}

// ============================================================================
// JSON Schema (for OpenAI Structured Outputs)
// CRITICAL: unwrap properties at top level (name, schema, strict)
// ============================================================================

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
              description: 'Episode title under 60 characters',
              maxLength: 60
            },
            style: {
              type: 'string',
              enum: ['Authority', 'Conversational', 'Curiosity-Driven'],
              description: 'Title personality style'
            },
            primary_keyword: {
              type: 'string',
              description: 'Main SEO keyword in the title'
            },
            search_potential: {
              type: 'string',
              enum: ['🟢 High', '🟡 Typical', '🔵 Cool'],
              description: 'Estimated search demand level'
            }
          },
          required: ['title', 'style', 'primary_keyword', 'search_potential'],
          additionalProperties: false
        },
        minItems: 3,
        maxItems: 3,
        description: 'Exactly 3 title options (one per style)'
      }
    },
    required: ['title_options'],
    additionalProperties: false
  }
} as const;