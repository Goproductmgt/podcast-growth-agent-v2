// ============================================================================
// YouTube Transcript Fetcher - No external packages required
// ============================================================================
//
// Fetches captions/transcript directly from YouTube by:
// 1. Loading the video page HTML
// 2. Extracting the captions track URL from the player config
// 3. Fetching the XML captions
// 4. Parsing the XML into plain text
//
// This avoids ESM/CJS compatibility issues with npm packages.
// ============================================================================

interface TranscriptSegment {
  text: string;
  offset: number;
  duration: number;
}

/**
 * Fetch the transcript for a YouTube video.
 * Returns an array of transcript segments with text, offset, and duration.
 * Throws if captions are not available.
 */
export async function fetchYouTubeTranscript(videoId: string): Promise<TranscriptSegment[]> {
  console.log(`📺 Fetching transcript for video: ${videoId}`);

  // Step 1: Fetch the YouTube video page
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const response = await fetch(videoUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch YouTube page: ${response.status}`);
  }

  const html = await response.text();

  // Step 2: Extract captions URL from the player response
  const captionsUrl = extractCaptionsUrl(html);

  if (!captionsUrl) {
    throw new Error('No captions available for this video. The video may not have subtitles/CC enabled.');
  }

  console.log(`📺 Found captions URL, fetching transcript...`);

  // Step 3: Fetch the captions XML
  const captionsResponse = await fetch(captionsUrl);

  if (!captionsResponse.ok) {
    throw new Error(`Failed to fetch captions: ${captionsResponse.status}`);
  }

  const captionsXml = await captionsResponse.text();

  // Step 4: Parse XML into transcript segments
  const segments = parseTranscriptXml(captionsXml);

  console.log(`📺 Parsed ${segments.length} transcript segments`);

  return segments;
}

/**
 * Extract the captions/subtitle track URL from the YouTube page HTML.
 * Looks for the playerCaptionsTracklistRenderer in the initial player response.
 */
function extractCaptionsUrl(html: string): string | null {
  try {
    // Look for captions in the ytInitialPlayerResponse
    const playerResponseMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.+?})\s*;\s*(?:var|const|let|<\/script)/);

    if (!playerResponseMatch) {
      // Try alternative pattern
      const altMatch = html.match(/"captions":\s*({.+?"captionTracks".+?})\s*,\s*"/);
      if (!altMatch) {
        console.error('Could not find player response in page HTML');
        return null;
      }
      // Parse just the captions portion
      try {
        const captionsData = JSON.parse(altMatch[1]);
        const tracks = captionsData?.playerCaptionsTracklistRenderer?.captionTracks;
        if (tracks && tracks.length > 0) {
          return selectBestTrack(tracks);
        }
      } catch {
        // Fall through
      }
      return null;
    }

    const playerResponse = JSON.parse(playerResponseMatch[1]);
    const captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

    if (!captionTracks || captionTracks.length === 0) {
      console.error('No caption tracks found in player response');
      return null;
    }

    return selectBestTrack(captionTracks);
  } catch (error) {
    console.error('Error extracting captions URL:', error);
    return null;
  }
}

/**
 * Select the best caption track, preferring English.
 */
function selectBestTrack(tracks: any[]): string | null {
  // Prefer English tracks
  const englishTrack = tracks.find(
    (t: any) => t.languageCode === 'en' || t.languageCode?.startsWith('en')
  );

  // Fall back to first available track
  const track = englishTrack || tracks[0];

  if (!track?.baseUrl) {
    return null;
  }

  // Return the URL (YouTube returns it with &fmt=srv3 by default, we want plain XML)
  let url = track.baseUrl;
  // Ensure we get XML format
  if (!url.includes('fmt=')) {
    url += '&fmt=srv3';
  }

  return url;
}

/**
 * Parse YouTube's caption XML format into transcript segments.
 * YouTube uses a simple XML format like:
 * <transcript>
 *   <text start="0.0" dur="2.5">Hello world</text>
 *   ...
 * </transcript>
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
