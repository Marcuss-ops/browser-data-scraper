import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { videoLinks, categories, closeDB } from '../src/db.js';

const execAsync = promisify(exec);

const DEFAULT_OUTPUT_DIR = 'C:\\Users\\pater\\Downloads\\ArtlistVideos';

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function extractVideoId(url) {
  const match = url.match(/footage-hls\/([^_/]+)/);
  return match ? match[1] : null;
}

function generateFileName(video, index) {
  const videoId = extractVideoId(video.url) || `video_${index}`;
  return `${videoId}.mp4`;
}

async function downloadSingleVideo(video, outputPath) {
  if (fs.existsSync(outputPath)) {
    const stats = fs.statSync(outputPath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    return { status: 'skip', size: stats.size, message: `${sizeMB} MB (exists)` };
  }

  try {
    const command = `ffmpeg -i "${video.url}" -c copy -y "${outputPath}" 2>&1`;
    await execAsync(command, { timeout: 300000 });

    if (fs.existsSync(outputPath)) {
      const stats = fs.statSync(outputPath);
      videoLinks.markDownloaded(video.url, outputPath, stats.size / (1024 * 1024));
      return { status: 'success', size: stats.size, message: `${(stats.size / (1024 * 1024)).toFixed(2)} MB` };
    }

    return { status: 'fail', size: 0, message: 'File not created' };
  } catch (error) {
    return { status: 'fail', size: 0, message: error.message.split('\n')[0] };
  }
}

function printProgressBar(current, total, width = 40) {
  const filled = Math.round((width * current) / total);
  const bar = '█'.repeat(filled) + '░'.repeat(width - filled);
  const pct = ((current / total) * 100).toFixed(1);
  return `[${bar}] ${current}/${total} (${pct}%)`;
}

async function downloadAll(outputDir, categoryName) {
  ensureDir(outputDir);

  let videos;
  let label;

  if (categoryName) {
    const cat = categories.getByName(categoryName);
    if (!cat) {
      console.log(`❌ Category "${categoryName}" not found`);
      return;
    }
    videos = videoLinks.getPending(categoryName);
    label = categoryName;
  } else {
    videos = videoLinks.getAllPending();
    label = 'All Categories';
  }

  if (videos.length === 0) {
    console.log(`✅ No pending videos to download${categoryName ? ` for "${categoryName}"` : ''}`);
    return;
  }

  console.log(`\n📥 Download Manager`);
  console.log('═'.repeat(60));
  console.log(`📁 Output: ${outputDir}`);
  console.log(`📂 Scope: ${label}`);
  console.log(`🎬 Pending: ${videos.length} videos`);
  console.log('═'.repeat(60));

  let success = 0;
  let skipped = 0;
  let failed = 0;
  let totalBytes = 0;
  const errors = [];

  for (let i = 0; i < videos.length; i++) {
    const video = videos[i];
    const fileName = generateFileName(video, i + 1);
    const catFolder = path.join(outputDir, video.category_name || video.category_name);
    ensureDir(catFolder);
    const outputPath = path.join(catFolder, fileName);

    console.log(`\n${printProgressBar(i, videos.length)}`);
    console.log(`\n📹 [${video.category_name}] ${video.search_term}`);
    console.log(`   📄 ${fileName}`);

    const result = await downloadSingleVideo(video, outputPath);

    if (result.status === 'success') {
      success++;
      totalBytes += result.size;
      console.log(`   ✅ ${result.message}`);
    } else if (result.status === 'skip') {
      skipped++;
      console.log(`   ⏭️ ${result.message}`);
    } else {
      failed++;
      errors.push({ url: video.url, error: result.message });
      console.log(`   ❌ ${result.message}`);
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('📊 Download Summary');
  console.log('═'.repeat(60));
  console.log(`   ✅ Downloaded: ${success}`);
  console.log(`   ⏭️ Skipped:    ${skipped}`);
  console.log(`   ❌ Failed:     ${failed}`);
  console.log(`   💾 Total Size: ${(totalBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`);
  console.log(`   📁 Output:     ${outputDir}`);

  if (errors.length > 0 && errors.length <= 10) {
    console.log('\n❌ Failed URLs:');
    errors.forEach((e, i) => console.log(`   ${i + 1}. ${e.url}`));
  } else if (errors.length > 10) {
    console.log(`\n❌ ${errors.length} failed URLs (too many to display)`);
  }

  console.log('═'.repeat(60));
}

export { downloadAll, DEFAULT_OUTPUT_DIR };
