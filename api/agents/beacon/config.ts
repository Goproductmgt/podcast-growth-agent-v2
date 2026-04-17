// ============================================================================
// AGENT: BEACON - Configuration
// GPT-5 settings for finding publications to pitch or cross-post
// ============================================================================

import { AgentConfig } from '../shared/types';

export const BEACON_CONFIG: AgentConfig = {
  name: 'Beacon',
  model: 'gpt-5.4',
  temperature: 0.5,            // Lower for research accuracy
  reasoning_effort: 'medium',  // Matches all other agents — avoids timeout
  verbosity: 'medium',         // Enough detail for why_this_fits and how_to_pitch
  max_tokens: 4096,            // Consistent with all other agents
  timeout_ms: 90000            // 90 seconds
};
