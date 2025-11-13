import ffmpeg from 'fluent-ffmpeg';
import { promises as fs } from 'fs';
import path from 'path';

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
): Promise<ChunkResult[]> {
  
  const chunkDurationSeconds = chunkDurationMinutes * 60;
  const outputDir = path.join(path.dirname(inputPath), 'chunks');
  
  // Create chunks directory if it doesn't exist
  await fs.mkdir(outputDir, { recursive: true });
  
  // Get audio duration
  const duration = await getAudioDuration(inputPath);
  const totalChunks = Math.ceil(duration / chunkDurationSeconds);
  
  console.log(`Audio duration: ${duration}s, splitting into ${totalChunks} chunks`);
  
  const chunks: ChunkResult[] = [];
  
  // Create chunks
  for (let i = 0; i < totalChunks; i++) {
    const startTime = i * chunkDurationSeconds;
    const outputPath = path.join(outputDir, `chunk_${i.toString().padStart(3, '0')}.mp3`);
    
    await createChunk(inputPath, outputPath, startTime, chunkDurationSeconds);
    
    chunks.push({
      chunkPath: outputPath,
      index: i,
      duration: Math.min(chunkDurationSeconds, duration - startTime)
    });
    
    console.log(`Created chunk ${i + 1}/${totalChunks}: ${outputPath}`);
  }
  
  return chunks;
}

/**
 * Gets the duration of an audio file in seconds
 */
function getAudioDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(err);
      } else {
        resolve(metadata.format.duration || 0);
      }
    });
  });
}

/**
 * Creates a single audio chunk
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
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });
}