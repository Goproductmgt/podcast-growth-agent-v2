import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchShowProfile, storeShowProfile } from '../site-builder/show-profiles';
import type { ShowProfile } from '../site-builder/types';
import { requireSiteBuilderAuth, setSiteCorsHeaders } from './auth';

export const config = {
  maxDuration: 30
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSiteCorsHeaders(req, res, 'GET, POST');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const siteSlug = req.query.siteSlug;
      if (typeof siteSlug !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'siteSlug is required'
        });
      }

      const profile = await fetchShowProfile(siteSlug);
      if (!profile) {
        return res.status(404).json({
          success: false,
          error: 'Show profile not found',
          siteSlug
        });
      }

      return res.status(200).json({
        success: true,
        profile
      });
    }

    if (req.method === 'POST') {
      if (!requireSiteBuilderAuth(req, res)) return;
      const profile = req.body as ShowProfile;
      if (!profile?.siteSlug || !profile?.brandKit) {
        return res.status(400).json({
          success: false,
          error: 'siteSlug and brandKit are required'
        });
      }

      const now = new Date().toISOString();
      const normalizedProfile: ShowProfile = {
        ...profile,
        id: profile.id || `show_${profile.siteSlug}`,
        showName: profile.showName || profile.brandKit.showName,
        createdAt: profile.createdAt || now,
        updatedAt: now
      };
      const stored = await storeShowProfile(normalizedProfile);

      return res.status(200).json({
        success: true,
        profile: normalizedProfile,
        stored
      });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed. Use GET or POST.' });
  } catch (error) {
    console.error('❌ Show profile request failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Show profile request failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
