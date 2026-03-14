import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { get } from 'https';
import { put } from '@vercel/blob';
import { chunkAudioFile } from './chunking/audioChunker';
import { transcribeAudioChunks } from './transcribe/groqTranscriber';
import { generateGrowthPlanStream } from './agents/orchestrator-stream';

// ============================================================================
// PROCESS STREAM - SSE streaming endpoint
// ============================================================================
//
// Same pipeline as process.ts but streams agent results as SSE events.
//
// SSE Events:
//   event: stage        → Pipeline progress (resolving, downloading, transcribing, agents)
//   event: agent_complete → Individual agent result
//   event: complete     → Final growth plan + report info
//   event: error        → Error occurred
//
// Accepts same body as process.ts: { blobUrl, episodeUrl? }
// ============================================================================

export const config = {
  maxDuration: 300,
};

// Helper to send an SSE event
function sendEvent(res: VercelResponse, event: string, data: any): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

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

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.status(200);

  const startTime = Date.now();

  try {
    const { blobUrl, episodeUrl } = req.body;

    if (!blobUrl) {
      sendEvent(res, 'error', { error: 'blobUrl is required' });
      res.end();
      return;
    }

    // ====================================================================
    // STAGE 1: Download
    // ====================================================================
    sendEvent(res, 'stage', { stage: 'downloading', message: 'Downloading audio...' });

    const timestamp = Date.now();
    const localPath = `/tmp/podcast-${timestamp}.mp3`;
    await downloadFile(blobUrl, localPath);

    // ====================================================================
    // STAGE 2: Chunk
    // ====================================================================
    sendEvent(res, 'stage', { stage: 'chunking', message: 'Splitting audio...' });

    const chunksDir = await chunkAudioFile(localPath);

    // ====================================================================
    // STAGE 3: Transcribe
    // ====================================================================
    sendEvent(res, 'stage', { stage: 'transcribing', message: 'Transcribing audio...' });

    const transcribeStart = Date.now();
    const result = await transcribeAudioChunks(chunksDir);
    const transcript = result.fullText;
    const transcribeTime = Date.now() - transcribeStart;

    console.log(`✅ Transcription complete in ${(transcribeTime / 1000).toFixed(1)}s`);

    // ====================================================================
    // STAGE 4: Run agents with streaming
    // ====================================================================
    sendEvent(res, 'stage', {
      stage: 'agents',
      message: 'Running AI agents...',
      transcript_length: transcript.length
    });

    const episodeId = `episode-${timestamp}`;

    const growthPlan = await generateGrowthPlanStream(
      transcript,
      (agentName, agentResult) => {
        // Stream each agent result as it completes
        sendEvent(res, 'agent_complete', {
          agent: agentName,
          success: agentResult.success,
          data: agentResult.data,
          error: agentResult.error,
          processing_time: agentResult.processing_time
        });
      },
      episodeId,
      episodeUrl
    );

    const agentsTime = Date.now() - (startTime + transcribeTime);
    const totalTime = Date.now() - startTime;

    // ====================================================================
    // STAGE 5: Store report
    // ====================================================================
    sendEvent(res, 'stage', { stage: 'saving', message: 'Saving report...' });

    const reportId = `rprt_${timestamp}_${Math.random().toString(36).substring(2, 11)}`;

    const reportData = {
      id: reportId,
      createdAt: new Date().toISOString(),
      episodeId: growthPlan.episode_id || episodeId,
      transcriptLength: transcript.length,
      processingTime: totalTime,
      transcript: transcript,
      growthPlan: growthPlan,
    };

    const blob = await put(`reports/${reportId}.json`, JSON.stringify(reportData), {
      access: 'public',
      token: process.env.PGA2_READ_WRITE_TOKEN,
      contentType: 'application/json',
    });

    const reportUrl = `https://podcastgrowthagent.com/#/report/${reportId}`;

    console.log(`✅ Report stored: ${reportId}`);
    console.log(`🎉 PIPELINE COMPLETE in ${(totalTime / 1000).toFixed(1)}s`);

    // ====================================================================
    // FINAL EVENT: Complete
    // ====================================================================
    sendEvent(res, 'complete', {
      success: true,
      growth_plan: growthPlan,
      reportId,
      reportUrl,
      reportBlobUrl: blob.url,
      metrics: {
        total_time: `${(totalTime / 1000).toFixed(1)}s`,
        transcription_time: `${(transcribeTime / 1000).toFixed(1)}s`,
        agents_time: `${(agentsTime / 1000).toFixed(1)}s`,
        transcript_length: transcript.length,
      }
    });

    res.end();

  } catch (error) {
    console.error('❌ Stream pipeline error:', error);
    sendEvent(res, 'error', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    res.end();
  }
}

// Helper function to download file from URL
async function downloadFile(url: string, destination: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`📡 Fetching: ${url}`);

    get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          downloadFile(redirectUrl, destination).then(resolve).catch(reject);
          return;
        }
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Download failed with status: ${response.statusCode}`));
        return;
      }

      const fileStream = createWriteStream(destination);
      pipeline(response, fileStream).then(() => resolve()).catch(reject);
    }).on('error', (error) => {
      reject(new Error(`Network error: ${error.message}`));
    });
  });
}
