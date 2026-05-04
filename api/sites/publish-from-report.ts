import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildEpisodePageWithCurator, renderEpisodePageHtml } from '../site-builder/episode-page';
import { fetchGrowthReport, StoredGrowthReport } from '../site-builder/report-loader';
import { applyShowProfile, fetchShowProfile } from '../site-builder/show-profiles';
import { storeEpisodePage } from '../site-builder/storage';
import type { BrandKit, EditorBlock, EpisodeMetadataInput, PageCuratorOutput, ResourceItem, SiteIntegration } from '../site-builder/types';
import { requireSiteBuilderAuth, setSiteCorsHeaders } from './auth';

export const config = {
  maxDuration: 60
};

interface PublishFromReportRequest {
  reportId: string;
  reportBlobUrl?: string;
  siteSlug?: string;
  episodeSlug?: string;
  brandKit?: Partial<BrandKit>;
  episode?: EpisodeMetadataInput;
  resources?: ResourceItem[];
  integrations?: SiteIntegration[];
  selectedBlocks?: EditorBlock[];
  pageStrategy?: PageCuratorOutput;
  usePageCuratorAgent?: boolean;
  status?: 'draft' | 'published';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSiteCorsHeaders(req, res, 'POST');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed. Use POST.' });
  }
  if (!requireSiteBuilderAuth(req, res)) return;

  try {
    const input = req.body as PublishFromReportRequest;
    if (!input?.reportId || typeof input.reportId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'reportId is required',
        usage: 'POST { reportId, reportBlobUrl?, episode?, brandKit?, resources?, siteSlug?, episodeSlug? }'
      });
    }

    const report = await fetchGrowthReport(input.reportId, input.reportBlobUrl);
    const profile = input.siteSlug ? await fetchShowProfile(input.siteSlug) : null;
    const pageInput = {
      reportId: input.reportId,
      reportBlobUrl: input.reportBlobUrl,
      siteSlug: input.siteSlug,
      episodeSlug: input.episodeSlug,
      brandKit: input.brandKit as BrandKit | undefined,
      episode: {
        ...episodeFromReport(report),
        ...(input.episode || {})
      },
      resources: input.resources || [],
      integrations: input.integrations || [],
      selectedBlocks: input.selectedBlocks,
      pageStrategy: input.pageStrategy,
      usePageCuratorAgent: input.usePageCuratorAgent,
      growthPlan: report.growthPlan,
      status: input.status || 'published'
    };
    const page = await buildEpisodePageWithCurator(profile ? applyShowProfile(pageInput, profile) : pageInput);

    const blobs = await storeEpisodePage(page);

    return res.status(200).json({
      success: true,
      report: {
        id: report.id,
        createdAt: report.createdAt,
        episodeId: report.episodeId
      },
      profileApplied: profile ? {
        id: profile.id,
        siteSlug: profile.siteSlug,
        showName: profile.showName
      } : null,
      page,
      html: renderEpisodePageHtml(page),
      blobs
    });
  } catch (error) {
    console.error('❌ Episode page publish from report failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Episode page publish from report failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

function episodeFromReport(report: StoredGrowthReport): EpisodeMetadataInput {
  const metadata = report.metadata || {};
  const sourceUrl = metadata.sourceUrl || report.sourceUrl || metadata.episodeUrl;
  const episode: EpisodeMetadataInput = {
    episodeTitle: metadata.episodeTitle,
    podcastTitle: metadata.podcastTitle,
    publishDate: metadata.publishDate,
    audioUrl: metadata.audioUrl,
    duration: metadata.audioDuration ? `${Math.round(metadata.audioDuration / 60)} min` : undefined,
    imageUrl: metadata.imageUrl || metadata.artworkUrl,
    description: report.growthPlan?.agents?.insight?.episode_summary
  };

  if (sourceUrl?.includes('open.spotify.com/')) {
    episode.spotifyUrl = sourceUrl;
  } else if (sourceUrl?.includes('podcasts.apple.com/')) {
    episode.appleUrl = sourceUrl;
  } else if (sourceUrl?.includes('youtube.com/') || sourceUrl?.includes('youtu.be/')) {
    episode.youtubeUrl = sourceUrl;
  }

  return episode;
}
