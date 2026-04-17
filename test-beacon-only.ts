// ============================================================================
// TEST: Beacon Agent Only
// Tests the Beacon agent independently before orchestrator
// ============================================================================

import 'dotenv/config';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { runBeaconAgent } from './api/agents/beacon';

async function testBeaconAgent() {
  console.log('\n🔦 Testing Beacon Agent...\n');

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
    console.log(`📊 Transcript length: ${transcript.length} characters\n`);

    // Run Beacon agent
    console.log('🚀 Running Beacon agent...\n');
    const startTime = Date.now();

    const result = await runBeaconAgent(transcript);

    const totalTime = Date.now() - startTime;

    // Display results
    if (result.success) {
      console.log('✅ BEACON AGENT SUCCESS!\n');
      console.log('⏱️  Time:', (result.processing_time / 1000).toFixed(2) + 's');
      console.log('🎫 Tokens:', result.tokens_used?.input, 'in,', result.tokens_used?.output, 'out');

      const cost = ((result.tokens_used?.input || 0) / 1_000_000 * 1.25) +
                   ((result.tokens_used?.output || 0) / 1_000_000 * 10);
      console.log('💰 Cost: ~$' + cost.toFixed(4));

      console.log('\n📋 OUTPUT:\n');
      console.log(JSON.stringify(result.data, null, 2));

    } else {
      console.log('❌ BEACON AGENT FAILED!\n');
      console.log('Error:', result.error);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testBeaconAgent();
