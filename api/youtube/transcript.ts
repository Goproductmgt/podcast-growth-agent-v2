// ============================================================================
// YouTube Transcript Fetcher - No external packages required
// ============================================================================
//
// Fetches captions/transcript directly from YouTube by:
// 1. Loading the video page HTML with proper consent cookies
// 2. Extracting the captions track URL from the player config
// 3. Fetching the XML captions
// 4. Parsing the XML into plain text
//
// Strategy order:
// 1. Page scrape with consent cookies (most reliable from server)
// 2. Innertube player API (fallback)
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

  // Strategy 1: Page scrape with consent cookies (most reliable)
  try {
    const segments = await fetchViaPageScrape(videoId);
    if (segments && segments.length > 0) {
      console.log(`📺 Got ${segments.length} segments via page scrape`);
      return segments;
    }
  } catch (err) {
    console.log(`📺 Page scrape approach failed: ${err instanceof Error ? err.message : err}`);
  }

  // Strategy 2: Try innertube player API (fallback)
  try {
    const segments = await fetchViaInnertubePlayer(videoId);
    if (segments && segments.length > 0) {
      console.log(`📺 Got ${segments.length} segments via innertube player`);
      return segments;
    }
  } catch (err) {
    console.log(`📺 Innertube player approach failed: ${err instanceof Error ? err.message : err}`);
  }

  throw new Error('Could not retrieve transcript. The video may not have captions enabled, or may be private/age-restricted.');
}

// ============================================================================
// STRATEGY 1: Page Scrape with Consent Cookies (primary)
// ============================================================================

async function fetchViaPageScrape(videoId: string): Promise<TranscriptSegment[]> {
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const response = await fetch(videoUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cookie': 'CONSENT=PENDING+987; SOCS=CAISNQgDEitib3FfaWRlbnRpdHlmcm9udGVuZHVpc2VydmVyXzIwMjMxMTE0LjA3X3AxGgJlbiACGgYIgJnsBhAB',
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch YouTube page: ${response.status}`);
  }

  const html = await response.text();

  // Try to extract captions URL from the page HTML
  const captionsUrl = extractCaptionsUrlFromHtml(html);

  if (!captionsUrl) {
    // Log a snippet of the HTML to help debug if this fails
    const hasPlayerResponse = html.includes('ytInitialPlayerResponse');
    const hasCaptionTracks = html.includes('captionTracks');
    console.log(`📺 Page scrape debug: hasPlayerResponse=${hasPlayerResponse}, hasCaptionTracks=${hasCaptionTracks}, htmlLength=${html.length}`);
    throw new Error('No captions found in page HTML');
  }

  console.log(`📺 Found captions URL via page scrape, fetching transcript...`);
  return await fetchAndParseCaption(captionsUrl);
}

// ============================================================================
// STRATEGY 2: Innertube Player API (fallback)
// ============================================================================

async function fetchViaInnertubePlayer(videoId: string): Promise<TranscriptSegment[]> {
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

  const trackUrl = selectBestTrack(captionTracks);
  if (!trackUrl) {
    throw new Error('Could not find usable caption track');
  }

  return await fetchAndParseCaption(trackUrl);
}

// ============================================================================
// SHARED HELPERS
// ============================================================================

/**
 * Fetch a caption track URL and parse the XML into segments
 */
async function fetchAndParseCaption(trackUrl: string): Promise<TranscriptSegment[]> {
  console.log(`📺 Fetching captions from track URL...`);

  // Unescape any unicode escapes in the URL (YouTube sometimes returns \u0026 for &)
  const cleanUrl = trackUrl.replace(/\\u0026/g, '&');

  const captionsResponse = await fetch(cleanUrl);
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
  // Prefer manually uploaded English tracks
  const manualEnglish = tracks.find(
    (t: any) => (t.languageCode === 'en' || t.languageCode?.startsWith('en')) && t.kind !== 'asr'
  );

  // Then auto-generated English
  const autoEnglish = tracks.find(
    (t: any) => (t.languageCode === 'en' || t.languageCode?.startsWith('en'))
  );

  // Fall back to first available track
  const track = manualEnglish || autoEnglish || tracks[0];

  if (!track?.baseUrl) {
    return null;
  }

  let url = track.baseUrl;
  if (!url.includes('fmt=')) {
    url += '&fmt=srv3';
  }

  return url;
}

/**
 * Extract captions URL from YouTube page HTML.
 * Uses multiple strategies to find the captionTracks data.
 */
function extractCaptionsUrlFromHtml(html: string): string | null {
  try {
    // Strategy A: Extract captionTracks directly (most reliable, avoids JSON parse issues)
    const captionsMatch = html.match(/"captionTracks"\s*:\s*(\[.*?\])\s*,\s*"/);
    if (captionsMatch) {
      try {
        // Unescape the JSON (YouTube escapes it)
        const unescaped = captionsMatch[1].replace(/\\u0026/g, '&').replace(/\\"/g, '"');
        const tracks = JSON.parse(unescaped);
        if (tracks && tracks.length > 0) {
          console.log(`📺 Found ${tracks.length} caption tracks via direct extraction`);
          return selectBestTrack(tracks);
        }
      } catch (parseErr) {
        console.log(`📺 Direct captionTracks parse failed: ${parseErr}`);
      }
    }

    // Strategy B: Extract full ytInitialPlayerResponse
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
            console.log(`📺 Found ${captionTracks.length} caption tracks via playerResponse`);
            return selectBestTrack(captionTracks);
          }
        } catch {
          continue;
        }
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

  const textPattern = /<text\s+start="([^"]*)"(?:\s+dur="([^"]*)")?[^>]*>([\s\S]*?)<\/text>/g;
  let match;

  while ((match = textPattern.exec(xml)) !== null) {
    const offset = parseFloat(match[1]) || 0;
    const duration = parseFloat(match[2]) || 0;
    let text = match[3];

    text = decodeHtmlEntities(text);
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
