import type { VercelRequest, VercelResponse } from '@vercel/node';
import { scrapeXSearch } from './x-scraper/scraper';
import { saveTweetsToBlob, appendTweetsToSheet } from './x-scraper/storage';

/**
 * X Scraper API Endpoint
 * 
 * Triggered by:
 * - Vercel Cron (daily)
 * - Manual HTTP request (for testing)
 * 
 * Query parameters:
 * - query: Search query (optional, uses default if not provided)
 * - max_scrolls: Number of times to scroll (optional, default: 5)
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const startTime = Date.now();
  
  try {
    console.log('[X-Scraper] Starting scraper run...');
    
    // Get query from request or use default
    const query = (req.query.query as string) || 
      '("new episode" OR "episode is live" OR "just dropped") (podcast OR 🎙️) filter:links -filter:replies lang:en';
    
    const max_scrolls = parseInt(req.query.max_scrolls as string) || 5;
    
    console.log(`[X-Scraper] Query: "${query}"`);
    console.log(`[X-Scraper] Max scrolls: ${max_scrolls}`);
    
    // Run the scraper
    const result = await scrapeXSearch({
      query,
      max_scrolls,
      delay_between_scrolls: 2000,
    });
    
    if (!result.success || result.tweets.length === 0) {
      console.error('[X-Scraper] Scraping failed or no tweets found');
      return res.status(500).json({
        success: false,
        error: result.errors.join(', ') || 'No tweets found',
        metrics: result.metrics,
      });
    }
    
    console.log(`[X-Scraper] Successfully scraped ${result.tweets.length} tweets`);
    
    // Save to Vercel Blob
    const runDate = new Date().toISOString().split('T')[0];
    const blobUrls = await saveTweetsToBlob(result.tweets, runDate);
    
    console.log('[X-Scraper] Saved to Blob:', blobUrls);
    
    // Try to save to Google Sheets (optional)
    let sheetsSuccess = false;
    try {
      sheetsSuccess = await appendTweetsToSheet(result.tweets);
    } catch (error) {
      console.warn('[X-Scraper] Google Sheets append failed (non-critical):', error);
    }
    
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    
    // Return success response
    return res.status(200).json({
      success: true,
      run_date: runDate,
      query,
      metrics: {
        ...result.metrics,
        processing_time_seconds: duration,
      },
      blob_urls: blobUrls,
      google_sheets_updated: sheetsSuccess,
      tweets_sample: result.tweets.slice(0, 3), // Return first 3 tweets as sample
    });
    
  } catch (error) {
    console.error('[X-Scraper] Fatal error:', error);
    
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    
    return res.status(500).json({
      success: false,
      error: errorMsg,
    });
  }
}