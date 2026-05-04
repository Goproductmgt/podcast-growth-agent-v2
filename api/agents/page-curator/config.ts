import { AgentConfig } from '../shared/types';

export const PAGE_CURATOR_CONFIG: AgentConfig = {
  name: 'Page Curator',
  model: 'gpt-5.4',
  temperature: 0.6,
  reasoning_effort: 'medium',
  verbosity: 'medium',
  max_tokens: 5000,
  timeout_ms: 90000
};
