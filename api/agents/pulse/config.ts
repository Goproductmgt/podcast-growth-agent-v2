// ============================================================================
// AGENT: PULSE - Configuration
// GPT-5 settings for trend connection and semantic matching
// ============================================================================

import { AgentConfig } from '../shared/types';

export const PULSE_CONFIG: AgentConfig = {
  name: 'Pulse',
  model: 'gpt-5.4-pro',
  temperature: 0.7,           // Creative bridging for trend connections
  reasoning_effort: 'high',   // Deep semantic matching
  verbosity: 'low',           // Concise trend connections
  max_tokens: 4096,           // Enough for reasoning + JSON output
  timeout_ms: 90000           // 90 seconds
};