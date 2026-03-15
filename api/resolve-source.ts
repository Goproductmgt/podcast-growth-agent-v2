import type { VercelRequest, VercelResponse } from '@vercel/node';
import { EpisodeMetadata, ResolveSourceResponse } from './agents/shared/types';

// ============================================================================
// URL DETECTION - Determine which platform a URL belongs to
// ============================================================================

type Platform = 'apple' | 'youtube' | 'spotify' | 'unknown';

function detectPlatform(url: string): Platform {
  if (url.includes('podcasts.apple.com') || url.includes('itunes.apple.com')) {
    return 'apple';
  }
  if (
    url.includes('youtube.com/watch') ||
    url.includes('youtu.be/') ||
    url.includes('youtube.com/live/') ||
    url.includes('youtube.com/shorts/') ||
    url.includes('youtube.com/embed/')
  ) {
    return 'youtube';
  }
  if (url.includes('open.spotify.com/episode/') || url.includes('spotify.link/')) {
    return 'spotify';
  }
  return 'unknown';
}

// ============================================================================
// URL PARSING - APPLE PODCASTS
// ============================================================================

interface ParsedAppleURL {
  podcastId: string;
  episodeId?: string;
  titleHint: string;
  originalUrl: string;
}

function parseApplePodcastsURL(url: string): ParsedAppleURL | null {
  try {
    // Extract podcast ID
    const podcastIdMatch = url.match(/id(\d+)/);
    if (!podcastIdMatch) {
      console.error('No podcast ID found in URL');
      return null;
    }
    const podcastId = podcastIdMatch[1];

    // Extract episode ID (optional - after ?i=)
    const episodeIdMatch = url.match(/[?&]i=(\d+)/);
    const episodeId = episodeIdMatch ? episodeIdMatch[1] : undefined;

    // Extract title hint from URL path
    // Example: /podcast/holiday-magic-the-traditions/id123?i=456
    // Extract: "holiday-magic-the-traditions"
    const pathMatch = url.match(/\/podcast\/([^\/]+)\/id\d+/);
    let titleHint = '';

    if (pathMatch && pathMatch[1]) {
      // Convert URL slug to search query
      // "holiday-magic-the-traditions" → "holiday magic traditions"
      titleHint = decodeURIComponent(pathMatch[1])
        .replace(/-/g, ' ')
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .trim();
    }

    console.log('Parsed Apple Podcasts URL:', {
      podcastId,
      episodeId,
      titleHint
    });

    return {
      podcastId,
      episodeId,
      titleHint,
      originalUrl: url
    };
  } catch (error) {
    console.error('Error parsing Apple Podcasts URL:', error);
    return null;
  }
}

// ============================================================================
// URL PARSING - YOUTUBE
// ============================================================================

/**
 * Extract YouTube video ID from various URL formats:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/live/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 */
function extractYouTubeVideoId(url: string): string | null {
  try {
    const patterns = [
      /[?&]v=([a-zA-Z0-9_-]{11})/,           // youtube.com/watch?v=ID
      /youtu\.be\/([a-zA-Z0-9_-]{11})/,        // youtu.be/ID
      /youtube\.com\/live\/([a-zA-Z0-9_-]{11})/, // youtube.com/live/ID
      /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/, // youtube.com/embed/ID
      /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/, // youtube.com/shorts/ID
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Fetch YouTube video title using the free oEmbed API (no API key required)
 */
async function getYouTubeVideoTitle(videoId: string): Promise<string | null> {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    console.log('📺 Fetching YouTube video title via oEmbed...');

    const response = await fetch(oembedUrl);

    if (!response.ok) {
      console.error('YouTube oEmbed API error:', response.status);
      return null;
    }

    const data = await response.json() as any;
    const title = data.title;

    if (!title) {
      console.error('No title found in YouTube oEmbed response');
      return null;
    }

    console.log('📺 YouTube video title:', title);
    return title;
  } catch (error) {
    console.error('Error fetching YouTube video title:', error);
    return null;
  }
}

/**
 * Clean up a YouTube video title for podcast search.
 * Removes common YouTube-specific suffixes and prefixes that wouldn't
 * appear in podcast episode titles.
 */
function cleanYouTubeTitleForSearch(title: string): string {
  return title
    // Remove common YouTube suffixes
    .replace(/\s*[|\-–—]\s*(full episode|official|podcast|video|clip|interview|highlight|recap).*$/i, '')
    // Remove episode numbering prefixes like "EP. 123 - " or "#123:"
    .replace(/^(ep\.?\s*#?\d+\s*[-:–—]\s*)/i, '')
    // Remove channel name suffixes like " | The Joe Rogan Experience"
    .replace(/\s*[|]\s*[^|]+$/, '')
    // Clean up extra whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

// ============================================================================
// LISTENNOTES API - EPISODE SEARCH (WITH FALLBACK)
// ============================================================================

/**
 * Search for episode within a specific podcast (by iTunes ID)
 */
async function searchWithinPodcast(
  apiKey: string,
  podcastId: string,
  titleQuery: string
): Promise<any | null> {
  const params = new URLSearchParams({
    q: titleQuery,
    podcast_id: podcastId,
    podcast_id_type: 'itunes_id'
  });

  const searchUrl = `https://listen-api.listennotes.com/api/v2/search_episode_titles?${params}`;
  
  console.log('Search attempt 1: Within specific podcast', {
    podcastId,
    titleQuery
  });

  const response = await fetch(searchUrl, {
    headers: { 'X-ListenAPI-Key': apiKey }
  });

  if (!response.ok) {
    console.error('ListenNotes API error (podcast search):', response.status);
    return null;
  }

  const data = await response.json() as any;
  
  if (data.results && data.results.length > 0) {
    console.log('✅ Found episode in specific podcast');
    return data.results[0];
  }

  console.log('❌ No results in specific podcast, will try global search');
  return null;
}

/**
 * Search for episode across ALL podcasts (fallback)
 * This handles cases where the episode is on a different feed than expected
 */
async function searchAllPodcasts(
  apiKey: string,
  titleQuery: string
): Promise<any | null> {
  const params = new URLSearchParams({
    q: titleQuery
  });

  const searchUrl = `https://listen-api.listennotes.com/api/v2/search_episode_titles?${params}`;
  
  console.log('Search attempt 2: Global search across all podcasts', {
    titleQuery
  });

  const response = await fetch(searchUrl, {
    headers: { 'X-ListenAPI-Key': apiKey }
  });

  if (!response.ok) {
    console.error('ListenNotes API error (global search):', response.status);
    return null;
  }

  const data = await response.json() as any;
  
  if (data.results && data.results.length > 0) {
    console.log('✅ Found episode in global search:', {
      title: data.results[0].title_original,
      podcast: data.results[0].podcast?.title_original
    });
    return data.results[0];
  }

  console.log('❌ No results in global search either');
  return null;
}

/**
 * Main search function with two-tier fallback:
 * 1. First try searching within the specific podcast (most accurate)
 * 2. If not found, search across all podcasts (handles feed mismatches)
 */
async function searchEpisodeWithFallback(
  podcastId: string,
  titleQuery: string
): Promise<EpisodeMetadata | null> {
  const apiKey = process.env.LISTENNOTES_API_KEY;
  
  if (!apiKey) {
    console.error('LISTENNOTES_API_KEY not found in environment');
    return null;
  }

  try {
    // ATTEMPT 1: Search within the specific podcast
    let episode = await searchWithinPodcast(apiKey, podcastId, titleQuery);
    
    // ATTEMPT 2: If not found, search globally
    if (!episode) {
      episode = await searchAllPodcasts(apiKey, titleQuery);
    }

    // Still no results
    if (!episode) {
      console.error('Episode not found in either search strategy');
      return null;
    }

    // Extract and return metadata
    return {
      episodeUrl: episode.listennotes_url || episode.link || '',
      episodeTitle: episode.title_original || episode.title || 'Unknown Episode',
      podcastTitle: episode.podcast?.title_original || episode.podcast?.title || 'Unknown Podcast',
      publishDate: episode.pub_date_ms 
        ? new Date(episode.pub_date_ms).toISOString() 
        : new Date().toISOString(),
      audioUrl: episode.audio || '',
      audioDuration: episode.audio_length_sec,
      podcastSocial: {
        twitter: episode.podcast?.twitter_handle || undefined,
        instagram: episode.podcast?.instagram_handle || undefined,
        facebook: episode.podcast?.facebook_handle || undefined,
        website: episode.podcast?.website || undefined
      }
    };
  } catch (error) {
    console.error('Error in episode search:', error);
    return null;
  }
}

// ============================================================================
// URL PARSING - SPOTIFY
// ============================================================================

/**
 * Extract Spotify episode ID from URL:
 * - https://open.spotify.com/episode/14HuB3tygVUmWI79O5cYz6
 * - https://open.spotify.com/episode/14HuB3tygVUmWI79O5cYz6?si=abc123
 */
function extractSpotifyEpisodeId(url: string): string | null {
  try {
    const match = url.match(/episode\/([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Fetch Spotify episode title using the free oEmbed API (no API key required)
 */
async function getSpotifyEpisodeTitle(episodeId: string): Promise<string | null> {
  try {
    const oembedUrl = `https://open.spotify.com/oembed?url=https://open.spotify.com/episode/${episodeId}`;
    console.log('🎵 Fetching Spotify episode title via oEmbed...');

    const response = await fetch(oembedUrl);

    if (!response.ok) {
      console.error('Spotify oEmbed API error:', response.status);
      return null;
    }

    const data = await response.json() as any;
    const title = data.title?.trim();

    if (!title) {
      console.error('No title found in Spotify oEmbed response');
      return null;
    }

    console.log('🎵 Spotify episode title:', title);
    return title;
  } catch (error) {
    console.error('Error fetching Spotify episode title:', error);
    return null;
  }
}

/**
 * Search ListenNotes for a podcast episode matching a Spotify episode title.
 */
async function searchSpotifyEpisode(
  title: string
): Promise<EpisodeMetadata | null> {
  const apiKey = process.env.LISTENNOTES_API_KEY;

  if (!apiKey) {
    console.error('LISTENNOTES_API_KEY not found in environment');
    return null;
  }

  try {
    console.log('🎵 Spotify → ListenNotes search');
    const episode = await searchAllPodcasts(apiKey, title);

    if (!episode) {
      console.error('🎵 No matching podcast episode found for Spotify episode');
      return null;
    }

    return {
      episodeUrl: episode.listennotes_url || episode.link || '',
      episodeTitle: episode.title_original || episode.title || 'Unknown Episode',
      podcastTitle: episode.podcast?.title_original || episode.podcast?.title || 'Unknown Podcast',
      publishDate: episode.pub_date_ms
        ? new Date(episode.pub_date_ms).toISOString()
        : new Date().toISOString(),
      audioUrl: episode.audio || '',
      audioDuration: episode.audio_length_sec,
      podcastSocial: {
        twitter: episode.podcast?.twitter_handle || undefined,
        instagram: episode.podcast?.instagram_handle || undefined,
        facebook: episode.podcast?.facebook_handle || undefined,
        website: episode.podcast?.website || undefined
      }
    };
  } catch (error) {
    console.error('Error searching Spotify episode:', error);
    return null;
  }
}

// ============================================================================
// YOUTUBE → LISTENNOTES SEARCH
// ============================================================================

/**
 * Search ListenNotes for a podcast episode matching a YouTube video title.
 * Uses a two-pass approach:
 * 1. Search with cleaned title (removes YouTube-specific noise)
 * 2. If no results, search with original title as fallback
 */
async function searchYouTubeEpisode(
  cleanedTitle: string,
  originalTitle: string
): Promise<EpisodeMetadata | null> {
  const apiKey = process.env.LISTENNOTES_API_KEY;

  if (!apiKey) {
    console.error('LISTENNOTES_API_KEY not found in environment');
    return null;
  }

  try {
    // ATTEMPT 1: Search with cleaned title
    console.log('📺 YouTube → ListenNotes search attempt 1 (cleaned title)');
    let episode = await searchAllPodcasts(apiKey, cleanedTitle);

    // ATTEMPT 2: If cleaned title didn't work, try original
    if (!episode && cleanedTitle !== originalTitle) {
      console.log('📺 YouTube → ListenNotes search attempt 2 (original title)');
      episode = await searchAllPodcasts(apiKey, originalTitle);
    }

    if (!episode) {
      console.error('📺 No matching podcast episode found for YouTube video');
      return null;
    }

    return {
      episodeUrl: episode.listennotes_url || episode.link || '',
      episodeTitle: episode.title_original || episode.title || 'Unknown Episode',
      podcastTitle: episode.podcast?.title_original || episode.podcast?.title || 'Unknown Podcast',
      publishDate: episode.pub_date_ms
        ? new Date(episode.pub_date_ms).toISOString()
        : new Date().toISOString(),
      audioUrl: episode.audio || '',
      audioDuration: episode.audio_length_sec,
      podcastSocial: {
        twitter: episode.podcast?.twitter_handle || undefined,
        instagram: episode.podcast?.instagram_handle || undefined,
        facebook: episode.podcast?.facebook_handle || undefined,
        website: episode.podcast?.website || undefined
      }
    };
  } catch (error) {
    console.error('Error searching YouTube episode:', error);
    return null;
  }
}

// ============================================================================
// API ENDPOINT
// ============================================================================

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  const { url } = req.body;

  if (!url || typeof url !== 'string') {
    res.status(400).json({ 
      success: false, 
      error: 'Missing or invalid URL parameter' 
    });
    return;
  }

  console.log('Resolving podcast URL:', url);

  const platform = detectPlatform(url);
  console.log(`🔍 Detected platform: ${platform}`);

  let metadata: EpisodeMetadata | null = null;

  // ========================================================================
  // APPLE PODCASTS
  // ========================================================================
  if (platform === 'apple') {
    const parsed = parseApplePodcastsURL(url);

    if (!parsed) {
      res.status(400).json({
        success: false,
        error: 'Invalid Apple Podcasts URL format. Please provide a valid episode or podcast URL from podcasts.apple.com'
      });
      return;
    }

    if (!parsed.titleHint) {
      res.status(400).json({
        success: false,
        error: 'Could not extract episode title from URL. Please ensure the URL includes the episode name in the path.'
      });
      return;
    }

    metadata = await searchEpisodeWithFallback(parsed.podcastId, parsed.titleHint);

  // ========================================================================
  // YOUTUBE
  // ========================================================================
  } else if (platform === 'youtube') {
    const videoId = extractYouTubeVideoId(url);

    if (!videoId) {
      res.status(400).json({
        success: false,
        error: 'Could not extract video ID from YouTube URL. Please provide a valid YouTube video URL.'
      });
      return;
    }

    // Step 1: Get video title from YouTube oEmbed (free, no API key)
    const videoTitle = await getYouTubeVideoTitle(videoId);

    if (!videoTitle) {
      res.status(400).json({
        success: false,
        error: 'Could not retrieve video title from YouTube. The video may be private or unavailable.'
      });
      return;
    }

    // Step 2: Clean up the title for better podcast search results
    const searchQuery = cleanYouTubeTitleForSearch(videoTitle);
    console.log(`📺 YouTube search query: "${searchQuery}" (from: "${videoTitle}")`);

    // Step 3: Search ListenNotes globally for this episode
    metadata = await searchYouTubeEpisode(searchQuery, videoTitle);

  // ========================================================================
  // SPOTIFY
  // ========================================================================
  } else if (platform === 'spotify') {
    const episodeId = extractSpotifyEpisodeId(url);

    if (!episodeId) {
      res.status(400).json({
        success: false,
        error: 'Could not extract episode ID from Spotify URL. Please provide a valid Spotify episode URL.'
      });
      return;
    }

    // Step 1: Get episode title from Spotify oEmbed (free, no API key)
    const episodeTitle = await getSpotifyEpisodeTitle(episodeId);

    if (!episodeTitle) {
      res.status(400).json({
        success: false,
        error: 'Could not retrieve episode title from Spotify. The episode may be private or unavailable.'
      });
      return;
    }

    // Step 2: Search ListenNotes for this episode
    metadata = await searchSpotifyEpisode(episodeTitle);

  // ========================================================================
  // UNSUPPORTED PLATFORM
  // ========================================================================
  } else {
    res.status(400).json({
      success: false,
      error: 'Unsupported URL. Please provide a link from Apple Podcasts, Spotify, or YouTube.'
    });
    return;
  }

  // ========================================================================
  // VALIDATE RESULTS
  // ========================================================================
  if (!metadata || !metadata.audioUrl) {
    res.status(404).json({
      success: false,
      error: platform === 'youtube'
        ? 'Could not find a matching podcast episode for this YouTube video. The episode may not be indexed as a podcast yet, or the title may differ. Try pasting the Apple Podcasts or Spotify link, or uploading the MP3 directly.'
        : platform === 'spotify'
        ? 'Could not find this Spotify episode in our podcast database. The episode may be a Spotify exclusive, or not yet indexed. Try pasting the Apple Podcasts link or uploading the MP3 directly.'
        : 'Could not find episode in ListenNotes database. The episode may be private, premium, geo-restricted, or not yet indexed. Please try uploading the MP3 file directly.'
    });
    return;
  }

  console.log('✅ Successfully resolved episode:', {
    title: metadata.episodeTitle,
    podcast: metadata.podcastTitle,
    hasAudio: !!metadata.audioUrl,
    source: platform
  });

  const response: ResolveSourceResponse = {
    success: true,
    metadata
  };

  res.status(200).json(response);
}