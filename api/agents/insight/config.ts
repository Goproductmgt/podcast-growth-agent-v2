// ============================================================================
// AGENT: INSIGHT - Configuration
// Temperature, reasoning effort, and other API settings
// ============================================================================

import { AgentConfig } from '../shared/types';

export const INSIGHT_CONFIG: AgentConfig = {
  name: 'Insight',
  model: 'gpt-5.4-pro',
  temperature: 0.7, // Creative but clear for summary writing
  reasoning_effort: 'high', // Deep semantic connections
  verbosity: 'medium', // Balanced explanations in semantic notes
  max_tokens: 4096, // Enough for reasoning + JSON output
  timeout_ms: 90000 // 90 seconds
};