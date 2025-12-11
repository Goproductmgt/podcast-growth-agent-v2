import type { VercelRequest, VercelResponse } from '@vercel/node';
import { put } from '@vercel/blob';
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
    const { transcript } = req.body;

    // Validation: Check if transcript exists
    if (!transcript) {
      return res.status(400).json({ 
        error: 'transcript is required',
        usage: 'POST { "transcript": "Your transcript text here..." }'
      });
    }

    // Validation: Check if transcript is a string
    if (typeof transcript !== 'string') {
      return res.status(400).json({ 
        error: 'transcript must be a string',
        received: typeof transcript
      });
    }

    const transcriptLength = transcript.trim().length;

    console.log('📝 Starting transcript processing pipeline...');
    console.log(`📊 Transcript length: ${transcriptLength.toLocaleString()} characters`);

    // Validation: Maximum length (hard block)
    if (transcriptLength > 100000) {
      return res.status(400).json({ 
        error: 'Transcript too long',
        message: 'Maximum transcript length is 100,000 characters.',
        received: transcriptLength,
        maximum: 100000
      });
    }

    // Validation: Minimum length (warning logged, but allow processing)
    if (transcriptLength < 1000) {
      console.log('⚠️  WARNING: Transcript is shorter than recommended (< 1,000 characters)');
      console.log('⚠️  Results may be limited. Processing anyway...');
    }

    // Validation: Basic format check (detect gibberish)
    const alphaNumericCount = (transcript.match(/[a-zA-Z0-9]/g) || []).length;
    const alphaNumericRatio = alphaNumericCount / transcriptLength;

    if (alphaNumericRatio < 0.5) {
      return res.status(400).json({ 
        error: 'Invalid transcript format',
        message: 'Transcript appears to contain mostly non-alphanumeric characters.',
        hint: 'Please ensure you are pasting actual transcript text, not symbols or formatting codes.'
      });
    }

    // ========================================================================
    // Step 1: Run AI Agents
    // ========================================================================
    const agentsStartTime = Date.now();
    console.log('🤖 Running 5 AI agents in parallel...');

    const growthPlan = await generateGrowthPlan(transcript);

    const agentsTime = Date.now() - agentsStartTime;
    console.log(`✅ Agents complete in ${(agentsTime / 1000).toFixed(1)}s`);

    // ========================================================================
    // Step 2: Store Complete Report
    // ========================================================================
    const timestamp = Date.now();
    const totalTime = Date.now() - startTime;

    console.log('💾 Storing report in Vercel Blob...');
    
    // Generate unique report ID
    const reportId = `rprt_${timestamp}_${Math.random().toString(36).substring(2, 11)}`;
    
    // Create report data object with all information
    const reportData = {
      id: reportId,
      createdAt: new Date().toISOString(),
      episodeId: growthPlan.episode_id || `episode-${timestamp}`,
      transcriptLength: transcriptLength,
      processingTime: totalTime,
      transcript: transcript.trim(),  // Store full transcript for agent re-runs
      growthPlan: growthPlan,
      source: 'direct_transcript_upload',  // Track which input method was used
    };

    // Store in Vercel Blob at /reports/[reportId].json
    const blob = await put(`reports/${reportId}.json`, JSON.stringify(reportData), {
      access: 'public',
      token: process.env.PGA2_READ_WRITE_TOKEN,
      contentType: 'application/json',
    });

    console.log(`✅ Report stored: ${reportId}`);
    console.log(`🔗 Blob URL: ${blob.url}`);
    
    // Generate shareable report URL for frontend
    const reportUrl = `https://podcastgrowthagent.com/report/${reportId}`;
    console.log(`🌐 Shareable URL: ${reportUrl}`);

    // ========================================================================
    console.log('🎉 TRANSCRIPT PROCESSING COMPLETE');
    console.log(`⏱️  Total time: ${(totalTime / 1000).toFixed(1)}s`);
    console.log(`   - Agents: ${(agentsTime / 1000).toFixed(1)}s`);
    console.log(`   - Overhead: ${((totalTime - agentsTime) / 1000).toFixed(1)}s`);

    // Return response with report info (same format as process.ts)
    return res.status(200).json({
      success: true,
      growth_plan: growthPlan,
      reportId: reportId,
      reportUrl: reportUrl,
      reportBlobUrl: blob.url,
      metrics: {
        total_time: `${(totalTime / 1000).toFixed(1)}s`,
        transcription_time: '0.0s',  // No transcription needed
        agents_time: `${(agentsTime / 1000).toFixed(1)}s`,
        transcript_length: transcriptLength,
      }
    });

  } catch (error) {
    console.error('❌ Transcript processing error:', error);
    const totalTime = Date.now() - startTime;
    
    return res.status(500).json({
      success: false,
      error: 'Processing failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      processing_time: `${(totalTime / 1000).toFixed(1)}s`,
    });
  }
}