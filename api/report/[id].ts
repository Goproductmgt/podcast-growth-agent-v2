import type { VercelRequest, VercelResponse } from '@vercel/node';

// Define the structure of stored report data
interface StoredReport {
  id: string;
  createdAt: string;
  episodeId: string;
  transcriptLength: number;
  processingTime: number;
  growthPlan: any;
}

interface ReportResponse {
  success: boolean;
  report?: StoredReport;
  error?: string;
  message?: string;
  details?: string;
  reportId?: string;
  usage?: string;
}

export const config = {
  maxDuration: 10,
};

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ 
      success: false,
      error: 'Method not allowed. Use GET.' 
    });
  }

  try {
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing report ID',
        usage: 'GET /api/report/[id] or GET /api/report?id=rprt_123'
      });
    }

    console.log('📖 Fetching report:', id);

    const blobUrl = `https://ezuhvwbolslnriog.public.blob.vercel-storage.com/reports/${id}.json`;

    console.log('🔗 Blob URL:', blobUrl);

    const response = await fetch(blobUrl);

    if (!response.ok) {
      if (response.status === 404) {
        console.log('❌ Report not found:', id);
        return res.status(404).json({
          success: false,
          error: 'Report not found',
          message: 'This report does not exist or may have been deleted.',
          reportId: id
        });
      }

      console.error('❌ Error fetching report:', response.status, response.statusText);
      return res.status(response.status).json({
        success: false,
        error: 'Failed to retrieve report',
        details: response.statusText
      });
    }

    const reportData = await response.json() as StoredReport;

    console.log('✅ Report retrieved successfully');
    console.log('📊 Episode ID:', reportData.episodeId);
    console.log('⏱️  Processing time:', reportData.processingTime, 'ms');

    return res.status(200).json({
      success: true,
      report: reportData
    });

  } catch (error) {
    console.error('❌ Error in report retrieval:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}