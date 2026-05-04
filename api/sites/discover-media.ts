import type { VercelRequest, VercelResponse } from '@vercel/node';
import { discoverEpisodeMedia } from '../site-builder/media-discovery';
import { EpisodeMediaDiscoveryInput } from '../site-builder/types';

export const config = {
  maxDuration: 30
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed. Use POST.' });
  }

  try {
    const input = req.body as EpisodeMediaDiscoveryInput;
    if (!input?.episode?.episodeTitle) {
      return res.status(400).json({
        success: false,
        error: 'episode.episodeTitle is required',
        usage: 'POST { episode: { episodeTitle, podcastTitle?, appleUrl?, spotifyUrl?, youtubeUrl? }, integrations?, providers?, maxResults? }'
      });
    }

    const discovery = await discoverEpisodeMedia(input);

    return res.status(200).json({
      success: true,
      discovery
    });
  } catch (error) {
    console.error('❌ Episode media discovery failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Episode media discovery failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
