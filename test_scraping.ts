
import { ScraperService } from "./src/services/scraper";

async function run() {
    const scraper = new ScraperService();
    console.log("Fetching ongoing page 1...");
    try {
        const ongoing = await scraper.getOngoing(1);
        console.log("Length:", ongoing.data.animeList.length);
        if (ongoing.data.animeList.length > 0) {
            console.log("First Item Full:");
            console.log(JSON.stringify(ongoing.data.animeList[0], null, 2));
        }
    } catch (e) {
        console.error(e);
    }
}

run();
