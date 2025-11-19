import type { VercelRequest, VercelResponse } from '@vercel/node';
import { put } from '@vercel/blob';

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
    // Vercel automatically parses multipart/form-data for us
    // File is available as a Buffer in req.body
    const contentType = req.headers['content-type'] || '';
    
    if (!contentType.includes('audio')) {
      return res.status(400).json({ error: 'File must be audio' });
    }

    const timestamp = Date.now();
    const filename = `podcast-${timestamp}.mp3`;

    // Upload to Vercel Blob
    const blob = await put(filename, req.body as Buffer, {
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
