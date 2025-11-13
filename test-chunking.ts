import { chunkAudioFile } from './api/chunking/audioChunker';
import path from 'path';

interface ChunkResult {
  chunkPath: string;
  index: number;
  duration: number;
}

async function testChunking(): Promise<void> {
  console.log('🎵 Testing Audio Chunking...\n');
  
  // TODO: Replace 'test-audio.mp3' with your actual MP3 filename
  const projectRoot = process.cwd();
  const testAudioPath = path.join(projectRoot, 'test-audio.mp3');
  
  try {
    console.log(`Input file: ${testAudioPath}`);
    console.log('Starting chunking process...\n');
    
    const chunks: ChunkResult[] = await chunkAudioFile(testAudioPath, 10);
    
    console.log('\n✅ Chunking completed successfully!');
    console.log(`\nCreated ${chunks.length} chunks:`);
    
    chunks.forEach((chunk: ChunkResult) => {
      console.log(`  - Chunk ${chunk.index}: ${chunk.duration}s`);
    });
    
  } catch (error) {
    console.error('❌ Error during chunking:', error);
  }
}

testChunking();