// ============================================================================
// AGENT: BRIDGE - Runner
// Executes the Bridge agent with OpenAI Responses API (GPT-5)
// ============================================================================

import OpenAI from 'openai';
import { buildSystemPrompt } from '../shared/system-context';
import { AgentResult } from '../shared/types';
import { filterByValidUrls } from '../shared/url-validator';
import { BRIDGE_CONFIG } from './config';
import { BRIDGE_PROMPT } from './prompt';
import { BRIDGE_SCHEMA, BridgeOutput } from './types';

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

export async function runBridgeAgent(transcript: string): Promise<AgentResult> {
  const startTime = Date.now();

  try {
    // Build the full prompt with system context
    const fullPrompt = buildSystemPrompt('Bridge', BRIDGE_PROMPT, transcript);

    // Call OpenAI Responses API (GPT-5)
    const response = await openai.responses.create({
      model: BRIDGE_CONFIG.model,
      input: fullPrompt,
      max_output_tokens: BRIDGE_CONFIG.max_tokens,
      reasoning: {
        effort: BRIDGE_CONFIG.reasoning_effort as 'low' | 'medium' | 'high'
      },
      text: {
        verbosity: BRIDGE_CONFIG.verbosity as 'low' | 'medium' | 'high',
        format: {
          type: 'json_schema',
          name: BRIDGE_SCHEMA.name,
          schema: BRIDGE_SCHEMA.schema,
          strict: BRIDGE_SCHEMA.strict
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
    const rawData: BridgeOutput = JSON.parse(content);

    // Validate URLs — filter out hallucinated/parked podcast links
    const validMatches = await filterByValidUrls(
      rawData.podcast_matches,
      (m) => m.podcast_url,
      'Bridge'
    );

    if (validMatches.length === 0) {
      return {
        agent: 'Bridge',
        success: false,
        data: null,
        error: 'All podcast URLs failed validation',
        processing_time: Date.now() - startTime
      };
    }

    const data: BridgeOutput = { podcast_matches: validMatches };

    return {
      agent: 'Bridge',
      success: true,
      data,
      error: null,
      processing_time: Date.now() - startTime,
      tokens_used: {
        input: response.usage?.input_tokens ?? 0,
        output: response.usage?.output_tokens ?? 0
      }
    };

  } catch (error) {
    const processingTime = Date.now() - startTime;
    return {
      agent: 'Bridge',
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error',
      processing_time: processingTime
    };
  }
}
