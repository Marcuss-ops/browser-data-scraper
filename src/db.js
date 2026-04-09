import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'artlist_videos.db');

let db;

export function getDB() {
  if (db) return db;

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS search_terms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      term TEXT NOT NULL,
      scraped INTEGER DEFAULT 0,
      last_scraped DATETIME,
      video_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
      UNIQUE(category_id, term)
    );

    CREATE TABLE IF NOT EXISTS video_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      search_term_id INTEGER NOT NULL,
      category_id INTEGER NOT NULL,
      url TEXT NOT NULL,
      video_id TEXT,
      file_name TEXT,
      file_size REAL,
      downloaded INTEGER DEFAULT 0,
      download_path TEXT,
      source TEXT DEFAULT 'unknown',
      width INTEGER DEFAULT 0,
      height INTEGER DEFAULT 0,
      duration INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (search_term_id) REFERENCES search_terms(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
      UNIQUE(search_term_id, url)
    );
  `);

  // Add new columns to existing tables if they don't exist
  try { db.exec('ALTER TABLE video_links ADD COLUMN source TEXT DEFAULT \'unknown\''); } catch (e) {}
  try { db.exec('ALTER TABLE video_links ADD COLUMN width INTEGER DEFAULT 0'); } catch (e) {}
  try { db.exec('ALTER TABLE video_links ADD COLUMN height INTEGER DEFAULT 0'); } catch (e) {}
  try { db.exec('ALTER TABLE video_links ADD COLUMN duration INTEGER DEFAULT 0'); } catch (e) {}

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_videos_category ON video_links(category_id);
    CREATE INDEX IF NOT EXISTS idx_videos_downloaded ON video_links(downloaded);
    CREATE INDEX IF NOT EXISTS idx_videos_source ON video_links(source);
    CREATE INDEX IF NOT EXISTS idx_terms_category ON search_terms(category_id);
    CREATE INDEX IF NOT EXISTS idx_terms_scraped ON search_terms(scraped);
  `);

  return db;
}

export function closeDB() {
  if (db) {
    db.close();
    db = null;
  }
}

// Category operations
export const categories = {
  add(name, description = '') {
    const db = getDB();
    const stmt = db.prepare('INSERT OR IGNORE INTO categories (name, description) VALUES (?, ?)');
    const result = stmt.run(name, description);
    return result.changes > 0 ? { name, description } : null;
  },

  getAll() {
    const db = getDB();
    return db.prepare(`
      SELECT c.*, 
             COUNT(DISTINCT st.id) as term_count,
             COUNT(DISTINCT vl.id) as video_count
      FROM categories c
      LEFT JOIN search_terms st ON c.id = st.category_id
      LEFT JOIN video_links vl ON c.id = vl.category_id
      GROUP BY c.id
      ORDER BY c.name
    `).all();
  },

  getByName(name) {
    const db = getDB();
    return db.prepare('SELECT * FROM categories WHERE name = ?').get(name);
  },

  delete(name) {
    const db = getDB();
    return db.prepare('DELETE FROM categories WHERE name = ?').run(name);
  }
};

// Search terms operations
export const searchTerms = {
  add(categoryName, term) {
    const db = getDB();
    const category = categories.getByName(categoryName);
    if (!category) throw new Error(`Category "${categoryName}" not found`);

    const stmt = db.prepare('INSERT OR IGNORE INTO search_terms (category_id, term) VALUES (?, ?)');
    const result = stmt.run(category.id, term);
    return result.changes > 0 ? { category: categoryName, term } : null;
  },

  addMultiple(categoryName, terms) {
    return terms.map(term => this.add(categoryName, term)).filter(Boolean);
  },

  getUnscraped(categoryName) {
    const db = getDB();
    const category = categories.getByName(categoryName);
    if (!category) throw new Error(`Category "${categoryName}" not found`);

    return db.prepare('SELECT * FROM search_terms WHERE category_id = ? AND scraped = 0').all(category.id);
  },

  getAll(categoryName) {
    const db = getDB();
    const category = categories.getByName(categoryName);
    if (!category) throw new Error(`Category "${categoryName}" not found`);

    return db.prepare('SELECT * FROM search_terms WHERE category_id = ? ORDER BY term').all(category.id);
  },

  markScraped(categoryName, term, videoCount = 0) {
    const db = getDB();
    const category = categories.getByName(categoryName);
    if (!category) throw new Error(`Category "${categoryName}" not found`);

    db.prepare(`
      UPDATE search_terms 
      SET scraped = 1, last_scraped = CURRENT_TIMESTAMP, video_count = ?
      WHERE category_id = ? AND term = ?
    `).run(videoCount, category.id, term);
  }
};

// Video links operations
export const videoLinks = {
  add(categoryName, searchTerm, url, videoId = null) {
    const db = getDB();
    const category = categories.getByName(categoryName);
    if (!category) throw new Error(`Category "${categoryName}" not found`);

    const searchTermRow = db.prepare('SELECT id FROM search_terms WHERE category_id = ? AND term = ?').get(category.id, searchTerm);
    if (!searchTermRow) throw new Error(`Search term "${searchTerm}" not found in category "${categoryName}"`);

    const stmt = db.prepare('INSERT OR IGNORE INTO video_links (search_term_id, category_id, url, video_id) VALUES (?, ?, ?, ?)');
    const result = stmt.run(searchTermRow.id, category.id, url, videoId);
    return result.changes > 0;
  },

  addMultiple(categoryName, searchTerm, urls) {
    let count = 0;
    for (const url of urls) {
      if (this.add(categoryName, searchTerm, url)) count++;
    }
    return count;
  },

  getByCategory(categoryName, downloadedOnly = false) {
    const db = getDB();
    const category = categories.getByName(categoryName);
    if (!category) throw new Error(`Category "${categoryName}" not found`);

    return db.prepare(`
      SELECT vl.*, st.term as search_term
      FROM video_links vl
      JOIN search_terms st ON vl.search_term_id = st.id
      WHERE vl.category_id = ? ${downloadedOnly ? 'AND vl.downloaded = 1' : ''}
      ORDER BY vl.created_at DESC
    `).all(category.id);
  },

  getBySearchTerm(categoryName, searchTerm) {
    const db = getDB();
    const category = categories.getByName(categoryName);
    if (!category) throw new Error(`Category "${categoryName}" not found`);

    return db.prepare(`
      SELECT * FROM video_links
      WHERE category_id = ? AND search_term_id = (
        SELECT id FROM search_terms WHERE category_id = ? AND term = ?
      )
      ORDER BY created_at DESC
    `).all(category.id, category.id, searchTerm);
  },

  markDownloaded(url, downloadPath, fileSize = null) {
    const db = getDB();
    db.prepare(`
      UPDATE video_links 
      SET downloaded = 1, download_path = ?, file_size = ?
      WHERE url = ?
    `).run(downloadPath, fileSize, url);
  },

  getStats(categoryName) {
    const db = getDB();
    const category = categories.getByName(categoryName);
    if (!category) throw new Error(`Category "${categoryName}" not found`);

    return db.prepare(`
      SELECT 
        COUNT(*) as total_videos,
        SUM(downloaded) as downloaded,
        COUNT(*) - SUM(downloaded) as pending,
        COALESCE(SUM(file_size), 0) as total_size_mb
      FROM video_links
      WHERE category_id = ?
    `).get(category.id);
  },

  getPending(categoryName) {
    const db = getDB();
    const category = categories.getByName(categoryName);
    if (!category) throw new Error(`Category "${categoryName}" not found`);

    return db.prepare(`
      SELECT vl.*, st.term as search_term
      FROM video_links vl
      JOIN search_terms st ON vl.search_term_id = st.id
      WHERE vl.category_id = ? AND vl.downloaded = 0
      ORDER BY vl.created_at
    `).all(category.id);
  },

  getAllPending() {
    const db = getDB();
    return db.prepare(`
      SELECT vl.*, c.name as category_name, st.term as search_term
      FROM video_links vl
      JOIN categories c ON vl.category_id = c.id
      JOIN search_terms st ON vl.search_term_id = st.id
      WHERE vl.downloaded = 0
      ORDER BY vl.created_at
    `).all();
  },

  addMultipleWithSource(categoryName, searchTerm, urls, source, metadata = []) {
    const db = getDB();
    const category = categories.getByName(categoryName);
    if (!category) throw new Error(`Category "${categoryName}" not found`);

    const searchTermRow = db.prepare('SELECT id FROM search_terms WHERE category_id = ? AND term = ?').get(category.id, searchTerm);
    if (!searchTermRow) throw new Error(`Search term "${searchTerm}" not found in category "${categoryName}"`);

    const stmt = db.prepare(`
      INSERT OR IGNORE INTO video_links 
      (search_term_id, category_id, url, video_id, source, width, height, duration, file_size) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let count = 0;
    db.transaction(() => {
      for (let i = 0; i < urls.length; i++) {
        const meta = metadata[i] || {};
        const result = stmt.run(
          searchTermRow.id,
          category.id,
          urls[i],
          meta.video_id || null,
          source,
          meta.width || 0,
          meta.height || 0,
          meta.duration || 0,
          meta.size ? meta.size / (1024 * 1024) : null
        );
        if (result.changes > 0) count++;
      }
    })();

    return count;
  },

  getBySource(source) {
    const db = getDB();
    return db.prepare(`
      SELECT vl.*, st.term as search_term, c.name as category_name
      FROM video_links vl
      JOIN search_terms st ON vl.search_term_id = st.id
      JOIN categories c ON vl.category_id = c.id
      WHERE vl.source = ?
      ORDER BY vl.created_at DESC
    `).all(source);
  },

  getStatsBySource() {
    const db = getDB();
    return db.prepare(`
      SELECT 
        source,
        COUNT(*) as total_videos,
        SUM(downloaded) as downloaded,
        COUNT(*) - SUM(downloaded) as pending,
        COALESCE(SUM(file_size), 0) as total_size_mb
      FROM video_links
      WHERE source != 'unknown'
      GROUP BY source
    `).all();
  }
};

// Duplicate detection
export const duplicates = {
  find() {
    const db = getDB();
    return db.prepare(`
      SELECT url, COUNT(*) as count, GROUP_CONCAT(c.name || ' / ' || st.term) as locations
      FROM video_links vl
      JOIN categories c ON vl.category_id = c.id
      JOIN search_terms st ON vl.search_term_id = st.id
      GROUP BY url
      HAVING count > 1
      ORDER BY count DESC
    `).all();
  },

  remove() {
    const db = getDB();
    const dupes = this.find();
    let removed = 0;

    const deleteStmt = db.prepare(`
      DELETE FROM video_links
      WHERE id NOT IN (
        SELECT MIN(id) FROM video_links GROUP BY url
      )
    `);

    const result = deleteStmt.run();
    removed = result.changes;
    return removed;
  }
};
