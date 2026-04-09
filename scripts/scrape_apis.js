import { categories, searchTerms, videoLinks, closeDB } from '../src/db.js';
import { searchAllPages as pixabaySearch } from '../src/pixabay_api.js';
import { searchAllPages as pexelsSearch } from '../src/pexels_api.js';

const MAX_PAGES = 10;

async function scrapeCategoryFromAPIs(categoryName, searchTerm) {
  console.log(`\n📹 Scraping: "${categoryName}" → "${searchTerm}"`);
  
  let totalVideos = 0;
  
  try {
    // Search Pixabay
    console.log('\n🔵 Searching Pixabay...');
    const pixabayVideos = await pixabaySearch(searchTerm, MAX_PAGES);
    
    if (pixabayVideos.length > 0) {
      const urls = pixabayVideos.map(v => v.url);
      const added = videoLinks.addMultipleWithSource(
        categoryName, 
        searchTerm, 
        urls,
        'pixabay',
        pixabayVideos
      );
      console.log(`   ✅ Pixabay: ${added} new videos saved`);
      totalVideos += added;
    }
    
    // Search Pexels
    console.log('\n🟡 Searching Pexels...');
    const pexelsVideos = await pexelsSearch(searchTerm, MAX_PAGES);
    
    if (pexelsVideos.length > 0) {
      const urls = pexelsVideos.map(v => v.url);
      const added = videoLinks.addMultipleWithSource(
        categoryName, 
        searchTerm, 
        urls,
        'pexels',
        pexelsVideos
      );
      console.log(`   ✅ Pexels: ${added} new videos saved`);
      totalVideos += added;
    }
    
    // Mark term as scraped
    searchTerms.markScraped(categoryName, searchTerm, totalVideos);
    
    console.log(`\n   💾 Total: ${totalVideos} new videos added to DB`);
    return totalVideos;
    
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return 0;
  }
}

async function scrapeAllCategories() {
  console.log('🚀 Starting API scraper for all categories...\n');
  console.log('═'.repeat(60));

  const allCategories = categories.getAll();
  if (allCategories.length === 0) {
    console.log('⚠️ No categories found. Run "node scripts/cli.js seed" first.');
    return;
  }

  console.log(`📊 Categories to scrape: ${allCategories.length}`);
  allCategories.forEach(c => {
    console.log(`   - ${c.name} (${c.term_count} terms, ${c.video_count} videos)`);
  });
  console.log('═'.repeat(60));

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
      const count = await scrapeCategoryFromAPIs(category.name, term.term);
      totalScraped += count;
      totalTerms++;
      if (count === 0) failedTerms++;

      // Rate limiting delay between terms
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log('🎉 Scraping completed!');
  console.log(`   ✅ Terms processed: ${totalTerms}`);
  console.log(`   📹 New videos saved: ${totalScraped}`);
  console.log(`   ❌ Failed terms: ${failedTerms}`);
  console.log('═'.repeat(60));
  
  closeDB();
}

// Export for use in other scripts
export { scrapeCategoryFromAPIs, scrapeAllCategories };

// Run directly
if (process.argv[1] && process.argv[1].endsWith('scrape_apis.js')) {
  scrapeAllCategories().catch(console.error);
}
