// ============================================================================
// AGENT: HOOK - Runner
// ============================================================================

import OpenAI from 'openai';
import { buildSystemPrompt } from '../shared/system-context';
import { AgentResult } from '../shared/types';
import { HOOK_CONFIG } from './config';
import { HOOK_PROMPT } from './prompt';
import { HOOK_SCHEMA, HookOutput } from './types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function runHookAgent(transcript: string): Promise<AgentResult> {
  const startTime = Date.now();
  
  try {
    const fullPrompt = buildSystemPrompt('Hook', HOOK_PROMPT, transcript);
    
    const response = await openai.chat.completions.create({
      model: HOOK_CONFIG.model,
      messages: [{ role: 'user', content: fullPrompt }],
      temperature: HOOK_CONFIG.temperature,
      max_tokens: HOOK_CONFIG.max_tokens,
      response_format: {
        type: 'json_schema',
        json_schema: HOOK_SCHEMA
      },
      // @ts-ignore
      reasoning: { effort: HOOK_CONFIG.reasoning_effort },
      text: { verbosity: HOOK_CONFIG.verbosity }
    });

    const processingTime = Date.now() - startTime;
    const content = response.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No content returned from OpenAI');
    }

    const data: HookOutput = JSON.parse(content);

    return {
      agent: 'Hook',
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
      agent: 'Hook',
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error',
      processing_time: processingTime
    };
  }
}