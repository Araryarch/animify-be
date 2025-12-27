import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { cors } from "@elysiajs/cors";
import { animeController } from "./controllers/anime.controller";

const app = new Elysia()
    .use(swagger({
        documentation: {
            info: {
                title: 'Samehadaku API',
                version: '1.0.0',
                description: 'Unofficial Samehadaku API built with Elysia and Bun'
            }
        }
    }))
    .use(cors())
    .get("/", () => ({
        status: "success",
        message: "Welcome to Samehadaku API",
        version: "1.0.0",
        documentation: "/swagger",
        endpoints: {
            home: "/anime/samehadaku/home",
            recent: "/anime/samehadaku/recent?page=1",
            ongoing: "/anime/samehadaku/ongoing?page=1",
            completed: "/anime/samehadaku/completed?page=1",
            popular: "/anime/samehadaku/popular?page=1",
            movies: "/anime/samehadaku/movies?page=1",
            search: "/anime/samehadaku/search?query=naruto&page=1",
            genres: "/anime/samehadaku/genres",
            genreDetail: "/anime/samehadaku/genres/:genreId?page=1",
            animeDetail: "/anime/samehadaku/anime/:animeId",
            episodeDetail: "/anime/samehadaku/episode/:episodeId"
        },
        repository: "https://github.com/Araryarch/animify-be",
        author: "Araryarch"
    }))
    .use(animeController);

// For Vercel deployment
export default app;


