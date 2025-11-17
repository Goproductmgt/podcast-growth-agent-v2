// ============================================================================
// AGENT: INSIGHT - Configuration
// Temperature, reasoning effort, and other API settings
// ============================================================================

import { AgentConfig } from '../shared/types';

export const INSIGHT_CONFIG: AgentConfig = {
  name: 'Insight',
  model: 'gpt-5',
  temperature: 0.7, // Creative but clear for summary writing
  reasoning_effort: 'medium', // Needs to think about semantic connections
  verbosity: 'medium', // Balanced explanations in semantic notes
  max_tokens: 2000, // Summary + 3 phrases + 5 keywords = moderate output
  timeout_ms: 45000 // 45 seconds max
};