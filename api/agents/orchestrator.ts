import { GrowthPlan, AgentResult, AgentError } from './shared/types';
import { runInsightAgent } from './insight';
import { runHookAgent } from './hook';
import { runSpotlightAgent } from './spotlight';
import { runAmplifyAgent } from './amplify';
import { runPulseAgent } from './pulse';

/**
 * Runs all 5 agents in parallel and aggregates their results
 * Uses Promise.allSettled for graceful degradation
 * Returns complete GrowthPlan even if some agents fail
 */
export async function runAllAgents(
  transcript: string,
  episodeId: string = 'episode-' + Date.now()
): Promise<GrowthPlan> {
  
  console.log('🚀 Starting Growth Plan generation...');
  console.log(`📄 Transcript length: ${transcript.length} characters`);
  console.log(`⏱️  Running 5 agents in parallel...\n`);
  
  const startTime = Date.now();
  
  // Run all 5 agents simultaneously
  const results = await Promise.allSettled([
    runInsightAgent(transcript),
    runHookAgent(transcript),
    runSpotlightAgent(transcript),
    runAmplifyAgent(transcript),
    runPulseAgent(transcript)
  ]);
  
  const totalTime = Date.now() - startTime;
  
  console.log(`\n✅ All agents completed in ${(totalTime / 1000).toFixed(2)}s\n`);
  
  // Process results
  const agentNames = ['insight', 'hook', 'spotlight', 'amplify', 'pulse'];
  const errors: AgentError[] = [];
  let successCount = 0;
  let failureCount = 0;
  
  // Extract agent data
  const agentData: any = {
    insight: null,
    hook: null,
    spotlight: null,
    amplify: null,
    pulse: null
  };
  
  results.forEach((result, index) => {
    const agentName = agentNames[index];
    
    if (result.status === 'fulfilled') {
      const agentResult: AgentResult = result.value;
      
      if (agentResult.success) {
        agentData[agentName] = agentResult.data;
        successCount++;
        console.log(`✅ ${agentName.toUpperCase()}: Success (${(agentResult.processing_time / 1000).toFixed(2)}s)`);
      } else {
        failureCount++;
        console.log(`❌ ${agentName.toUpperCase()}: Failed - ${agentResult.error}`);
        errors.push({
          agent: agentName,
          error: agentResult.error || 'Unknown error',
          timestamp: new Date().toISOString()
        });
      }
    } else {
      // Promise itself rejected (rare)
      failureCount++;
      console.log(`❌ ${agentName.toUpperCase()}: Promise rejected - ${result.reason}`);
      errors.push({
        agent: agentName,
        error: result.reason?.message || 'Promise rejected',
        timestamp: new Date().toISOString()
      });
    }
  });
  
  console.log(`\n📊 Results: ${successCount}/${agentNames.length} agents succeeded\n`);
  
  // Build final Growth Plan
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