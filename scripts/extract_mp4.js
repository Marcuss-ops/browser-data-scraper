import puppeteer from 'puppeteer-core';

const TARGET_URL = 'https://artlist.io/stock-footage/search?terms=anime';
const LIGHTPANDA_WS = 'ws://127.0.0.1:9222';

async function extractMP4Links() {
  console.log('🚀 Connessione a Lightpanda...');
  
  const browser = await puppeteer.connect({
    browserWSEndpoint: LIGHTPANDA_WS,
  });

  const context = await browser.createBrowserContext();
  const page = await context.newPage();

  // Pattern per catturare URL video Artlist
  const videoUrls = new Set();
  const videoPattern = /artlist\.io|artgrid|footage|\.m3u8|\.mp4|cdn-cgi|cms-public-artifacts/;
  
  page.on('response', async (response) => {
    const url = response.url();
    if (videoPattern.test(url)) {
      console.log(`📹 ${url}`);
      videoUrls.add(url);
    }
  });

  try {
    console.log(`\n📄 Navigazione verso: ${TARGET_URL}\n`);
    await page.setViewport({ width: 1920, height: 1080 });
    
    await page.goto(TARGET_URL, { 
      waitUntil: "networkidle0",
      timeout: 90000 
    });

    await new Promise(resolve => setTimeout(resolve, 10000));

    // Filtra solo URL video/artlist
    const artlistLinks = Array.from(videoUrls).filter(url => 
      url.includes('.m3u8') || 
      url.includes('.mp4') || 
      url.includes('footage') ||
      url.includes('cms-public-artifacts')
    );

    console.log(`\n✅ Trovati ${artlistLinks.length} link Artlist:\n`);
    artlistLinks.forEach((link, i) => {
      console.log(`${i + 1}. ${link}`);
    });

    // Salva
    const fs = await import('fs');
    const outputPath = './artlist_video_links.txt';
    fs.writeFileSync(outputPath, artlistLinks.join('\n'));
    console.log(`\n💾 Salvati ${artlistLinks.length} link in: ${outputPath}`);

  } catch (error) {
    console.error('\n❌ Errore:', error.message);
  } finally {
    try {
      await page.close();
      await context.close();
      await browser.disconnect();
    } catch (e) {}
    console.log('\n👋 Fatto!');
  }
}

extractMP4Links();
