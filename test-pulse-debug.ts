// ============================================================================
// TEST: Pulse Agent Debug
// Shows raw GPT-5 response to diagnose JSON parsing issue
// ============================================================================

import 'dotenv/config';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import OpenAI from 'openai';
import { buildSystemPrompt } from './api/agents/shared/system-context';
import { PULSE_CONFIG } from './api/agents/pulse/config';
import { PULSE_PROMPT } from './api/agents/pulse/prompt';
import { PULSE_SCHEMA } from './api/agents/pulse/types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function debugPulseAgent() {
  console.log('\n🔍 DEBUGGING PULSE AGENT...\n');
  
  try {
    const transcriptsDir = join(process.cwd(), 'transcripts');
    const files = readdirSync(transcriptsDir);
    const transcriptFiles = files.filter(f => f.startsWith('transcript-'));
    const latestTranscript = transcriptFiles.sort().reverse()[0];
    const transcriptPath = join(transcriptsDir, latestTranscript);
    
    const transcript = readFileSync(transcriptPath, 'utf-8');
    
    console.log('🚀 Calling GPT-5...\n');
    
    const fullPrompt = buildSystemPrompt('Pulse', PULSE_PROMPT, transcript);
    
    const response = await openai.responses.create({
      model: PULSE_CONFIG.model,
      input: fullPrompt,
      max_output_tokens: PULSE_CONFIG.max_tokens,
      reasoning: {
        effort: PULSE_CONFIG.reasoning_effort as 'low' | 'medium' | 'high'
      },
      text: {
        verbosity: PULSE_CONFIG.verbosity as 'low' | 'medium' | 'high',
        format: {
          type: 'json_schema',
          name: PULSE_SCHEMA.name,
          schema: PULSE_SCHEMA.schema,
          strict: PULSE_SCHEMA.strict
        }
      }
    });
    
    console.log('📦 Response status:', response.status);
    console.log('📊 Response output length:', response.output?.length || 0);
    console.log('\n');
    
    // Try primary extraction
    let content: string | undefined = (response as any).output_text;
    
    console.log('🔍 PRIMARY EXTRACTION (output_text):');
    if (content) {
      console.log('✅ Found content');
      console.log('Length:', content.length);
      console.log('\nFirst 500 characters:');
      console.log(content.substring(0, 500));
      console.log('\n...\n');
      console.log('Last 500 characters:');
      console.log(content.substring(Math.max(0, content.length - 500)));
    } else {
      console.log('❌ No content in output_text');
    }
    
    console.log('\n' + '='.repeat(80) + '\n');
    
    // Try parsing
    if (content) {
      console.log('🔧 ATTEMPTING TO PARSE JSON...\n');
      try {
        const parsed = JSON.parse(content);
        console.log('✅ JSON PARSED SUCCESSFULLY!');
        console.log(JSON.stringify(parsed, null, 2));
      } catch (parseError) {
        console.log('❌ JSON PARSE FAILED!');
        console.log('Error:', parseError instanceof Error ? parseError.message : parseError);
        
        // Show the problematic area
        const match = parseError instanceof Error ? parseError.message.match(/position (\d+)/) : null;
        if (match) {
          const pos = parseInt(match[1]);
          console.log('\n📍 Content around error position:');
          console.log(content.substring(Math.max(0, pos - 100), Math.min(content.length, pos + 100)));
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

debugPulseAgent();
