import { chromium, Browser, Page } from 'playwright-core';
import chromiumPkg from '@sparticuz/chromium';

/**
 * Scrapes X (Twitter) search results for podcast-related tweets
 */
export async function scrapeXSearch(config: ScraperConfig): Promise<ScraperResult> {
  const {
    query,
    max_scrolls = 5,
    delay_between_scrolls = 2000,
  } = config;

  const tweets = new Map<string, Tweet>(); // Map for deduplication by URL
  const errors: string[] = [];
  const run_date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  let browser: Browser | undefined;
  
  try {
    console.log(`[Scraper] Starting scrape for query: "${query}"`);
    
    // Launch browser with Vercel-compatible Chromium
    browser = await chromium.launch({
      args: chromiumPkg.args,
      executablePath: await chromiumPkg.executablePath(),
      headless: true,
    });
    
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
    
    const page = await context.newPage();
    
    // Build X search URL
    const searchUrl = `https://twitter.com/search?q=${encodeURIComponent(query)}&src=typed_query&f=live`;
    console.log(`[Scraper] Navigating to: ${searchUrl}`);
    
    // Navigate to X search
    await page.goto(searchUrl, { 
      waitUntil: 'networkidle',
      timeout: 30000 // 30 second timeout
    });
    
    // Wait for content to load
    await page.waitForTimeout(3000);
    
    // Scroll and collect tweets
    for (let i = 0; i < max_scrolls; i++) {
      console.log(`[Scraper] Scroll ${i + 1}/${max_scrolls}`);
      
      // Extract tweets from current view
      const tweetsOnPage = await extractTweetsFromPage(page, run_date, query);
      
      // Add to map (automatically deduplicates by tweet URL)
      tweetsOnPage.forEach(tweet => {
        tweets.set(tweet.tweet_url, tweet);
      });
      
      console.log(`[Scraper] Total unique tweets so far: ${tweets.size}`);
      
      // Scroll down
      await page.evaluate(() => {
        // @ts-ignore - window exists in browser context
        window.scrollBy(0, window.innerHeight * 2);
      });
      
      // Wait for new content to load
      await page.waitForTimeout(delay_between_scrolls);
    }
    
    console.log(`[Scraper] Completed. Collected ${tweets.size} unique tweets`);
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Scraper] Error:`, errorMsg);
    errors.push(errorMsg);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
  
  // Convert Map to Array
  const tweetsArray = Array.from(tweets.values());
  
  // Calculate metrics
  const unique_handles = new Set(tweetsArray.map(t => t.twitter_handle)).size;
  const apple_links_found = tweetsArray.filter(t => t.apple_podcast_url !== null).length;
  
  return {
    success: errors.length === 0 && tweetsArray.length > 0,
    tweets: tweetsArray,
    metrics: {
      tweets_collected: tweetsArray.length,
      unique_handles,
      apple_links_found,
    },
    errors,
  };
}

/**
 * Extract tweet data from current page view
 */
async function extractTweetsFromPage(
  page: Page, 
  run_date: string, 
  source_query: string
): Promise<Tweet[]> {
  const tweets: Tweet[] = [];
  
  try {
    // X/Twitter uses dynamic data-testid attributes
    // This selector finds all tweet articles
    const tweetElements = await page.$$('article[data-testid="tweet"]');
    
    console.log(`[Scraper] Found ${tweetElements.length} tweet elements on page`);
    
    for (const element of tweetElements) {
      try {
        // Extract tweet data
        const tweetData = await element.evaluate((el) => {
          // Find username
          const usernameEl = el.querySelector('[data-testid="User-Name"] a[href^="/"]');
          const username = usernameEl ? usernameEl.getAttribute('href')?.replace('/', '@') : null;
          
          // Find tweet text
          const textEl = el.querySelector('[data-testid="tweetText"]');
          const text = textEl ? textEl.textContent || '' : '';
          
          // Find tweet link
          const linkEl = el.querySelector('a[href*="/status/"]');
          const tweetUrl = linkEl ? `https://twitter.com${linkEl.getAttribute('href')}` : null;
          
          // Find timestamp
          const timeEl = el.querySelector('time');
          const timestamp = timeEl ? timeEl.getAttribute('datetime') || new Date().toISOString() : new Date().toISOString();
          
          // Find all URLs in tweet
          const urlElements = el.querySelectorAll('a[href*="//"]');
          const urls: string[] = [];
          urlElements.forEach((a: any) => {
            const href = a.getAttribute('href');
            if (href && !href.includes('twitter.com') && !href.startsWith('/')) {
              urls.push(href);
            }
          });
          
          return {
            username,
            text,
            tweetUrl,
            timestamp,
            urls,
          };
        });
        
        // Skip if missing critical data
        if (!tweetData.username || !tweetData.tweetUrl) {
          continue;
        }
        
        // Check for Apple Podcast links
        const apple_podcast_url = findApplePodcastUrl(tweetData.urls);
        
        // Build Tweet object
        const tweet: Tweet = {
          run_date,
          source_query,
          twitter_handle: tweetData.username,
          tweet_url: tweetData.tweetUrl,
          tweet_text: tweetData.text,
          tweet_created_at: tweetData.timestamp,
          urls_in_tweet: tweetData.urls,
          apple_podcast_url,
        };
        
        tweets.push(tweet);
        
      } catch (error) {
        console.error('[Scraper] Error extracting individual tweet:', error);
        continue; // Skip this tweet, continue with others
      }
    }
    
  } catch (error) {
    console.error('[Scraper] Error extracting tweets from page:', error);
  }
  
  return tweets;
}

/**
 * Find Apple Podcast URL from array of URLs
 */
function findApplePodcastUrl(urls: string[]): string | null {
  for (const url of urls) {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('podcasts.apple.com') || lowerUrl.includes('itunes.apple.com')) {
      return url;
    }
  }
  return null;
}

// Import types
import type { Tweet, ScraperConfig, ScraperResult } from './types';