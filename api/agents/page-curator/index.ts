import type { AgentResult } from '../shared/types';
import type { EpisodePageInput } from '../../site-builder/types';
import { getOpenAIClient } from '../shared/openai-client';
import { PAGE_CURATOR_CONFIG } from './config';
import { PAGE_CURATOR_PROMPT } from './prompt';
import { PAGE_CURATOR_SKILLS } from './skills';
import { PAGE_CURATOR_SCHEMA, PageCuratorOutput } from './types';

interface MessageOutputItem {
  type: 'message';
  content: Array<{
    type: string;
    text?: string;
  }>;
}

function isMessageItem(item: any): item is MessageOutputItem {
  return item && item.type === 'message' && Array.isArray(item.content);
}

export async function runPageCuratorAgent(input: EpisodePageInput): Promise<AgentResult> {
  const startTime = Date.now();

  try {
    const response = await getOpenAIClient().responses.create({
      model: PAGE_CURATOR_CONFIG.model,
      input: buildPageCuratorInput(input),
      max_output_tokens: PAGE_CURATOR_CONFIG.max_tokens,
      reasoning: {
        effort: PAGE_CURATOR_CONFIG.reasoning_effort
      },
      text: {
        verbosity: PAGE_CURATOR_CONFIG.verbosity,
        format: {
          type: 'json_schema',
          name: PAGE_CURATOR_SCHEMA.name,
          schema: PAGE_CURATOR_SCHEMA.schema,
          strict: PAGE_CURATOR_SCHEMA.strict
        }
      }
    });

    const processingTime = Date.now() - startTime;
    let content: string | undefined = (response as any).output_text;

    if (!content && Array.isArray(response.output)) {
      const messageItem = response.output.find(isMessageItem);
      const firstContent = (messageItem as any)?.content?.[0];
      if (firstContent?.text) content = firstContent.text;
    }

    if (!content) throw new Error('No content returned from OpenAI');

    const data: PageCuratorOutput = normalizePageCuratorOutput(JSON.parse(content));

    return {
      agent: 'Page Curator',
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
    return {
      agent: 'Page Curator',
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error',
      processing_time: Date.now() - startTime
    };
  }
}

function buildPageCuratorInput(input: EpisodePageInput): string {
  return `${PAGE_CURATOR_PROMPT}

${PAGE_CURATOR_SKILLS}

PAGE BUILDER CONTEXT:
${JSON.stringify({
    brandKit: input.brandKit,
    episode: input.episode,
    growthPlan: input.growthPlan,
    resources: input.resources || [],
    integrations: input.integrations || [],
    selectedBlocks: input.selectedBlocks || []
  }, null, 2)}
`;
}

function normalizePageCuratorOutput(output: PageCuratorOutput): PageCuratorOutput {
  return {
    ...output,
    creatorGuide: (output.creatorGuide || []).map(item => ({
      ...item,
      url: item.url || undefined
    }))
  };
}
