import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getBlockCatalog } from '../site-builder/blocks';

export const config = {
  maxDuration: 10
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed. Use GET.' });
  }

  return res.status(200).json({
    success: true,
    blocks: getBlockCatalog(),
    recommendedFlow: [
      'Start with the generated episode page.',
      'Add media blocks by pasting YouTube, Instagram, TikTok, or shopping URLs.',
      'Connect providers only when the platform requires it.',
      'Preview, edit labels/copy, then publish.'
    ]
  });
}
