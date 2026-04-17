// ============================================================================
// AGENT: BEACON - Configuration
// GPT-5 settings for finding publications to pitch or cross-post
// ============================================================================

import { AgentConfig } from '../shared/types';

export const BEACON_CONFIG: AgentConfig = {
  name: 'Beacon',
  model: 'gpt-5.4',
  temperature: 0.5,            // Lower for research accuracy
  reasoning_effort: 'medium',  // Semantic translation requires real reasoning — keep at medium
  verbosity: 'low',            // Concise output — tighter pitches, less budget consumed
  max_tokens: 10000,           // Bumped from 6000 — engagement-first prompt + 3 publications need headroom
  timeout_ms: 90000            // 90 seconds
};
