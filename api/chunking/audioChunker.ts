import ffmpeg from 'fluent-ffmpeg';
import { promises as fs } from 'fs';
import path from 'path';

// Point fluent-ffmpeg to the static binaries
const ffmpegPath = require('ffmpeg-static');
if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}

const ffprobePath = require('ffprobe-static').path;
if (ffprobePath) {
  ffmpeg.setFfprobePath(ffprobePath);
}

interface ChunkResult {
  chunkPath: string;
  index: number;
  duration: number;
}

/**
 * Splits an audio file into chunks of specified duration
 * @param inputPath - Path to the input audio file
 * @param chunkDurationMinutes - Duration of each chunk in minutes (default: 10)
 * @returns Array of chunk file paths
 */
export async function chunkAudioFile(
  inputPath: string,
  chunkDurationMinutes: number = 10
): Promise<string> {
  
  const chunkDurationSeconds = chunkDurationMinutes * 60;
  const outputDir = path.join(path.dirname(inputPath), 'chunks');
  
  // Create chunks directory if it doesn't exist
  await fs.mkdir(outputDir, { recursive: true });
  
  // Get audio duration
  const duration = await getAudioDuration(inputPath);
  const totalChunks = Math.ceil(duration / chunkDurationSeconds);
  
  console.log(`📊 Audio duration: ${Math.round(duration)}s (~${Math.round(duration / 60)} minutes)`);
  console.log(`✂️  Splitting into ${totalChunks} chunks of ${chunkDurationMinutes} minutes each\n`);
  
  const chunks: ChunkResult[] = [];
  
  // Create each chunk
  for (let i = 0; i < totalChunks; i++) {
    const startTime = i * chunkDurationSeconds;
    const chunkPath = path.join(outputDir, `chunk_${String(i).padStart(3, '0')}.mp3`);
    
    await createChunk(inputPath, chunkPath, startTime, chunkDurationSeconds);
    
    // Calculate actual duration of this chunk (last chunk might be shorter)
    const chunkDuration = Math.min(chunkDurationSeconds, duration - startTime);
    
    chunks.push({
      chunkPath,
      index: i,
      duration: chunkDuration
    });
    
    console.log(`✅ Created chunk ${i + 1}/${totalChunks}: ${path.basename(chunkPath)}`);
  }
  
  // Return the output directory path
  return outputDir;
}

/**
 * Get the duration of an audio file in seconds
 */
function getAudioDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(new Error(`Failed to probe audio file: ${err.message}`));
        return;
      }
      
      const duration = metadata.format.duration;
      if (!duration) {
        reject(new Error('Could not determine audio duration'));
        return;
      }
      
      resolve(duration);
    });
  });
}

/**
 * Create a single audio chunk
 */
function createChunk(
  inputPath: string,
  outputPath: string,
  startTime: number,
  duration: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .setStartTime(startTime)
      .setDuration(duration)
      .output(outputPath)
      .audioCodec('libmp3lame')  // Use MP3 codec
      .audioBitrate('128k')       // Set bitrate
      .on('end', () => resolve())
      .on('error', (err) => reject(new Error(`Failed to create chunk: ${err.message}`)))
      .run();
  });
}