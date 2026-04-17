import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const TARGET_URL = 'https://artlist.io/stock-footage/search?terms=anime';
const OUTPUT_DIR = process.env.SCRAPER_OUTPUT_DIR || './Output';

// Crea cartella se non esiste
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log(`📁 Creata cartella: ${OUTPUT_DIR}`);
}

async function downloadVideo(m3u8Url, index) {
  // Estrai ID video dal URL
  const match = m3u8Url.match(/footage-hls\/([^_]+)/);
  const videoId = match ? match[1] : `video_${index}`;
  
  // Nome file con ID univoco per evitare sovrascritture
  const fileName = `${videoId}.mp4`;
  const outputPath = path.join(OUTPUT_DIR, fileName);

  // Salta se già esiste
  if (fs.existsSync(outputPath)) {
    const stats = fs.statSync(outputPath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`  ⏭️ ${videoId} già esiste (${sizeMB} MB)`);
    return 'skip';
  }

  try {
    console.log(`  ⬇️ Download video ${index}: ${videoId}`);
    
    // ffmpeg scarica e converte HLS in MP4
    const command = `ffmpeg -i "${m3u8Url}" -c copy -y "${outputPath}" 2>&1`;
    const { stdout, stderr } = await execAsync(command, { timeout: 120000 });
    
    if (fs.existsSync(outputPath)) {
      const stats = fs.statSync(outputPath);
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
      console.log(`  ✅ ${fileName} (${sizeMB} MB)`);
      return true;
    }
  } catch (error) {
    console.log(`  ❌ Errore download ${videoId}: ${error.message.split('\n')[0]}`);
    return false;
  }
}

async function scrapeAndDownload() {
  console.log('🚀 Avvio Chrome con Puppeteer...\n');
  
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled'
    ]
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  // Cattura TUTTI gli URL video (playlist + 480p)
  const videoUrls = new Set();
  const videoPattern = /footage-hls.*\.m3u8/i;
  
  page.on('response', async (response) => {
    const url = response.url();
    if (videoPattern.test(url)) {
      console.log(`\n  📹 ${url.split('/').pop()}`);
      videoUrls.add(url);
    }
  });

  try {
    console.log(`📄 Navigazione verso: ${TARGET_URL}\n`);
    await page.setViewport({ width: 1920, height: 1080 });
    
    await page.goto(TARGET_URL, { 
      waitUntil: "networkidle0",
      timeout: 120000 
    });

    const title = await page.title();
    console.log(`📄 Titolo: ${title}\n`);
    
    if (title.includes('Just a moment')) {
      console.log('⚠️ Cloudflare sta bloccando...');
      return;
    }

    // Scroll lento e costante per caricare video
    console.log('📜 Scroll pagina per caricare video...\n');
    
    await page.evaluate(async () => {
      const maxScrolls = 50;
      for (let i = 0; i < maxScrolls; i++) {
        window.scrollBy(0, 600);
        await new Promise(r => setTimeout(r, 1500));
      }
    });
    
    await new Promise(resolve => setTimeout(resolve, 15000));

    // Hover veloce su tutti i video
    console.log('\n🖱️ Hover sui video...\n');
    const selector = 'a[href*="footage"], article a, [data-id] a';
    const videoItems = await page.$$(selector);
    console.log(`  Trovati ${videoItems.length} elementi`);
    
    for (let i = 0; i < videoItems.length; i++) {
      try {
        process.stdout.write(`  Hover ${i + 1}/${videoItems.length}\r`);
        await videoItems[i].hover();
        await new Promise(resolve => setTimeout(resolve, 400));
      } catch (e) {}
    }

    await new Promise(resolve => setTimeout(resolve, 20000));

    // Filtra: prendi solo i playlist principali (unici per video)
    const allUrls = Array.from(videoUrls);
    console.log(`\n🔍 Debug: ${allUrls.length} URL totali catturati`);
    
    // Estrai solo i playlist principali (quelli con "playlist" nel nome)
    const playlistLinks = allUrls.filter(url => 
      url.includes('_playlist_') || url.match(/[^p]playlist\.m3u8$/)
    );
    
    console.log(`📦 Playlist principali: ${playlistLinks.length}`);
    
    // Debug: mostra primi URL
    if (playlistLinks.length > 0 && playlistLinks.length <= 5) {
      console.log('\n🎬 Playlist trovate:');
      playlistLinks.forEach((url, i) => console.log(`  ${i+1}. ${url.split('/').pop()}`));
    }

    console.log(`\n✅ Trovati ${playlistLinks.length} video da scaricare\n`);
    console.log('═'.repeat(60));

    // Download video
    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < playlistLinks.length; i++) {
      const url = playlistLinks[i];
      const result = await downloadVideo(url, i + 1);
      if (result === true) successCount++;
      else if (result === 'skip') skipCount++;
      else failCount++;
    }

    console.log('\n' + '═'.repeat(60));
    console.log(`\n🎉 Download completati:`);
    console.log(`   ✅ Nuovi: ${successCount}`);
    console.log(`   ⏭️  Saltati (già esistenti): ${skipCount}`);
    console.log(`   ❌ Falliti: ${failCount}`);
    console.log(`   📊 Totale trovati: ${playlistLinks.length}`);
    console.log(`\n📁 Cartella: ${OUTPUT_DIR}`);

  } catch (error) {
    console.error('\n❌ Errore:', error.message);
  } finally {
    await browser.close();
    console.log('\n👋 Fatto!');
  }
}

scrapeAndDownload();
