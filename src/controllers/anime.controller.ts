import { Elysia, t } from "elysia";
import { ScraperService } from "../services/scraper";
import {
    createResponse,
    PaginationDto,
    SearchQueryDto,
} from "../dtos/anime.dto";
import { cache } from "../utils/cache";
import { scrapeLimiter } from "../utils/ratelimit";

export const animeController = (app: Elysia) => {
    const scraper = new ScraperService();

    return app.group("/anime/samehadaku", (app) =>
        app
            // Rate limiting middleware
            .onBeforeHandle(({ request, set }) => {
                const ip = request.headers.get('x-forwarded-for') ||
                    request.headers.get('x-real-ip') ||
                    'unknown';

                const result = scrapeLimiter.check(ip);

                // Set rate limit headers
                set.headers['X-RateLimit-Limit'] = '30';
                set.headers['X-RateLimit-Remaining'] = result.remaining.toString();
                set.headers['X-RateLimit-Reset'] = new Date(result.resetTime).toISOString();

                if (!result.allowed) {
                    set.status = 429;
                    return {
                        status: 'error',
                        message: 'Too many requests. Please try again later.',
                        retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
                    };
                }
            })
            .get("/home", async () => {
                const cacheKey = "home";
                const cached = cache.get<any>(cacheKey);
                if (cached) return createResponse(cached.data, cached.pagination, "Successfully fetched home data (cached)");

                const data = await scraper.getHome();
                cache.set(cacheKey, data, 3 * 60 * 1000); // 3 minutes cache
                return createResponse(data.data, data.pagination, "Successfully fetched home data");
            }, {
                detail: {
                    summary: "Home Info",
                    description: "Get homepage data including recent, batch, movie, and top10 anime. Returns cached data if available (3min TTL).",
                    tags: ["Anime"],
                    responses: {
                        200: { description: "Successfully fetched home data with recent, batch, movie, and top10 sections" },
                        429: { description: "Rate limit exceeded (30 req/min)" }
                    }
                }
            })
            .get("/recent", async ({ query }) => {
                const page = query.page || 1;
                const cacheKey = `recent:${page}`;
                const cached = cache.get<any>(cacheKey);
                if (cached) return createResponse(cached.data, cached.pagination, "Successfully fetched recent anime (cached)");

                const data = await scraper.getRecent(page);
                cache.set(cacheKey, data, 5 * 60 * 1000); // 5 minutes cache
                return createResponse(data.data, data.pagination, "Successfully fetched recent anime");
            }, {
                query: PaginationDto,
                detail: { summary: "Recent Anime", description: "Get latest anime updates" }
            })
            .get("/search", async ({ query }) => {
                const page = query.page || 1;
                const searchQuery = query.q || "";

                // Cache search results
                const cacheKey = `search:${searchQuery}:${page}`;
                const cached = cache.get<any>(cacheKey);
                if (cached) return createResponse(cached.data, cached.pagination, `Successfully searched for: ${searchQuery} (cached)`);

                const data = await scraper.getSearch(searchQuery, page);
                cache.set(cacheKey, data, 10 * 60 * 1000); // 10 minutes cache for search
                return createResponse(data.data, data.pagination, `Successfully searched for: ${searchQuery}`);
            }, {
                query: SearchQueryDto,
                detail: {
                    summary: "Search Anime",
                    description: "Search anime by keyword. Results are cached for 10 minutes. Rate limit: 30 req/min.",
                    tags: ["Anime"],
                    responses: {
                        200: { description: "Search results with pagination" },
                        429: { description: "Rate limit exceeded" }
                    }
                }
            })
            .get("/ongoing", async ({ query }) => {
                const page = query.page || 1;
                const data = await scraper.getOngoing(page);
                return createResponse(data.data, data.pagination, "Successfully fetched ongoing anime");
            }, {
                query: PaginationDto,
                detail: { summary: "Ongoing Anime", description: "Get ongoing anime list" }
            })
            .get("/completed", async ({ query }) => {
                const page = query.page || 1;
                const data = await scraper.getCompleted(page);
                return createResponse(data.data, data.pagination, "Successfully fetched completed anime");
            }, {
                query: PaginationDto,
                detail: { summary: "Completed Anime", description: "Get completed anime list" }
            })
            .get("/popular", async ({ query }) => {
                const page = query.page || 1;
                const data = await scraper.getPopular(page);
                return createResponse(data.data, data.pagination, "Successfully fetched popular anime");
            }, {
                query: PaginationDto,
                detail: { summary: "Popular Anime", description: "Get popular anime list" }
            })
            .get("/movies", async ({ query }) => {
                const page = query.page || 1;
                const data = await scraper.getMovies(page);
                return createResponse(data.data, data.pagination, "Successfully fetched anime movies");
            }, {
                query: PaginationDto,
                detail: { summary: "Anime Movies", description: "Get anime movies list" }
            })
            .get("/genres", async () => {
                const data = await scraper.getGenres();
                return createResponse(data.data, null, "Successfully fetched genre list");
            }, {
                detail: { summary: "Genres", description: "Get list of genres" }
            })
            .get("/genres/:genreId", async ({ params, query }) => {
                const page = query.page || 1;
                const data = await scraper.getByGenre(params.genreId, page);
                return createResponse(data.data, data.pagination, `Successfully fetched anime for genre: ${params.genreId}`);
            }, {
                params: t.Object({ genreId: t.String() }),
                query: PaginationDto,
                detail: { summary: "Anime by Genre", description: "Get anime list by genre" }
            })
            .get("/anime/:animeId", async ({ params, set }) => {
                const data = await scraper.getDetail(params.animeId);
                if (!data) {
                    set.status = 404;
                    return createResponse(null, null, "Anime not found");
                }
                return createResponse(data.data, null, "Successfully fetched anime detail");
            }, {
                params: t.Object({ animeId: t.String() }),
                detail: { summary: "Anime Detail", description: "Get anime details" }
            })
            .get("/episode/:episodeId", async ({ params, set }) => {
                const data = await scraper.getEpisode(params.episodeId);
                if (!data) {
                    set.status = 404;
                    return createResponse(null, null, "Episode not found");
                }
                return createResponse(data.data, null, "Successfully fetched episode detail");
            }, {
                params: t.Object({ episodeId: t.String() }),
                detail: { summary: "Episode Detail", description: "Get episode stream/download links" }
            })
            .get("/total-pages/:endpoint", async ({ params }) => {
                const validEndpoints = ['recent', 'ongoing', 'completed', 'popular', 'movies'] as const;
                const endpoint = validEndpoints.includes(params.endpoint as any)
                    ? params.endpoint as 'recent' | 'ongoing' | 'completed' | 'popular' | 'movies'
                    : 'recent';
                const data = await scraper.getTotalPages(endpoint);
                return createResponse(data.data, null, "Successfully fetched/calculated total pages");
            }, {
                params: t.Object({ endpoint: t.String() }),
                detail: {
                    summary: "Get Total Pages",
                    description: "Get total pages for a specific endpoint. Valid: recent, ongoing, completed, popular, movies"
                }
            })
    );
};
