import { put } from '@vercel/blob';
import { google } from 'googleapis';
import { createObjectCsvWriter } from 'csv-writer';
import type { Tweet } from './types';
import fs from 'fs';
import path from 'path';

/**
 * Save tweets to Vercel Blob as JSON and CSV
 */
export async function saveTweetsToBlob(tweets: Tweet[], runDate: string): Promise<{
  jsonUrl: string;
  csvUrl: string;
}> {
  const jsonFilename = `runs/${runDate}.json`;
  const csvFilename = `runs/${runDate}.csv`;
  
  console.log(`[Storage] Saving ${tweets.length} tweets to Blob`);
  
  // Save JSON
  const jsonBlob = await put(jsonFilename, JSON.stringify(tweets, null, 2), {
    access: 'public',
    token: process.env.PGA2_READ_WRITE_TOKEN,
    contentType: 'application/json',
  });
  
  // Convert to CSV
  const csvContent = convertTweetsToCSV(tweets);
  
  // Save CSV
  const csvBlob = await put(csvFilename, csvContent, {
    access: 'public',
    token: process.env.PGA2_READ_WRITE_TOKEN,
    contentType: 'text/csv',
  });
  
  // Also save to /latest/
  await put('latest/latest.json', JSON.stringify(tweets, null, 2), {
    access: 'public',
    token: process.env.PGA2_READ_WRITE_TOKEN,
    contentType: 'application/json',
  });
  
  await put('latest/latest.csv', csvContent, {
    access: 'public',
    token: process.env.PGA2_READ_WRITE_TOKEN,
    contentType: 'text/csv',
  });
  
  console.log(`[Storage] Saved to Blob: ${jsonBlob.url}`);
  
  return {
    jsonUrl: jsonBlob.url,
    csvUrl: csvBlob.url,
  };
}

/**
 * Convert tweets array to CSV format
 */
function convertTweetsToCSV(tweets: Tweet[]): string {
  if (tweets.length === 0) {
    return 'run_date,source_query,twitter_handle,tweet_url,tweet_text,tweet_created_at,urls_in_tweet,apple_podcast_url\n';
  }
  
  const header = 'run_date,source_query,twitter_handle,tweet_url,tweet_text,tweet_created_at,urls_in_tweet,apple_podcast_url\n';
  
  const rows = tweets.map(tweet => {
    const escapeCsvField = (field: string) => {
      if (field.includes(',') || field.includes('"') || field.includes('\n')) {
        return `"${field.replace(/"/g, '""')}"`;
      }
      return field;
    };
    
    return [
      tweet.run_date,
      escapeCsvField(tweet.source_query),
      tweet.twitter_handle,
      tweet.tweet_url,
      escapeCsvField(tweet.tweet_text),
      tweet.tweet_created_at,
      escapeCsvField(tweet.urls_in_tweet.join('; ')),
      tweet.apple_podcast_url || '',
    ].join(',');
  });
  
  return header + rows.join('\n');
}

/**
 * Append tweets to Google Sheet using OAuth credentials
 */
export async function appendTweetsToSheet(tweets: Tweet[]): Promise<boolean> {
  try {
    console.log(`[Storage] Appending ${tweets.length} tweets to Google Sheet`);
    
    // Load OAuth credentials
    const credentialsPath = path.join(process.cwd(), '.credentials', 'oauth-client.json');
    const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
    
    // Get refresh token from environment
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    
    if (!refreshToken) {
      console.warn('[Storage] No GOOGLE_REFRESH_TOKEN found, skipping Sheets');
      return false;
    }
    
    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      credentials.installed.client_id,
      credentials.installed.client_secret,
      credentials.installed.redirect_uris[0]
    );
    
    // Set credentials
    oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });
    
    // Create Sheets API client
    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
    
    // Get spreadsheet ID from environment
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    
    if (!spreadsheetId) {
      console.warn('[Storage] No GOOGLE_SHEET_ID found, skipping Sheets');
      return false;
    }
    
    // Convert tweets to rows
    const rows = tweets.map(tweet => [
      tweet.run_date,
      tweet.source_query,
      tweet.twitter_handle,
      tweet.tweet_url,
      tweet.tweet_text,
      tweet.tweet_created_at,
      tweet.urls_in_tweet.join('; '),
      tweet.apple_podcast_url || '',
    ]);
    
    // Append to sheet
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Leads!A:H', // Assumes sheet named "Leads"
      valueInputOption: 'RAW',
      requestBody: {
        values: rows,
      },
    });
    
    console.log('[Storage] Successfully appended to Google Sheet');
    return true;
    
  } catch (error) {
    console.error('[Storage] Error appending to Google Sheet:', error);
    return false;
  }
}