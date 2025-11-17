// ============================================================================
// AGENT: AMPLIFY - Runner
// ============================================================================

import OpenAI from 'openai';
import { buildSystemPrompt } from '../shared/system-context';
import { AgentResult } from '../shared/types';
import { AMPLIFY_CONFIG } from './config';
import { AMPLIFY_PROMPT } from './prompt';
import { AMPLIFY_SCHEMA, AmplifyOutput } from './types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function runAmplifyAgent(transcript: string): Promise<AgentResult> {
  const startTime = Date.now();
  
  try {
    const fullPrompt = buildSystemPrompt('Amplify', AMPLIFY_PROMPT, transcript);
    
    const response = await openai.chat.completions.create({
      model: AMPLIFY_CONFIG.model,
      messages: [{ role: 'user', content: fullPrompt }],
      temperature: AMPLIFY_CONFIG.temperature,
      max_tokens: AMPLIFY_CONFIG.max_tokens,
      response_format: {
        type: 'json_schema',
        json_schema: AMPLIFY_SCHEMA
      },
      // @ts-ignore
      reasoning: { effort: AMPLIFY_CONFIG.reasoning_effort },
      text: { verbosity: AMPLIFY_CONFIG.verbosity }
    });

    const processingTime = Date.now() - startTime;
    const content = response.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No content returned from OpenAI');
    }

    const data: AmplifyOutput = JSON.parse(content);

    return {
      agent: 'Amplify',
      success: true,
      data,
      error: null,
      processing_time: processingTime,
      tokens_used: {
        input: response.usage?.prompt_tokens || 0,
        output: response.usage?.completion_tokens || 0
      }
    };

  } catch (error) {
    const processingTime = Date.now() - startTime;
    return {
      agent: 'Amplify',
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error',
      processing_time: processingTime
    };
  }
}