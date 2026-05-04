const DEFAULT_BLOB_BASE_URL = 'https://ezuhvwbolslnriog.public.blob.vercel-storage.com';

export interface StoredGrowthReport {
  id: string;
  createdAt: string;
  episodeId: string;
  transcriptLength?: number;
  processingTime?: number;
  transcript?: string;
  growthPlan: any;
  source?: string;
  sourceUrl?: string;
  metadata?: {
    episodeUrl?: string;
    sourceUrl?: string;
    episodeTitle?: string;
    podcastTitle?: string;
    publishDate?: string;
    audioUrl?: string;
    audioDuration?: number;
    imageUrl?: string;
    artworkUrl?: string;
    podcastSocial?: Record<string, string>;
    source?: string;
  };
}

export async function fetchGrowthReport(reportId: string, reportBlobUrl?: string): Promise<StoredGrowthReport> {
  const url = reportBlobUrl || buildReportBlobUrl(reportId);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch growth report ${reportId}: ${response.status} ${response.statusText}`);
  }

  const report = await response.json() as StoredGrowthReport;
  if (!report?.growthPlan) {
    throw new Error(`Growth report ${reportId} did not include a growthPlan payload.`);
  }

  return report;
}

function buildReportBlobUrl(reportId: string): string {
  const blobBaseUrl = process.env.PGA2_BLOB_PUBLIC_BASE_URL || DEFAULT_BLOB_BASE_URL;
  return `${blobBaseUrl}/reports/${reportId}.json`;
}
