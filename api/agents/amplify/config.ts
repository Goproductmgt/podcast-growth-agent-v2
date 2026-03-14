// ============================================================================
// AGENT: AMPLIFY - Configuration
// GPT-5 settings for finding podcast matches + communities with real URLs
// ============================================================================

import { AgentConfig } from '../shared/types';

export const AMPLIFY_CONFIG: AgentConfig = {
  name: 'Amplify',
  model: 'gpt-5.4-pro',
  temperature: 0.5,           // Lower for research accuracy
  reasoning_effort: 'high',   // Deep reasoning for real URLs/contacts
  verbosity: 'medium',        // Thorough explanations
  max_tokens: 8192,           // More room for complex URL/contact reasoning
  timeout_ms: 90000           // 90 seconds
};