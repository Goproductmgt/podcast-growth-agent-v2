// ============================================================================
// AGENT: AMPLIFY - Configuration
// GPT-5 settings for finding podcast matches + communities with real URLs
// ============================================================================

import { AgentConfig } from '../shared/types';

export const AMPLIFY_CONFIG: AgentConfig = {
  name: 'Amplify',
  model: 'gpt-5',
  temperature: 0.5,           // Lower for research accuracy
  reasoning_effort: 'high',   // Most complex - finding real URLs/contacts
  verbosity: 'medium',        // Needs thorough explanations
  max_tokens: 8000,           // INCREASED - high reasoning needs more space
  timeout_ms: 60000           // 60 second timeout (longer for complex task)
};