import type { BrandAssetResolution } from './types';

interface AppleLookupResult {
  collectionName?: string;
  trackName?: string;
  artworkUrl100?: string;
  artworkUrl600?: string;
  feedUrl?: string;
  collectionViewUrl?: string;
  description?: string;
}

export async function resolveBrandAssets(sourceUrl: string): Promise<BrandAssetResolution> {
  const url = normalizeUrl(sourceUrl);

  const listenNotesAssets = await tryResolveListenNotesAssets(url);
  if (listenNotesAssets?.candidates.length) {
    return listenNotesAssets;
  }

  if (isApplePodcastUrl(url)) {
    return resolveApplePodcastAssets(url);
  }

  return resolveOpenGraphAssets(url);
}

async function resolveApplePodcastAssets(sourceUrl: string): Promise<BrandAssetResolution> {
  const podcastId = extractApplePodcastId(sourceUrl);
  if (!podcastId) {
    return resolveOpenGraphAssets(sourceUrl, 'apple-podcasts');
  }

  const lookupUrl = `https://itunes.apple.com/lookup?id=${encodeURIComponent(podcastId)}&entity=podcast`;
  const response = await fetch(lookupUrl);
  if (!response.ok) {
    throw new Error(`Apple lookup failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as { results?: AppleLookupResult[] };
  const podcast = data.results?.find(result => result.feedUrl || result.collectionName) || data.results?.[0];
  if (!podcast) {
    return resolveOpenGraphAssets(sourceUrl, 'apple-podcasts');
  }

  const artworkUrl = upgradeAppleArtwork(podcast.artworkUrl600 || podcast.artworkUrl100);
  const candidates = [
    artworkUrl ? {
      label: 'Podcast artwork',
      url: artworkUrl,
      width: 1200,
      height: 1200,
      source: 'apple-itunes-lookup'
    } : null,
    podcast.artworkUrl100 ? {
      label: 'Small podcast artwork',
      url: podcast.artworkUrl100,
      width: 100,
      height: 100,
      source: 'apple-itunes-lookup'
    } : null
  ].filter(Boolean) as BrandAssetResolution['candidates'];

  return {
    sourceUrl,
    provider: 'apple-podcasts',
    metadataSource: 'apple-itunes-lookup',
    showName: podcast.collectionName,
    episodeTitle: podcast.trackName,
    artworkUrl,
    logoUrl: artworkUrl,
    feedUrl: podcast.feedUrl,
    websiteUrl: podcast.collectionViewUrl,
    description: podcast.description,
    socialLinks: {},
    candidates
  };
}

async function resolveOpenGraphAssets(sourceUrl: string, provider: BrandAssetResolution['provider'] = 'webpage'): Promise<BrandAssetResolution> {
  const response = await fetch(sourceUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; PodcastGrowthAgent/1.0; +https://podcastgrowthagent.com)'
    }
  });

  if (!response.ok) {
    throw new Error(`Webpage asset lookup failed: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const title = extractMeta(html, 'og:title') || extractTitle(html);
  const description = extractMeta(html, 'og:description') || extractMeta(html, 'description');
  const image = absoluteUrl(extractMeta(html, 'og:image') || extractMeta(html, 'twitter:image'), sourceUrl);
  const socialLinks = extractSocialLinks(html, sourceUrl);

  return {
    sourceUrl,
    provider,
    metadataSource: 'open-graph',
    showName: title,
    artworkUrl: image,
    logoUrl: image,
    description,
    socialLinks,
    candidates: image ? [{
      label: 'Page preview image',
      url: image,
      source: 'open-graph'
    }] : []
  };
}

async function tryResolveListenNotesAssets(sourceUrl: string): Promise<BrandAssetResolution | null> {
  const apiKey = process.env.LISTENNOTES_API_KEY;
  if (!apiKey) return null;

  const parsed = parsePodcastSourceUrl(sourceUrl);
  if (!parsed) return null;

  const params = new URLSearchParams({
    q: parsed.titleHint
  });

  if (parsed.podcastId && parsed.podcastIdType) {
    params.set('podcast_id', parsed.podcastId);
    params.set('podcast_id_type', parsed.podcastIdType);
  }

  const response = await fetch(`https://listen-api.listennotes.com/api/v2/search_episode_titles?${params}`, {
    headers: {
      'X-ListenAPI-Key': apiKey
    }
  });

  if (!response.ok) {
    console.log(`ListenNotes asset lookup skipped: ${response.status} ${response.statusText}`);
    return null;
  }

  const data = await response.json() as any;
  const episode = data.results?.[0];
  if (!episode) {
    return tryResolveListenNotesPodcastSearch(sourceUrl, parsed);
  }

  const podcast = episode.podcast || {};
  const candidates = buildListenNotesImageCandidates(episode, podcast);
  const artworkUrl = candidates[0]?.url;
  if (!artworkUrl) {
    return tryResolveListenNotesPodcastSearch(sourceUrl, parsed);
  }

  return {
    sourceUrl,
    provider: parsed.provider,
    metadataSource: 'listennotes',
    showName: podcast.title_original || podcast.title || episode.podcast_title_original || episode.podcast_title,
    episodeTitle: episode.title_original || episode.title,
    artworkUrl,
    logoUrl: artworkUrl,
    feedUrl: episode.rss || podcast.rss || podcast.rss_url,
    websiteUrl: podcast.website || episode.link || episode.listennotes_url,
    description: episode.description_original || episode.description || podcast.description_original || podcast.description,
    socialLinks: extractListenNotesSocialLinks(podcast),
    candidates
  };
}

async function tryResolveListenNotesPodcastSearch(
  sourceUrl: string,
  parsed: {
    provider: BrandAssetResolution['provider'];
    podcastId?: string;
    podcastIdType?: 'itunes_id' | 'spotify_id';
    titleHint: string;
  }
): Promise<BrandAssetResolution | null> {
  const apiKey = process.env.LISTENNOTES_API_KEY;
  if (!apiKey) return null;

  const params = new URLSearchParams({
    q: parsed.titleHint,
    type: 'podcast',
    sort_by_date: '0'
  });

  const response = await fetch(`https://listen-api.listennotes.com/api/v2/search?${params}`, {
    headers: {
      'X-ListenAPI-Key': apiKey
    }
  });

  if (!response.ok) {
    console.log(`ListenNotes podcast asset lookup skipped: ${response.status} ${response.statusText}`);
    return null;
  }

  const data = await response.json() as any;
  const podcast = data.results?.[0];
  if (!podcast) return null;

  const candidates = buildListenNotesImageCandidates({}, podcast);
  const artworkUrl = candidates[0]?.url;
  if (!artworkUrl) return null;

  return {
    sourceUrl,
    provider: parsed.provider,
    metadataSource: 'listennotes',
    showName: podcast.title_original || podcast.title,
    artworkUrl,
    logoUrl: artworkUrl,
    feedUrl: podcast.rss || podcast.rss_url,
    websiteUrl: podcast.website || podcast.listennotes_url,
    description: podcast.description_original || podcast.description,
    socialLinks: extractListenNotesSocialLinks(podcast),
    candidates
  };
}

function extractListenNotesSocialLinks(podcast: any): Record<string, string> {
  const socials: Record<string, string> = {};

  addSocial(socials, 'website', podcast.website);
  addSocial(socials, 'twitter', normalizeTwitter(podcast.twitter_handle));
  addSocial(socials, 'instagram', normalizeInstagram(podcast.instagram_handle));
  addSocial(socials, 'facebook', normalizeFacebook(podcast.facebook_handle));
  addSocial(socials, 'linkedin', podcast.linkedin_url || podcast.linkedin);
  addSocial(socials, 'youtube', podcast.youtube_url || podcast.youtube);
  addSocial(socials, 'tiktok', podcast.tiktok_url || podcast.tiktok);

  return socials;
}

function buildListenNotesImageCandidates(episode: any, podcast: any): BrandAssetResolution['candidates'] {
  const candidates = [
    { label: 'Podcast artwork', url: podcast.image, source: 'listennotes-podcast-image' },
    { label: 'Podcast thumbnail', url: podcast.thumbnail, source: 'listennotes-podcast-thumbnail' },
    { label: 'Episode artwork', url: episode.image, source: 'listennotes-episode-image' },
    { label: 'Episode thumbnail', url: episode.thumbnail, source: 'listennotes-episode-thumbnail' }
  ]
    .filter(candidate => typeof candidate.url === 'string' && candidate.url.length > 0)
    .filter((candidate, index, all) => all.findIndex(item => item.url === candidate.url) === index);

  return candidates;
}

function parsePodcastSourceUrl(sourceUrl: string): {
  provider: BrandAssetResolution['provider'];
  podcastId?: string;
  podcastIdType?: 'itunes_id' | 'spotify_id';
  titleHint: string;
} | null {
  if (isApplePodcastUrl(sourceUrl)) {
    const podcastId = extractApplePodcastId(sourceUrl) || undefined;
    const titleHint = extractAppleTitleHint(sourceUrl);
    if (!titleHint) return null;
    return {
      provider: 'apple-podcasts',
      podcastId,
      podcastIdType: podcastId ? 'itunes_id' : undefined,
      titleHint
    };
  }

  if (sourceUrl.includes('open.spotify.com/episode/')) {
    const episodeId = sourceUrl.match(/episode\/([a-zA-Z0-9]+)/)?.[1];
    return {
      provider: 'spotify',
      podcastId: episodeId,
      podcastIdType: episodeId ? 'spotify_id' : undefined,
      titleHint: extractSlugTitleHint(sourceUrl)
    };
  }

  return null;
}

function extractAppleTitleHint(sourceUrl: string): string {
  const pathMatch = sourceUrl.match(/\/podcast\/([^/]+)\/id\d+/);
  if (pathMatch?.[1]) {
    return decodeURIComponent(pathMatch[1])
      .replace(/-/g, ' ')
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  return extractSlugTitleHint(sourceUrl);
}

function extractSlugTitleHint(sourceUrl: string): string {
  try {
    const url = new URL(sourceUrl);
    const lastPathPart = url.pathname.split('/').filter(Boolean).pop() || '';
    return decodeURIComponent(lastPathPart)
      .replace(/-/g, ' ')
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  } catch {
    return '';
  }
}

function normalizeUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only http and https URLs are supported.');
  }
  return url.toString();
}

function isApplePodcastUrl(url: string): boolean {
  return url.includes('podcasts.apple.com') || url.includes('itunes.apple.com');
}

function extractApplePodcastId(url: string): string | null {
  const match = url.match(/id(\d+)/);
  return match?.[1] || null;
}

function upgradeAppleArtwork(url?: string): string | undefined {
  if (!url) return undefined;
  return url.replace(/\/\d+x\d+bb\.(jpg|png|webp)$/i, '/1200x1200bb.$1');
}

function extractMeta(html: string, key: string): string | undefined {
  const escapedKey = escapeRegExp(key);
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${escapedKey}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+name=["']${escapedKey}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escapedKey}["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${escapedKey}["'][^>]*>`, 'i')
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtml(match[1]);
  }

  return undefined;
}

function extractTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match?.[1] ? decodeHtml(match[1]) : undefined;
}

function extractSocialLinks(html: string, baseUrl: string): Record<string, string> {
  const socials: Record<string, string> = {};
  const linkPattern = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(html)) !== null) {
    const href = absoluteUrl(match[1], baseUrl);
    if (!href) continue;

    const platform = detectSocialPlatform(href);
    if (platform && !socials[platform]) {
      socials[platform] = href;
    }
  }

  return socials;
}

function detectSocialPlatform(url: string): string | null {
  const hostname = new URL(url).hostname.replace(/^www\./, '').toLowerCase();

  if (hostname === 'instagram.com') return 'instagram';
  if (hostname === 'tiktok.com') return 'tiktok';
  if (hostname === 'youtube.com' || hostname === 'youtu.be') return 'youtube';
  if (hostname === 'facebook.com') return 'facebook';
  if (hostname === 'linkedin.com') return 'linkedin';
  if (hostname === 'x.com' || hostname === 'twitter.com') return 'twitter';
  if (hostname === 'threads.net') return 'threads';
  if (hostname === 'pinterest.com') return 'pinterest';
  if (hostname === 'substack.com' || hostname.endsWith('.substack.com')) return 'substack';

  return null;
}

function addSocial(socials: Record<string, string>, platform: string, value: string | undefined): void {
  if (!value) return;
  socials[platform] = value;
}

function normalizeTwitter(handle: string | undefined): string | undefined {
  if (!handle) return undefined;
  if (handle.startsWith('http')) return handle;
  return `https://x.com/${handle.replace(/^@/, '')}`;
}

function normalizeInstagram(handle: string | undefined): string | undefined {
  if (!handle) return undefined;
  if (handle.startsWith('http')) return handle;
  return `https://www.instagram.com/${handle.replace(/^@/, '')}/`;
}

function normalizeFacebook(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (value.startsWith('http')) return value;
  return `https://www.facebook.com/${value.replace(/^@/, '')}`;
}

function absoluteUrl(value: string | undefined, baseUrl: string): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return undefined;
  }
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
