import puppeteer from 'puppeteer-core';
import { categories, searchTerms, videoLinks, closeDB } from '../src/db.js';

const LIGHTPANDA_WS = 'ws://127.0.0.1:9222';
const ARTLIST_BASE = 'https://artlist.io/stock-footage/search?terms=';

async function scrapeCategory(categoryName, searchTerm, page) {
  console.log(`\n📹 Scraping: "${categoryName}" → "${searchTerm}"`);

  const videoUrls = new Set();
  const videoPattern = /footage-hls.*\.m3u8/i;

  const url = `${ARTLIST_BASE}${encodeURIComponent(searchTerm)}`;
  console.log(`   URL: ${url}`);

  try {
    await page.goto(url, {
      waitUntil: "networkidle0",
      timeout: 90000
    });

    // Check for Cloudflare
    const title = await page.title();
    if (title.includes('Just a moment')) {
      console.log('   ⚠️ Cloudflare detected, waiting 30s...');
      await new Promise(r => setTimeout(r, 30000));
    }

    // Scroll to load more content
    await page.evaluate(async () => {
      for (let i = 0; i < 20; i++) {
        window.scrollBy(0, 500);
        await new Promise(r => setTimeout(r, 1000));
      }
    });

    // Hover on video items to trigger previews
    const selector = 'a[href*="footage"], article a, [data-id] a';
    const videoItems = await page.$$(selector);
    console.log(`   🖱️ Found ${videoItems.length} elements, hovering...`);

    for (let i = 0; i < Math.min(30, videoItems.length); i++) {
      try {
        await videoItems[i].hover();
        await new Promise(r => setTimeout(r, 300));
      } catch (e) {}
    }

    // Wait for final network calls
    await new Promise(r => setTimeout(r, 15000));

    // Extract playlist URLs
    const allUrls = Array.from(videoUrls);
    const playlistLinks = allUrls.filter(url =>
      url.includes('_playlist_') || url.match(/[^p]playlist\.m3u8$/)
    );

    console.log(`   ✅ Found ${playlistLinks.length} unique videos`);

    // Save to DB
    const added = videoLinks.addMultiple(categoryName, searchTerm, playlistLinks);
    searchTerms.markScraped(categoryName, searchTerm, added);

    console.log(`   💾 Saved ${added} new links to DB`);
    return added;

  } catch (error) {
    console.error(`   ❌ Error: ${error.message.split('\n')[0]}`);
    return 0;
  }
}

async function scrapeAllCategories() {
  console.log('🚀 Starting category scraper...\n');
  console.log('═'.repeat(60));

  const allCategories = categories.getAll();
  if (allCategories.length === 0) {
    console.log('⚠️ No categories found. Run "node cli.js seed" first.');
    return;
  }

  console.log(`📊 Categories to scrape: ${allCategories.length}`);
  allCategories.forEach(c => {
    console.log(`   - ${c.name} (${c.term_count} terms, ${c.video_count} videos)`);
  });
  console.log('═'.repeat(60));

  // Connect to Lightpanda
  console.log('\n🔌 Connecting to Lightpanda...');
  const browser = await puppeteer.connect({
    browserWSEndpoint: LIGHTPANDA_WS,
  });

  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  // Intercept video URLs
  page.on('response', async (response) => {
    const url = response.url();
    if (/footage-hls.*\.m3u8/i.test(url)) {
      // Store in page context for current scrape session
      if (!page._videoUrls) page._videoUrls = new Set();
      page._videoUrls.add(url);
    }
  });

  let totalScraped = 0;
  let totalTerms = 0;
  let failedTerms = 0;

  // Scrape each category
  for (const category of allCategories) {
    console.log(`\n📁 Category: ${category.name}`);
    console.log('─'.repeat(40));

    const unscrapedTerms = searchTerms.getUnscraped(category.name);
    if (unscrapedTerms.length === 0) {
      console.log('   ⏭️ All terms already scraped');
      continue;
    }

    console.log(`   📝 ${unscrapedTerms.length} terms to scrape\n`);

    for (const term of unscrapedTerms) {
      page._videoUrls = new Set(); // Reset for each term
      const count = await scrapeCategory(category.name, term.term, page);
      totalScraped += count;
      totalTerms++;
      if (count === 0) failedTerms++;

      // Rate limiting delay
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log('🎉 Scraping completed!');
  console.log(`   ✅ Terms processed: ${totalTerms}`);
  console.log(`   📹 New videos saved: ${totalScraped}`);
  console.log(`   ❌ Failed terms: ${failedTerms}`);
  console.log('═'.repeat(60));

  // Cleanup
  try {
    await page.close();
    await context.close();
    await browser.disconnect();
  } catch (e) {}
  closeDB();
}

// Export for use in other scripts
export { scrapeCategory, scrapeAllCategories };

// Run directly
if (process.argv[1] && process.argv[1].endsWith('scrape_categories.js')) {
  scrapeAllCategories().catch(console.error);
}
