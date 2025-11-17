// ============================================================================
// AGENT: PULSE - Runner
// ============================================================================

import OpenAI from 'openai';
import { buildSystemPrompt } from '../shared/system-context';
import { AgentResult } from '../shared/types';
import { PULSE_CONFIG } from './config';
import { PULSE_PROMPT } from './prompt';
import { PULSE_SCHEMA, PulseOutput } from './types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function runPulseAgent(transcript: string): Promise<AgentResult> {
  const startTime = Date.now();
  
  try {
    const fullPrompt = buildSystemPrompt('Pulse', PULSE_PROMPT, transcript);
    
    const response = await openai.chat.completions.create({
      model: PULSE_CONFIG.model,
      messages: [{ role: 'user', content: fullPrompt }],
      temperature: PULSE_CONFIG.temperature,
      max_tokens: PULSE_CONFIG.max_tokens,
      response_format: {
        type: 'json_schema',
        json_schema: PULSE_SCHEMA
      },
      // @ts-ignore
      reasoning: { effort: PULSE_CONFIG.reasoning_effort },
      text: { verbosity: PULSE_CONFIG.verbosity }
    });

    const processingTime = Date.now() - startTime;
    const content = response.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No content returned from OpenAI');
    }

    const data: PulseOutput = JSON.parse(content);

    return {
      agent: 'Pulse',
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
      agent: 'Pulse',
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error',
      processing_time: processingTime
    };
  }
}