import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { Browser, Page } from "puppeteer";
import { BASE_URL } from "../utils/constants";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";

puppeteer.use(StealthPlugin());

// Cache for total pages per endpoint type
const totalPagesCache: Map<string, { value: number; timestamp: number }> = new Map();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour cache


export class ScraperService {
  private async launchBrowser(): Promise<Browser> {
    const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL;

    if (isProduction) {
      // Use Chromium for Vercel
      const chromium = await import('@sparticuz/chromium');
      const puppeteerCore = await import('puppeteer-core');

      return puppeteerCore.default.launch({
        args: chromium.default.args,
        executablePath: await chromium.default.executablePath(),
        headless: true,
      });
    } else {
      // Local development with regular Puppeteer
      const userDataDir = join(tmpdir(), `samehadaku-pptr-${randomUUID()}`);
      return puppeteer.launch({
        headless: true,
        userDataDir,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--disable-gpu",
        ],
      });
    }
  }

  private async getPage(): Promise<{ browser: Browser; page: Page }> {
    const browser = await this.launchBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Optimize speed: Block heavy resources
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    return { browser, page };
  }

  // Binary search to find the last page with content
  private async findTotalPages(baseUrlPattern: string, cacheKey: string): Promise<number> {
    // Check cache first
    const cached = totalPagesCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.value;
    }

    let browser: Browser | undefined;
    let page: Page | undefined;

    try {
      ({ browser, page } = await this.getPage());

      let low = 1;
      let high = 1000; // Start with a high estimate
      let lastValid = 1;

      // First, find an upper bound by doubling
      while (high <= 2000) {
        const url = baseUrlPattern.replace('{page}', String(high));
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

        const hasContent = await page.evaluate(() => {
          return document.querySelectorAll('.post-show ul li, article.animpost').length > 0;
        });

        if (hasContent) {
          low = high;
          high = high * 2;
          lastValid = high;
        } else {
          break;
        }
      }

      // Binary search between low and high
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const url = baseUrlPattern.replace('{page}', String(mid));

        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

        const hasContent = await page.evaluate(() => {
          return document.querySelectorAll('.post-show ul li, article.animpost').length > 0;
        });

        if (hasContent) {
          lastValid = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }

      // Cache the result
      totalPagesCache.set(cacheKey, { value: lastValid, timestamp: Date.now() });
      return lastValid;

    } catch (error) {
      console.error('Error finding total pages:', error);
      return 0;
    } finally {
      if (browser) await browser.close();
    }
  }

  private constructPagination(page: number, hasNext: boolean, hasPrev: boolean, totalPages: number = 0) {
    // Ensure totalPages is at least current page
    let validTotalPages = totalPages;
    if (validTotalPages < page) {
      validTotalPages = hasNext ? page + 1 : page;
    }

    // If hasNextPage but totalPages = currentPage, increment
    if (hasNext && validTotalPages === page) {
      validTotalPages = page + 1;
    }

    return {
      currentPage: page,
      hasPrevPage: hasPrev || page > 1,
      prevPage: (hasPrev || page > 1) ? page - 1 : null,
      hasNextPage: hasNext,
      nextPage: hasNext ? page + 1 : null,
      totalPages: validTotalPages
    };
  }

  private async scrapeRecentList(url: string, pageNumber: number = 1) {
    let browser: Browser | undefined;
    let page: Page | undefined;
    try {
      ({ browser, page } = await this.getPage());
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

      try {
        await page.waitForSelector(".post-show ul li", { timeout: 15000 });
      } catch (e) { console.warn("Wait selector timeout in scrapeRecentList"); }

      const data = await page.evaluate(() => {
        const items: any[] = [];

        // For recent/home page, items are in .post-show ul li
        const elements = document.querySelectorAll(".post-show ul li");

        elements.forEach((el) => {
          // Find title specifically in .entry-title or .dtla h2
          const titleEl = el.querySelector(".entry-title a") || el.querySelector(".dtla h2 a") || el.querySelector("h2 a");
          const thumbEl = el.querySelector(".thumb img");

          // Get episode info from the span with episode text
          let episodes = "";
          const authorEl = el.querySelector("author[itemprop='name']");
          if (authorEl) {
            episodes = authorEl.textContent?.trim() || "";
          }

          // Get release date
          let releasedOn = "";
          const spans = el.querySelectorAll(".dtla span");
          spans.forEach(span => {
            if (span.textContent?.includes("Released on")) {
              releasedOn = span.textContent.replace(/.*Released on.*?:\s*/, "").trim();
            }
          });

          const samehadakuUrl = titleEl?.getAttribute("href") || "";
          const animeId = samehadakuUrl.split("/").filter(Boolean).pop() || "";
          const title = titleEl?.textContent?.trim() || "";

          if (title && animeId) {
            items.push({
              title,
              poster: thumbEl?.getAttribute("src") || "",
              episodes,
              releasedOn,
              animeId,
              href: `/samehadaku/anime/${animeId}`,
              samehadakuUrl
            });
          }
        });

        // Check pagination using link rel="next" and rel="prev"
        const nextLink = document.querySelector('link[rel="next"]');
        const prevLink = document.querySelector('link[rel="prev"]');
        const hasNextPage = !!nextLink;
        const hasPrevPage = !!prevLink;

        // Try to get total pages from page numbers if available
        let totalPages = 0;
        // Look for last page number in pagination
        const pageNums = document.querySelectorAll('.hpage a, .pagination a, .page-numbers');
        pageNums.forEach(el => {
          const text = el.textContent?.trim() || '';
          const textNum = parseInt(text);
          if (!isNaN(textNum) && textNum > totalPages) totalPages = textNum;

          const href = el.getAttribute('href') || '';
          const match = href.match(/\/page\/(\d+)/);
          if (match) {
            const num = parseInt(match[1]);
            if (num > totalPages) totalPages = num;
          }
        });

        // Fallback: if no totalPages found but hasNextPage, estimate
        if (totalPages === 0 && hasNextPage) {
          totalPages = pageNumber + 10; // Conservative estimate
        } else if (totalPages === 0) {
          totalPages = pageNumber; // Current page is last
        }

        return { items, hasNextPage, hasPrevPage, totalPages };
      });

      return {
        message: "Successfully fetched data",
        data: { animeList: data.items },
        pagination: this.constructPagination(pageNumber, data.hasNextPage, data.hasPrevPage, data.totalPages)
      };
    } catch (error) {
      console.error(`Error scraping ${url}:`, error);
      return {
        message: "Failed to fetch data",
        data: { animeList: [] },
        pagination: this.constructPagination(pageNumber, false, false, 0)
      };
    } finally {
      if (browser) await browser.close();
    }
  }

  private async scrapeAnimeList(url: string, listKey: string = "animeList", pageNumber: number = 1) {
    let browser: Browser | undefined;
    let page: Page | undefined;
    try {
      ({ browser, page } = await this.getPage());
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

      try {
        // Wait for anime list content to load
        await page.waitForSelector("article.animpost, .animpost, .post-show ul li", { timeout: 15000 });
      } catch (e) { console.warn("Wait selector timeout in scrapeAnimeList"); }

      const data = await page.evaluate(() => {
        const items: any[] = [];

        // For anime list pages (search, ongoing, completed, etc.)
        // The structure is: article.animpost > div.animepost > div.animposx > a[title]
        const elements = document.querySelectorAll("article.animpost, .animpost");

        elements.forEach((el) => {
          // Get the main link which contains title attribute
          const linkEl = el.querySelector(".animposx > a") || el.querySelector("a[title]") || el.querySelector("a");
          const thumbEl = el.querySelector("img");

          const samehadakuUrl = linkEl?.getAttribute("href") || "";
          const animeId = samehadakuUrl.split("/").filter(Boolean).pop() || "";
          // Title is in the "title" attribute of the link, not text content
          const title = linkEl?.getAttribute("title") || linkEl?.textContent?.trim() || "";

          // Extract genres from article class names (genre-action, genre-comedy, etc.)
          const genreList: any[] = [];
          const classList = el.className || "";
          const genreMatches = classList.match(/genre-[a-z-]+/g) || [];
          genreMatches.forEach(g => {
            const genreId = g.replace("genre-", "");
            const genreTitle = genreId.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
            genreList.push({
              title: genreTitle,
              genreId,
              href: `/samehadaku/genres/${genreId}`,
              samehadakuUrl: `https://v1.samehadaku.how/genre/${genreId}/`
            });
          });

          // Try to get status from class or element
          let status = el.querySelector(".status")?.textContent?.trim() || "";
          if (!status) {
            // Check article class for status-publish, etc.
            if (classList.includes("status-")) {
              const statusMatch = classList.match(/status-(\w+)/);
              if (statusMatch) {
                // Map WordPress status to readable status
                status = "Ongoing"; // Default for published anime on ongoing page
              }
            }
          }

          if (title && animeId) {
            items.push({
              title,
              poster: thumbEl?.getAttribute("src") || "",
              type: el.querySelector(".type")?.textContent?.trim() || "",
              score: el.querySelector(".score")?.textContent?.trim()?.replace(/[^0-9.]/g, '') || "",
              status: status || "Unknown",
              animeId,
              href: `/samehadaku/anime/${animeId}`,
              samehadakuUrl,
              genreList: genreList.length > 0 ? genreList : undefined
            });
          }
        });

        // Check pagination
        // Check pagination
        const nextLink = document.querySelector('link[rel="next"]');
        const prevLink = document.querySelector('link[rel="prev"]');
        // Added .arrow_pag and checks for next/prev
        const hasNextPage = !!nextLink || !!document.querySelector('.next.page-numbers, .hpage a[rel="next"], .arrow_pag .fa-caret-right, a.arrow_pag:not(.prev)');
        const hasPrevPage = !!prevLink || !!document.querySelector('.prev.page-numbers, .hpage a[rel="prev"], .arrow_pag .fa-caret-left');

        let totalPages = 0;
        const pageNums = document.querySelectorAll('.page-numbers:not(.next):not(.prev), .hpage a');
        pageNums.forEach(el => {
          const text = el.textContent?.trim() || '';
          const num = parseInt(text);
          if (!isNaN(num) && num > totalPages) totalPages = num;
          // Also check href
          const href = el.getAttribute('href') || '';
          const match = href.match(/\/page\/(\d+)/);
          if (match) {
            const hrefNum = parseInt(match[1]);
            if (hrefNum > totalPages) totalPages = hrefNum;
          }
        });

        // Try extracting from "Page X of Y" text
        const pageSpan = document.querySelector('.pagination span:first-child');
        if (pageSpan && pageSpan.textContent && pageSpan.textContent.includes('Page')) {
          const parts = pageSpan.textContent.split('of');
          if (parts.length > 1) {
            const total = parseInt(parts[1].trim());
            if (!isNaN(total) && total > totalPages) totalPages = total;
          }
        }

        // Fallback: if no totalPages found but hasNextPage, estimate
        if (totalPages === 0 && hasNextPage) {
          totalPages = pageNumber + 10; // Conservative estimate
        } else if (totalPages === 0) {
          totalPages = pageNumber; // Current page is last
        }

        return { items, hasNextPage, hasPrevPage, totalPages };
      });

      return {
        message: "Successfully fetched data",
        data: { [listKey]: data.items },
        pagination: this.constructPagination(pageNumber, data.hasNextPage, data.hasPrevPage, data.totalPages)
      };
    } catch (error) {
      console.error(`Error scraping ${url}:`, error);
      return {
        message: "Failed to fetch data",
        data: { [listKey]: [] },
        pagination: this.constructPagination(pageNumber, false, false, 0)
      };
    } finally {
      if (browser) await browser.close();
    }
  }

  // Home page with recent, batch, movie, top10 sections (matching SankaVollerei)
  async getHome() {
    let browser: Browser | undefined;
    let page: Page | undefined;
    try {
      ({ browser, page } = await this.getPage());
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 60000 });

      try {
        // Wait for main content
        await page.waitForSelector(".post-show ul li, .animpost", { timeout: 15000 });
      } catch (e) { console.warn("Wait selector timeout in getHome"); }

      const data = await page.evaluate(() => {
        // Helper to extract anime items
        const extractAnimeList = (selector: string) => {
          const items: any[] = [];
          document.querySelectorAll(selector).forEach((el) => {
            const titleEl = el.querySelector(".entry-title a") || el.querySelector(".dtla h2 a") || el.querySelector("a");
            const thumbEl = el.querySelector("img");
            const authorEl = el.querySelector("author[itemprop='name']");
            const samehadakuUrl = titleEl?.getAttribute("href") || "";
            const animeId = samehadakuUrl.split("/").filter(Boolean).pop() || "";

            if (titleEl && animeId) {
              let releasedOn = "";
              el.querySelectorAll(".dtla span, span").forEach(span => {
                if (span.textContent?.includes("Released on")) {
                  releasedOn = span.textContent.replace(/.*Released on.*?:\s*/, "").trim();
                }
              });

              items.push({
                title: titleEl.textContent?.trim() || titleEl.getAttribute("title") || "",
                poster: thumbEl?.getAttribute("src") || "",
                episodes: authorEl?.textContent?.trim() || "",
                releasedOn,
                animeId,
                href: `/samehadaku/anime/${animeId}`,
                samehadakuUrl
              });
            }
          });
          return items;
        };

        // Recent anime section
        const recentItems = extractAnimeList(".post-show ul li");

        // Batch section
        const batchItems: any[] = [];
        // Try multiple selectors for batch
        document.querySelectorAll(".listupd .bs, .bixbox.batchlist article, .widget-batch ul li").forEach((el) => {
          const linkEl = el.querySelector("a");
          const imgEl = el.querySelector("img");
          const samehadakuUrl = linkEl?.getAttribute("href") || "";

          if (samehadakuUrl.includes("/batch/")) {
            const batchId = samehadakuUrl.split("/").filter(Boolean).pop() || "";
            const title = linkEl?.getAttribute("title") || imgEl?.getAttribute("alt") || linkEl?.textContent?.trim() || "";

            if (batchId && title) {
              batchItems.push({
                title,
                poster: imgEl?.getAttribute("src") || "",
                batchId,
                href: `/samehadaku/batch/${batchId}`,
                samehadakuUrl
              });
            }
          }
        });

        // Movie section - based on "Project Movie" header
        const movieItems: any[] = [];
        const headers = Array.from(document.querySelectorAll('h3, h4'));
        const movieHeader = headers.find(h => h.textContent && h.textContent.includes('Project Movie'));
        let movieContainer: Element | null = null;

        if (movieHeader) {
          let container = movieHeader.parentElement;
          let attempts = 0;
          while (container && attempts < 4) {
            if (container.querySelector('ul li, article')) {
              movieContainer = container;
              break;
            }
            container = container.parentElement;
            attempts++;
          }
        }

        if (movieContainer) {
          (movieContainer as Element).querySelectorAll("ul li, article").forEach((el) => {
            const linkEl = el.querySelector("a");
            const imgEl = el.querySelector("img");
            const samehadakuUrl = linkEl?.getAttribute("href") || "";
            const animeId = samehadakuUrl.split("/").filter(Boolean).pop() || "";
            const title = linkEl?.getAttribute("title") || imgEl?.getAttribute("alt") || imgEl?.getAttribute("title") || linkEl?.textContent?.trim() || "";

            if (animeId && title) {
              movieItems.push({
                title,
                poster: imgEl?.getAttribute("src") || "",
                animeId,
                href: `/samehadaku/anime/${animeId}`,
                samehadakuUrl
              });
            }
          });
        }

        // Top 10 (popular sidebar) - selector `.topten-animesu ul li`
        const top10Items: any[] = [];
        document.querySelectorAll(".topten-animesu ul li").forEach((el, index) => {
          if (index >= 10) return; // Only top 10
          const linkEl = el.querySelector("a");
          const imgEl = el.querySelector("img");
          const samehadakuUrl = linkEl?.getAttribute("href") || "";
          const animeId = samehadakuUrl.split("/").filter(Boolean).pop() || "";
          const title = el.querySelector(".judul")?.textContent?.trim() ||
            linkEl?.getAttribute("title") ||
            imgEl?.getAttribute("title") || "";

          if (animeId && title) {
            const score = el.querySelector(".score, .rating")?.textContent?.trim()?.replace(/[^0-9.]/g, '') || "";
            top10Items.push({
              rank: index + 1,
              title,
              poster: imgEl?.getAttribute("src") || "",
              score,
              animeId,
              href: `/samehadaku/anime/${animeId}`,
              samehadakuUrl
            });
          }
        });

        return {
          recent: {
            href: "/samehadaku/recent",
            samehadakuUrl: "https://v1.samehadaku.how/",
            animeList: recentItems
          },
          batch: {
            href: "/samehadaku/batch",
            samehadakuUrl: "https://v1.samehadaku.how/batch/",
            batchList: batchItems
          },
          movie: {
            href: "/samehadaku/movies",
            samehadakuUrl: "https://v1.samehadaku.how/anime-movie/",
            animeList: movieItems
          },
          top10: {
            href: "/samehadaku/popular",
            samehadakuUrl: "https://v1.samehadaku.how/daftar-anime/?order=popular",
            animeList: top10Items
          }
        };
      });

      // Fix batch list if empty by fetching from batch page
      if (data.batch.batchList.length === 0) {
        try {
          console.log(`Checking ${BASE_URL}/batch/ for fallback...`);
          await page.goto(`${BASE_URL}/batch/`, { waitUntil: "domcontentloaded" });
          const batches = await page.evaluate(() => {
            return Array.from(document.querySelectorAll("article.animpost")).map((el: any) => {
              const linkEl = el.querySelector("a");
              const imgEl = el.querySelector("img");
              const samehadakuUrl = linkEl?.getAttribute("href") || "";
              const batchId = samehadakuUrl.split("/").filter(Boolean).pop() || "";
              const title = el.querySelector(".tt, .title, h2")?.textContent?.trim() ||
                linkEl?.getAttribute("title") || "";
              return {
                title,
                poster: imgEl?.getAttribute("src") || "",
                batchId,
                href: `/samehadaku/batch/${batchId}`,
                samehadakuUrl
              };
            }).filter((b: any) => b.batchId && b.title);
          });
          console.log(`Fallback batch found: ${batches.length}`);
          data.batch.batchList = batches.slice(0, 5);
        } catch (e) {
          console.error("Failed to fetch batch list fallback:", e);

        }
      }

      // Calculate pagination for Home (based on Recent)
      const recentCacheKey = 'recent';
      const cachedTotal = totalPagesCache.get(recentCacheKey);
      let totalPages = 600; // Estimate based on user feedback/typical count

      if (cachedTotal && Date.now() - cachedTotal.timestamp < CACHE_TTL) {
        totalPages = cachedTotal.value;
      } else {
        // Trigger background update
        this.findTotalPages(`${BASE_URL}/page/{page}/`, recentCacheKey).then(total => {
          console.log(`Updated cache for recent (from home): ${total}`);
        }).catch(console.error);
      }

      return {
        message: "Successfully fetched home",
        data,
        pagination: {
          currentPage: 1,
          hasPrevPage: false,
          prevPage: null,
          hasNextPage: true,
          nextPage: 2,
          totalPages
        }
      };
    } catch (error) {
      console.error('Error scraping home:', error);
      return {
        message: "Failed to fetch home",
        data: {
          recent: { href: "/samehadaku/recent", samehadakuUrl: "", animeList: [] },
          batch: { href: "/samehadaku/batch", samehadakuUrl: "", batchList: [] },
          movie: { href: "/samehadaku/movies", samehadakuUrl: "", animeList: [] },
          top10: { href: "/samehadaku/popular", samehadakuUrl: "", animeList: [] }
        },
        pagination: null
      };
    } finally {
      if (browser) await browser.close();
    }
  }

  private async enrichPaginationWithCache(result: any, endpoint: string, pageNumber: number, urlPattern: string) {
    if (result.pagination) {
      const cachedTotal = totalPagesCache.get(endpoint);
      if (cachedTotal && Date.now() - cachedTotal.timestamp < CACHE_TTL) {
        result.pagination.totalPages = cachedTotal.value;
      } else if (result.pagination.hasNextPage) {
        // No cache available, set a reasonable estimate
        result.pagination.totalPages = Math.max(result.pagination.totalPages, pageNumber + 50);

        // Start background task
        this.findTotalPages(urlPattern, endpoint).then(total => {
          console.log(`Updated cache for ${endpoint}: ${total}`);
        }).catch(console.error);
      }
    }
    return result;
  }

  async getRecent(pageNumber: number = 1, includeTotalPages: boolean = true) {
    // The paginated URL for recent anime updates
    const url = pageNumber > 1 ? `${BASE_URL}/page/${pageNumber}/` : `${BASE_URL}/`;
    const result = await this.scrapeRecentList(url, pageNumber);

    if (includeTotalPages) {
      await this.enrichPaginationWithCache(result, 'recent', pageNumber, `${BASE_URL}/page/{page}/`);
    }

    return result;
  }

  async getSearch(query: string, pageNumber: number = 1) {
    const url = `${BASE_URL}/page/${pageNumber}/?s=${encodeURIComponent(query)}`;
    const result = await this.scrapeAnimeList(url, "animeList", pageNumber);
    // Search is dynamic, just ensure totalPages >= next page if hasNextPage
    if (result.pagination && result.pagination.hasNextPage && result.pagination.totalPages <= pageNumber) {
      result.pagination.totalPages = pageNumber + 1;
    }
    return result;
  }

  async getOngoing(pageNumber: number = 1) {
    const url = pageNumber > 1
      ? `${BASE_URL}/anime/page/${pageNumber}/?status=ongoing&order=update`
      : `${BASE_URL}/anime/?status=ongoing&order=update`;
    const result = await this.scrapeAnimeList(url, "animeList", pageNumber);
    return this.enrichPaginationWithCache(result, 'ongoing', pageNumber, `${BASE_URL}/anime/page/{page}/?status=ongoing&order=update`);
  }

  async getCompleted(pageNumber: number = 1) {
    const url = pageNumber > 1
      ? `${BASE_URL}/anime/page/${pageNumber}/?status=completed&order=latest`
      : `${BASE_URL}/anime/?status=completed&order=latest`;
    const result = await this.scrapeAnimeList(url, "animeList", pageNumber);
    return this.enrichPaginationWithCache(result, 'completed', pageNumber, `${BASE_URL}/anime/page/{page}/?status=completed&order=latest`);
  }

  async getPopular(pageNumber: number = 1) {
    const url = pageNumber > 1
      ? `${BASE_URL}/anime/page/${pageNumber}/?order=popular`
      : `${BASE_URL}/anime/?order=popular`;
    const result = await this.scrapeAnimeList(url, "animeList", pageNumber);
    return this.enrichPaginationWithCache(result, 'popular', pageNumber, `${BASE_URL}/anime/page/{page}/?order=popular`);
  }

  async getMovies(pageNumber: number = 1) {
    const url = pageNumber > 1
      ? `${BASE_URL}/anime/page/${pageNumber}/?type=movie`
      : `${BASE_URL}/anime/?type=movie`;
    const result = await this.scrapeAnimeList(url, "animeList", pageNumber);
    return this.enrichPaginationWithCache(result, 'movies', pageNumber, `${BASE_URL}/anime/page/{page}/?type=movie`);
  }

  async getGenres() {
    let browser: Browser | undefined;
    let page: Page | undefined;
    try {
      ({ browser, page } = await this.getPage());
      await page.goto(`${BASE_URL}/daftar-anime/`, { waitUntil: "domcontentloaded", timeout: 60000 });

      try {
        await page.waitForSelector(".filter_act.genres label", { timeout: 15000 });
      } catch (e) { console.warn("Wait selector timeout in getGenres"); }

      const genres = await page.evaluate(() => {
        const items: any[] = [];

        // Use the filter labels for genres
        document.querySelectorAll(".filter_act.genres label").forEach(el => {
          const title = el.textContent?.trim() || "";
          // Create genreId from title (lowercase, replace spaces with hyphens)
          const genreId = title.toLowerCase().replace(/\s+/g, '-');
          if (title) {
            items.push({
              title,
              genreId,
              href: `/samehadaku/genres/${genreId}`,
              samehadakuUrl: `https://v1.samehadaku.how/genre/${genreId}/`
            });
          }
        });

        // Remove duplicates
        const uniqueItems = items.filter((v, i, a) => a.findIndex(t => t.genreId === v.genreId) === i);
        return uniqueItems;
      });

      return {
        message: "Successfully fetched genres",
        data: { genreList: genres },
        pagination: null
      };
    } catch (e) {
      console.error(e);
      return { message: "Failed", data: { genreList: [] }, pagination: null };
    } finally {
      if (browser) await browser.close();
    }
  }

  async getByGenre(genreId: string, pageNumber: number = 1) {
    const url = pageNumber > 1
      ? `${BASE_URL}/genre/${genreId}/page/${pageNumber}/`
      : `${BASE_URL}/genre/${genreId}/`;
    const result = await this.scrapeAnimeList(url, "animeList", pageNumber);
    return this.enrichPaginationWithCache(result, `genre-${genreId}`, pageNumber, `${BASE_URL}/genre/${genreId}/page/{page}/`);
  }

  async getDetail(id: string) {
    const url = id.startsWith("http") ? id : `${BASE_URL}/anime/${id}/`;
    let browser: Browser | undefined;
    let page: Page | undefined;

    try {
      ({ browser, page } = await this.getPage());
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

      try {
        await page.waitForSelector(".entry-title, .infox, .spe", { timeout: 15000 });
      } catch (e) { console.warn("Wait selector timeout in getDetail"); }

      const data = await page.evaluate(() => {
        const title = document.querySelector(".entry-title, .infox h1")?.textContent?.trim() || "";
        const poster = document.querySelector(".thumb img, .infox .thumb img")?.getAttribute("src") || "";

        // Extract info from .spe spans (structure: <b>Label</b> Value or <b>Label:</b> Value)
        const info: Record<string, string> = {};
        document.querySelectorAll(".spe span").forEach(el => {
          const b = el.querySelector("b");
          if (b) {
            const label = b.textContent?.trim().replace(/:$/, '').toLowerCase() || "";
            // Get text after <b> tag
            let value = "";
            // Check for links inside
            const links = el.querySelectorAll("a");
            if (links.length > 0) {
              value = Array.from(links).map(a => a.textContent?.trim()).join(", ");
            } else {
              // Get text content after the <b> tag
              value = el.textContent?.replace(b.textContent || "", "").trim() || "";
            }
            if (label && value) {
              info[label] = value;
            }
          }
        });

        // Score extraction
        let scoreValue = "";
        let scoreUsers = "";
        const scoreEl = document.querySelector(".rating strong, .score");
        if (scoreEl) {
          scoreValue = scoreEl.textContent?.trim()?.replace(/[^0-9.]/g, '') || "";
        }
        const voteEl = document.querySelector(".rating .votes");
        if (voteEl) {
          scoreUsers = voteEl.textContent?.trim()?.replace(/[^0-9,]/g, '') || "";
        }

        // Synopsis - get all paragraphs
        const paragraphs: string[] = [];
        document.querySelectorAll(".entry-content p, .desc p").forEach(p => {
          const text = p.textContent?.trim();
          if (text) paragraphs.push(text);
        });

        // Genres
        const genreList: any[] = [];
        document.querySelectorAll(".genre-info a, .genxed a").forEach(el => {
          if (el.textContent) {
            const sUrl = el.getAttribute("href") || "";
            const gId = sUrl.split("/").filter(Boolean).pop() || "";
            genreList.push({
              title: el.textContent.trim(),
              genreId: gId,
              href: `/samehadaku/genres/${gId}`,
              samehadakuUrl: sUrl
            });
          }
        });

        // Episodes
        const episodeList: any[] = [];
        document.querySelectorAll(".lstepsiode ul li").forEach(el => {
          const a = el.querySelector(".eps a");
          if (a) {
            const link = a.getAttribute("href") || "";
            const epId = link.split("/").filter(Boolean).pop() || "";
            // Try to extract episode number
            const epText = a.textContent?.trim() || "";
            const epNum = parseInt(epText.match(/\d+/)?.[0] || "0");
            episodeList.push({
              title: epNum || epText,
              episodeId: epId,
              href: `/samehadaku/episode/${epId}`,
              samehadakuUrl: link
            });
          }
        });

        // Batch links
        const batchList: any[] = [];
        document.querySelectorAll(".listbatch a, .download-batch a").forEach(el => {
          const link = el.getAttribute("href") || "";
          const batchId = link.split("/").filter(Boolean).pop() || "";
          const batchTitle = el.textContent?.trim() || "";
          if (batchId && batchTitle) {
            batchList.push({
              title: batchTitle,
              batchId,
              href: `/samehadaku/batch/${batchId}`,
              samehadakuUrl: link
            });
          }
        });

        const samehadakuUrl = document.querySelector('link[rel="canonical"]')?.getAttribute('href') || "";
        const animeId = samehadakuUrl.split("/").filter(Boolean).pop() || "";

        return {
          title,
          poster,
          score: scoreValue ? { value: scoreValue, users: scoreUsers } : { value: "", users: "" },
          japanese: info["japanese"] || info["judul jepang"] || "",
          synonyms: info["synonyms"] || info["sinonim"] || "",
          english: info["english"] || info["judul inggris"] || "",
          status: info["status"] || "Unknown",
          type: info["type"] || info["tipe"] || "",
          source: info["source"] || info["sumber"] || "",
          duration: info["duration"] || info["durasi"] || "",
          episodes: info["episodes"] || info["episode"] || info["total episode"] || null,
          season: info["season"] || info["musim"] || "",
          studios: info["studios"] || info["studio"] || "",
          producers: info["producers"] || info["produser"] || "",
          aired: info["aired"] || info["released"] || info["tayang"] || "",
          trailer: "", // Would need to extract from page if available
          synopsis: { paragraphs, connections: [] },
          genreList,
          batchList: batchList.length > 0 ? batchList : [],
          episodeList
        };
      });

      return {
        message: "Successfully fetched detail",
        data: data,
        pagination: null
      };
    } catch (error) {
      console.error(error);
      return null;
    } finally {
      if (browser) await browser.close();
    }
  }

  async getEpisode(id: string) {
    const url = id.startsWith("http") ? id : `${BASE_URL}/${id}/`;
    let browser: Browser | undefined;
    let page: Page | undefined;
    try {
      ({ browser, page } = await this.getPage());
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

      try {
        await page.waitForSelector(".entry-title, iframe, .download-eps", { timeout: 15000 });
      } catch (e) { console.warn("Wait selector timeout in getEpisode"); }

      const data = await page.evaluate(() => {
        const title = document.querySelector(".entry-title")?.textContent?.trim() || "";

        const streamLinks: any[] = [];

        // Capture visible iframes/embeds
        document.querySelectorAll("iframe, embed").forEach((el: any) => {
          const src = el.getAttribute("src");
          if (src && !src.includes("facebook") && !src.includes("twitter") && !src.includes("disqus")) {
            streamLinks.push({
              server: "Embed Server",
              url: src
            });
          }
        });

        // Capture Download links (MP4/MKV) as streams/downloads
        document.querySelectorAll(".download-eps ul li").forEach(li => {
          const format = li.querySelector("strong")?.textContent?.trim() || "Unknown Format";
          li.querySelectorAll("span a").forEach(a => {
            const serverName = a.textContent?.trim() || "Download";
            const href = a.getAttribute("href");
            if (href) {
              streamLinks.push({
                server: `${format} - ${serverName}`,
                url: href
              });
            }
          });
        });

        const downloadLinks: any[] = [];
        document.querySelectorAll(".download-eps ul li").forEach(el => {
          const quality = el.querySelector("strong")?.textContent?.trim();
          const links: any[] = [];
          el.querySelectorAll("a").forEach(a => {
            links.push({
              host: a.textContent?.trim(),
              url: a.getAttribute("href")
            });
          });
          if (quality) downloadLinks.push({ quality, links });
        });

        return { title, streamLinks, downloadLinks };
      });

      return {
        message: "Successfully fetched episode",
        data: { ...data, episodeId: id },
        pagination: null
      };
    } catch (error) {
      console.error(error);
      return null;
    } finally {
      if (browser) await browser.close();
    }
  }

  // Public method to get/warm total pages cache
  async getTotalPages(endpoint: 'recent' | 'ongoing' | 'completed' | 'popular' | 'movies' = 'recent') {
    const patterns: Record<string, string> = {
      recent: `${BASE_URL}/page/{page}/`,
      ongoing: `${BASE_URL}/anime/page/{page}/?status=ongoing&order=update`,
      completed: `${BASE_URL}/anime/page/{page}/?status=completed&order=latest`,
      popular: `${BASE_URL}/anime/page/{page}/?order=popular`,
      movies: `${BASE_URL}/anime/page/{page}/?type=movie`
    };

    const total = await this.findTotalPages(patterns[endpoint], endpoint);
    return {
      message: "Successfully fetched total pages",
      data: { endpoint, totalPages: total },
      pagination: null
    };
  }

  // Get cached total pages (returns 0 if not cached)
  getCachedTotalPages(endpoint: string): number {
    const cached = totalPagesCache.get(endpoint);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.value;
    }
    return 0;
  }
}
