// ============================================================================
// AGENT: INSIGHT - Runner
// Executes the Insight agent with OpenAI API
// ============================================================================

import OpenAI from 'openai';
import { buildSystemPrompt } from '../shared/system-context';
import { AgentResult } from '../shared/types';
import { INSIGHT_CONFIG } from './config';
import { INSIGHT_PROMPT } from './prompt';
import { INSIGHT_SCHEMA, InsightOutput } from './types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function runInsightAgent(transcript: string): Promise<AgentResult> {
  const startTime = Date.now();
  
  try {
    // Build the full prompt with system context
    const fullPrompt = buildSystemPrompt('Insight', INSIGHT_PROMPT, transcript);
    
    // Call OpenAI with Structured Outputs
    const response = await openai.chat.completions.create({
      model: INSIGHT_CONFIG.model,
      messages: [
        {
          role: 'user',
          content: fullPrompt
        }
      ],
      temperature: INSIGHT_CONFIG.temperature,
      max_tokens: INSIGHT_CONFIG.max_tokens,
      response_format: {
        type: 'json_schema',
        json_schema: INSIGHT_SCHEMA
      },
      // GPT-5 specific parameters
      // @ts-ignore - These params exist but TypeScript definitions may not be updated
      reasoning: {
        effort: INSIGHT_CONFIG.reasoning_effort
      },
      text: {
        verbosity: INSIGHT_CONFIG.verbosity
      }
    });

    const processingTime = Date.now() - startTime;
    const content = response.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No content returned from OpenAI');
    }

    // Parse the JSON response
    const data: InsightOutput = JSON.parse(content);

    return {
      agent: 'Insight',
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
      agent: 'Insight',
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error',
      processing_time: processingTime
    };
  }
}