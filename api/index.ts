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

export default app;

// Handle Vercel serverless function
export const GET = app.handle;
export const POST = app.handle;
export const PUT = app.handle;
export const DELETE = app.handle;
export const PATCH = app.handle;
