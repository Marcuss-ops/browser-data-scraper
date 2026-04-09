import { PEXELS_API_KEY, PEXELS_API_BASE, DEFAULT_PARAMS, RATE_LIMITS } from './api_config.js';

// Sleep utility function
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Search for videos on Pexels
 * @param {string} query - Search term
 * @param {object} options - Additional search parameters
 * @returns {object} API response
 */
export async function searchVideos(query, options = {}) {
  const params = new URLSearchParams({
    query,
    per_page: DEFAULT_PARAMS.per_page,
    ...options
  });

  const url = `${PEXELS_API_BASE}/search?${params.toString()}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': PEXELS_API_KEY
      }
    });
    
    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Pexels API rate limit exceeded');
      }
      throw new Error(`Pexels API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`❌ Pexels search error for "${query}":`, error.message);
    throw error;
  }
}

/**
 * Get video download URLs in different qualities
 * @param {object} video - Video object from Pexels API
 * @returns {array} Array of video quality options
 */
export function getVideoQualities(video) {
  return video.video_files || [];
}

/**
 * Get best quality video URL (prefer HD/4K)
 * @param {object} video - Video object from Pexels API
 * @returns {object} Best quality video info
 */
export function getBestQuality(video) {
  const files = video.video_files || [];
  // Sort by width (highest first)
  const sorted = files
    .filter(f => f.width && f.link)
    .sort((a, b) => (b.width || 0) - (a.width || 0));
  
  return sorted[0] || null;
}

/**
 * Search and extract video metadata
 * @param {string} query - Search term
 * @param {object} options - Search parameters
 * @returns {array} Array of video metadata
 */
export async function searchAndExtract(query, options = {}) {
  const data = await searchVideos(query, options);
  
  return data.videos.map(video => ({
    source: 'pexels',
    video_id: video.id.toString(),
    url: getBestQuality(video)?.link || video.url,
    title: video.tags?.join(', ') || '',
    width: getBestQuality(video)?.width || 0,
    height: getBestQuality(video)?.height || 0,
    size: getBestQuality(video)?.size || 0,
    duration: video.duration || 0,
    thumbnail: video.image || video.user?.image,
    user: video.user?.name,
    user_id: video.user?.id,
    views: 0,
    downloads: 0,
    likes: 0
  }));
}

/**
 * Paginated search - fetch all pages
 * @param {string} query - Search term
 * @param {number} maxPages - Maximum number of pages to fetch
 * @param {object} options - Search parameters
 * @returns {array} All video results
 */
export async function searchAllPages(query, maxPages = 10, options = {}) {
  let allVideos = [];
  let page = 1;
  
  console.log(`\n🔍 Pexels: Searching "${query}" (max ${maxPages} pages)...`);
  
  while (page <= maxPages) {
    const data = await searchVideos(query, { ...options, page });
    
    if (data.videos.length === 0) {
      console.log(`   ⏭️ No more results on page ${page}`);
      break;
    }
    
    const extracted = data.videos.map(video => ({
      source: 'pexels',
      video_id: video.id.toString(),
      url: getBestQuality(video)?.link || video.url,
      title: video.tags?.join(', ') || '',
      width: getBestQuality(video)?.width || 0,
      height: getBestQuality(video)?.height || 0,
      size: getBestQuality(video)?.size || 0,
      duration: video.duration || 0,
      thumbnail: video.image || video.user?.image,
      user: video.user?.name,
      user_id: video.user?.id,
      views: 0,
      downloads: 0,
      likes: 0
    }));
    
    allVideos = allVideos.concat(extracted);
    console.log(`   📄 Page ${page}: ${data.videos.length} videos (${data.total_results} total hits)`);
    
    // Check if we've reached the end
    if (page >= data.total_pages || page >= maxPages) {
      break;
    }
    
    page++;
    await sleep(RATE_LIMITS.pexels.delayBetweenRequests);
  }
  
  return allVideos;
}
