import type { VercelRequest, VercelResponse } from '@vercel/node';

// ============================================================================
// PROCESS URL STREAM - SSE streaming for URL-based pipeline
// ============================================================================
//
// Same flow as process-url.ts but streams agent results via SSE.
// Steps 1-2 (resolve + fetch-to-blob) happen first, then
// delegates to process-stream logic for chunking/transcription/agents.
//
// Accepts same body as process-url.ts: { url }
// ============================================================================

import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { get } from 'https';
import { put } from '@vercel/blob';
// youtube-transcript is ESM-only, must use dynamic import
async function fetchYouTubeTranscript(videoId: string) {
  const { YoutubeTranscript } = await import('youtube-transcript');
  return YoutubeTranscript.fetchTranscript(videoId);
}
import { chunkAudioFile } from './chunking/audioChunker';
import { transcribeAudioChunks } from './transcribe/groqTranscriber';
import { generateGrowthPlanStream } from './agents/orchestrator-stream';

export const config = {
  maxDuration: 300,
};

function sendEvent(res: VercelResponse, event: string, data: any): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

interface ResolveSourceResponse {
  success: boolean;
  metadata?: {
    episodeUrl: string;
    episodeTitle: string;
    podcastTitle: string;
    publishDate: string;
    audioUrl: string;
    audioDuration?: number;
    podcastSocial?: Record<string, string>;
  };
  error?: string;
}

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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.status(200);

  const { url } = req.body;

  if (!url || typeof url !== 'string') {
    sendEvent(res, 'error', { error: 'Missing or invalid url parameter' });
    res.end();
    return;
  }

  const startTime = Date.now();

  try {
    // ====================================================================
    // YOUTUBE PATH: Pull transcript directly, skip audio pipeline
    // ====================================================================
    if (isYouTubeUrl(url)) {
      console.log('📺 YouTube URL detected — using transcript path');
      sendEvent(res, 'stage', { stage: 'resolving', message: 'Fetching YouTube video info...' });

      const videoId = extractYouTubeVideoId(url);
      if (!videoId) {
        sendEvent(res, 'error', { error: 'Could not extract video ID from YouTube URL.' });
        res.end();
        return;
      }

      // Get metadata
      const videoMeta = await getYouTubeMetadata(videoId);
      sendEvent(res, 'stage', {
        stage: 'resolved',
        message: 'YouTube video found',
        metadata: {
          episodeTitle: videoMeta.title,
          podcastTitle: videoMeta.author,
          episodeUrl: `https://www.youtube.com/watch?v=${videoId}`,
          source: 'youtube',
        }
      });

      // Pull transcript directly
      sendEvent(res, 'stage', { stage: 'transcribing', message: 'Fetching YouTube transcript...' });

      let transcriptItems;
      try {
        transcriptItems = await fetchYouTubeTranscript(videoId);
      } catch (err) {
        console.error('❌ YouTube transcript fetch failed:', err);
        sendEvent(res, 'error', {
          error: 'Could not retrieve transcript from YouTube. The video may not have captions enabled, or may be private/age-restricted. Try uploading the MP3 directly.'
        });
        res.end();
        return;
      }

      const transcript = transcriptItems.map(item => item.text).join(' ');
      console.log(`📝 YouTube transcript: ${transcript.length} characters`);

      if (transcript.length < 100) {
        sendEvent(res, 'error', { error: 'YouTube transcript is too short. The video may not have meaningful captions.' });
        res.end();
        return;
      }

      // Run agents with streaming
      sendEvent(res, 'stage', {
        stage: 'agents',
        message: 'Running AI agents...',
        transcript_length: transcript.length
      });

      const timestamp = Date.now();
      const episodeId = `yt-${videoId}-${timestamp}`;

      const growthPlan = await generateGrowthPlanStream(
        transcript,
        (agentName, agentResult) => {
          sendEvent(res, 'agent_complete', {
            agent: agentName,
            success: agentResult.success,
            data: agentResult.data,
            error: agentResult.error,
            processing_time: agentResult.processing_time
          });
        },
        episodeId
      );

      // Store report
      sendEvent(res, 'stage', { stage: 'saving', message: 'Saving report...' });

      const reportId = `rprt_${timestamp}_${Math.random().toString(36).substring(2, 11)}`;
      const totalTime = Date.now() - startTime;

      const reportData = {
        id: reportId,
        createdAt: new Date().toISOString(),
        episodeId,
        transcriptLength: transcript.length,
        processingTime: totalTime,
        transcript,
        growthPlan,
        source: 'youtube',
        youtubeVideoId: videoId,
      };

      const blob = await put(`reports/${reportId}.json`, JSON.stringify(reportData), {
        access: 'public',
        token: process.env.PGA2_READ_WRITE_TOKEN,
        contentType: 'application/json',
      });

      const reportUrl = `https://podcastgrowthagent.com/#/report/${reportId}`;

      console.log(`✅ YouTube pipeline complete in ${(totalTime / 1000).toFixed(1)}s`);

      sendEvent(res, 'complete', {
        success: true,
        growth_plan: growthPlan,
        metadata: {
          episodeTitle: videoMeta.title,
          podcastTitle: videoMeta.author,
          episodeUrl: `https://www.youtube.com/watch?v=${videoId}`,
          source: 'youtube',
        },
        reportId,
        reportUrl,
        reportBlobUrl: blob.url,
        metrics: {
          total_time: `${(totalTime / 1000).toFixed(1)}s`,
          transcription_time: '0.0s',
          transcript_length: transcript.length,
        }
      });

      res.end();
      return;
    }

    // ====================================================================
    // APPLE PODCASTS PATH: Resolve → download → transcribe → agents
    // ====================================================================
    // STAGE 1: Resolve podcast URL
    // ====================================================================
    sendEvent(res, 'stage', { stage: 'resolving', message: 'Resolving podcast URL...' });

    const resolveResponse = await fetch(`${getBaseUrl(req)}/api/resolve-source`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });

    if (!resolveResponse.ok) {
      const errorData = await resolveResponse.json() as any;
      sendEvent(res, 'error', { error: errorData.error || 'Failed to resolve podcast URL' });
      res.end();
      return;
    }

    const resolveData = await resolveResponse.json() as ResolveSourceResponse;

    sendEvent(res, 'stage', {
      stage: 'resolved',
      message: 'Podcast resolved',
      metadata: resolveData.metadata
    });

    // ====================================================================
    // STAGE 2: Fetch audio to blob
    // ====================================================================
    sendEvent(res, 'stage', { stage: 'fetching_audio', message: 'Downloading audio...' });

    const fetchResponse = await fetch(`${getBaseUrl(req)}/api/fetch-to-blob`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audioUrl: resolveData.metadata?.audioUrl,
        filename: sanitizeFilename(resolveData.metadata?.episodeTitle || 'episode')
      })
    });

    if (!fetchResponse.ok) {
      const errorData = await fetchResponse.json() as any;
      sendEvent(res, 'error', { error: errorData.error || 'Failed to download audio' });
      res.end();
      return;
    }

    const fetchData = await fetchResponse.json() as FetchToBlobResponse;

    // ====================================================================
    // STAGE 3: Download from blob, chunk, transcribe
    // ====================================================================
    sendEvent(res, 'stage', { stage: 'chunking', message: 'Splitting audio...' });

    const timestamp = Date.now();
    const localPath = `/tmp/podcast-${timestamp}.mp3`;
    await downloadFile(fetchData.blobUrl!, localPath);

    const chunksDir = await chunkAudioFile(localPath);

    sendEvent(res, 'stage', { stage: 'transcribing', message: 'Transcribing audio...' });

    const transcribeStart = Date.now();
    const result = await transcribeAudioChunks(chunksDir);
    const transcript = result.fullText;
    const transcribeTime = Date.now() - transcribeStart;

    // ====================================================================
    // STAGE 4: Run agents with streaming
    // ====================================================================
    sendEvent(res, 'stage', {
      stage: 'agents',
      message: 'Running AI agents...',
      transcript_length: transcript.length
    });

    const episodeId = `episode-${timestamp}`;
    const episodeUrl = resolveData.metadata?.episodeUrl;

    const growthPlan = await generateGrowthPlanStream(
      transcript,
      (agentName, agentResult) => {
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

    // ====================================================================
    // FINAL EVENT
    // ====================================================================
    sendEvent(res, 'complete', {
      success: true,
      growth_plan: growthPlan,
      metadata: resolveData.metadata,
      reportId,
      reportUrl,
      reportBlobUrl: blob.url,
      metrics: {
        total_time: `${(totalTime / 1000).toFixed(1)}s`,
        transcription_time: `${(transcribeTime / 1000).toFixed(1)}s`,
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

// ============================================================================
// YOUTUBE HELPERS
// ============================================================================

function isYouTubeUrl(url: string): boolean {
  return (
    url.includes('youtube.com/watch') ||
    url.includes('youtu.be/') ||
    url.includes('youtube.com/live/') ||
    url.includes('youtube.com/shorts/') ||
    url.includes('youtube.com/embed/')
  );
}

function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

async function getYouTubeMetadata(videoId: string): Promise<{ title: string; author: string }> {
  const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
  const response = await fetch(oembedUrl);
  if (!response.ok) {
    return { title: 'Unknown Video', author: 'Unknown Channel' };
  }
  const data = await response.json() as any;
  return {
    title: data.title || 'Unknown Video',
    author: data.author_name || 'Unknown Channel',
  };
}

// ============================================================================
// HELPERS
// ============================================================================

function getBaseUrl(req: VercelRequest): string {
  const host = req.headers.host || 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  return `${protocol}://${host}`;
}

function sanitizeFilename(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
}

function downloadFile(url: string, destination: string): Promise<void> {
  return new Promise((resolve, reject) => {
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
