import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { runAllAgents } from './api/agents/orchestrator';

async function testAgents() {
  console.log('='.repeat(60));
  console.log('🎙️  PODCAST GROWTH AGENT V2 - TEST RUN');
  console.log('='.repeat(60));
  console.log();
  
  try {
    // Find the most recent transcript file
    const transcriptsDir = './transcripts';
    const files = fs.readdirSync(transcriptsDir)
      .filter(file => file.startsWith('transcript-') && file.endsWith('.txt'))
      .sort()
      .reverse(); // Most recent first
    
    if (files.length === 0) {
      console.error('❌ No transcript files found in ./transcripts/');
      console.log('💡 Expected format: transcript-[timestamp].txt');
      return;
    }
    
    const transcriptFile = files[0];
    const transcriptPath = path.join(transcriptsDir, transcriptFile);
    
    console.log(`📂 Loading transcript: ${transcriptFile}`);
    const transcript = fs.readFileSync(transcriptPath, 'utf-8');
    console.log(`✅ Loaded ${transcript.length} characters\n`);
    
    // Run all agents
    const growthPlan = await runAllAgents(transcript);
    
    // Save results
    const outputDir = './growth-plans';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const outputFile = path.join(outputDir, `growth-plan-${Date.now()}.json`);
    fs.writeFileSync(outputFile, JSON.stringify(growthPlan, null, 2));
    
    console.log('='.repeat(60));
    console.log('📊 FINAL RESULTS');
    console.log('='.repeat(60));
    console.log(`✅ Success: ${growthPlan.summary.agents_succeeded}/${growthPlan.summary.total_agents} agents`);
    console.log(`⏱️  Total time: ${(growthPlan.processing_time / 1000).toFixed(2)}s`);
    console.log(`💾 Saved to: ${outputFile}`);
    
    if (growthPlan.errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      growthPlan.errors.forEach(error => {
        console.log(`   - ${error.agent}: ${error.error}`);
      });
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 TEST COMPLETE!');
    console.log('='.repeat(60));
    
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

testAgents();