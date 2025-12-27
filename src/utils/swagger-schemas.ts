import { t } from "elysia";

// Common response schemas for Swagger documentation
export const ResponseSchemas = {
    // Standard API response wrapper
    success: (dataSchema: any) => t.Object({
        status: t.String({ examples: ["success"] }),
        message: t.String(),
        data: dataSchema,
        pagination: t.Optional(t.Object({
            currentPage: t.Number({ examples: [1] }),
            hasPrevPage: t.Boolean({ examples: [false] }),
            prevPage: t.Union([t.Number(), t.Null()]),
            hasNextPage: t.Boolean({ examples: [true] }),
            nextPage: t.Union([t.Number(), t.Null()]),
            totalPages: t.Number({ examples: [50] })
        }))
    }),

    // Anime item schema
    animeItem: t.Object({
        title: t.String({ examples: ["One Piece"] }),
        poster: t.String({ examples: ["https://example.com/poster.jpg"] }),
        animeId: t.String({ examples: ["one-piece"] }),
        href: t.String({ examples: ["/samehadaku/anime/one-piece"] }),
        episode: t.Optional(t.String({ examples: ["Episode 1122"] })),
        releaseDay: t.Optional(t.String({ examples: ["Sunday"] })),
        releaseTime: t.Optional(t.String({ examples: ["2024-12-27"] })),
        status: t.Optional(t.String({ examples: ["Ongoing"] })),
        genreList: t.Optional(t.Array(t.String()))
    }),

    // Anime list response
    animeList: t.Object({
        animeList: t.Array(t.Object({
            title: t.String({ examples: ["One Piece"] }),
            poster: t.String(),
            animeId: t.String(),
            href: t.String(),
            episode: t.Optional(t.String()),
            status: t.Optional(t.String())
        }))
    }),

    // Genre item
    genreItem: t.Object({
        title: t.String({ examples: ["Action"] }),
        genreId: t.String({ examples: ["action"] }),
        href: t.String({ examples: ["/samehadaku/genres/action"] })
    }),

    // Episode detail
    episodeDetail: t.Object({
        title: t.String({ examples: ["One Piece Episode 1122"] }),
        streamList: t.Array(t.Object({
            server: t.String({ examples: ["720p - Zippyshare"] }),
            url: t.String()
        })),
        downloadList: t.Array(t.Object({
            quality: t.String({ examples: ["720p"] }),
            links: t.Array(t.Object({
                server: t.String(),
                url: t.String()
            }))
        })),
        prevEpisode: t.Union([t.String(), t.Null()]),
        nextEpisode: t.Union([t.String(), t.Null()])
    })
};
