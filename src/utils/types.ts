export interface Anime {
    title: string;
    thumbnail: string;
    link: string;
    syth?: string;
    eps?: string;
    date?: string;
}

export interface Episode {
    title: string;
    link: string;
    date: string;
}

export interface AnimeDetail {
    title: string;
    thumbnail: string;
    synopsis: string;
    genres: string[];
    status: string;
    totalEpisodes?: string;
    episodes: Episode[];
}

export interface DownloadLink {
    quality: string;
    links: { label: string; url: string }[];
}

export interface StreamLink {
    server: string;
    url: string;
}
