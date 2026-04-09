import { PIXABAY_API_KEY, PIXABAY_API_BASE, DEFAULT_PARAMS, RATE_LIMITS } from './api_config.js';

// Sleep utility function
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Search for videos on Pixabay
 * @param {string} query - Search term
 * @param {object} options - Additional search parameters
 * @returns {object} API response
 */
export async function searchVideos(query, options = {}) {
  const params = new URLSearchParams({
    key: PIXABAY_API_KEY,
    q: query,
    ...DEFAULT_PARAMS,
    ...options
  });

  const url = `${PIXABAY_API_BASE}/?${params.toString()}`;
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Pixabay API rate limit exceeded');
      }
      throw new Error(`Pixabay API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`❌ Pixabay search error for "${query}":`, error.message);
    throw error;
  }
}

/**
 * Get video download URLs in different qualities
 * @param {object} video - Video object from Pixabay API
 * @returns {array} Array of video quality options
 */
export function getVideoQualities(video) {
  const videos = video.videos || {};
  return [
    { quality: 'large', ...videos.large },
    { quality: 'medium', ...videos.medium },
    { quality: 'small', ...videos.small },
    { quality: 'tiny', ...videos.tiny }
  ].filter(v => v.url);
}

/**
 * Get best quality video URL
 * @param {object} video - Video object from Pixabay API
 * @returns {object} Best quality video info
 */
export function getBestQuality(video) {
  const videos = video.videos || {};
  return videos.large || videos.medium || videos.small || videos.tiny;
}

/**
 * Search and extract video metadata
 * @param {string} query - Search term
 * @param {object} options - Search parameters
 * @returns {array} Array of video metadata
 */
export async function searchAndExtract(query, options = {}) {
  const data = await searchVideos(query, options);
  
  return data.hits.map(video => ({
    source: 'pixabay',
    video_id: video.id.toString(),
    url: getBestQuality(video)?.url || video.pageURL,
    title: video.tags,
    width: getBestQuality(video)?.width || 0,
    height: getBestQuality(video)?.height || 0,
    size: getBestQuality(video)?.size || 0,
    duration: video.duration || 0,
    thumbnail: getBestQuality(video)?.thumbnail,
    user: video.user,
    user_id: video.user_id,
    views: video.views,
    downloads: video.downloads,
    likes: video.likes
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
  
  console.log(`\n🔍 Pixabay: Searching "${query}" (max ${maxPages} pages)...`);
  
  while (page <= maxPages) {
    const data = await searchVideos(query, { ...options, page });
    
    if (data.hits.length === 0) {
      console.log(`   ⏭️ No more results on page ${page}`);
      break;
    }
    
    const extracted = data.hits.map(video => ({
      source: 'pixabay',
      video_id: video.id.toString(),
      url: getBestQuality(video)?.url || video.pageURL,
      title: video.tags,
      width: getBestQuality(video)?.width || 0,
      height: getBestQuality(video)?.height || 0,
      size: getBestQuality(video)?.size || 0,
      duration: video.duration || 0,
      thumbnail: getBestQuality(video)?.thumbnail,
      user: video.user,
      user_id: video.user_id,
      views: video.views,
      downloads: video.downloads,
      likes: video.likes
    }));
    
    allVideos = allVideos.concat(extracted);
    console.log(`   📄 Page ${page}: ${data.hits.length} videos (${data.totalHits} total hits)`);
    
    // Check if we've reached the end
    if (allVideos.length >= data.totalHits || page >= 10) {
      break;
    }
    
    page++;
    await sleep(RATE_LIMITS.pixabay.delayBetweenRequests);
  }
  
  return allVideos;
}
