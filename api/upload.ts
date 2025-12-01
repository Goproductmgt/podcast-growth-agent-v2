import type { VercelRequest, VercelResponse } from '@vercel/node';
import { put } from '@vercel/blob';

// CRITICAL: Disable Vercel's body parsing for large files
export const config = {
  api: {
    bodyParser: false,
  },
};

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
    console.log('📤 Starting upload...');
    
    const contentType = req.headers['content-type'] || '';
    
    if (!contentType.includes('audio')) {
      return res.status(400).json({ error: 'Content-Type must be audio/*' });
    }

    const timestamp = Date.now();
    const filename = `podcast-${timestamp}.mp3`;

    console.log(`📝 Uploading ${filename} to Vercel Blob...`);

    // Stream the request directly to Blob (no memory buffer!)
    const blob = await put(filename, req, {
      access: 'public',
      contentType: 'audio/mpeg',
    });

    console.log('✅ Upload successful:', blob.url);

    return res.status(200).json({
      success: true,
      blob_url: blob.url,
      filename: filename,
      uploaded_at: new Date().toISOString(),
    });

  } catch (error) {
    console.error('❌ Upload error:', error);
    return res.status(500).json({
      error: 'Upload failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
