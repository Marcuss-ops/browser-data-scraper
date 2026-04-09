// Scarica Chrome automaticamente
import puppeteer from 'puppeteer';

const TARGET_URL = 'https://artlist.io/stock-footage/search?terms=anime';

async function extractArtlistVideos() {
  console.log('🚀 Avvio Chrome con Puppeteer...');
  
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process'
    ]
  });

  const page = await browser.newPage();
  
  // User-Agent realistico
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  // Pattern URL video - solo video reali
  const videoUrls = new Set();
  const videoPattern = /\.m3u8|\.mp4|cms-public-artifacts.*footage|footage-hls/i;
  
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
      timeout: 120000 
    });

    // Verifica titolo pagina (non deve essere "Just a moment...")
    const title = await page.title();
    console.log(`📄 Titolo pagina: ${title}`);
    
    if (title.includes('Just a moment')) {
      console.log('\n⚠️  Cloudflare sta bloccando la richiesta...');
      console.log('   Proviamo ad attendere...');
      await new Promise(resolve => setTimeout(resolve, 30000));
      
      const newTitle = await page.title();
      console.log(`📄 Nuovo titolo: ${newTitle}`);
    }

    await new Promise(resolve => setTimeout(resolve, 15000));

    // Scroll pagina lentamente
    console.log('\n📜 Scroll pagina...');
    await page.evaluate(async () => {
      for (let i = 0; i < 5; i++) {
        window.scrollBy(0, 600);
        await new Promise(r => setTimeout(r, 2000));
      }
    });

    // Hover sui video per triggerare le preview
    console.log('\n🖱️  Hover sui video per caricare preview...');
    const selector = 'a[href*="footage"], article a, [data-id] a, .footage-grid-item a, .search-results a';
    const videoItems = await page.$$(selector);
    console.log(`  Trovati ${videoItems.length} elementi`);
    
    for (let i = 0; i < Math.min(20, videoItems.length); i++) {
      try {
        console.log(`  Hover ${i + 1}/${Math.min(20, videoItems.length)}`);
        await videoItems[i].hover();
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (e) {
        // Ignora errori
      }
    }

    await new Promise(resolve => setTimeout(resolve, 15000));

    // Debug: vediamo quali URL sono stati catturati
    console.log('\n🔍 Debug - Tutti URL artlist catturati:');
    const allArtlistUrls = Array.from(videoUrls);
    allArtlistUrls.slice(0, 20).forEach((url, i) => {
      console.log(`  ${i+1}. ${url}`);
    });

    // Filtra URL video
    const videoLinks = Array.from(videoUrls).filter(url => 
      url.includes('.m3u8') || 
      url.includes('.mp4')
    );

    console.log(`\n✅ Trovati ${videoLinks.length} link video:\n`);
    videoLinks.forEach((link, i) => {
      console.log(`${i + 1}. ${link}`);
    });

    // Salva
    const fs = await import('fs');
    const outputPath = './artlist_video_links.txt';
    fs.writeFileSync(outputPath, videoLinks.join('\n'));
    console.log(`\n💾 Salvati ${videoLinks.length} link in: ${outputPath}`);

  } catch (error) {
    console.error('\n❌ Errore:', error.message);
  } finally {
    await browser.close();
    console.log('\n👋 Fatto!');
  }
}

extractArtlistVideos();
