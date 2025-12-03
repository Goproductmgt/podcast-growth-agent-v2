import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleUpload } from '@vercel/blob/client';

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

    console.log(`🔑 Generating upload URL for: ${filename}`);

    // This returns instructions for the client to upload directly to Blob
    const jsonResponse = await handleUpload({
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        return {
          allowedContentTypes: ['audio/mpeg', 'audio/mp3'],
          tokenPayload: JSON.stringify({
            uploadedAt: new Date().toISOString(),
          }),
        };
      },
      onUploadCompleted: async ({ blob }) => {
        console.log('✅ Upload completed:', blob.url);
      },
    });

    return res.status(200).json(jsonResponse);

  } catch (error) {
    console.error('❌ Error generating upload URL:', error);
    return res.status(500).json({
      error: 'Failed to generate upload URL',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
