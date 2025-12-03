// ============================================================================
// AGENT: PULSE - Runner
// Executes the Pulse agent with OpenAI Responses API (GPT-5)
// ============================================================================

import OpenAI from 'openai';
import { buildSystemPrompt } from '../shared/system-context';
import { AgentResult } from '../shared/types';
import { PULSE_CONFIG } from './config';
import { PULSE_PROMPT } from './prompt';
import { PULSE_SCHEMA, PulseOutput } from './types';

const openai = new OpenAI({
  apiKey: process.env.OpenAI
});

// Type definition for message output item
interface MessageOutputItem {
  type: 'message';
  content: Array<{
    type: string;
    text?: string;
  }>;
}

// Type guard to check if an output item is a message
function isMessageItem(item: any): item is MessageOutputItem {
  return item && item.type === 'message' && Array.isArray(item.content);
}

export async function runPulseAgent(transcript: string): Promise<AgentResult> {
  const startTime = Date.now();
  
  try {
    // Build the full prompt with system context
    const fullPrompt = buildSystemPrompt('Pulse', PULSE_PROMPT, transcript);
    
    // Call OpenAI Responses API (GPT-5)
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

    const processingTime = Date.now() - startTime;
    
    // Extract JSON content from Responses API
    // GPT-5 Responses API puts JSON in output_text at the top level (most reliable)
    let content: string | undefined = (response as any).output_text;
    
    // Fallback: look for message type in output array
    if (!content && Array.isArray(response.output)) {
      const messageItem = response.output.find(isMessageItem);
      
      // Runtime check confirmed it's a message, cast for property access
      if (messageItem) {
        const firstContent = (messageItem as any).content[0];
        if (firstContent && firstContent.text) {
          content = firstContent.text;
        }
      }
    }

    if (!content) {
      throw new Error('No content returned from OpenAI');
    }

    // Parse the JSON response
    const data: PulseOutput = JSON.parse(content);

    return {
      agent: 'Pulse',
      success: true,
      data,
      error: null,
      processing_time: processingTime,
      tokens_used: {
        input: response.usage?.input_tokens ?? 0,
        output: response.usage?.output_tokens ?? 0
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