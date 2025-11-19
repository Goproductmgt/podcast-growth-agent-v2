// ============================================================================
// TEST: Amplify Agent Debug
// Shows raw GPT-5 response to diagnose extraction issue
// ============================================================================

import 'dotenv/config';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import OpenAI from 'openai';
import { buildSystemPrompt } from './api/agents/shared/system-context';
import { AMPLIFY_CONFIG } from './api/agents/amplify/config';
import { AMPLIFY_PROMPT } from './api/agents/amplify/prompt';
import { AMPLIFY_SCHEMA } from './api/agents/amplify/types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function debugAmplifyAgent() {
  console.log('\n🔍 DEBUGGING AMPLIFY AGENT...\n');
  
  try {
    const transcriptsDir = join(process.cwd(), 'transcripts');
    const files = readdirSync(transcriptsDir);
    const transcriptFiles = files.filter(f => f.startsWith('transcript-'));
    const latestTranscript = transcriptFiles.sort().reverse()[0];
    const transcriptPath = join(transcriptsDir, latestTranscript);
    
    const transcript = readFileSync(transcriptPath, 'utf-8');
    
    console.log('🚀 Calling GPT-5...\n');
    
    const fullPrompt = buildSystemPrompt('Amplify', AMPLIFY_PROMPT, transcript);
    
    const response = await openai.responses.create({
      model: AMPLIFY_CONFIG.model,
      input: fullPrompt,
      max_output_tokens: AMPLIFY_CONFIG.max_tokens,
      reasoning: {
        effort: AMPLIFY_CONFIG.reasoning_effort as 'low' | 'medium' | 'high'
      },
      text: {
        verbosity: AMPLIFY_CONFIG.verbosity as 'low' | 'medium' | 'high',
        format: {
          type: 'json_schema',
          name: AMPLIFY_SCHEMA.name,
          schema: AMPLIFY_SCHEMA.schema,
          strict: AMPLIFY_SCHEMA.strict
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
      console.log('\nFirst 800 characters:');
      console.log(content.substring(0, 800));
      console.log('\n...\n');
    } else {
      console.log('❌ No content in output_text');
      console.log('\n📋 Full response object keys:', Object.keys(response));
      console.log('\n📋 Response.output array:');
      console.log(JSON.stringify(response.output, null, 2));
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
      }
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

debugAmplifyAgent();
