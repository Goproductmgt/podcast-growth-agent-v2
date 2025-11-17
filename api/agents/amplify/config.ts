// ============================================================================
// AGENT: AMPLIFY - Configuration
// ============================================================================

import { AgentConfig } from '../shared/types';

export const AMPLIFY_CONFIG: AgentConfig = {
  name: 'Amplify',
  model: 'gpt-5',
  temperature: 0.5, // Research-focused, less creative
  reasoning_effort: 'high', // Needs to find real communities
  verbosity: 'medium', // Detailed explanations for matches
  max_tokens: 2500, // Podcast match + 1-4 communities = larger output
  timeout_ms: 60000 // 60 seconds (more time for research)
};