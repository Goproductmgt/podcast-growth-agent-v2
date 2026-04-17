// ============================================================================
// STREAMING ORCHESTRATOR
// Runs all 5 agents in parallel, fires callback as each completes
// ============================================================================

import { GrowthPlan, AgentResult, AgentError } from './shared/types';
import { runInsightAgent } from './insight';
import { runHookAgent } from './hook';
import { runSpotlightAgent } from './spotlight';
import { runAmplifyAgent } from './amplify';
import { runPulseAgent } from './pulse';
import { runBridgeAgent } from './bridge';
import { runBeaconAgent } from './beacon';

export type AgentCompleteCallback = (
  agentName: string,
  result: AgentResult
) => void;

/**
 * Runs all 5 agents in parallel, calling onAgentComplete as each finishes.
 * Returns the complete GrowthPlan when all are done.
 */
export async function generateGrowthPlanStream(
  transcript: string,
  onAgentComplete: AgentCompleteCallback,
  episodeId: string = 'episode-' + Date.now(),
  episodeUrl?: string
): Promise<GrowthPlan> {

  console.log('🚀 Starting Growth Plan generation (streaming)...');
  console.log(`📄 Transcript length: ${transcript.length} characters`);
  console.log(`⏱️  Running 7 agents in parallel...\n`);

  const startTime = Date.now();

  const agentNames = ['insight', 'hook', 'spotlight', 'amplify', 'pulse', 'bridge', 'beacon'];
  const errors: AgentError[] = [];
  let successCount = 0;
  let failureCount = 0;
  const agentData: any = {
    insight: null,
    hook: null,
    spotlight: null,
    amplify: null,
    pulse: null,
    bridge: null,
    beacon: null
  };

  // Wrap each agent in a promise that calls onAgentComplete when done
  const wrapAgent = async (
    name: string,
    runner: Promise<AgentResult>
  ): Promise<void> => {
    try {
      const result = await runner;
      if (result.success) {
        agentData[name] = result.data;
        successCount++;
        console.log(`✅ ${name.toUpperCase()}: Success (${(result.processing_time / 1000).toFixed(2)}s)`);
      } else {
        failureCount++;
        console.log(`❌ ${name.toUpperCase()}: Failed - ${result.error}`);
        errors.push({
          agent: name,
          error: result.error || 'Unknown error',
          timestamp: new Date().toISOString()
        });
      }
      onAgentComplete(name, result);
    } catch (err: any) {
      failureCount++;
      console.log(`❌ ${name.toUpperCase()}: Promise rejected - ${err.message}`);
      const failResult: AgentResult = {
        agent: name,
        success: false,
        data: null,
        error: err.message || 'Promise rejected',
        processing_time: Date.now() - startTime
      };
      errors.push({
        agent: name,
        error: err.message || 'Promise rejected',
        timestamp: new Date().toISOString()
      });
      onAgentComplete(name, failResult);
    }
  };

  // Run all 7 agents - each fires onAgentComplete independently
  await Promise.all([
    wrapAgent('insight', runInsightAgent(transcript)),
    wrapAgent('hook', runHookAgent(transcript)),
    wrapAgent('spotlight', runSpotlightAgent(transcript, episodeUrl)),
    wrapAgent('amplify', runAmplifyAgent(transcript)),
    wrapAgent('pulse', runPulseAgent(transcript)),
    wrapAgent('bridge', runBridgeAgent(transcript)),
    wrapAgent('beacon', runBeaconAgent(transcript))
  ]);

  const totalTime = Date.now() - startTime;
  console.log(`\n✅ All agents completed in ${(totalTime / 1000).toFixed(2)}s`);
  console.log(`📊 Results: ${successCount}/${agentNames.length} agents succeeded\n`);

  const growthPlan: GrowthPlan = {
    episode_id: episodeId,
    transcript_length: transcript.length,
    processing_time: totalTime,
    timestamp: new Date().toISOString(),
    agents: agentData,
    errors: errors,
    summary: {
      agents_succeeded: successCount,
      agents_failed: failureCount,
      total_agents: agentNames.length
    }
  };

  return growthPlan;
}
