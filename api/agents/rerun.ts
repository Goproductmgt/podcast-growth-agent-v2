import type { VercelRequest, VercelResponse } from '@vercel/node';
import { put } from '@vercel/blob';
import { runInsightAgent } from './insight';
import { runHookAgent } from './hook';
import { runSpotlightAgent } from './spotlight';
import { runAmplifyAgent } from './amplify';
import { runPulseAgent } from './pulse';

export const config = {
  maxDuration: 60, // Individual agents should complete within 60 seconds
};

interface RerunRequest {
  reportId: string;
  agentName: 'insight' | 'hook' | 'spotlight' | 'amplify' | 'pulse';
}

interface StoredReport {
  id: string;
  createdAt: string;
  episodeId: string;
  transcriptLength: number;
  processingTime: number;
  transcript: string;
  growthPlan: any;
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
    return res.status(405).json({ 
      success: false,
      error: 'Method not allowed. Use POST.' 
    });
  }

  const startTime = Date.now();

  try {
    const { reportId, agentName } = req.body as RerunRequest;

    // Validate inputs
    if (!reportId || !agentName) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        usage: 'POST { "reportId": "rprt_...", "agentName": "amplify" }'
      });
    }

    const validAgents = ['insight', 'hook', 'spotlight', 'amplify', 'pulse'];
    if (!validAgents.includes(agentName)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid agent name',
        validAgents: validAgents
      });
    }

    console.log(`🔄 Re-running ${agentName} agent for report: ${reportId}`);

    // ========================================================================
    // STEP 1: Fetch existing report from Blob storage
    // ========================================================================
    console.log('📥 Fetching existing report...');
    const blobUrl = `https://ezuhvwbolslnriog.public.blob.vercel-storage.com/reports/${reportId}.json`;
    
    const reportResponse = await fetch(blobUrl);
    
    if (!reportResponse.ok) {
      if (reportResponse.status === 404) {
        return res.status(404).json({
          success: false,
          error: 'Report not found',
          reportId: reportId
        });
      }
      throw new Error(`Failed to fetch report: ${reportResponse.status}`);
    }

    const report = await reportResponse.json() as StoredReport;
    console.log('✅ Report fetched');

    // ========================================================================
    // STEP 2: Extract transcript
    // ========================================================================
    const transcript = report.transcript;
    
    if (!transcript) {
      return res.status(400).json({
        success: false,
        error: 'Report does not contain transcript',
        message: 'This report was created before transcript storage was enabled. Please re-process the episode.'
      });
    }

    console.log(`📝 Transcript length: ${transcript.length} characters`);

    // ========================================================================
    // STEP 3: Run the specific agent
    // ========================================================================
    console.log(`🤖 Running ${agentName} agent...`);
    const agentStart = Date.now();
    
    let agentResult;
    
    switch (agentName) {
      case 'insight':
        agentResult = await runInsightAgent(transcript);
        break;
      case 'hook':
        agentResult = await runHookAgent(transcript);
        break;
      case 'spotlight':
        agentResult = await runSpotlightAgent(transcript);
        break;
      case 'amplify':
        agentResult = await runAmplifyAgent(transcript);
        break;
      case 'pulse':
        agentResult = await runPulseAgent(transcript);
        break;
    }

    const agentTime = Date.now() - agentStart;
    console.log(`✅ ${agentName} completed in ${(agentTime / 1000).toFixed(1)}s`);

    // Check if agent succeeded
    if (!agentResult.success) {
      return res.status(500).json({
        success: false,
        error: 'Agent execution failed',
        agentName: agentName,
        details: agentResult.error,
        processingTime: `${(agentTime / 1000).toFixed(1)}s`
      });
    }

    // ========================================================================
    // STEP 4: Update report with new agent output
    // ========================================================================
    console.log('💾 Updating report with new results...');
    
    // Update the specific agent's data
    report.growthPlan.agents[agentName] = agentResult.data;
    
    // Update errors array - remove old errors for this agent
    report.growthPlan.errors = report.growthPlan.errors.filter(
      (err: any) => err.agent !== agentName
    );
    
    // Add new error if agent failed (shouldn't happen since we check above, but safety)
    if (agentResult.error) {
      report.growthPlan.errors.push({
        agent: agentName,
        error: agentResult.error,
        timestamp: new Date().toISOString()
      });
    }
    
    // Update success/failure counts
    const agentsList = ['insight', 'hook', 'spotlight', 'amplify', 'pulse'];
    const succeededCount = agentsList.filter(
      agent => report.growthPlan.agents[agent] !== null
    ).length;
    
    report.growthPlan.summary = {
      agents_succeeded: succeededCount,
      agents_failed: 5 - succeededCount,
      total_agents: 5
    };

    // ========================================================================
    // STEP 5: Save updated report back to Blob
    // ========================================================================
    console.log('💾 Saving updated report...');
    
    const blob = await put(
      `reports/${reportId}.json`,
      JSON.stringify(report),
      {
        access: 'public',
        token: process.env.PGA2_READ_WRITE_TOKEN,
        contentType: 'application/json',
      }
    );

    console.log('✅ Report updated successfully');

    const totalTime = Date.now() - startTime;

    // ========================================================================
    // STEP 6: Return new agent results
    // ========================================================================
    return res.status(200).json({
      success: true,
      agentName: agentName,
      result: agentResult.data,
      reportUpdated: true,
      metrics: {
        agent_processing_time: `${(agentTime / 1000).toFixed(1)}s`,
        total_time: `${(totalTime / 1000).toFixed(1)}s`,
        tokens_used: agentResult.tokens_used
      }
    });

  } catch (error) {
    console.error('❌ Rerun error:', error);
    const totalTime = Date.now() - startTime;
    
    return res.status(500).json({
      success: false,
      error: 'Agent rerun failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      processing_time: `${(totalTime / 1000).toFixed(1)}s`
    });
  }
}