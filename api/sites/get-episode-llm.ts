import type { VercelRequest, VercelResponse } from '@vercel/node';
import { renderEpisodePageLlmText } from '../site-builder/episode-page';
import { fetchStoredEpisodePage } from '../site-builder/storage';

export const config = {
  maxDuration: 15
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed. Use GET.' });
  }

  try {
    const siteSlug = req.query.siteSlug;
    const episodeSlug = req.query.episodeSlug;

    if (typeof siteSlug !== 'string' || typeof episodeSlug !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'siteSlug and episodeSlug are required',
        usage: 'GET /api/sites/get-episode-llm?siteSlug=redesigning-health-home&episodeSlug=...'
      });
    }

    const page = await fetchStoredEpisodePage(siteSlug, episodeSlug);
    if (!page) {
      return res.status(404).json({
        success: false,
        error: 'Episode page not found',
        siteSlug,
        episodeSlug
      });
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600');
    return res.status(200).send(renderEpisodePageLlmText(page));
  } catch (error) {
    console.error('Episode llm.txt fetch failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Episode llm.txt fetch failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
