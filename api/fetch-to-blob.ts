import type { VercelRequest, VercelResponse } from '@vercel/node';
import { put } from '@vercel/blob';

// ============================================================================
// FETCH TO BLOB - Stream audio from URL to Vercel Blob
// ============================================================================

interface FetchToBlobResponse {
  success: boolean;
  blobUrl?: string;
  size?: number;
  error?: string;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  // Validate token exists (early fail-fast)
  const token = process.env.PGA2_READ_WRITE_TOKEN;
  if (!token) {
    console.error('❌ PGA2_READ_WRITE_TOKEN not configured');
    res.status(500).json({
      success: false,
      error: 'Blob storage not configured'
    });
    return;
  }

  const { audioUrl, filename } = req.body;

  if (!audioUrl || typeof audioUrl !== 'string') {
    res.status(400).json({ 
      success: false, 
      error: 'Missing or invalid audioUrl parameter' 
    });
    return;
  }

  const blobFilename = filename || `podcast-${Date.now()}.mp3`;

  console.log('🎵 Fetching audio from URL:', audioUrl);
  console.log('📁 Target blob filename:', blobFilename);

  try {
    // Step 1: Fetch the audio file
    const audioResponse = await fetch(audioUrl);
    
    if (!audioResponse.ok) {
      console.error('❌ Failed to fetch audio:', audioResponse.status, audioResponse.statusText);
      res.status(502).json({
        success: false,
        error: `Failed to fetch audio from source: ${audioResponse.statusText}`
      });
      return;
    }

    // Check if we got a valid audio response
    const contentType = audioResponse.headers.get('content-type');
    console.log('🎧 Audio content type:', contentType);

    // Get the audio as a buffer (for Vercel Blob)
    const audioBuffer = await audioResponse.arrayBuffer();
    const audioSize = audioBuffer.byteLength;
    
    console.log('📦 Downloaded audio size:', audioSize, 'bytes (~' + Math.round(audioSize / 1024 / 1024) + 'MB)');

    if (audioSize === 0) {
      console.error('❌ Downloaded audio file is empty');
      res.status(502).json({
        success: false,
        error: 'Downloaded audio file is empty'
      });
      return;
    }

    // Step 2: Upload to Vercel Blob
    console.log('☁️  Uploading to Vercel Blob...');
    
    const blob = await put(blobFilename, audioBuffer, {
      access: 'public',
      contentType: contentType || 'audio/mpeg',
      token: token,  // ← CRITICAL: Pass the token explicitly
      addRandomSuffix: true  // Make filenames unique
    });

    console.log('✅ Successfully uploaded to blob:', blob.url);

    const response: FetchToBlobResponse = {
      success: true,
      blobUrl: blob.url,
      size: audioSize
    };

    res.status(200).json(response);

  } catch (error) {
    console.error('❌ Error in fetch-to-blob:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
}