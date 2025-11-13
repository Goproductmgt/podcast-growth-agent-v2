# Podcast Growth Agent v2

AI-powered podcast marketing automation pipeline.

## Architecture
- **Frontend:** Replit (upload interface)
- **Backend:** Vercel Functions (audio processing + AI orchestration)
- **Storage:** Vercel Blob (temp audio) + Supabase (growth plans)
- **AI Services:** Groq (transcription) + OpenAI (9 agents)

## Target Performance
- Full 60-min episode processing: < 90 seconds
- Parallel transcription: 6-9 chunks simultaneously
- Concurrent agent execution: All 9 agents in parallel

## Tech Stack
- Node.js / TypeScript
- Vercel Serverless Functions
- Groq API (Whisper Large V3 Turbo)
- OpenAI API (GPT-4)
- Supabase (Postgres)
- ffmpeg (audio processing)

## Project Status
🚧 In Development

### Session 1: Foundation & Core Engine
- [x] Project structure created
- [x] Git repository initialized
- [ ] Node.js dependencies
- [ ] Audio chunking engine
- [ ] Parallel transcription
- [ ] Agent orchestration

## Local Development
(Instructions coming as we build)