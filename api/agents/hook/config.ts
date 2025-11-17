// ============================================================================
// AGENT: HOOK - Configuration
// ============================================================================

import { AgentConfig } from '../shared/types';

export const HOOK_CONFIG: AgentConfig = {
  name: 'Hook',
  model: 'gpt-5',
  temperature: 0.7, // Creative copywriting
  reasoning_effort: 'medium', // Needs to consider SEO + personality
  verbosity: 'low', // Short, punchy titles
  max_tokens: 1000, // 3 titles = small output
  timeout_ms: 40000 // 40 seconds max
};