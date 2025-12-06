// ============================================================================
// SHARED TYPES
// Only types that are truly shared across all agents
// Individual agent types live in their own folders
// ============================================================================

// ============================================================================
// AGGREGATED GROWTH PLAN OUTPUT
// This is the final structure returned to the user
// ============================================================================
export interface GrowthPlan {
  episode_id: string;
  transcript_length: number;
  processing_time: number;
  timestamp: string; // ISO format
  agents: {
    insight: any | null;   // Will be typed properly when we import agent types
    hook: any | null;
    spotlight: any | null;
    amplify: any | null;
    pulse: any | null;
  };
  errors: AgentError[];
  summary: {
    agents_succeeded: number;
    agents_failed: number;
    total_agents: number;
  };
}

export interface AgentError {
  agent: string;
  error: string;
  timestamp: string;
}

// ============================================================================
// AGENT CONFIGURATION
// Used by orchestrator to configure each agent's API call
// ============================================================================
export interface AgentConfig {
  name: string;
  model: string; // 'gpt-5'
  temperature: number;
  reasoning_effort: 'minimal' | 'low' | 'medium' | 'high';
  verbosity: 'low' | 'medium' | 'high';
  max_tokens: number;
  timeout_ms: number;
}

// ============================================================================
// AGENT EXECUTION RESULT
// Returned by each agent runner
// ============================================================================
export interface AgentResult {
  agent: string;
  success: boolean;
  data: any | null;
  error: string | null;
  processing_time: number;
  tokens_used?: {
    input: number;
    output: number;
  };
}// ============================================================================
// URL RESOLVER TYPES (Added Session 10)
// ============================================================================

export interface EpisodeMetadata {
  // Core identifiers
  episodeUrl: string;        // Link to episode (for posting)
  episodeTitle: string;
  podcastTitle: string;
  
  // Publishing info
  publishDate: string;       // ISO format
  
  // Audio
  audioUrl: string;          // Direct MP3 URL
  audioDuration?: number;    // Duration in seconds
  
  // Social handles (if available)
  podcastSocial?: {
    twitter?: string;
    instagram?: string;
    facebook?: string;
    website?: string;
  }
}

export interface ParsedPodcastURL {
  platform: 'apple' | 'spotify';
  episodeId?: string;        // Optional - might only have podcast ID
  podcastId: string;
  originalUrl: string;
}

export interface ResolveSourceResponse {
  success: boolean;
  metadata?: EpisodeMetadata;
  error?: string;
}