import type { VercelRequest, VercelResponse } from '@vercel/node';
import { resolveBrandAssets } from '../site-builder/brand-assets';

export const config = {
  maxDuration: 30
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed. Use GET or POST.' });
  }

  try {
    const sourceUrl = req.method === 'POST' ? req.body?.url : req.query.url;
    if (!sourceUrl || typeof sourceUrl !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'url is required',
        usage: 'GET /api/sites/resolve-brand-assets?url=https://podcasts.apple.com/...'
      });
    }

    const assets = await resolveBrandAssets(sourceUrl);

    return res.status(200).json({
      success: true,
      assets,
      recommendedActions: [
        assets.logoUrl ? 'Use this podcast artwork as the first logo option.' : 'Ask the user to upload a logo.',
        'Let the user crop or replace this image in the editor.',
        'Save the selected image into the Brand Kit before publishing.'
      ]
    });
  } catch (error) {
    console.error('❌ Brand asset resolution failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Brand asset resolution failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
