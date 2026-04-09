import { searchClips, saveToDir } from '../src/artlist_api.js';
import { categories, searchTerms, videoLinks, closeDB } from '../src/db.js';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const OUTPUT_DIR = 'C:\\Users\\pater\\Pyt\\browserDataTest\\Output';

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Search and map Artlist videos, save to DB and download
 */
async function searchAndDownload(searchTerm, options = {}) {
  const {
    maxPages = 5,
    download = true,
    saveToDb = true,
    categoryName = 'Artlist'
  } = options;

  console.log('═'.repeat(60));
  console.log(`🎬 Artlist Video Mapper: "${searchTerm}"`);
  console.log('═'.repeat(60));

  // Step 1: Search via GraphQL API
  const clips = await searchClips(searchTerm, { maxPages });

  if (clips.length === 0) {
    console.log('\n⚠️ No clips found!');
    return;
  }

  // Step 2: Save mapping to JSON
  const jsonFile = `artlist_${searchTerm.replace(/\s+/g, '_')}_mapping.json`;
  saveToDir(clips, jsonFile, OUTPUT_DIR);

  // Step 3: Save to database (optional)
  if (saveToDb) {
    console.log('\n💾 Saving to database...');
    
    // Ensure category exists
    const cat = categories.getByName(categoryName);
    if (!cat) {
      categories.add(categoryName, 'Videos from Artlist GraphQL API');
    }

    // Ensure search term exists
    const existingTerm = searchTerms.getAll(categoryName).find(t => t.term === searchTerm);
    if (!existingTerm) {
      searchTerms.add(categoryName, searchTerm);
    }

    // Add clips to DB
    const urls = clips.map(c => c.hlsUrl).filter(Boolean);
    const metadata = clips.map(c => ({
      video_id: c.id.toString(),
      width: c.width,
      height: c.height,
      duration: c.duration,
      size: 0
    }));

    const added = videoLinks.addMultipleWithSource(
      categoryName,
      searchTerm,
      urls,
      'artlist',
      metadata
    );

    searchTerms.markScraped(categoryName, searchTerm, added);
    console.log(`   ✅ Added ${added} videos to DB`);
  }

  // Step 4: Download videos (optional)
  if (download) {
    console.log('\n📥 Starting downloads...');
    await downloadClips(clips, searchTerm);
  }

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('📊 Summary');
  console.log('═'.repeat(60));
  console.log(`   🔍 Search term: "${searchTerm}"`);
  console.log(`   📹 Clips found: ${clips.length}`);
  console.log(`   📁 Output dir: ${OUTPUT_DIR}`);
  console.log(`   📄 Mapping file: ${path.join(OUTPUT_DIR, jsonFile)}`);
  console.log('═'.repeat(60));

  closeDB();
}

/**
 * Download clips using ffmpeg
 */
async function downloadClips(clips, searchTerm) {
  const termDir = path.join(OUTPUT_DIR, searchTerm.replace(/\s+/g, '_'));
  if (!fs.existsSync(termDir)) {
    fs.mkdirSync(termDir, { recursive: true });
  }

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    if (!clip.hlsUrl) {
      skipped++;
      continue;
    }

    // Build filename
    const sanitizedName = clip.name
      ? clip.name.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50)
      : `clip_${clip.id}`;
    
    const fileName = `${String(i + 1).padStart(3, '0')}_${sanitizedName}_${clip.width}x${clip.height}.mp4`;
    const outputPath = path.join(termDir, fileName);

    // Skip if exists
    if (fs.existsSync(outputPath)) {
      const stats = fs.statSync(outputPath);
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
      console.log(`   ⏭️ [${i + 1}/${clips.length}] ${fileName} (${sizeMB} MB)`);
      skipped++;
      continue;
    }

    console.log(`   ⬇️ [${i + 1}/${clips.length}] ${clip.name || clip.id} (${clip.width}x${clip.height}, ${clip.duration}s)`);

    try {
      // Download HLS stream with ffmpeg
      const command = `ffmpeg -i "${clip.hlsUrl}" -c copy -y -loglevel error "${outputPath}" 2>&1`;
      await execAsync(command, { timeout: 120000 });

      if (fs.existsSync(outputPath)) {
        const stats = fs.statSync(outputPath);
        const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        console.log(`   ✅ ${fileName} (${sizeMB} MB)`);
        success++;

        // Mark as downloaded in DB
        try {
          videoLinks.markDownloaded(clip.hlsUrl, outputPath, stats.size / (1024 * 1024));
        } catch (e) {}
      } else {
        console.log(`   ❌ Download failed (file not created)`);
        failed++;
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message.split('\n')[0]}`);
      failed++;
    }

    // Rate limiting delay
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\n' + '─'.repeat(40));
  console.log(`   ✅ Downloaded: ${success}`);
  console.log(`   ⏭️ Skipped: ${skipped}`);
  console.log(`   ❌ Failed: ${failed}`);
}

// Parse CLI args
const args = process.argv.slice(2);
const searchTerm = args[0] || 'spider';
const maxPages = parseInt(args[1]) || 5;
const noDownload = args.includes('--no-download');
const noDb = args.includes('--no-db');

searchAndDownload(searchTerm, {
  maxPages,
  download: !noDownload,
  saveToDb: !noDb
}).catch(console.error);
