import type {
  EpisodeMediaDiscoveryInput,
  EpisodeMediaDiscoveryResult,
  MediaDiscoveryCandidate,
  MediaDiscoveryProvider,
  MediaDiscoveryProviderResult,
  SiteIntegration
} from './types';

const DEFAULT_PROVIDERS: MediaDiscoveryProvider[] = ['spotify', 'youtube', 'instagram'];
const DEFAULT_MAX_RESULTS = 5;

export async function discoverEpisodeMedia(input: EpisodeMediaDiscoveryInput): Promise<EpisodeMediaDiscoveryResult> {
  const providers = input.providers?.length ? input.providers : DEFAULT_PROVIDERS;
  const maxResults = input.maxResults || DEFAULT_MAX_RESULTS;
  const results = await Promise.all(providers.map(provider => discoverProvider(provider, input, maxResults)));
  const bestMatches = results
    .flatMap(result => result.candidates)
    .sort((left, right) => right.confidence - left.confidence)
    .slice(0, maxResults);

  return {
    episodeTitle: input.episode.episodeTitle || '',
    podcastTitle: input.episode.podcastTitle,
    providers: results,
    bestMatches
  };
}

async function discoverProvider(
  provider: MediaDiscoveryProvider,
  input: EpisodeMediaDiscoveryInput,
  maxResults: number
): Promise<MediaDiscoveryProviderResult> {
  try {
    switch (provider) {
      case 'spotify':
        return await discoverSpotify(input, maxResults);
      case 'youtube':
        return await discoverYouTube(input, maxResults);
      case 'instagram':
        return await discoverInstagram(input, maxResults);
      default:
        return providerResult(provider, 'error', 'Unsupported media discovery provider.', []);
    }
  } catch (error) {
    return providerResult(provider, 'error', error instanceof Error ? error.message : 'Media discovery failed.', []);
  }
}

async function discoverSpotify(input: EpisodeMediaDiscoveryInput, maxResults: number): Promise<MediaDiscoveryProviderResult> {
  const exactEpisodeUrl = collectProviderUrls('spotify', input).find(url => /open\.spotify\.com\/episode\//i.test(url));
  if (exactEpisodeUrl) {
    return providerResult('spotify', 'searched', 'Exact Spotify episode URL was already attached.', [
      candidate('spotify', input.episode.episodeTitle || 'Spotify episode', exactEpisodeUrl, {
        confidence: 1,
        matchReason: 'Existing Spotify episode URL',
        source: 'existing-url'
      })
    ]);
  }

  const showId = collectProviderUrls('spotify', input)
    .map(extractSpotifyShowId)
    .find(Boolean);

  if (!showId) {
    return providerResult('spotify', 'needs-connection', 'Connect a Spotify show URL so we can search that show catalog.', []);
  }

  const token = await getSpotifyAccessToken();
  if (!token) {
    return providerResult('spotify', 'needs-credentials', 'Set SPOTIFY_BEARER_TOKEN or SPOTIFY_CLIENT_ID/SPOTIFY_CLIENT_SECRET to search Spotify episodes.', []);
  }

  const response = await fetchJson<any>(`https://api.spotify.com/v1/shows/${showId}/episodes?market=US&limit=50`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const candidates = (response.items || [])
    .map((item: any) => {
      const url = item.external_urls?.spotify;
      if (!url) return null;
      const score = scoreMatch(input, item.name, item.description);
      return candidate('spotify', item.name, url, {
        confidence: score,
        matchReason: describeScore(score, 'Spotify show episode title/description'),
        source: 'api',
        description: item.description,
        thumbnailUrl: item.images?.[0]?.url,
        publishedAt: item.release_date
      });
    })
    .filter(Boolean)
    .sort((left: MediaDiscoveryCandidate, right: MediaDiscoveryCandidate) => right.confidence - left.confidence)
    .slice(0, maxResults);

  return providerResult('spotify', 'searched', 'Searched Spotify show episodes.', candidates);
}

async function discoverYouTube(input: EpisodeMediaDiscoveryInput, maxResults: number): Promise<MediaDiscoveryProviderResult> {
  const exactVideoUrl = collectProviderUrls('youtube', input).find(isYouTubeVideoUrl);
  if (exactVideoUrl) {
    const videoId = extractYouTubeVideoId(exactVideoUrl);
    return providerResult('youtube', 'searched', 'Exact YouTube video URL was already attached.', [
      candidate('youtube', input.episode.episodeTitle || 'YouTube video', exactVideoUrl, {
        confidence: 1,
        matchReason: 'Existing YouTube video URL',
        source: 'existing-url',
        embedUrl: videoId ? `https://www.youtube.com/embed/${videoId}?controls=1&playsinline=1` : undefined
      })
    ]);
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return providerResult('youtube', 'needs-credentials', 'Set YOUTUBE_API_KEY to search YouTube for this episode.', []);
  }

  const channelId = findIntegration(input.integrations, 'youtube')?.config?.channelId;
  const query = compact([
    input.episode.episodeTitle,
    input.episode.podcastTitle,
    extractYouTubeHandle(collectProviderUrls('youtube', input)[0] || '')
  ]).join(' ');
  const params = new URLSearchParams({
    part: 'snippet',
    q: query,
    type: 'video',
    maxResults: String(Math.min(maxResults * 3, 25)),
    key: apiKey
  });
  if (channelId) params.set('channelId', channelId);

  const response = await fetchJson<any>(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);
  const candidates = (response.items || [])
    .map((item: any) => {
      const videoId = item.id?.videoId;
      if (!videoId) return null;
      const url = `https://www.youtube.com/watch?v=${videoId}`;
      const score = scoreMatch(input, item.snippet?.title, item.snippet?.description);
      return candidate('youtube', item.snippet?.title || 'YouTube video', url, {
        confidence: score,
        matchReason: describeScore(score, channelId ? 'YouTube channel video search' : 'YouTube video search'),
        source: 'api',
        description: item.snippet?.description,
        thumbnailUrl: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url,
        publishedAt: item.snippet?.publishedAt,
        embedUrl: `https://www.youtube.com/embed/${videoId}?controls=1&playsinline=1`
      });
    })
    .filter(Boolean)
    .sort((left: MediaDiscoveryCandidate, right: MediaDiscoveryCandidate) => right.confidence - left.confidence)
    .slice(0, maxResults);

  return providerResult('youtube', 'searched', 'Searched YouTube for matching episode videos.', candidates);
}

async function discoverInstagram(input: EpisodeMediaDiscoveryInput, maxResults: number): Promise<MediaDiscoveryProviderResult> {
  const exactPostUrl = collectProviderUrls('instagram', input).find(isInstagramPostUrl);
  if (exactPostUrl) {
    return providerResult('instagram', 'searched', 'Exact Instagram Reel/post URL was already attached.', [
      candidate('instagram', input.episode.episodeTitle || 'Instagram episode post', exactPostUrl, {
        confidence: 1,
        matchReason: 'Existing Instagram Reel/post URL',
        source: 'existing-url'
      })
    ]);
  }

  const instagramIntegration = findIntegration(input.integrations, 'instagram');
  const accessToken = instagramIntegration?.config?.accessToken || process.env.INSTAGRAM_ACCESS_TOKEN;
  const igUserId = instagramIntegration?.config?.igUserId || process.env.INSTAGRAM_IG_USER_ID;

  if (!accessToken || !igUserId) {
    return providerResult('instagram', 'needs-connection', 'Connect Instagram Business/Creator access so we can search the podcaster’s own Reels and posts.', []);
  }

  const params = new URLSearchParams({
    fields: 'id,caption,permalink,media_type,media_url,thumbnail_url,timestamp',
    limit: '50',
    access_token: accessToken
  });
  const response = await fetchJson<any>(`https://graph.facebook.com/v19.0/${igUserId}/media?${params.toString()}`);
  const candidates = (response.data || [])
    .map((item: any) => {
      if (!item.permalink) return null;
      const score = scoreMatch(input, item.caption, item.caption);
      return candidate('instagram', firstLine(item.caption) || 'Instagram media', item.permalink, {
        confidence: score,
        matchReason: describeScore(score, 'Instagram connected account captions'),
        source: 'connected-account',
        description: item.caption,
        thumbnailUrl: item.thumbnail_url || item.media_url,
        publishedAt: item.timestamp
      });
    })
    .filter(Boolean)
    .sort((left: MediaDiscoveryCandidate, right: MediaDiscoveryCandidate) => right.confidence - left.confidence)
    .slice(0, maxResults);

  return providerResult('instagram', 'searched', 'Searched connected Instagram media captions.', candidates);
}

function providerResult(
  provider: MediaDiscoveryProvider,
  status: MediaDiscoveryProviderResult['status'],
  message: string,
  candidates: Array<MediaDiscoveryCandidate | null>
): MediaDiscoveryProviderResult {
  return {
    provider,
    status,
    message,
    candidates: candidates.filter(Boolean) as MediaDiscoveryCandidate[]
  };
}

function candidate(
  provider: MediaDiscoveryProvider,
  title: string,
  url: string,
  options: Partial<MediaDiscoveryCandidate>
): MediaDiscoveryCandidate {
  const confidence = Number((options.confidence ?? 0).toFixed(3));
  return {
    provider,
    title,
    url,
    embedUrl: options.embedUrl,
    thumbnailUrl: options.thumbnailUrl,
    description: options.description,
    publishedAt: options.publishedAt,
    confidence,
    matchReason: options.matchReason || 'Candidate match',
    action: options.action || (confidence >= 0.82 ? 'auto-attach' : confidence >= 0.45 ? 'review' : 'connect-required'),
    source: options.source || 'api'
  };
}

function scoreMatch(input: EpisodeMediaDiscoveryInput, title?: string, description?: string): number {
  const episodeTitle = input.episode.episodeTitle || '';
  const haystack = normalize(`${title || ''} ${description || ''}`);
  const titleTokens = tokenSet(episodeTitle);
  if (!titleTokens.size || !haystack) return 0;

  const matched = Array.from(titleTokens).filter(token => haystack.includes(token)).length;
  const overlap = matched / titleTokens.size;
  const exactTitleBonus = normalize(title || '').includes(normalize(episodeTitle).slice(0, 60)) ? 0.25 : 0;
  const podcastBonus = input.episode.podcastTitle && haystack.includes(normalize(input.episode.podcastTitle)) ? 0.1 : 0;

  return Math.min(1, overlap * 0.78 + exactTitleBonus + podcastBonus);
}

function describeScore(score: number, source: string): string {
  if (score >= 0.82) return `High-confidence match from ${source}`;
  if (score >= 0.45) return `Possible match from ${source}; ask the podcaster to confirm`;
  return `Low-confidence candidate from ${source}`;
}

async function getSpotifyAccessToken(): Promise<string | null> {
  if (process.env.SPOTIFY_BEARER_TOKEN) return process.env.SPOTIFY_BEARER_TOKEN;

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  if (!response.ok) return null;
  const json = await response.json() as { access_token?: string };
  return json.access_token || null;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }
  return await response.json() as T;
}

function collectProviderUrls(provider: string, input: EpisodeMediaDiscoveryInput): string[] {
  const integrationUrls = (input.integrations || [])
    .filter(integration => integration.provider === provider)
    .flatMap(integration => compact([integration.url, ...(integration.urls || [])]));
  const episodeUrl = provider === 'spotify'
    ? input.episode.spotifyUrl
    : provider === 'youtube'
      ? input.episode.youtubeUrl
      : undefined;

  return Array.from(new Set(compact([episodeUrl, ...integrationUrls])));
}

function findIntegration(integrations: SiteIntegration[] | undefined, provider: string): SiteIntegration | undefined {
  return integrations?.find(integration => integration.provider === provider);
}

function extractSpotifyShowId(url?: string): string | null {
  const match = url?.match(/open\.spotify\.com\/show\/([a-zA-Z0-9]+)/i);
  return match?.[1] || null;
}

function isYouTubeVideoUrl(url: string): boolean {
  return Boolean(extractYouTubeVideoId(url));
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

function extractYouTubeHandle(url: string): string | null {
  const match = url.match(/youtube\.com\/(@[^/?#]+)/i);
  return match?.[1] || null;
}

function isInstagramPostUrl(url: string): boolean {
  return /instagram\.com\/(p|reel|tv)\//i.test(url);
}

function firstLine(value?: string): string {
  return (value || '').split('\n')[0].slice(0, 90);
}

function tokenSet(value: string): Set<string> {
  return new Set(normalize(value).split(' ').filter(token => token.length > 2));
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compact<T>(items: Array<T | null | undefined | false>): T[] {
  return items.filter(Boolean) as T[];
}
