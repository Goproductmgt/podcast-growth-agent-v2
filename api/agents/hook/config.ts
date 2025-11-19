// ============================================================================
// AGENT: HOOK - Configuration
// GPT-5 settings for title generation
// ============================================================================

import { AgentConfig } from '../shared/types';

export const HOOK_CONFIG: AgentConfig = {
  name: 'Hook',
  model: 'gpt-5',
  temperature: 0.7,           // Creative copywriting
  reasoning_effort: 'medium', // Balance quality and speed
  verbosity: 'low',           // Concise titles
  max_tokens: 3500,           // Simpler than Insight, needs less space
  timeout_ms: 45000           // 45 second timeout
};