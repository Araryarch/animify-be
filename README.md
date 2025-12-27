# Samehadaku API

Unofficial Samehadaku API built with Elysia and Bun.

## Features

- 🚀 Fast scraping with optimized Puppeteer
- 📦 Batch processing support
- 🎬 Movie and episode streaming links
- 📊 Pagination with caching
- 🔍 Search functionality
- 📝 Complete anime details

## Local Development

### Prerequisites

- [Bun](https://bun.sh) installed

### Installation

```bash
bun install
```

### Run Development Server

```bash
bun run dev
```

Server will start at `http://localhost:3000`

API documentation available at `http://localhost:3000/swagger`

## Deploy to Vercel

### Prerequisites

- [Vercel CLI](https://vercel.com/cli) installed
- Vercel account

### Deploy Steps

1. **Login to Vercel**

```bash
vc login
```

2. **Deploy to Vercel**

```bash
vc deploy
```

3. **Deploy to Production**

```bash
vc deploy --prod
```

### Configuration

The project is configured to use Bun runtime on Vercel via `vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "bunVersion": "1.x"
}
```

## API Endpoints

### Home
- `GET /anime/samehadaku/home` - Get homepage data (recent, batch, movie, top10)

### Lists
- `GET /anime/samehadaku/recent?page=1` - Recent anime updates
- `GET /anime/samehadaku/ongoing?page=1` - Ongoing anime
- `GET /anime/samehadaku/completed?page=1` - Completed anime
- `GET /anime/samehadaku/popular?page=1` - Popular anime
- `GET /anime/samehadaku/movies?page=1` - Anime movies

### Search & Filter
- `GET /anime/samehadaku/search?query=naruto&page=1` - Search anime
- `GET /anime/samehadaku/genres` - Get all genres
- `GET /anime/samehadaku/genres/:genreId?page=1` - Get anime by genre

### Details
- `GET /anime/samehadaku/anime/:animeId` - Get anime details
- `GET /anime/samehadaku/episode/:episodeId` - Get episode details with stream links

### Utility
- `GET /anime/samehadaku/total-pages/:endpoint` - Get total pages for an endpoint

## Performance Optimizations

- ✅ Resource blocking (images, fonts, stylesheets)
- ✅ DOM content loaded strategy
- ✅ Explicit selector waiting
- ✅ Request interception
- ✅ Browser instance isolation
- ✅ Pagination caching

## Tech Stack

- **Runtime**: Bun
- **Framework**: Elysia
- **Scraping**: Puppeteer with Stealth plugin
- **Documentation**: Swagger/OpenAPI

## License

MIT
