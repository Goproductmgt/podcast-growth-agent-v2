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
      titleHint = pathMatch[1]
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
// LISTENNOTES API - EPISODE SEARCH
// ============================================================================

async function searchEpisodeInPodcast(
  podcastId: string,
  titleQuery: string
): Promise<EpisodeMetadata | null> {
  const apiKey = process.env.LISTENNOTES_API_KEY;
  
  if (!apiKey) {
    console.error('LISTENNOTES_API_KEY not found in environment');
    return null;
  }

  try {
    // Build search URL
    const params = new URLSearchParams({
      q: titleQuery,
      podcast_id: podcastId,
      podcast_id_type: 'itunes_id'
    });

    const searchUrl = `https://listen-api.listennotes.com/api/v2/search_episode_titles?${params}`;
    
    console.log('Searching ListenNotes:', {
      podcastId,
      titleQuery,
      url: searchUrl
    });

    const response = await fetch(searchUrl, {
      headers: {
        'X-ListenAPI-Key': apiKey
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ListenNotes API error:', response.status, response.statusText, errorText);
      return null;
    }

    const data = await response.json() as any;
    
    // Check if we got results
    if (!data.results || data.results.length === 0) {
      console.error('No episodes found matching search criteria');
      return null;
    }

    // Get the first (best) match
    const episode = data.results[0];
    
    console.log('Found episode:', {
      title: episode.title_original || episode.title,
      podcast: episode.podcast?.title,
      pubDate: episode.pub_date_ms
    });

    // Extract metadata
    return {
      episodeUrl: episode.listennotes_url || episode.link || '',
      episodeTitle: episode.title_original || episode.title || 'Unknown Episode',
      podcastTitle: episode.podcast?.title || 'Unknown Podcast',
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
    console.error('Error searching ListenNotes:', error);
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

  const metadata = await searchEpisodeInPodcast(parsed.podcastId, parsed.titleHint);

  if (!metadata || !metadata.audioUrl) {
    res.status(404).json({
      success: false,
      error: 'Could not find episode in ListenNotes database. The episode may be private, premium, geo-restricted, or not yet indexed. Please try a different episode.'
    });
    return;
  }

  console.log('Successfully resolved episode:', metadata.episodeTitle);

  const response: ResolveSourceResponse = {
    success: true,
    metadata
  };

  res.status(200).json(response);
}