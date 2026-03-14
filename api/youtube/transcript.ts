// ============================================================================
// YouTube Transcript Fetcher - No external packages required
// ============================================================================
//
// Uses YouTube's internal innertube API to fetch captions reliably
// from server environments (avoids bot-detection on the video page).
//
// Flow:
// 1. Call YouTube's /youtubei/v1/get_transcript endpoint
// 2. Parse the transcript response
// 3. Return plain text segments
//
// Fallback: If innertube fails, try scraping the video page HTML
// ============================================================================

interface TranscriptSegment {
  text: string;
  offset: number;
  duration: number;
}

const INNERTUBE_API_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';

/**
 * Fetch the transcript for a YouTube video.
 * Returns an array of transcript segments with text, offset, and duration.
 * Throws if captions are not available.
 */
export async function fetchYouTubeTranscript(videoId: string): Promise<TranscriptSegment[]> {
  console.log(`📺 Fetching transcript for video: ${videoId}`);

  // Strategy 1: Try innertube player endpoint to get caption track URLs
  try {
    const segments = await fetchViaInnertubePlayer(videoId);
    if (segments && segments.length > 0) {
      console.log(`📺 Got ${segments.length} segments via innertube player`);
      return segments;
    }
  } catch (err) {
    console.log(`📺 Innertube player approach failed: ${err instanceof Error ? err.message : err}`);
  }

  // Strategy 2: Try scraping the video page (may work if not bot-blocked)
  try {
    const segments = await fetchViaPageScrape(videoId);
    if (segments && segments.length > 0) {
      console.log(`📺 Got ${segments.length} segments via page scrape`);
      return segments;
    }
  } catch (err) {
    console.log(`📺 Page scrape approach failed: ${err instanceof Error ? err.message : err}`);
  }

  throw new Error('Could not retrieve transcript. The video may not have captions enabled, or may be private/age-restricted.');
}

// ============================================================================
// STRATEGY 1: Innertube Player API
// ============================================================================

async function fetchViaInnertubePlayer(videoId: string): Promise<TranscriptSegment[]> {
  // Call the innertube player endpoint to get video info including caption tracks
  const playerResponse = await fetch(
    `https://www.youtube.com/youtubei/v1/player?key=${INNERTUBE_API_KEY}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      body: JSON.stringify({
        context: {
          client: {
            hl: 'en',
            gl: 'US',
            clientName: 'WEB',
            clientVersion: '2.20240101.00.00',
          }
        },
        videoId: videoId,
      })
    }
  );

  if (!playerResponse.ok) {
    throw new Error(`Innertube player API returned ${playerResponse.status}`);
  }

  const data = await playerResponse.json() as any;

  const captionTracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

  if (!captionTracks || captionTracks.length === 0) {
    throw new Error('No caption tracks in innertube player response');
  }

  // Select best track (prefer English)
  const trackUrl = selectBestTrack(captionTracks);
  if (!trackUrl) {
    throw new Error('Could not find usable caption track');
  }

  // Fetch the captions XML
  return await fetchAndParseCaption(trackUrl);
}

// ============================================================================
// STRATEGY 2: Page Scrape (fallback)
// ============================================================================

async function fetchViaPageScrape(videoId: string): Promise<TranscriptSegment[]> {
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const response = await fetch(videoUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cookie': 'CONSENT=YES+1',
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch YouTube page: ${response.status}`);
  }

  const html = await response.text();

  // Try to extract captions URL from ytInitialPlayerResponse
  const captionsUrl = extractCaptionsUrlFromHtml(html);

  if (!captionsUrl) {
    throw new Error('No captions found in page HTML');
  }

  return await fetchAndParseCaption(captionsUrl);
}

// ============================================================================
// SHARED HELPERS
// ============================================================================

/**
 * Fetch a caption track URL and parse the XML into segments
 */
async function fetchAndParseCaption(trackUrl: string): Promise<TranscriptSegment[]> {
  console.log(`📺 Fetching captions from track URL...`);

  const captionsResponse = await fetch(trackUrl);
  if (!captionsResponse.ok) {
    throw new Error(`Failed to fetch captions XML: ${captionsResponse.status}`);
  }

  const captionsXml = await captionsResponse.text();
  return parseTranscriptXml(captionsXml);
}

/**
 * Select the best caption track, preferring English.
 */
function selectBestTrack(tracks: any[]): string | null {
  // Prefer English tracks
  const englishTrack = tracks.find(
    (t: any) => t.languageCode === 'en' || t.languageCode?.startsWith('en')
  );

  // Fall back to auto-generated English
  const autoTrack = tracks.find(
    (t: any) => t.kind === 'asr' && (t.languageCode === 'en' || t.languageCode?.startsWith('en'))
  );

  // Fall back to first available track
  const track = englishTrack || autoTrack || tracks[0];

  if (!track?.baseUrl) {
    return null;
  }

  let url = track.baseUrl;
  // Ensure we get XML format
  if (!url.includes('fmt=')) {
    url += '&fmt=srv3';
  }

  return url;
}

/**
 * Extract captions URL from YouTube page HTML.
 */
function extractCaptionsUrlFromHtml(html: string): string | null {
  try {
    // Try multiple patterns for the player response
    const patterns = [
      /ytInitialPlayerResponse\s*=\s*({.+?})\s*;\s*(?:var|const|let|<\/script)/,
      /ytInitialPlayerResponse\s*=\s*({.+?})\s*;/,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) {
        try {
          const playerResponse = JSON.parse(match[1]);
          const captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
          if (captionTracks && captionTracks.length > 0) {
            return selectBestTrack(captionTracks);
          }
        } catch {
          continue;
        }
      }
    }

    // Try extracting just the captions portion
    const captionsMatch = html.match(/"captionTracks"\s*:\s*(\[.+?\])/);
    if (captionsMatch) {
      try {
        const tracks = JSON.parse(captionsMatch[1]);
        if (tracks && tracks.length > 0) {
          return selectBestTrack(tracks);
        }
      } catch {
        // Fall through
      }
    }

    return null;
  } catch (error) {
    console.error('Error extracting captions URL from HTML:', error);
    return null;
  }
}

/**
 * Parse YouTube's caption XML format into transcript segments.
 */
function parseTranscriptXml(xml: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];

  // Match all <text> elements
  const textPattern = /<text\s+start="([^"]*)"(?:\s+dur="([^"]*)")?[^>]*>([\s\S]*?)<\/text>/g;
  let match;

  while ((match = textPattern.exec(xml)) !== null) {
    const offset = parseFloat(match[1]) || 0;
    const duration = parseFloat(match[2]) || 0;
    let text = match[3];

    // Decode HTML entities
    text = decodeHtmlEntities(text);

    // Clean up whitespace
    text = text.replace(/\s+/g, ' ').trim();

    if (text) {
      segments.push({ text, offset, duration });
    }
  }

  return segments;
}

/**
 * Decode common HTML entities found in YouTube captions.
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num)))
    .replace(/\n/g, ' ');
}
