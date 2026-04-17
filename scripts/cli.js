import { categories, searchTerms, videoLinks, duplicates, closeDB } from '../src/db.js';
import { downloadAll, DEFAULT_OUTPUT_DIR } from './download_manager.js';
import { scrapeAllCategories as scrapeAPIs } from './scrape_apis.js';
import readlineSync from 'readline-sync';

function printTable(headers, rows) {
  const widths = headers.map((h, i) => 
    Math.max(h.length, ...rows.map(r => String(r[i] ?? '').length))
  );
  
  const pad = (str, i) => String(str ?? '').padEnd(widths[i]);
  
  console.log(headers.map((h, i) => pad(h, i).toUpperCase()).join(' | '));
  console.log(widths.map(w => '─'.repeat(w)).join('-+-'));
  rows.forEach(r => console.log(r.map((c, i) => pad(c, i)).join(' | ')));
  console.log();
}

const commands = {
  help() {
    console.log(`
📦 Artlist Video Database CLI

Usage: node cli.js <command> [args]

Commands:
  seed                    - Add sample categories and search terms
  categories              - List all categories with stats
  terms <category>        - List search terms for a category
  videos <category>       - List all videos for a category
  stats <category>        - Show detailed stats for a category
  add-cat <name> [desc]   - Add a new category
  add-term <cat> <term>   - Add a search term to a category
  add-batch               - Interactive: add a category with multiple terms
  delete-cat <name>       - Delete a category and all its data
  search <query>          - Search terms/videos across all categories
  dedup [remove]          - Find (and remove) duplicate videos
  download [category]     - Download pending videos (all or by category)
  scrape                  - Scrape all unscraped terms (requires Lightpanda)
  api-scrape              - Scrape using Pixabay and Pexels APIs
  api-stats               - Show statistics by API source
  api-videos <source>     - List videos from specific API source
  help                    - Show this help
    `);
  },

  seed() {
    console.log('🌱 Adding seed data...\n');

    const seedData = [
      {
        category: 'Sports',
        description: 'Sports and athletic activities',
        terms: ['football', 'basketball', 'soccer goal', 'tennis match', 'running sprint', 'baseball hit', 'swimming pool', 'gym workout']
      },
      {
        category: 'Nature',
        description: 'Natural landscapes and wildlife',
        terms: ['ocean waves', 'mountain sunset', 'forest aerial', 'waterfall', 'snowy peaks', 'tropical beach', 'rain forest', 'desert dunes']
      },
      {
        category: 'Technology',
        description: 'Tech, computers, and digital concepts',
        terms: ['coding computer', 'artificial intelligence', 'robotics', 'smartphone usage', 'virtual reality', 'data center', 'circuit board', 'drone flying']
      },
      {
        category: 'Business',
        description: 'Corporate and professional settings',
        terms: ['office meeting', 'handshake deal', 'presentation', 'coworking space', 'businesswoman', 'teamwork', 'finance charts', 'startup']
      },
      {
        category: 'Food',
        description: 'Cooking, dining, and culinary content',
        terms: ['cooking pasta', 'chef plating', 'coffee pour', 'pizza making', 'sushi preparation', 'baking bread', 'grilling bbq', 'cocktail mixing']
      },
      {
        category: 'Travel',
        description: 'Destinations and journey footage',
        terms: ['airplane takeoff', 'city timelapse', 'train journey', 'road trip', 'cruise ship', 'hotel luxury', 'backpacking', 'eiffel tower']
      },
      {
        category: 'Anime',
        description: 'Anime and manga style content',
        terms: ['anime', 'manga style', 'japanese animation', 'kawaii', 'tokyo street', 'sakura petals', 'samurai', 'ninja']
      },
      {
        category: 'Music',
        description: 'Musical performances and instruments',
        terms: ['guitar playing', 'dj mixing', 'piano performance', 'drum kit', 'singer microphone', 'concert crowd', 'violin solo', 'recording studio']
      }
    ];

    let catCount = 0;
    let termCount = 0;

    for (const seed of seedData) {
      const added = categories.add(seed.category, seed.description);
      if (added) catCount++;

      const addedTerms = searchTerms.addMultiple(seed.category, seed.terms);
      termCount += addedTerms.length;
    }

    console.log(`✅ Added ${catCount} categories`);
    console.log(`✅ Added ${termCount} search terms`);
    console.log('\n💡 Run "node cli.js categories" to view all categories');
    console.log('💡 Run "node cli.js scrape" to start scraping');
  },

  categories() {
    const all = categories.getAll();
    if (all.length === 0) {
      console.log('⚠️ No categories found. Run "node cli.js seed" to add sample data.');
      return;
    }

    console.log(`\n📊 Categories (${all.length} total)\n`);
    printTable(
      ['Name', 'Description', 'Terms', 'Videos'],
      all.map(c => [c.name, c.description || '-', c.term_count, c.video_count])
    );
  },

  terms(categoryName) {
    if (!categoryName) {
      console.log('⚠️ Usage: node cli.js terms <category>');
      return;
    }

    try {
      const all = searchTerms.getAll(categoryName);
      if (all.length === 0) {
        console.log(`⚠️ No terms found for "${categoryName}"`);
        return;
      }

      console.log(`\n📝 Search terms for "${categoryName}" (${all.length} total)\n`);
      printTable(
        ['Term', 'Scraped', 'Videos', 'Last Scraped'],
        all.map(t => [
          t.term,
          t.scraped ? '✅ Yes' : '⏳ No',
          t.video_count,
          t.last_scraped || '-'
        ])
      );
    } catch (e) {
      console.log(`❌ ${e.message}`);
    }
  },

  videos(categoryName) {
    if (!categoryName) {
      console.log('⚠️ Usage: node cli.js videos <category>');
      return;
    }

    try {
      const videos = videoLinks.getByCategory(categoryName);
      if (videos.length === 0) {
        console.log(`⚠️ No videos found for "${categoryName}". Run scraping first.`);
        return;
      }

      console.log(`\n🎬 Videos for "${categoryName}" (${videos.length} total)\n`);
      
      // Show first 50
      const toShow = videos.slice(0, 50);
      printTable(
        ['#', 'Search Term', 'Video ID', 'Downloaded', 'URL'],
        toShow.map((v, i) => [
          i + 1,
          v.search_term,
          v.video_id || '-',
          v.downloaded ? '✅' : '❌',
          v.url.length > 60 ? v.url.substring(0, 57) + '...' : v.url
        ])
      );

      if (videos.length > 50) {
        console.log(`... and ${videos.length - 50} more (use stats command for summary)`);
      }
    } catch (e) {
      console.log(`❌ ${e.message}`);
    }
  },

  stats(categoryName) {
    if (!categoryName) {
      console.log('⚠️ Usage: node cli.js stats <category>');
      return;
    }

    try {
      const stats = videoLinks.getStats(categoryName);
      const category = categories.getByName(categoryName);
      const terms = searchTerms.getAll(categoryName);

      console.log(`\n📊 Stats for "${categoryName}"\n`);
      console.log('─'.repeat(40));
      console.log(`Description:    ${category?.description || '-'}`);
      console.log(`Search terms:   ${terms.length}`);
      console.log(`  └ Scraped:    ${terms.filter(t => t.scraped).length}`);
      console.log(`  └ Pending:    ${terms.filter(t => !t.scraped).length}`);
      console.log(`Total videos:   ${stats.total_videos}`);
      console.log(`  └ Downloaded: ${stats.downloaded}`);
      console.log(`  └ Pending:    ${stats.pending}`);
      console.log(`Total size:     ${(stats.total_size_mb / 1024).toFixed(2)} GB`);
      console.log('─'.repeat(40));
    } catch (e) {
      console.log(`❌ ${e.message}`);
    }
  },

  addCategory(name, description) {
    if (!name) {
      console.log('⚠️ Usage: node cli.js add-cat <name> [description]');
      return;
    }

    const added = categories.add(name, description || '');
    if (added) {
      console.log(`✅ Category "${name}" added`);
    } else {
      console.log(`⚠️ Category "${name}" already exists`);
    }
  },

  addTerm(categoryName, term) {
    if (!categoryName || !term) {
      console.log('⚠️ Usage: node cli.js add-term <category> <term>');
      return;
    }

    try {
      const added = searchTerms.add(categoryName, term);
      if (added) {
        console.log(`✅ Term "${term}" added to "${categoryName}"`);
      } else {
        console.log(`⚠️ Term "${term}" already exists in "${categoryName}"`);
      }
    } catch (e) {
      console.log(`❌ ${e.message}`);
    }
  },

  addBatch() {
    console.log('\n📦 Batch Add Category\n');
    console.log('─'.repeat(40));

    const name = readlineSync.question('Category name: ').trim();
    if (!name) {
      console.log('❌ Name cannot be empty');
      return;
    }

    const existing = categories.getByName(name);
    if (existing) {
      console.log(`⚠️ Category "${name}" already exists. Adding terms to it.`);
    } else {
      const desc = readlineSync.question('Description (optional): ').trim();
      categories.add(name, desc || '');
    }

    console.log('\nEnter search terms (one per line, empty line to finish):\n');
    const terms = [];
    let i = 1;
    while (true) {
      const term = readlineSync.question(`  Term ${i}: `).trim();
      if (!term) break;
      terms.push(term);
      i++;
    }

    if (terms.length === 0) {
      console.log('\n⚠️ No terms entered');
      return;
    }

    const added = searchTerms.addMultiple(name, terms);
    console.log(`\n✅ Added ${added.length}/${terms.length} terms to "${name}"`);
  },

  search(query) {
    if (!query) {
      console.log('⚠️ Usage: node cli.js search <query>');
      return;
    }

    console.log(`\n🔍 Searching "${query}" across all categories...\n`);

    const allCats = categories.getAll();
    let termMatches = 0;
    let videoMatches = 0;

    console.log('📝 Matching Terms:');
    console.log('─'.repeat(60));
    for (const cat of allCats) {
      const terms = searchTerms.getAll(cat.name);
      for (const term of terms) {
        if (term.term.toLowerCase().includes(query.toLowerCase())) {
          console.log(`   ${cat.name} → ${term.term} (${term.video_count} videos)`);
          termMatches++;
          videoMatches += term.video_count;
        }
      }
    }

    if (termMatches > 0) {
      console.log(`\n📊 Found ${termMatches} matching terms, ~${videoMatches} videos`);
    } else {
      console.log('   No matching terms found');
    }
  },

  dedup(action) {
    const dupes = duplicates.find();

    if (dupes.length === 0) {
      console.log('✅ No duplicate videos found');
      return;
    }

    console.log(`\n🔍 Found ${dupes.length} duplicate URLs\n`);
    console.log('─'.repeat(80));

    dupes.slice(0, 20).forEach(d => {
      console.log(`   URL: ${d.url.length > 60 ? d.url.substring(0, 57) + '...' : d.url}`);
      console.log(`   Copies: ${d.count} | Locations: ${d.locations}`);
      console.log();
    });

    const totalDupes = dupes.reduce((sum, d) => sum + (d.count - 1), 0);
    console.log(`📊 ${totalDupes} removable duplicates\n`);

    if (action === 'remove') {
      const removed = duplicates.remove();
      console.log(`✅ Removed ${removed} duplicate entries`);
    } else {
      console.log('💡 Run "node cli.js dedup remove" to delete duplicates');
    }
  },

  download(categoryName, outputDir) {
    const dir = outputDir || DEFAULT_OUTPUT_DIR;
    downloadAll(dir, categoryName).then(() => {
      closeDB();
    });
  },

  deleteCategory(name) {
    if (!name) {
      console.log('⚠️ Usage: node cli.js delete-cat <name>');
      return;
    }

    const result = categories.delete(name);
    if (result.changes > 0) {
      console.log(`✅ Category "${name}" and all its data deleted`);
    } else {
      console.log(`⚠️ Category "${name}" not found`);
    }
  },

  apiScrape() {
    scrapeAPIs().then(() => {
      closeDB();
    });
  },

  apiStats() {
    const stats = videoLinks.getStatsBySource();
    
    if (stats.length === 0) {
      console.log('⚠️ No API-sourced videos found. Run "node scripts/cli.js api-scrape" first.');
      return;
    }

    console.log(`\n📊 API Source Statistics\n`);
    printTable(
      ['Source', 'Total', 'Downloaded', 'Pending', 'Size (MB)'],
      stats.map(s => [
        s.source.charAt(0).toUpperCase() + s.source.slice(1),
        s.total_videos,
        s.downloaded,
        s.pending,
        s.total_size_mb.toFixed(2)
      ])
    );
  },

  apiVideos(source) {
    if (!source) {
      console.log('⚠️ Usage: node cli.js api-videos <source>');
      console.log('   Available sources: pixabay, pexels');
      return;
    }

    const videos = videoLinks.getBySource(source.toLowerCase());
    if (videos.length === 0) {
      console.log(`⚠️ No videos found for source "${source}"`);
      return;
    }

    console.log(`\n🎬 Videos from "${source}" (${videos.length} total)\n`);

    const toShow = videos.slice(0, 50);
    printTable(
      ['#', 'Category', 'Search Term', 'Video ID', 'Downloaded', 'Width', 'Height', 'URL'],
      toShow.map((v, i) => [
        i + 1,
        v.category_name || '-',
        v.search_term || '-',
        v.video_id || '-',
        v.downloaded ? '✅' : '❌',
        v.width || '-',
        v.height || '-',
        v.url.length > 50 ? v.url.substring(0, 47) + '...' : v.url
      ])
    );

    if (videos.length > 50) {
      console.log(`... and ${videos.length - 50} more`);
    }
  }
};

// Parse CLI args
const args = process.argv.slice(2);
const command = args[0];

if (!command || !commands[command]) {
  commands.help();
} else {
  commands[command](...args.slice(1));
}

// Close DB on exit
process.on('exit', closeDB);
