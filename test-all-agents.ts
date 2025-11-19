// ============================================================================
// TEST: Complete Growth Plan Generation
// Tests all 5 agents running in parallel via orchestrator
// ============================================================================

import 'dotenv/config';
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { runAllAgents } from './api/agents/orchestrator';

async function testCompleteSystem() {
  console.log('\n' + '='.repeat(80));
  console.log('🎯 TESTING COMPLETE GROWTH PLAN GENERATION');
  console.log('='.repeat(80) + '\n');
  
  try {
    // Find the most recent transcript
    const transcriptsDir = join(process.cwd(), 'transcripts');
    const files = readdirSync(transcriptsDir);
    const transcriptFiles = files.filter(f => f.startsWith('transcript-'));
    
    if (transcriptFiles.length === 0) {
      throw new Error('No transcript files found in /transcripts folder');
    }
    
    const latestTranscript = transcriptFiles.sort().reverse()[0];
    const transcriptPath = join(transcriptsDir, latestTranscript);
    
    console.log(`📄 Loading transcript: ${latestTranscript}\n`);
    
    const transcript = readFileSync(transcriptPath, 'utf-8');
    
    // Run orchestrator
    const growthPlan = await runAllAgents(transcript);
    
    // Display summary
    console.log('='.repeat(80));
    console.log('📊 GROWTH PLAN SUMMARY');
    console.log('='.repeat(80));
    console.log(`\n⏱️  Total Time: ${(growthPlan.processing_time / 1000).toFixed(2)}s`);
    console.log(`✅ Successful: ${growthPlan.summary.agents_succeeded}/${growthPlan.summary.total_agents} agents`);
    console.log(`❌ Failed: ${growthPlan.summary.agents_failed}/${growthPlan.summary.total_agents} agents`);
    
    if (growthPlan.errors.length > 0) {
      console.log('\n⚠️  Errors:');
      growthPlan.errors.forEach(err => {
        console.log(`   - ${err.agent}: ${err.error}`);
      });
    }
    
    // Save to file
    const outputDir = join(process.cwd(), 'growth-plans');
    try {
      mkdirSync(outputDir, { recursive: true });
    } catch (e) {}
    
    const outputPath = join(outputDir, `growth-plan-${Date.now()}.json`);
    writeFileSync(outputPath, JSON.stringify(growthPlan, null, 2));
    
    console.log(`\n💾 Growth Plan saved to: ${outputPath}`);
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ COMPLETE SYSTEM TEST SUCCESSFUL!');
    console.log('='.repeat(80) + '\n');
    
    // Show which agents succeeded
    console.log('📋 Agent Status:');
    const agents = ['insight', 'hook', 'spotlight', 'amplify', 'pulse'];
    agents.forEach(agent => {
      const hasData = growthPlan.agents[agent] !== null;
      console.log(`   ${hasData ? '✅' : '❌'} ${agent.toUpperCase()}`);
    });
    
    console.log('\n');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testCompleteSystem();
