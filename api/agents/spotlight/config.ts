// ============================================================================
// AGENT: SPOTLIGHT - Configuration
// GPT-5 settings for shareable quote generation
// ============================================================================

import { AgentConfig } from '../shared/types';

export const SPOTLIGHT_CONFIG: AgentConfig = {
  name: 'Spotlight',
  model: 'gpt-5',
  temperature: 0.6,           // Balanced - authentic but shareable
  reasoning_effort: 'low',    // Quote selection is straightforward
  verbosity: 'low',           // Concise outputs
  max_tokens: 3000,           // Simpler than Hook
  timeout_ms: 45000           // 45 second timeout
};