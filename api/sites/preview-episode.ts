import type { VercelRequest, VercelResponse } from '@vercel/node';
import { REDESIGNING_HEALTH_HOME_BRAND_KIT } from '../site-builder/brand-kits';
import { buildEpisodePageWithCurator, renderEpisodePageHtml } from '../site-builder/episode-page';
import { EpisodePageInput } from '../site-builder/types';

export const config = {
  maxDuration: 30
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const input = req.method === 'POST'
      ? req.body as EpisodePageInput
      : buildRedesigningHealthHomeExample();

    const page = await buildEpisodePageWithCurator({
      ...input,
      usePageCuratorAgent: req.query.curate === '1' ? true : input.usePageCuratorAgent,
      status: 'draft'
    });

    const wantsHtml = req.query.format === 'html' || req.headers.accept?.includes('text/html');
    if (wantsHtml) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(renderEpisodePageHtml(page));
    }

    return res.status(200).json({
      success: true,
      page,
      html: renderEpisodePageHtml(page)
    });
  } catch (error) {
    console.error('❌ Episode page preview failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Episode page preview failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

function buildRedesigningHealthHomeExample(): EpisodePageInput {
  return {
    siteSlug: 'redesigning-health-home',
    episodeSlug: 'what-if-you-didnt-have-to-choose-between-productivity',
    brandKit: REDESIGNING_HEALTH_HOME_BRAND_KIT,
    episode: {
      episodeTitle: "What If You Didn't Have to Choose Between Productivity and Peace?",
      podcastTitle: 'Redesigning Health & Home',
      appleUrl: 'https://podcasts.apple.com/us/podcast/what-if-you-didnt-have-to-choose-between-productivity/id1799868338?i=1000765053598',
      youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      description: 'A gentle planning conversation about choosing routines that support your energy, home, health, and real life.'
    },
    integrations: [
      {
        provider: 'youtube',
        connected: true,
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
      },
      {
        provider: 'instagram',
        connected: false,
        url: 'https://www.instagram.com/reel/example/'
      },
      {
        provider: 'substack',
        connected: true,
        url: 'https://example.substack.com'
      }
    ],
    resources: [
      {
        title: 'Clutterbug Quiz',
        url: 'https://clutterbug.me/',
        description: 'A home organizing style quiz mentioned as a helpful reset tool.',
        type: 'resource'
      },
      {
        title: 'A Slob Comes Clean',
        url: 'https://www.aslobcomesclean.com/',
        description: 'Practical encouragement for real-life home routines.',
        type: 'resource'
      },
      {
        title: 'Intentional Planning Favorites',
        url: 'https://rhh-shopping-2025-goproductmgt.replit.app/',
        description: 'A starter shopping collection for gentle planning, home reset, and everyday routines.',
        type: 'affiliate'
      }
    ],
    growthPlan: {
      agents: {
        insight: {
          episode_summary: 'Kerri and Meg unpack why planners do not work for everyone, especially when hour-by-hour layouts clash with real life, changing energy, and menopause-related fatigue. The bigger takeaway is that letting go of planner guilt can help you choose a simple system that supports your health, relationships, and home.',
          key_discovery_phrases: [
            'planning by energy levels',
            'planner guilt reset',
            'gentle productivity systems'
          ],
          keywords: [
            { keyword: 'planning by energy levels' },
            { keyword: 'paper planner vs phone calendar' },
            { keyword: 'gentle productivity for women' },
            { keyword: 'menopause fatigue planning' },
            { keyword: 'simple weekly planning routine' }
          ]
        },
        hook: {
          title_options: [
            { title: 'A Planning Strategy That Works With Your Energy' },
            { title: "Why Your Planner Isn't Working" },
            { title: 'The Gentle Reset for Planner Guilt' }
          ]
        },
        spotlight: {
          shareable_quotes: [
            {
              quote: 'You do not have to choose between being productive and being gentle with yourself.',
              timestamp: '00:03:12'
            },
            {
              quote: 'A planner should support your real life, not make you feel behind before the day begins.',
              timestamp: '00:08:44'
            },
            {
              quote: 'Sometimes the reset is not a new system. It is permission to redesign the one you already have.',
              timestamp: '00:16:20'
            }
          ],
          ready_to_post_caption: 'What if your planner could work with your energy instead of against it? This episode is a gentle reset for anyone tired of planner guilt. Listen to the full episode.'
        },
        amplify: {
          communities: [
            {
              name: 'r/GetMotivated',
              url: 'https://www.reddit.com/r/GetMotivated/'
            },
            {
              name: 'r/Declutter',
              url: 'https://www.reddit.com/r/declutter/'
            }
          ]
        }
      }
    }
  };
}
