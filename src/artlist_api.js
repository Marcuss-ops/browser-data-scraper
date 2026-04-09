import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GRAPHQL_ENDPOINT = 'https://search-api.artlist.io/v1/graphql';

/**
 * Build Artlist GraphQL query for searching clips
 */
function buildClipQuery(searchTerm, page = 1, includeAIContent = true) {
  return {
    query: `
      query ClipList($searchTerms: [String]) {
        clipList(searchTerms: $searchTerms, page: ${page}) {
          exactResults {
            id
            clipName
            clipPath
            duration
            width
            height
            thumbnailUrl
          }
          totalExact
        }
      }
    `,
    variables: {
      searchTerms: [searchTerm]
    }
  };
}

/**
 * Build HLS video URL from clipPath
 */
function buildHlsUrl(clipPath, clipId) {
  if (!clipPath) return null;
  
  if (clipPath.startsWith('http')) return clipPath;
  
  if (clipPath.includes('_playlist.m3u8') || clipPath.endsWith('.m3u8')) {
    return `https://cms-public-artifacts.artlist.io${clipPath.startsWith('/') ? '' : '/'}${clipPath}`;
  }
  
  const cleanPath = clipPath.replace(/^\/+/, '');
  return `https://cms-public-artifacts.artlist.io/${cleanPath}`;
}

/**
 * Search clips via Artlist GraphQL API
 */
export async function searchClips(searchTerm, options = {}) {
  const { maxPages = 10, includeAIContent = true, delayMs = 1000 } = options;
  
  const allClips = [];
  let currentPage = 1;
  let hardLimitReached = false;

  console.log(`\n🎬 Artlist: Searching "${searchTerm}" (max ${maxPages} pages, 50/page)...`);

  while (currentPage <= maxPages && !hardLimitReached) {
    const payload = {
      query: `
        query ClipList($searchTerms: [String]) {
          clipList(searchTerms: $searchTerms, page: ${currentPage}) {
            exactResults {
              id
              clipName
              clipPath
              duration
              width
              height
              thumbnailUrl
            }
            totalExact
          }
        }
      `,
      variables: { searchTerms: [searchTerm] }
    };

    try {
      const response = await fetch(GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        console.error(`   ❌ HTTP ${response.status}: ${response.statusText}`);
        break;
      }

      const data = await response.json();
      const clips = data?.data?.clipList?.exactResults || [];

      if (clips.length === 0) {
        console.log(`   ⏭️ Page ${currentPage}: no more results`);
        hardLimitReached = true;
        break;
      }

      console.log(`   📄 Page ${currentPage}: ${clips.length} clips (${allClips.length + clips.length} cumulative)`);

      for (const clip of clips) {
        allClips.push({
          source: 'artlist',
          id: clip.id,
          name: clip.clipName,
          clipPath: clip.clipPath,
          duration: clip.duration,
          width: clip.width,
          height: clip.height,
          thumbnailUrl: clip.thumbnailUrl,
          hlsUrl: clip.clipPath
        });
      }

      // Hard cap at 500 (10 pages)
      if (currentPage >= 10) {
        console.log(`   ⚠️  API hard limit reached (500 results max)`);
        hardLimitReached = true;
      }

      currentPage++;

      if (currentPage <= maxPages && !hardLimitReached) {
        await new Promise(r => setTimeout(r, delayMs));
      }

    } catch (error) {
      console.error(`   ❌ Error on page ${currentPage}: ${error.message}`);
      break;
    }
  }

  console.log(`   ✅ Total clips found: ${allClips.length}`);
  return allClips;
}

/**
 * Get video quality variants
 */
export function getVideoVariants(clip) {
  const base = clip.clipPath;
  if (!base) return [];

  const variants = [];
  
  if (base.includes('_playlist.m3u8')) {
    variants.push({ quality: 'original', url: buildHlsUrl(base, clip.id) });
  } else if (base.endsWith('.mp4')) {
    variants.push({ quality: 'original', url: buildHlsUrl(base, clip.id) });
    const baseNoExt = base.replace('.mp4', '');
    variants.push({ quality: '1080p', url: buildHlsUrl(`${baseNoExt}_1080.mp4`, clip.id) });
    variants.push({ quality: '720p', url: buildHlsUrl(`${baseNoExt}_720.mp4`, clip.id) });
  }
  
  return variants;
}

/**
 * Save results to JSON file
 */
export function saveResults(results, filename) {
  const outputPath = path.join(__dirname, '..', filename);
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n💾 Saved to: ${outputPath}`);
  return outputPath;
}

/**
 * Save results to custom directory
 */
export function saveToDir(results, filename, outputDir) {
  const outputPath = path.join(outputDir, filename);
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n💾 Saved to: ${outputPath}`);
  return outputPath;
}
