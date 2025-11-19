// ============================================================================
// AGENT: PULSE - Configuration
// GPT-5 settings for trend connection and semantic matching
// ============================================================================

import { AgentConfig } from '../shared/types';

export const PULSE_CONFIG: AgentConfig = {
  name: 'Pulse',
  model: 'gpt-5',
  temperature: 0.6,           // Balanced for trend matching
  reasoning_effort: 'medium', // Semantic matching requires thinking
  verbosity: 'low',           // Concise trend connections
  max_tokens: 3500,           // Moderate complexity
  timeout_ms: 45000           // 45 second timeout
};