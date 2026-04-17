// ============================================================================
// AGENT: BRIDGE - Configuration
// GPT-5 settings for finding cross-promotion podcast matches
// ============================================================================

import { AgentConfig } from '../shared/types';

export const BRIDGE_CONFIG: AgentConfig = {
  name: 'Bridge',
  model: 'gpt-5.4',
  temperature: 0.5,            // Lower for research accuracy
  reasoning_effort: 'medium',  // Matches all other agents — avoids timeout
  verbosity: 'medium',         // Enough detail for why_collaborate and suggested_approach
  max_tokens: 6000,            // Bumped from 4096 — production runs were hitting truncation
  timeout_ms: 90000            // 90 seconds
};
