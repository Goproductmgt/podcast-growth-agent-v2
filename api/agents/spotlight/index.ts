// ============================================================================
// AGENT: SPOTLIGHT - Runner
// ============================================================================

import OpenAI from 'openai';
import { buildSystemPrompt } from '../shared/system-context';
import { AgentResult } from '../shared/types';
import { SPOTLIGHT_CONFIG } from './config';
import { SPOTLIGHT_PROMPT } from './prompt';
import { SPOTLIGHT_SCHEMA, SpotlightOutput } from './types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function runSpotlightAgent(transcript: string): Promise<AgentResult> {
  const startTime = Date.now();
  
  try {
    const fullPrompt = buildSystemPrompt('Spotlight', SPOTLIGHT_PROMPT, transcript);
    
    const response = await openai.chat.completions.create({
      model: SPOTLIGHT_CONFIG.model,
      messages: [{ role: 'user', content: fullPrompt }],
      temperature: SPOTLIGHT_CONFIG.temperature,
      max_tokens: SPOTLIGHT_CONFIG.max_tokens,
      response_format: {
        type: 'json_schema',
        json_schema: SPOTLIGHT_SCHEMA
      },
      // @ts-ignore
      reasoning: { effort: SPOTLIGHT_CONFIG.reasoning_effort },
      text: { verbosity: SPOTLIGHT_CONFIG.verbosity }
    });

    const processingTime = Date.now() - startTime;
    const content = response.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No content returned from OpenAI');
    }

    const data: SpotlightOutput = JSON.parse(content);

    return {
      agent: 'Spotlight',
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
      agent: 'Spotlight',
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error',
      processing_time: processingTime
    };
  }
}