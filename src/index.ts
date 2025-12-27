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
    .get("/", ({ set }) => {
        set.redirect = "/swagger";
    })
    .use(animeController);

// For Vercel deployment
export default app;

// For local development
if (import.meta.env?.DEV || process.env.NODE_ENV !== 'production') {
    app.listen(3000);
    console.log(
        `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
    );
    console.log(
        `📄 Swagger documentation available at http://${app.server?.hostname}:${app.server?.port}/swagger`
    );
}
