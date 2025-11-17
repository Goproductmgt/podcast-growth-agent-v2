// ============================================================================
// AGENT: PULSE - Configuration
// ============================================================================

import { AgentConfig } from '../shared/types';

export const PULSE_CONFIG: AgentConfig = {
  name: 'Pulse',
  model: 'gpt-5',
  temperature: 0.6, // Balanced creativity + accuracy
  reasoning_effort: 'medium', // Needs to think about semantic connections
  verbosity: 'low', // Concise trend explanations
  max_tokens: 1500, // 1-2 trends or dad joke = moderate output
  timeout_ms: 45000 // 45 seconds max
};