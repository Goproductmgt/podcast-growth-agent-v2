import 'dotenv/config';
import OpenAI from 'openai';

let client: OpenAI | null = null;

export function getOpenAIApiKey(): string | undefined {
  return process.env.OPENAI_API_KEY || process.env.OpenAI;
}

export function hasOpenAIApiKey(): boolean {
  return Boolean(getOpenAIApiKey());
}

export function getOpenAIClient(): OpenAI {
  if (!client) {
    const apiKey = getOpenAIApiKey();
    if (!apiKey) {
      throw new Error('Missing OpenAI API key. Set OPENAI_API_KEY in the environment.');
    }

    client = new OpenAI({
      apiKey
    });
  }

  return client;
}
