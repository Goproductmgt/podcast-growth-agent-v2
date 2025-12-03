import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const timestamp = Date.now();
    const filename = `podcast-${timestamp}.mp3`;
    const token = process.env.PGA2_READ_WRITE_TOKEN;

    if (!token) {
      throw new Error('PGA2_READ_WRITE_TOKEN not configured');
    }

    console.log(`🔑 Generating client upload token for: ${filename}`);

    // Generate client upload token
    const uploadUrl = `https://blob.vercel-storage.com/${filename}`;
    
    // Return the URL and token for client-side upload
    return res.status(200).json({
      url: uploadUrl,
      token: token,
      filename: filename,
      uploadedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('❌ Error generating upload URL:', error);
    return res.status(500).json({
      error: 'Failed to generate upload URL',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}