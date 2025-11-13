import 'dotenv/config';
import { transcribeAudioChunks } from './api/transcribe/groqTranscriber';
import fs from 'fs';
import path from 'path';

/**
 * Test script to transcribe all audio chunks in parallel
 * This will process all 7 chunks and create a complete transcript
 */
async function testTranscription() {
  console.log('🎯 Starting Transcription Test\n');
  console.log('================================================\n');
  
  try {
    // Run the transcription on all chunks in the ./chunks directory
    const result = await transcribeAudioChunks('./chunks');
    
    console.log('\n================================================');
    console.log('✅ TRANSCRIPTION SUCCESSFUL!\n');
    
    // Create output directory if it doesn't exist
    const outputDir = './transcripts';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Save the full transcript to a file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputPath = path.join(outputDir, `transcript-${timestamp}.txt`);
    
    fs.writeFileSync(outputPath, result.fullText, 'utf-8');
    
    console.log('📄 Transcript Details:');
    console.log(`   • File saved: ${outputPath}`);
    console.log(`   • Total duration: ${Math.floor(result.duration / 60)} minutes`);
    console.log(`   • Total segments: ${result.segments.length}`);
    console.log(`   • Chunks processed: ${result.chunkCount}`);
    console.log(`   • Character count: ${result.fullText.length.toLocaleString()}\n`);
    
    // Show a preview of the transcript (first 500 characters)
    console.log('📝 Transcript Preview (first 500 characters):');
    console.log('================================================');
    console.log(result.fullText.substring(0, 500) + '...\n');
    
    console.log('✅ Test complete! Check the full transcript at:');
    console.log(`   ${outputPath}\n`);
    
  } catch (error: any) {
    console.error('\n❌ TRANSCRIPTION FAILED\n');
    console.error('Error details:', error.message);
    console.error('\nTroubleshooting tips:');
    console.error('  1. Check that GROQ_API_KEY is set in your .env file');
    console.error('  2. Verify that audio chunks exist in ./chunks directory');
    console.error('  3. Ensure you have internet connection for API calls\n');
    process.exit(1);
  }
}

// Run the test
testTranscription();