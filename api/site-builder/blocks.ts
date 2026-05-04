import type {
  BlockDefinition,
  BrandKit,
  EditorBlock,
  EpisodeMetadataInput,
  ResourceItem,
  SiteIntegration,
  SiteIntegrationProvider
} from './types';

export const BLOCK_CATALOG: BlockDefinition[] = [
  {
    type: 'brand-customizer',
    label: 'Make This Ours',
    description: 'A no-code brand kit editor for colors, fonts, voice, favorite words, and avoided words.',
    category: 'layout',
    source: 'brand-kit'
  },
  {
    type: 'hero',
    label: 'Episode Hero',
    description: 'The main title, summary, and listen buttons for the episode.',
    category: 'episode',
    source: 'episode-metadata'
  },
  {
    type: 'listen-links',
    label: 'Listen Links',
    description: 'No-code buttons for Apple Podcasts, Spotify, YouTube, and audio.',
    category: 'episode',
    source: 'episode-metadata'
  },
  {
    type: 'youtube-player',
    label: 'YouTube Player',
    description: 'A responsive YouTube video player built from a YouTube URL.',
    category: 'media',
    source: 'integration',
    requiresConnection: 'youtube',
    defaultSettings: {
      controls: true,
      captionsDefault: false,
      playsInline: true
    }
  },
  {
    type: 'youtube-channel',
    label: 'YouTube Channel',
    description: 'A polished channel card for subscribing or browsing videos when no exact episode video is connected yet.',
    category: 'media',
    source: 'integration',
    requiresConnection: 'youtube'
  },
  {
    type: 'instagram-reel',
    label: 'Instagram Reel',
    description: 'Embed or link to a public Instagram Reel after Instagram is connected.',
    category: 'media',
    source: 'integration',
    requiresConnection: 'instagram'
  },
  {
    type: 'quote-grid',
    label: 'Shareable Quote Grid',
    description: 'Pulls the best shareable moments from Agent Spotlight.',
    category: 'growth',
    source: 'growth-plan'
  },
  {
    type: 'takeaways',
    label: 'Key Takeaways',
    description: 'Turns the growth plan into readable episode takeaways.',
    category: 'episode',
    source: 'growth-plan'
  },
  {
    type: 'resources',
    label: 'Resources Mentioned',
    description: 'Links, tools, guests, and references from the episode.',
    category: 'episode',
    source: 'manual'
  },
  {
    type: 'shopping-grid',
    label: 'Shop the Episode',
    description: 'A no-code shopping block for affiliate links, host picks, and products.',
    category: 'commerce',
    source: 'manual'
  },
  {
    type: 'newsletter-signup',
    label: 'Email Signup',
    description: 'A branded call-to-action for Mailchimp, ConvertKit, Substack, or a custom form.',
    category: 'capture',
    source: 'integration'
  },
  {
    type: 'social-links',
    label: 'Social Links',
    description: 'One-click social profile buttons for Instagram, Facebook, YouTube, TikTok, and other channels.',
    category: 'capture',
    source: 'integration'
  },
  {
    type: 'social-caption',
    label: 'Ready-to-Post Caption',
    description: 'Uses Agent Spotlight to create a caption the host can reuse.',
    category: 'growth',
    source: 'growth-plan'
  },
  {
    type: 'distribution-list',
    label: 'Distribution Suggestions',
    description: 'Shows communities, publications, and partner ideas from the growth agents.',
    category: 'growth',
    source: 'growth-plan'
  }
];

interface BuildBlocksInput {
  brandKit: BrandKit;
  episode: Required<Pick<EpisodeMetadataInput, 'episodeTitle' | 'podcastTitle'>> & EpisodeMetadataInput;
  growthPlan: any;
  resources: ResourceItem[];
  integrations: SiteIntegration[];
  selectedBlocks?: EditorBlock[];
  showBrandCustomizer?: boolean;
}

export function buildEditorBlocks(input: BuildBlocksInput): EditorBlock[] {
  if (input.selectedBlocks?.length) {
    return normalizeSelectedBlocks(input.selectedBlocks, input.integrations);
  }

  const agents = input.growthPlan?.agents || {};
  const insight = agents.insight || {};
  const spotlight = agents.spotlight || {};
  const amplify = agents.amplify || {};
  const pulse = agents.pulse || {};
  const bridge = agents.bridge || {};
  const beacon = agents.beacon || {};
  const youtubeUrls = collectProviderUrls('youtube', input.integrations, input.episode.youtubeUrl);
  const youtubeChannelUrls = youtubeUrls.filter(isYouTubeChannelUrl);
  const youtubeVideoUrls = youtubeUrls.filter(url => !isYouTubeChannelUrl(url));
  const instagramUrls = collectInstagramUrls(input.integrations);
  const appleEpisodeId = extractAppleEpisodeId(input.episode.appleUrl);
  const socialLinks = collectSocialLinks(input.integrations);
  const emailIntegration = findFirstIntegration(input.integrations, ['mailchimp', 'convertkit', 'substack']);

  return compact<EditorBlock>([
    block('brand-customizer', 'Make This Ours', 'brand-kit', {
      showName: input.brandKit.showName,
      colors: input.brandKit.colors,
      fonts: input.brandKit.fonts,
      voice: input.brandKit.voice,
      wordsUseOften: input.brandKit.wordsUseOften,
      wordsAvoid: input.brandKit.wordsAvoid,
      logoUrl: input.brandKit.logoUrl || input.brandKit.artworkUrl,
      imageAlt: input.brandKit.imageAlt
    }, {
      visible: input.showBrandCustomizer !== false
    }),
    block('hero', 'Episode Hero', 'episode-metadata', {
      title: input.episode.episodeTitle,
      podcastTitle: input.episode.podcastTitle,
      summary: insight.episode_summary || input.episode.description,
      logoUrl: input.brandKit.logoUrl || input.brandKit.artworkUrl,
      artworkUrl: input.episode.imageUrl || input.brandKit.artworkUrl || input.brandKit.logoUrl,
      imageAlt: input.brandKit.imageAlt || `${input.episode.podcastTitle} artwork`,
      brandWords: input.brandKit.wordsUseOften
    }),
    block('listen-links', 'Listen Links', 'episode-metadata', {
      appleUrl: input.episode.appleUrl,
      spotifyUrl: input.episode.spotifyUrl,
      youtubeUrl: input.episode.youtubeUrl,
      audioUrl: input.episode.audioUrl
    }),
    ...youtubeVideoUrls.map((url, index) => block('youtube-player', index === 0 ? 'YouTube Player' : `YouTube Player ${index + 1}`, 'integration', {
      url,
      videoId: extractYouTubeVideoId(url),
      embedUrl: buildYouTubeEmbedUrl(url)
    }, {
      needsConnection: 'youtube',
      settings: {
        aspectRatio: '16 / 9',
        controls: true,
        playsInline: true
      }
    })),
    ...youtubeChannelUrls.map((url, index) => block('youtube-channel', index === 0 ? 'YouTube Channel' : `YouTube Channel ${index + 1}`, 'integration', {
      url,
      handle: extractYouTubeHandle(url),
      heading: 'Subscribe on YouTube',
      body: 'Watch clips, conversations, and episode extras from the show.',
      episodeTitle: input.episode.episodeTitle,
      appleEpisodeId,
      selectionHint: 'Connect YouTube or paste the episode video URL to replace this card with the exact player.'
    }, {
      needsConnection: 'youtube'
    })),
    ...instagramUrls.map((url, index) => block('instagram-reel', index === 0 ? 'Instagram Reel' : `Instagram Reel ${index + 1}`, 'integration', {
      url,
      embedMode: isInstagramPostUrl(url) ? 'embed' : 'select-or-link-fallback',
      fallbackText: isInstagramPostUrl(url) ? 'View on Instagram' : 'Open Instagram',
      episodeTitle: input.episode.episodeTitle,
      appleEpisodeId,
      selectionHint: 'Connect Instagram or paste the episode Reel/post URL to show the exact embed here.'
    }, {
      needsConnection: 'instagram',
      settings: {
        aspectRatio: '9 / 16'
      }
    })),
    block('takeaways', 'Key Takeaways', 'growth-plan', {
      phrases: insight.key_discovery_phrases || [],
      keywords: insight.keywords || [],
      trends: compact([
        ...(pulse.trends || pulse.trend_connections || []),
        pulse.durable_trend,
        pulse.viral_moment
      ])
    }),
    block('quote-grid', 'Shareable Quote Grid', 'growth-plan', {
      quotes: spotlight.shareable_quotes || []
    }),
    block('resources', 'Resources Mentioned', 'manual', {
      items: input.resources.filter(resource => !isCommerceResource(resource))
    }),
    block('shopping-grid', 'Shop the Episode', 'manual', {
      items: input.resources.filter(isCommerceResource),
      disclosure: 'Some links may be affiliate links. We only share resources that fit the episode and the show.'
    }),
    block('newsletter-signup', 'Email Signup', emailIntegration ? 'integration' : 'manual', {
      provider: emailIntegration?.provider || 'custom',
      url: emailIntegration?.url,
      heading: `Get the next ${input.episode.podcastTitle} reset`,
      body: 'A short note when new episodes, resources, and gentle ideas are ready.'
    }, {
      needsConnection: emailIntegration?.provider,
      visible: true
    }),
    block('social-links', 'Social Links', 'integration', {
      links: socialLinks
    }, {
      visible: socialLinks.length > 0
    }),
    block('social-caption', 'Ready-to-Post Caption', 'growth-plan', {
      caption: spotlight.ready_to_post_caption || null
    }),
    block('distribution-list', 'Distribution Suggestions', 'growth-plan', {
      communities: amplify.communities || [],
      podcastMatches: compact([amplify.podcast_match, ...(bridge.podcast_matches || []), ...(bridge.matches || [])]),
      publications: beacon.publications || [],
      trend: pulse.durable_trend || pulse.viral_moment || (pulse.trends || pulse.trend_connections || [])[0] || null
    })
  ]);
}

export function getBlockCatalog(): BlockDefinition[] {
  return BLOCK_CATALOG;
}

function normalizeSelectedBlocks(blocks: EditorBlock[], integrations: SiteIntegration[]): EditorBlock[] {
  return blocks.map(item => {
    const definition = BLOCK_CATALOG.find(blockDefinition => blockDefinition.type === item.type);
    const provider = item.needsConnection || definition?.requiresConnection;
    const connected = provider ? hasConnectedProvider(integrations, provider) : true;

    return {
      ...item,
      visible: item.visible !== false,
      needsConnection: connected ? undefined : provider
    };
  });
}

function block(
  type: string,
  label: string,
  source: EditorBlock['source'],
  content: Record<string, any>,
  options: Partial<EditorBlock> = {}
): EditorBlock {
  return {
    id: `${type}_${Math.random().toString(36).slice(2, 10)}`,
    type,
    label,
    source,
    visible: options.visible !== false,
    needsConnection: options.needsConnection,
    content,
    settings: options.settings,
    locked: options.locked
  };
}

function collectProviderUrls(provider: SiteIntegrationProvider, integrations: SiteIntegration[], fallback?: string): string[] {
  const urls = integrations
    .filter(integration => integration.provider === provider)
    .flatMap(integration => compact([integration.url, ...(integration.urls || [])]));

  return Array.from(new Set(compact([fallback, ...urls])));
}

function collectInstagramUrls(integrations: SiteIntegration[]): string[] {
  const urls = integrations
    .filter(integration => integration.provider === 'instagram')
    .flatMap(integration => compact([
      integration.config?.latestPostUrl,
      integration.config?.latestReelUrl,
      integration.url,
      ...(integration.urls || [])
    ]));

  return Array.from(new Set(urls));
}

function findFirstIntegration(integrations: SiteIntegration[], providers: SiteIntegrationProvider[]): SiteIntegration | undefined {
  return integrations.find(integration => providers.includes(integration.provider));
}

function collectSocialLinks(integrations: SiteIntegration[]): Array<{ label: string; url: string; provider: string }> {
  return integrations
    .filter(integration => ['youtube', 'instagram', 'facebook', 'tiktok', 'custom'].includes(integration.provider))
    .filter(integration => Boolean(integration.url))
    .map(integration => ({
      label: integration.label || labelForProvider(integration.provider),
      url: integration.url as string,
      provider: integration.config?.platform || integration.provider
    }));
}

function labelForProvider(provider: SiteIntegrationProvider): string {
  switch (provider) {
    case 'youtube':
      return 'YouTube';
    case 'instagram':
      return 'Instagram';
    case 'facebook':
      return 'Facebook';
    case 'tiktok':
      return 'TikTok';
    default:
      return 'Social';
  }
}

function hasConnectedProvider(integrations: SiteIntegration[], provider: SiteIntegrationProvider): boolean {
  if (provider === 'youtube') return true;
  return integrations.some(integration => integration.provider === provider && integration.connected);
}

function isCommerceResource(resource: ResourceItem): boolean {
  return resource.type === 'product' || resource.type === 'affiliate';
}

function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

function buildYouTubeEmbedUrl(url: string): string | null {
  const playlistMatch = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  if (/youtube\.com\/embed\/videoseries/i.test(url) && playlistMatch) {
    return `https://www.youtube.com/embed/videoseries?list=${playlistMatch[1]}`;
  }

  const videoId = extractYouTubeVideoId(url);
  if (!videoId) return null;
  return `https://www.youtube.com/embed/${videoId}?controls=1&playsinline=1`;
}

function isYouTubeChannelUrl(url: string): boolean {
  return /youtube\.com\/(@|channel\/|c\/|user\/)/i.test(url);
}

function extractYouTubeHandle(url: string): string | null {
  const match = url.match(/youtube\.com\/(@[^/?#]+)/i);
  return match?.[1] || null;
}

function isInstagramPostUrl(url: string): boolean {
  return /instagram\.com\/(p|reel|tv)\//i.test(url);
}

function extractAppleEpisodeId(url?: string): string | null {
  if (!url) return null;
  const match = url.match(/[?&]i=(\d+)/);
  return match?.[1] || null;
}

function compact<T>(items: Array<T | null | undefined | false>): T[] {
  return items.filter(Boolean) as T[];
}
