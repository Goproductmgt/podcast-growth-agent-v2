// ============================================================================
// AGENT: SPOTLIGHT - Configuration
// ============================================================================

import { AgentConfig } from '../shared/types';

export const SPOTLIGHT_CONFIG: AgentConfig = {
  name: 'Spotlight',
  model: 'gpt-5',
  temperature: 0.6, // Balanced: authentic + shareable
  reasoning_effort: 'low', // Quote selection is straightforward
  verbosity: 'low', // Short, punchy content
  max_tokens: 1500, // 3 quotes + caption = moderate output
  timeout_ms: 40000 // 40 seconds max
};