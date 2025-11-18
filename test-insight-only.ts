import 'dotenv/config';
import * as fs from 'fs';
import { runInsightAgent } from './api/agents/insight';

async function testInsight() {
  console.log('🧪 Testing INSIGHT agent only...\n');
  
  // Load transcript
  const files = fs.readdirSync('./transcripts')
    .filter(f => f.startsWith('transcript-'))
    .sort()
    .reverse();
  
  const transcript = fs.readFileSync(`./transcripts/${files[0]}`, 'utf-8');
  console.log(`📄 Loaded ${transcript.length} characters\n`);
  
  // Run just Insight
  const result = await runInsightAgent(transcript);
  
  if (result.success) {
    console.log('✅ INSIGHT AGENT SUCCESS!\n');
    console.log('📊 Output:');
    console.log(JSON.stringify(result.data, null, 2));
    console.log(`\n⏱️  Time: ${(result.processing_time / 1000).toFixed(2)}s`);
    console.log(`🎫 Tokens: ${result.tokens_used?.input} in, ${result.tokens_used?.output} out`);
  } else {
    console.log('❌ INSIGHT AGENT FAILED');
    console.log(`Error: ${result.error}`);
  }
}

testInsight();