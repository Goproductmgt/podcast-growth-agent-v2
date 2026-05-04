import { put } from '@vercel/blob';
import type { EpisodePageDocument } from './types';
import { renderEpisodePageHtml, renderEpisodePageLlmText } from './episode-page';

const DEFAULT_BLOB_BASE_URL = 'https://ezuhvwbolslnriog.public.blob.vercel-storage.com';

export async function storeEpisodePage(page: EpisodePageDocument): Promise<{
  jsonBlobUrl: string;
  htmlBlobUrl: string;
  llmTextBlobUrl: string;
}> {
  if (page.status !== 'published') {
    throw new Error('Only published episode pages can be stored as public artifacts.');
  }

  const token = process.env.PGA2_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error('Missing Vercel Blob token. Set PGA2_READ_WRITE_TOKEN or BLOB_READ_WRITE_TOKEN.');
  }

  const basePath = `sites/${page.siteSlug}/episodes/${page.episodeSlug}`;
  const [jsonBlob, htmlBlob, llmTextBlob] = await Promise.all([
    put(`${basePath}.json`, JSON.stringify(page, null, 2), {
      access: 'public',
      token,
      contentType: 'application/json'
    }),
    put(`${basePath}.html`, renderEpisodePageHtml(page), {
      access: 'public',
      token,
      contentType: 'text/html; charset=utf-8'
    }),
    put(`${basePath}/llm.txt`, renderEpisodePageLlmText(page), {
      access: 'public',
      token,
      contentType: 'text/plain; charset=utf-8'
    })
  ]);

  return {
    jsonBlobUrl: jsonBlob.url,
    htmlBlobUrl: htmlBlob.url,
    llmTextBlobUrl: llmTextBlob.url
  };
}

export async function fetchStoredEpisodePage(siteSlug: string, episodeSlug: string): Promise<EpisodePageDocument | null> {
  const blobBaseUrl = process.env.PGA2_BLOB_PUBLIC_BASE_URL || DEFAULT_BLOB_BASE_URL;
  const response = await fetch(`${blobBaseUrl}/sites/${siteSlug}/episodes/${episodeSlug}.json`);

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Failed to fetch stored page: ${response.status} ${response.statusText}`);
  }

  const page = await response.json() as EpisodePageDocument;
  if (page.status !== 'published') return null;

  return page;
}
