# Artlist MP4 Scraper

A multi-source video scraping and download system with support for **Artlist GraphQL API**, Pixabay API, and Pexels API. Features a SQLite database for organized storage, category management, and automated video downloads.

## 📁 Project Structure

```
browserDataTest/
├── src/                      # Core source code
│   ├── db.js                 # Database module (SQLite schema & operations)
│   ├── api_config.js         # Pixabay & Pexels API keys
│   ├── pixabay_api.js        # Pixabay API client
│   ├── pexels_api.js         # Pexels API client
│   └── artlist_api.js        # Artlist GraphQL API client ⭐
├── scripts/                  # Executable scripts
│   ├── cli.js                # Main CLI interface
│   ├── download_manager.js   # Video download handler
│   ├── download_videos.js    # Standalone downloader (legacy)
│   ├── scrape_categories.js  # Artlist browser scraper (Lightpanda)
│   ├── scrape_apis.js        # Unified Pixabay/Pexels scraper
│   ├── map_artlist.js        # ⭐ Artlist GraphQL mapper + downloader
│   ├── extract_mp4.js        # MP4 link extractor (Lightpanda)
│   └── extract_with_puppeteer.js  # MP4 link extractor (Puppeteer)
├── examples/                 # Example/test scripts
│   └── test_lightpanda.js    # Lightpanda connection test
├── Output/                   # ⭐ Downloaded videos & mapping files
│   └── artlist_<term>_mapping.json
├── artlist_videos.db         # SQLite database (auto-generated)
├── package.json              # Dependencies
└── README.md                 # This file
```

## ✨ Features

- 🗄️ **SQLite Database** - Organized storage with categories, search terms, and video metadata
- 📁 **Category Management** - Group videos by category with related search terms
- 📊 **CLI Tools** - Full command-line interface for managing and querying data
- 🌐 **Multi-Source Support**:
  - **Artlist GraphQL API** ⭐ - Direct API access, up to 500 clips per search term (no browser needed)
  - **Pixabay API** - Direct API access to royalty-free videos
  - **Pexels API** - Direct API access to free stock videos
  - **Artlist Browser Scraper** - Lightpanda/Puppeteer fallback
- 🤖 **Automated Scraping** - Scrape across all categories with smart resume
- ⏭️ **Smart Resume** - Skips already scraped terms and downloaded videos
- 📥 **Batch Downloads** - Download pending videos by category or all at once
- 🔍 **Duplicate Detection** - Find and remove duplicate video entries
- 📈 **Source Tracking** - Track which API/source each video came from

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Choose Your Video Source

#### Option A: Artlist GraphQL API ⭐ (Recommended - Fast, No Browser)

```bash
# Map and download all videos for a search term (max 500)
node scripts/map_artlist.js spider 10

# Map only, no download
node scripts/map_artlist.js spider 10 --no-download
```

#### Option B: Pixabay & Pexels APIs (No Docker Required)

```bash
# Initialize database with seed data
node scripts/cli.js seed

# Start scraping from both APIs
node scripts/cli.js api-scrape
```

#### Option C: Artlist Browser Scraper (Requires Docker + Lightpanda)

```bash
# Start Lightpanda browser
docker run -d --name lightpanda -p 9222:9222 lightpanda/browser:nightly

# Initialize database
node scripts/cli.js seed

# Start scraping
node scripts/cli.js scrape
```

### 3. Download Videos

```bash
# Download all pending videos
node scripts/cli.js download

# Download for specific category
node scripts/cli.js download Sports
```

## 📖 CLI Commands

### Artlist GraphQL Mapper ⭐

```bash
node scripts/map_artlist.js <term> [pages] [options]

# Examples:
node scripts/map_artlist.js spider 10              # Map + download 500 clips
node scripts/map_artlist.js nature 5 --no-download # Map only, 250 clips
node scripts/map_artlist.js "city skyline" 10      # Multi-word search
```

**Options:**
- `[term]` - Search term (required)
- `[pages]` - Number of pages to fetch, 1-10 (default: 5)
- `--no-download` - Skip downloading, only map and save JSON
- `--no-db` - Skip saving to database

**Output:**
- `Output/artlist_<term>_mapping.json` - Full mapping with video URLs
- `Output/<term>/` - Downloaded MP4 files

### Database Management

```bash
node scripts/cli.js seed                    # Add sample categories & terms
node scripts/cli.js categories              # List all categories with stats
node scripts/cli.js terms <category>        # List search terms for a category
node scripts/cli.js videos <category>       # List all videos for a category
node scripts/cli.js stats <category>        # Show detailed stats
```

### API Commands (Pixabay & Pexels)

```bash
node scripts/cli.js api-scrape              # Scrape using both APIs
node scripts/cli.js api-stats               # Show statistics by API source
node scripts/cli.js api-videos <source>     # List videos from specific API
                                            # Sources: pixabay, pexels
```

### Add/Remove Data

```bash
node scripts/cli.js add-cat <name> [desc]   # Add a new category
node scripts/cli.js add-term <cat> <term>   # Add a search term
node scripts/cli.js add-batch               # Interactive: add category + multiple terms
node scripts/cli.js delete-cat <name>       # Delete a category and all its data
```

### Search & Cleanup

```bash
node scripts/cli.js search <query>          # Search terms across all categories
node scripts/cli.js dedup                   # Find duplicate videos
node scripts/cli.js dedup remove            # Remove duplicate videos
```

### Download

```bash
node scripts/cli.js download                # Download ALL pending videos
node scripts/cli.js download <category>     # Download pending for one category
```

### Artlist Browser Scraping (Requires Lightpanda)

```bash
node scripts/cli.js scrape                  # Scrape all unscraped terms
```

## 🎯 Example Workflows

### Artlist GraphQL (Fastest - Recommended)

```bash
# Single term - full download (500 clips max)
node scripts/map_artlist.js spider 10

# Multiple terms - mapping only
node scripts/map_artlist.js nature 10 --no-download
node scripts/map_artlist.js city 10 --no-download
node scripts/map_artlist.js people 10 --no-download

# Batch download thousands of videos across terms
node scripts/map_artlist.js "spider web" 10
node scripts/map_artlist.js tarantula 10
node scripts/map_artlist.js insect 10
```

### Pixabay & Pexels APIs

```bash
# 1. Add seed data
node scripts/cli.js seed

# 2. Scrape from both APIs
node scripts/cli.js api-scrape

# 3. Check results
node scripts/cli.js api-stats

# 4. Download
node scripts/cli.js download
```

### Artlist Browser (Legacy)

```bash
# 1. Start Lightpanda
docker run -d --name lightpanda -p 9222:9222 lightpanda/browser:nightly

# 2. Scrape Artlist
node scripts/cli.js scrape

# 3. Download
node scripts/cli.js download Sports
```

## 🗃️ Database Schema

```
categories ──┬── search_terms ──┬── video_links
             │                  │
             │                  ├── url
             │                  ├── video_id
             │                  ├── source (artlist/pixabay/pexels)
             │                  ├── width, height, duration
             │                  ├── downloaded (bool)
             │                  └── download_path
             │
             ├── name
             ├── description
             └── created_at
```

## 🎬 Seed Categories

| Category     | Example Search Terms                           |
| ------------ | ---------------------------------------------- |
| Sports       | football, basketball, soccer goal, tennis...   |
| Nature       | ocean waves, mountain sunset, forest aerial... |
| Technology   | coding computer, AI, robotics, VR...           |
| Business     | office meeting, handshake, presentation...     |
| Food         | cooking pasta, chef plating, coffee pour...    |
| Travel       | airplane takeoff, city timelapse, train...     |
| Anime        | anime, manga style, japanese animation...      |
| Music        | guitar playing, dj mixing, piano performance...|

## 🌐 API Configuration

### Artlist GraphQL API ⭐
- **Endpoint**: `https://search-api.artlist.io/v1/graphql`
- **Results per page**: 50 clips
- **Max pages**: 10 (hard limit)
- **Max results per term**: **500 clips**
- **Auth**: None required (public endpoint)
- **Video format**: HLS (.m3u8) → converted to MP4 via ffmpeg

### Pixabay API
- **API Key**: Configure in `.env` or `src/api_config.js`
- **Rate Limit**: 100 requests/minute
- **Documentation**: https://pixabay.com/api/docs/

### Pexels API
- **API Key**: Configure in `.env` or `src/api_config.js`
- **Rate Limit**: 200 requests/hour
- **Documentation**: https://www.pexels.com/api/

### Changing API Keys

Edit `.env` (recommended) or `src/api_config.js`:

```javascript
export const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY || 'your-key-here';
export const PEXELS_API_KEY = process.env.PEXELS_API_KEY || 'your-key-here';
```

## ⚙️ Configuration

### Download Output Directory

Videos are downloaded to `./Output` by default. Modify `SCRAPER_OUTPUT_DIR` in your environment or `OUTPUT_DIR` in `scripts/map_artlist.js` to change this.

### Rate Limiting

Adjust rate limits in `src/api_config.js`:

```javascript
export const RATE_LIMITS = {
  pixabay: {
    maxRequestsPerMinute: 100,
    delayBetweenRequests: 600 // ms
  },
  pexels: {
    maxRequestsPerMinute: 200,
    delayBetweenRequests: 300 // ms
  }
};
```

## 📦 Dependencies

- **better-sqlite3** - SQLite3 database driver for Node.js
- **node-fetch** - HTTP client for API requests
- **puppeteer** - Headless Chrome automation (for Artlist browser scraping)
- **puppeteer-core** - Core Puppeteer library (for Lightpanda)
- **readline-sync** - Synchronous readline for interactive CLI

## 🛠️ Troubleshooting

### Artlist GraphQL Returns 0 Results

- Check your search term spelling
- Some terms may have fewer than 50 results
- The API has a hard cap of 500 results per term

### API Rate Limit Errors

The scraper includes automatic delays between requests. If you hit rate limits:
- Reduce `maxRequestsPerMinute` in `src/api_config.js`
- Increase `delayBetweenRequests`
- Wait a few minutes before retrying

### ffmpeg Not Found

Ensure ffmpeg is installed and in your PATH:
```bash
ffmpeg -version
```

### Database Reset

To start fresh, delete `artlist_videos.db` and run `node scripts/cli.js seed` again.

### No Videos Found

Make sure you've run the mapper or scraper first to populate the database.

## ⚠️ Disclaimer

**Respect the Terms of Service for all platforms!**

- **Artlist**: Verify scraping/downloading is allowed before use
- **Pixabay**: Content License - https://pixabay.com/service/license/
- **Pexels**: License - https://www.pexels.com/license/

This tool is for **educational purposes only**. The authors are not responsible for any misuse or legal consequences. Always attribute content creators as required by their respective licenses.

## 📝 License

Educational use only. Respect all platform licenses and content usage rights.
