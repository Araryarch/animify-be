
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

async function debugHtml() {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    try {
        await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
        console.log("Navigating to home page...");
        await page.goto("https://v1.samehadaku.how/", { waitUntil: "domcontentloaded", timeout: 60000 });

        try {
            // Count standard animposts (Grid cards with tooltips)
            const count = await page.evaluate(() => document.querySelectorAll("article.animpost").length);
            console.log("Animpost count on Home:", count);

            // Be careful not to count Movies/Batches which might also be animpost?
            // Usually Movies are in separate widget.
            // Let's check parent container class for animpost
            const parents = await page.evaluate(() => {
                const els = Array.from(document.querySelectorAll("article.animpost"));
                return els.slice(0, 5).map(e => e.parentElement?.className + " -> " + e.parentElement?.parentElement?.className);
            });
            console.log("Parents:", parents);

        } catch (e) {
            console.log("Selector error");
        }

    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
}

debugHtml();
