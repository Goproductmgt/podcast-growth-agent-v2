// TypeScript interfaces for X scraper

export interface Tweet {
  run_date: string;              // YYYY-MM-DD
  source_query: string;          // The search query used
  twitter_handle: string;        // @username
  tweet_url: string;             // Full tweet permalink
  tweet_text: string;            // Complete tweet content
  tweet_created_at: string;      // Timestamp or date
  urls_in_tweet: string[];       // Array of URLs found in tweet
  apple_podcast_url: string | null;  // Apple Podcast link if found, null otherwise
}

export interface ScraperResult {
  success: boolean;
  tweets: Tweet[];
  metrics: {
    tweets_collected: number;
    unique_handles: number;
    apple_links_found: number;
  };
  errors: string[];
}

export interface ScraperConfig {
  query: string;                 // Search query to use
  max_scrolls?: number;          // How many times to scroll (default: 5)
  delay_between_scrolls?: number; // Milliseconds to wait (default: 2000)
}