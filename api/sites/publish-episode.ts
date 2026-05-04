import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildEpisodePageWithCurator, renderEpisodePageHtml } from '../site-builder/episode-page';
import { storeEpisodePage } from '../site-builder/storage';
import { EpisodePageInput } from '../site-builder/types';
import { requireSiteBuilderAuth, setSiteCorsHeaders } from './auth';

export const config = {
  maxDuration: 60
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSiteCorsHeaders(req, res, 'POST');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed. Use POST.' });
  }
  if (!requireSiteBuilderAuth(req, res)) return;

  try {
    const input = req.body as EpisodePageInput;
    if (!input?.growthPlan) {
      return res.status(400).json({
        success: false,
        error: 'growthPlan is required',
        usage: 'POST { growthPlan, episode?, brandKit?, resources?, siteSlug?, episodeSlug?, status? }'
      });
    }

    const page = await buildEpisodePageWithCurator({
      ...input,
      status: input.status || 'published'
    });

    const blobs = await storeEpisodePage(page);

    return res.status(200).json({
      success: true,
      page,
      html: renderEpisodePageHtml(page),
      blobs
    });
  } catch (error) {
    console.error('❌ Episode page publish failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Episode page publish failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
