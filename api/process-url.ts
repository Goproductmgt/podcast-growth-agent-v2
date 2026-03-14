import type { VercelRequest, VercelResponse } from '@vercel/node';
// youtube-transcript is ESM-only, must use dynamic import
async function fetchYouTubeTranscript(videoId: string) {
  const { YoutubeTranscript } = await import('youtube-transcript');
  return YoutubeTranscript.fetchTranscript(videoId);
}
import { put } from '@vercel/blob';
import { generateGrowthPlan } from './agents/orchestrator';

// ============================================================================
// PROCESS URL - Complete pipeline from podcast URL to Growth Plan
// ============================================================================
//
// Flow (Apple Podcasts):
// 1. Apple Podcasts URL → resolve-source → audio URL + metadata
// 2. Audio URL → fetch-to-blob → blob URL
// 3. Blob URL → process → Growth Plan
//
// Flow (YouTube):
// 1. YouTube URL → oEmbed (title) + youtube-transcript (captions)
// 2. Transcript → agents directly (skips audio pipeline entirely)
//
// This orchestrator chains all services together
// ============================================================================

interface ProcessUrlResponse {
  success: boolean;
  growth_plan?: any;
  metadata?: any;
  reportId?: string;        // NEW: Report ID for reference
  reportUrl?: string;       // NEW: Shareable URL
  reportBlobUrl?: string;   // NEW: Direct blob URL
  error?: string;
  timing?: {
    resolve_time: number;
    fetch_time: number;
    process_time: number;
    total_time: number;
  };
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

interface ProcessResponse {
  success: boolean;
  growth_plan?: any;
  reportId?: string;        // NEW: From process.ts
  reportUrl?: string;       // NEW: From process.ts
  reportBlobUrl?: string;   // NEW: From process.ts
  error?: string;
}

interface ErrorResponse {
  success: boolean;
  error: string;
}

export const config = {
  maxDuration: 300, // 5 minutes - same as /api/process
};

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

  const { url } = req.body;

  if (!url || typeof url !== 'string') {
    res.status(400).json({ 
      success: false, 
      error: 'Missing or invalid url parameter' 
    });
    return;
  }

  console.log('🎬 Starting URL processing pipeline for:', url);

  const startTime = Date.now();

  try {
    // ========================================================================
    // YOUTUBE PATH: Pull transcript directly, skip audio pipeline
    // ========================================================================
    if (isYouTubeUrl(url)) {
      console.log('📺 YouTube URL detected — using transcript path');

      const videoId = extractYouTubeVideoId(url);
      if (!videoId) {
        return res.status(400).json({
          success: false,
          error: 'Could not extract video ID from YouTube URL.'
        });
      }

      // Step 1: Get video metadata via oEmbed
      console.log('📺 Step 1: Fetching YouTube metadata...');
      const metadataStart = Date.now();
      const videoMeta = await getYouTubeMetadata(videoId);
      const metadataTime = Date.now() - metadataStart;
      console.log(`✅ Metadata fetched in ${metadataTime}ms: "${videoMeta.title}"`);

      // Step 2: Pull transcript directly from YouTube captions
      console.log('📺 Step 2: Fetching YouTube transcript...');
      const transcriptStart = Date.now();

      let transcriptItems;
      try {
        transcriptItems = await fetchYouTubeTranscript(videoId);
      } catch (err) {
        console.error('❌ YouTube transcript fetch failed:', err);
        return res.status(400).json({
          success: false,
          error: 'Could not retrieve transcript from YouTube. The video may not have captions enabled, or may be private/age-restricted. Try uploading the MP3 directly.'
        });
      }

      // Combine transcript segments into plain text
      const transcript = transcriptItems.map(item => item.text).join(' ');
      const transcriptTime = Date.now() - transcriptStart;
      console.log(`✅ Transcript fetched in ${(transcriptTime / 1000).toFixed(1)}s`);
      console.log(`📝 Transcript length: ${transcript.length} characters`);

      if (transcript.length < 100) {
        return res.status(400).json({
          success: false,
          error: 'YouTube transcript is too short. The video may not have meaningful captions.'
        });
      }

      // Step 3: Run agents directly (no audio pipeline needed!)
      console.log('🤖 Step 3: Running 5 AI agents...');
      const agentsStart = Date.now();
      const timestamp = Date.now();
      const episodeId = `yt-${videoId}-${timestamp}`;

      const growthPlan = await generateGrowthPlan(transcript, episodeId);
      const agentsTime = Date.now() - agentsStart;

      // Step 4: Store report
      console.log('💾 Step 4: Storing report...');
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

      console.log(`✅ Report stored: ${reportId}`);
      console.log('🎉 YOUTUBE PIPELINE COMPLETE');
      console.log(`⏱️  Total time: ${(totalTime / 1000).toFixed(1)}s`);
      console.log(`   - Metadata: ${metadataTime}ms`);
      console.log(`   - Transcript: ${(transcriptTime / 1000).toFixed(1)}s`);
      console.log(`   - Agents: ${(agentsTime / 1000).toFixed(1)}s`);

      return res.status(200).json({
        success: true,
        growth_plan: growthPlan,
        metadata: {
          episodeTitle: videoMeta.title,
          podcastTitle: videoMeta.author,
          episodeUrl: `https://www.youtube.com/watch?v=${videoId}`,
          publishDate: new Date().toISOString(),
          source: 'youtube',
        },
        reportId,
        reportUrl,
        reportBlobUrl: blob.url,
        timing: {
          resolve_time: metadataTime,
          fetch_time: 0,
          process_time: agentsTime + transcriptTime,
          total_time: totalTime
        }
      });
    }

    // ========================================================================
    // APPLE PODCASTS PATH: Resolve → download audio → transcribe → agents
    // ========================================================================
    // STEP 1: Resolve podcast URL to audio URL + metadata
    // ========================================================================
    console.log('🔍 Step 1: Resolving podcast URL...');
    const resolveStart = Date.now();

    const resolveResponse = await fetch(`${getBaseUrl(req)}/api/resolve-source`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });

    if (!resolveResponse.ok) {
      const errorData = await resolveResponse.json() as ErrorResponse;
      console.error('❌ Resolve failed:', errorData);
      res.status(resolveResponse.status).json({
        success: false,
        error: errorData.error || 'Failed to resolve podcast URL'
      });
      return;
    }

    const resolveData = await resolveResponse.json() as ResolveSourceResponse;
    const resolveTime = Date.now() - resolveStart;

    console.log(`✅ Resolved in ${resolveTime}ms`);
    console.log('📝 Episode:', resolveData.metadata?.episodeTitle);
    console.log('🎙️  Podcast:', resolveData.metadata?.podcastTitle);
    console.log('🔗 Episode URL:', resolveData.metadata?.episodeUrl);
    console.log('🎵 Audio URL:', resolveData.metadata?.audioUrl);

    // ========================================================================
    // STEP 2: Download audio and upload to Blob storage
    // ========================================================================
    console.log('📦 Step 2: Fetching audio to blob...');
    const fetchStart = Date.now();

    const fetchResponse = await fetch(`${getBaseUrl(req)}/api/fetch-to-blob`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audioUrl: resolveData.metadata?.audioUrl,
        filename: sanitizeFilename(resolveData.metadata?.episodeTitle || 'episode')
      })
    });

    if (!fetchResponse.ok) {
      const errorData = await fetchResponse.json() as ErrorResponse;
      console.error('❌ Fetch to blob failed:', errorData);
      res.status(fetchResponse.status).json({
        success: false,
        error: errorData.error || 'Failed to download audio'
      });
      return;
    }

    const fetchData = await fetchResponse.json() as FetchToBlobResponse;
    const fetchTime = Date.now() - fetchStart;

    console.log(`✅ Audio fetched in ${fetchTime}ms`);
    console.log('☁️  Blob URL:', fetchData.blobUrl);
    console.log('📦 Size:', Math.round((fetchData.size || 0) / 1024 / 1024) + 'MB');

    // ========================================================================
    // STEP 3: Process audio through existing pipeline
    // ========================================================================
    console.log('🤖 Step 3: Processing through AI pipeline...');
    const processStart = Date.now();

    const processResponse = await fetch(`${getBaseUrl(req)}/api/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        blobUrl: fetchData.blobUrl,
        episodeUrl: resolveData.metadata?.episodeUrl  // NEW: Pass episode URL
      })
    });

    if (!processResponse.ok) {
      const errorData = await processResponse.json() as ErrorResponse;
      console.error('❌ Processing failed:', errorData);
      res.status(processResponse.status).json({
        success: false,
        error: errorData.error || 'Failed to process podcast'
      });
      return;
    }

    const processData = await processResponse.json() as ProcessResponse;
    const processTime = Date.now() - processStart;
    const totalTime = Date.now() - startTime;

    console.log(`✅ Processing complete in ${processTime}ms`);
    console.log(`🎉 Total pipeline time: ${totalTime}ms (${Math.round(totalTime / 1000)}s)`);
    
    // NEW: Log report information
    if (processData.reportId) {
      console.log(`📋 Report ID: ${processData.reportId}`);
      console.log(`🔗 Report URL: ${processData.reportUrl}`);
    }

    // ========================================================================
    // RETURN COMPLETE RESULT (INCLUDING REPORT INFO)
    // ========================================================================
    const response: ProcessUrlResponse = {
      success: true,
      growth_plan: processData.growth_plan,
      metadata: resolveData.metadata,
      reportId: processData.reportId,           // NEW: Pass through from process.ts
      reportUrl: processData.reportUrl,         // NEW: Pass through from process.ts
      reportBlobUrl: processData.reportBlobUrl, // NEW: Pass through from process.ts
      timing: {
        resolve_time: resolveTime,
        fetch_time: fetchTime,
        process_time: processTime,
        total_time: totalTime
      }
    };

    res.status(200).json(response);

  } catch (error) {
    console.error('❌ Error in process-url pipeline:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
}

// ============================================================================
// HELPER FUNCTIONS
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
