import { t } from "elysia";

// Response wrapper like SankaVollerei
export const createResponse = <T>(data: T, pagination?: any, message: string = "Successfully fetched data") => ({
    status: "success" as const,
    creator: "Samehadaku API",
    message,
    data,
    pagination: pagination || null
});

export const PaginationDto = t.Object({
    page: t.Optional(t.Numeric({ default: 1 })),
    order: t.Optional(t.String())
});

export const PaginationResponseDto = t.Object({
    currentPage: t.Numeric(),
    hasPrevPage: t.Boolean(),
    prevPage: t.Union([t.Numeric(), t.Null()]),
    hasNextPage: t.Boolean(),
    nextPage: t.Union([t.Numeric(), t.Null()]),
    totalPages: t.Numeric()
});

export const GenreItemDto = t.Object({
    title: t.String(),
    genreId: t.String(),
    href: t.String(),
    samehadakuUrl: t.String()
});

// Recent Anime Item (Home & Recent Endpoint)
export const RecentAnimeDto = t.Object({
    title: t.String(),
    poster: t.String(),
    episodes: t.String(),
    releasedOn: t.String(),
    animeId: t.String(),
    href: t.String(),
    samehadakuUrl: t.String(),
    synopsis: t.Optional(t.String()),
    score: t.Optional(t.String()),
    genreList: t.Optional(t.Array(GenreItemDto))
});

// General Anime Card (Search, Ongoing, Completed, Movies, Popular, Genre)
export const AnimeCardDto = t.Object({
    title: t.String(),
    poster: t.String(),
    type: t.Optional(t.String()),
    score: t.Optional(t.String()),
    status: t.Optional(t.String()),
    animeId: t.String(),
    href: t.String(),
    samehadakuUrl: t.String(),
    genreList: t.Optional(t.Array(GenreItemDto)),
    synopsis: t.Optional(t.String()),
    episodes: t.Optional(t.String()),
    rank: t.Optional(t.Number()) // For popular/top10
});

// Base response schema
export const BaseResponseDto = t.Object({
    status: t.Literal("success"),
    creator: t.String(),
    message: t.String(),
    data: t.Any(),
    pagination: t.Union([PaginationResponseDto, t.Null()])
});

// Batch Item (Home & Detail)
export const BatchItemDto = t.Object({
    title: t.String(),
    poster: t.Optional(t.String()), // Batch in home might have poster
    batchId: t.String(),
    href: t.String(),
    samehadakuUrl: t.String()
});

// Home Page Data Structure
export const HomeDataDto = t.Object({
    recent: t.Object({
        href: t.String(),
        samehadakuUrl: t.String(),
        animeList: t.Array(RecentAnimeDto)
    }),
    batch: t.Object({
        href: t.String(),
        samehadakuUrl: t.String(),
        batchList: t.Array(BatchItemDto)
    }),
    movie: t.Object({
        href: t.String(),
        samehadakuUrl: t.String(),
        animeList: t.Array(AnimeCardDto)
    }),
    top10: t.Object({
        href: t.String(),
        samehadakuUrl: t.String(),
        animeList: t.Array(AnimeCardDto)
    })
});

// Score object for anime detail
export const ScoreDto = t.Object({
    value: t.String(),
    users: t.String()
});

// Synopsis object
export const SynopsisDto = t.Object({
    paragraphs: t.Array(t.String()),
    connections: t.Array(t.Any())
});

// Anime Detail DTO (Exact Sanka Match)
export const AnimeDetailDataDto = t.Object({
    title: t.String(),
    poster: t.String(),
    score: ScoreDto,
    japanese: t.String(),
    synonyms: t.String(),
    english: t.String(),
    status: t.String(),
    type: t.String(),
    source: t.String(),
    duration: t.String(),
    episodes: t.Union([t.String(), t.Null()]),
    season: t.String(),
    studios: t.String(),
    producers: t.String(),
    aired: t.String(),
    trailer: t.String(),
    synopsis: SynopsisDto,
    genreList: t.Array(GenreItemDto),
    batchList: t.Array(BatchItemDto),
    episodeList: t.Array(t.Object({
        title: t.Union([t.String(), t.Number()]),
        episodeId: t.String(),
        href: t.String(),
        samehadakuUrl: t.String()
    }))
});

// Stream link for episode
export const StreamLinkDto = t.Object({
    title: t.String(),
    url: t.String()
});

// Download link for episode
export const DownloadLinkDto = t.Object({
    title: t.String(),
    quality: t.String(),
    links: t.Array(t.Object({
        title: t.String(),
        url: t.String()
    }))
});

// Episode Detail DTO
export const EpisodeDetailDataDto = t.Object({
    title: t.String(),
    episodeId: t.String(),
    animeId: t.String(),
    animeTitle: t.String(),
    prevEpisode: t.Union([t.Object({ episodeId: t.String(), href: t.String() }), t.Null()]),
    nextEpisode: t.Union([t.Object({ episodeId: t.String(), href: t.String() }), t.Null()]),
    streamList: t.Array(StreamLinkDto),
    downloadList: t.Array(DownloadLinkDto)
});

export const SearchQueryDto = t.Object({
    q: t.String({ minLength: 1 }),
    page: t.Optional(t.Numeric({ default: 1 }))
});
