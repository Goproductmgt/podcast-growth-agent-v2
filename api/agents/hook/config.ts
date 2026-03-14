// ============================================================================
// AGENT: HOOK - Configuration
// GPT-5 settings for title generation
// ============================================================================

import { AgentConfig } from '../shared/types';

export const HOOK_CONFIG: AgentConfig = {
  name: 'Hook',
  model: 'gpt-5.4-pro',
  temperature: 0.8,           // Higher creativity for title variation
  reasoning_effort: 'high',   // Better balance of catchy + SEO-smart
  verbosity: 'low',           // Concise titles
  max_tokens: 4096,           // Enough for reasoning + JSON output
  timeout_ms: 90000           // 90 seconds
};