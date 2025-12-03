import fs from 'fs';
import Groq from 'groq-sdk';
import path from 'path';

// Initialize Groq client
const groq = new Groq({
  apiKey: process.env.GROQ,
});

// TypeScript interfaces for type safety
interface TranscriptSegment {
  start: number;  // timestamp in seconds
  end: number;    // timestamp in seconds
  text: string;
}

interface ChunkTranscript {
  text: string;
  segments: TranscriptSegment[];
}

interface TranscriptionResult {
  fullText: string;
  segments: TranscriptSegment[];
  duration: number;
  chunkCount: number;
}

/**
 * Format seconds into HH:MM:SS timestamp format
 * Example: 3665 seconds → "01:01:05"
 */
function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Normalize timestamps by adding offset based on chunk position
 * This ensures timestamps are cumulative across all chunks
 * 
 * Example: Chunk 2 starts at 10 minutes (600 seconds)
 * - Original segment: start: 5.2, end: 8.7
 * - Normalized: start: 605.2, end: 608.7
 */
function normalizeTimestamps(
  transcript: ChunkTranscript,
  chunkIndex: number,
  chunkDurationSeconds: number = 600  // 10 minutes default
): ChunkTranscript {
  const offset = chunkIndex * chunkDurationSeconds;
  
  return {
    ...transcript,
    segments: transcript.segments.map(segment => ({
      ...segment,
      start: segment.start + offset,
      end: segment.end + offset,
    })),
  };
}

/**
 * Transcribe a single audio chunk with retry logic
 * Implements exponential backoff for rate limits
 */
async function transcribeChunkWithRetry(
  chunkPath: string,
  chunkIndex: number,
  maxRetries: number = 3
): Promise<ChunkTranscript> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`  → Transcribing chunk ${chunkIndex + 1} (attempt ${attempt + 1}/${maxRetries})...`);
      
      const transcription = await groq.audio.transcriptions.create({
        file: fs.createReadStream(chunkPath),
        model: 'whisper-large-v3-turbo',
        response_format: 'verbose_json',  // Returns segments with timestamps
        language: 'en',                    // Improves speed + accuracy
        temperature: 0.0,                  // Most deterministic output
      });

     // Parse the response (cast to any to access verbose_json properties)
      const transcriptionData = transcription as any;
      
      const result: ChunkTranscript = {
        text: transcriptionData.text || '',
        segments: (transcriptionData.segments || []).map((seg: any) => ({
          start: seg.start,
          end: seg.end,
          text: seg.text,
        })),
      };
      console.log(`  ✓ Chunk ${chunkIndex + 1} transcribed successfully`);
      return result;

    } catch (error: any) {
      const isLastAttempt = attempt === maxRetries - 1;
      
      if (error.status === 429) {
        // Rate limit error
        const waitTime = Math.pow(2, attempt) * 1000; // Exponential backoff
        console.log(`  ⚠ Rate limit hit on chunk ${chunkIndex + 1}. Waiting ${waitTime/1000}s...`);
        
        if (!isLastAttempt) {
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
      }
      
      if (isLastAttempt) {
        console.error(`  ✗ Failed to transcribe chunk ${chunkIndex + 1}: ${error.message}`);
        throw new Error(`Chunk ${chunkIndex + 1} transcription failed: ${error.message}`);
      }
    }
  }
  
  throw new Error(`Failed to transcribe chunk ${chunkIndex + 1} after ${maxRetries} attempts`);
}

/**
 * Main function: Transcribe all audio chunks in parallel
 * Returns a complete transcript with normalized timestamps
 */
export async function transcribeAudioChunks(
  chunksDirectory: string = './chunks'
): Promise<TranscriptionResult> {
  const startTime = Date.now();
  
  console.log('\n🎙️  Starting parallel transcription...\n');
  
  // Get all chunk files (sorted numerically)
  const chunkFiles = fs.readdirSync(chunksDirectory)
    .filter(file => file.endsWith('.mp3'))
    .sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)?.[0] || '0');
      const numB = parseInt(b.match(/\d+/)?.[0] || '0');
      return numA - numB;
    });
  
  console.log(`Found ${chunkFiles.length} chunks to transcribe\n`);
  
  if (chunkFiles.length === 0) {
    throw new Error(`No audio chunks found in ${chunksDirectory}`);
  }
  
  // Transcribe all chunks in parallel
  const transcriptionPromises = chunkFiles.map((file, index) => {
    const chunkPath = path.join(chunksDirectory, file);
    return transcribeChunkWithRetry(chunkPath, index);
  });
  
  try {
    const chunkTranscripts = await Promise.all(transcriptionPromises);
    
    console.log('\n✓ All chunks transcribed successfully!\n');
    console.log('📝 Normalizing timestamps and stitching transcript...\n');
    
    // Normalize timestamps for each chunk
    const normalizedTranscripts = chunkTranscripts.map((transcript, index) => 
      normalizeTimestamps(transcript, index)
    );
    
    // Combine all segments
    const allSegments = normalizedTranscripts.flatMap(t => t.segments);
    
    // Create full text with timestamps
    const fullText = allSegments
      .map(seg => `[${formatTimestamp(seg.start)}] ${seg.text.trim()}`)
      .join('\n');
    
    const totalDuration = allSegments.length > 0 
      ? allSegments[allSegments.length - 1].end 
      : 0;
    
    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`✓ Transcription complete in ${elapsedTime}s`);
    console.log(`  • Total duration: ${formatTimestamp(totalDuration)}`);
    console.log(`  • Segments: ${allSegments.length}`);
    console.log(`  • Chunks processed: ${chunkFiles.length}\n`);
    
    return {
      fullText,
      segments: allSegments,
      duration: totalDuration,
      chunkCount: chunkFiles.length,
    };
    
  } catch (error: any) {
    console.error('\n✗ Transcription failed:', error.message);
    throw error;
  }
}