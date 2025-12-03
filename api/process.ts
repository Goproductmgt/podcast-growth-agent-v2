import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { get } from 'https';
import { chunkAudioFile } from './chunking/audioChunker';
import { transcribeAudioChunks } from './transcribe/groqTranscriber';
import { generateGrowthPlan } from './agents/orchestrator';

export const config = {
  maxDuration: 300, // 5 minutes (matches vercel.json)
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

  const startTime = Date.now();

  try {
    const { blobUrl } = req.body;

    if (!blobUrl) {
      return res.status(400).json({ 
        error: 'blobUrl is required',
        usage: 'POST { "blobUrl": "https://..." }'
      });
    }

    console.log('📥 Starting processing pipeline...');
    console.log('📍 Blob URL:', blobUrl);

    // Step 1: Download MP3 from Blob to /tmp
    const timestamp = Date.now();
    const localPath = `/tmp/podcast-${timestamp}.mp3`;
    
    console.log('⬇️  Downloading from Blob to /tmp...');
    await downloadFile(blobUrl, localPath);
    console.log('✅ Download complete:', localPath);

    // Step 2: Chunk audio for transcription
    console.log('✂️  Chunking audio with ffmpeg...');
    const chunksDir = await chunkAudioFile(localPath);
    console.log(`✅ Chunking complete: ${chunksDir}`);

    // Step 3: Transcribe all chunks in parallel
    console.log('🎙️  Transcribing (parallel via Groq)...');
    const transcribeStart = Date.now();
    const transcript = await transcribeAudioChunks(chunksDir);
    const transcribeTime = Date.now() - transcribeStart;
    console.log(`✅ Transcription complete in ${(transcribeTime / 1000).toFixed(1)}s`);
    console.log(`📝 Transcript length: ${transcript.length} characters`);

    // Step 4: Run all 5 AI agents in parallel
    console.log('🤖 Running 5 AI agents (Insight, Hook, Spotlight, Amplify, Pulse)...');
    const agentsStart = Date.now();
    const growthPlan = await generateGrowthPlan(transcript);
    const agentsTime = Date.now() - agentsStart;
    console.log(`✅ Growth Plan generated in ${(agentsTime / 1000).toFixed(1)}s`);

    const totalTime = Date.now() - startTime;

    console.log('🎉 PIPELINE COMPLETE');
    console.log(`⏱️  Total time: ${(totalTime / 1000).toFixed(1)}s`);
    console.log(`   - Transcription: ${(transcribeTime / 1000).toFixed(1)}s`);
    console.log(`   - Agents: ${(agentsTime / 1000).toFixed(1)}s`);

    return res.status(200).json({
      success: true,
      growth_plan: growthPlan,
      metrics: {
        total_time: `${(totalTime / 1000).toFixed(1)}s`,
        transcription_time: `${(transcribeTime / 1000).toFixed(1)}s`,
        agents_time: `${(agentsTime / 1000).toFixed(1)}s`,
        transcript_length: transcript.length,
      }
    });

  } catch (error) {
    console.error('❌ Pipeline error:', error);
    const totalTime = Date.now() - startTime;
    
    return res.status(500).json({
      success: false,
      error: 'Processing failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      processing_time: `${(totalTime / 1000).toFixed(1)}s`,
    });
  }
}

// Helper function to download file from URL to local filesystem
async function downloadFile(url: string, destination: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`📡 Fetching: ${url}`);
    
    get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          console.log(`↪️  Redirect to: ${redirectUrl}`);
          downloadFile(redirectUrl, destination)
            .then(resolve)
            .catch(reject);
          return;
        }
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Download failed with status: ${response.statusCode}`));
        return;
      }

      const fileStream = createWriteStream(destination);
      
      pipeline(response, fileStream)
        .then(() => {
          console.log('💾 File saved to:', destination);
          resolve();
        })
        .catch(reject);
        
    }).on('error', (error) => {
      reject(new Error(`Network error: ${error.message}`));
    });
  });
}
