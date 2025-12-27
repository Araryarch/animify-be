import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { cors } from "@elysiajs/cors";
import { animeController } from "../src/controllers/anime.controller";

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
    .use(animeController);

// Export for Vercel
export default app.fetch;
