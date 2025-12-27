import { Elysia, t } from "elysia";
import { ScraperService } from "../services/scraper";
import {
    createResponse,
    PaginationDto,
    SearchQueryDto,
} from "../dtos/anime.dto";
import { cache } from "../utils/cache";

export const animeController = (app: Elysia) => {
    const scraper = new ScraperService();

    return app.group("/anime/samehadaku", (app) =>
        app
            .get("/home", async () => {
                const cacheKey = "home";
                const cached = cache.get<any>(cacheKey);
                if (cached) return createResponse(cached.data, cached.pagination, "Successfully fetched home data (cached)");

                const data = await scraper.getHome();
                cache.set(cacheKey, data, 3 * 60 * 1000); // 3 minutes cache
                return createResponse(data.data, data.pagination, "Successfully fetched home data");
            }, {
                detail: { summary: "Home Info", description: "Get homepage data including recent, schedule, popular" }
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
                const data = await scraper.getSearch(query.q, page);
                return createResponse(data.data, data.pagination, `Successfully searched for: ${query.q}`);
            }, {
                query: SearchQueryDto,
                detail: { summary: "Search Anime", description: "Search anime by keyword" }
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
