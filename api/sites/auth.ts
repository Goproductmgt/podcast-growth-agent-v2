import type { VercelRequest, VercelResponse } from '@vercel/node';

const DEFAULT_ALLOWED_ORIGIN = 'https://podcastgrowthagent.com';

export function setSiteCorsHeaders(req: VercelRequest, res: VercelResponse, methods: string): void {
  const allowedOrigin = process.env.SITE_BUILDER_ALLOWED_ORIGIN || DEFAULT_ALLOWED_ORIGIN;
  const origin = req.headers.origin;
  res.setHeader('Access-Control-Allow-Origin', origin === allowedOrigin ? allowedOrigin : allowedOrigin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', `${methods}, OPTIONS`);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Site-Builder-Secret');
}

export function requireSiteBuilderAuth(req: VercelRequest, res: VercelResponse): boolean {
  const secret = process.env.SITE_BUILDER_API_SECRET;
  if (!secret) {
    res.status(500).json({
      success: false,
      error: 'SITE_BUILDER_API_SECRET is required before write endpoints can be used.'
    });
    return false;
  }

  const authorization = req.headers.authorization || '';
  const bearer = authorization.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : '';
  const headerSecret = req.headers['x-site-builder-secret'];
  const providedSecret = typeof headerSecret === 'string' ? headerSecret : bearer;

  if (providedSecret !== secret) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized'
    });
    return false;
  }

  return true;
}
