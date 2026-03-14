// ============================================================================
// AGENT: SPOTLIGHT - Configuration
// GPT-5 settings for shareable quote generation
// ============================================================================

import { AgentConfig } from '../shared/types';

export const SPOTLIGHT_CONFIG: AgentConfig = {
  name: 'Spotlight',
  model: 'gpt-5.4-pro',
  temperature: 0.6,           // Balanced - authentic but shareable
  reasoning_effort: 'medium', // Smarter quote selection
  verbosity: 'low',           // Concise outputs
  max_tokens: 4096,           // Enough for reasoning + JSON output
  timeout_ms: 90000           // 90 seconds
};