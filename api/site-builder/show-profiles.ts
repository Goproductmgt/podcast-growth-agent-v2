import { put } from '@vercel/blob';
import { REDESIGNING_HEALTH_HOME_BRAND_KIT } from './brand-kits';
import type { BrandKit, EpisodePageInput, ShowProfile } from './types';

const DEFAULT_BLOB_BASE_URL = 'https://ezuhvwbolslnriog.public.blob.vercel-storage.com';

export const REDESIGNING_HEALTH_HOME_PROFILE: ShowProfile = {
  id: 'show_redesigning_health_home',
  siteSlug: 'redesigning-health-home',
  showName: 'Redesigning Health & Home',
  brandKit: REDESIGNING_HEALTH_HOME_BRAND_KIT,
  integrations: [
    {
      provider: 'youtube',
      connected: true,
      url: 'https://www.youtube.com/@RedesigningHealthHome',
      urls: [
        'https://www.youtube.com/embed/videoseries?list=UUuq9AH8Mm2fYdnLLVeSt-IA'
      ],
      config: {
        channelId: 'UCuq9AH8Mm2fYdnLLVeSt-IA',
        uploadsPlaylistId: 'UUuq9AH8Mm2fYdnLLVeSt-IA'
      }
    },
    {
      provider: 'instagram',
      connected: false,
      url: 'https://www.instagram.com/redesigning_health_and_home/'
    },
    {
      provider: 'facebook',
      connected: true,
      url: 'https://www.facebook.com/profile.php?id=61573569193975'
    }
  ],
  defaultResources: [
    {
      title: 'Shop Redesigning Health & Home',
      url: 'https://rhh-shopping-2025-goproductmgt.replit.app/',
      description: 'A curated collection of home, wellness, and gentle reset favorites.',
      type: 'affiliate'
    }
  ],
  listenLinks: {
    spotifyUrl: 'https://open.spotify.com/show/41UJ6L0AksZCXNv00jA1jk',
    youtubeUrl: 'https://www.youtube.com/@RedesigningHealthHome'
  },
  templatePreferences: {
    showBrandCustomizer: false,
    defaultBlocks: [
      'hero',
      'listen-links',
      'takeaways',
      'quote-grid',
      'resources',
      'shopping-grid',
      'youtube-channel',
      'instagram-reel',
      'social-links',
      'newsletter-signup',
      'distribution-list'
    ]
  },
  createdAt: '2026-05-03T00:00:00.000Z',
  updatedAt: '2026-05-03T00:00:00.000Z'
};

export function applyShowProfile(input: EpisodePageInput, profile: ShowProfile): EpisodePageInput {
  return {
    ...input,
    siteSlug: input.siteSlug || profile.siteSlug,
    brandKit: mergeProfileBrandKit(profile.brandKit, input.brandKit),
    episode: {
      ...input.episode,
      podcastTitle: input.episode?.podcastTitle || profile.showName,
      spotifyUrl: input.episode?.spotifyUrl || profile.listenLinks?.spotifyUrl,
      youtubeUrl: input.episode?.youtubeUrl || profile.listenLinks?.youtubeUrl
    },
    integrations: [
      ...profile.integrations,
      ...(input.integrations || [])
    ],
    resources: [
      ...(profile.defaultResources || []),
      ...(input.resources || [])
    ],
    selectedBlocks: profile.templatePreferences?.showBrandCustomizer === false
      ? undefined
      : input.selectedBlocks,
    showBrandCustomizer: input.showBrandCustomizer ?? profile.templatePreferences?.showBrandCustomizer
  };
}

export async function storeShowProfile(profile: ShowProfile): Promise<{ blobUrl: string }> {
  const token = process.env.PGA2_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error('Missing Vercel Blob token. Set PGA2_READ_WRITE_TOKEN or BLOB_READ_WRITE_TOKEN.');
  }

  const blob = await put(`sites/${profile.siteSlug}/profile.json`, JSON.stringify(profile, null, 2), {
    access: 'public',
    token,
    contentType: 'application/json'
  });

  return { blobUrl: blob.url };
}

export async function fetchShowProfile(siteSlug: string): Promise<ShowProfile | null> {
  if (siteSlug === REDESIGNING_HEALTH_HOME_PROFILE.siteSlug) {
    return REDESIGNING_HEALTH_HOME_PROFILE;
  }

  const blobBaseUrl = process.env.PGA2_BLOB_PUBLIC_BASE_URL || DEFAULT_BLOB_BASE_URL;
  const response = await fetch(`${blobBaseUrl}/sites/${siteSlug}/profile.json`);
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Failed to fetch show profile: ${response.status} ${response.statusText}`);
  }

  return await response.json() as ShowProfile;
}

function mergeProfileBrandKit(profileBrandKit: BrandKit, override?: BrandKit): BrandKit {
  if (!override) return profileBrandKit;

  return {
    ...profileBrandKit,
    ...override,
    colors: {
      ...profileBrandKit.colors,
      ...(override.colors || {})
    },
    fonts: {
      ...profileBrandKit.fonts,
      ...(override.fonts || {})
    },
    voice: override.voice || profileBrandKit.voice,
    wordsUseOften: override.wordsUseOften || profileBrandKit.wordsUseOften,
    wordsAvoid: override.wordsAvoid || profileBrandKit.wordsAvoid
  };
}
