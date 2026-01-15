import type { VercelRequest, VercelResponse } from '@vercel/node';
import { EpisodeMetadata, ResolveSourceResponse } from './agents/shared/types';

// ============================================================================
// URL PARSING - APPLE PODCASTS ONLY
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

  // Validate it's an Apple Podcasts URL
  if (!url.includes('podcasts.apple.com') && !url.includes('itunes.apple.com')) {
    res.status(400).json({
      success: false,
      error: 'Currently only Apple Podcasts URLs are supported. Please provide a URL from podcasts.apple.com'
    });
    return;
  }

  // Parse the URL
  const parsed = parseApplePodcastsURL(url);
  
  if (!parsed) {
    res.status(400).json({
      success: false,
      error: 'Invalid Apple Podcasts URL format. Please provide a valid episode or podcast URL from podcasts.apple.com'
    });
    return;
  }

  // Search for the episode using title hint
  if (!parsed.titleHint) {
    res.status(400).json({
      success: false,
      error: 'Could not extract episode title from URL. Please ensure the URL includes the episode name in the path.'
    });
    return;
  }

  // Use the new two-tier search with fallback
  const metadata = await searchEpisodeWithFallback(parsed.podcastId, parsed.titleHint);

  if (!metadata || !metadata.audioUrl) {
    res.status(404).json({
      success: false,
      error: 'Could not find episode in ListenNotes database. The episode may be private, premium, geo-restricted, or not yet indexed. Please try uploading the MP3 file directly.'
    });
    return;
  }

  console.log('✅ Successfully resolved episode:', {
    title: metadata.episodeTitle,
    podcast: metadata.podcastTitle,
    hasAudio: !!metadata.audioUrl
  });

  const response: ResolveSourceResponse = {
    success: true,
    metadata
  };

  res.status(200).json(response);
}