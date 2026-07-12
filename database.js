const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

function getDataDir() {
  // In Electron packaged app, __dirname is inside asar (read-only)
  // Use userData path for writable database storage
  try {
    const { app } = require('electron');
    if (app && app.getPath) {
      const userData = app.getPath('userData');
      const dataDir = path.join(userData, 'data');
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      return dataDir;
    }
  } catch (e) {}
  // Fallback to local data directory (normal Node.js)
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  return dataDir;
}

const DB_PATH = path.join(getDataDir(), 'gharianime.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS anime (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      alt_titles TEXT DEFAULT '[]',
      source TEXT DEFAULT '',
      source_id TEXT DEFAULT '',
      cover_url TEXT DEFAULT '',
      synopsis TEXT DEFAULT '',
      status TEXT DEFAULT 'Unknown',
      genres TEXT DEFAULT '[]',
      year INTEGER DEFAULT 0,
      episodes INTEGER DEFAULT 0,
      duration INTEGER DEFAULT 0,
      rating REAL DEFAULT 0,
      date_added DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      sort_order INTEGER DEFAULT 0,
      color TEXT DEFAULT '#6366f1'
    );

    CREATE TABLE IF NOT EXISTS anime_categories (
      anime_id INTEGER NOT NULL,
      category_id INTEGER NOT NULL,
      PRIMARY KEY (anime_id, category_id),
      FOREIGN KEY (anime_id) REFERENCES anime(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS episodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      anime_id INTEGER NOT NULL,
      number REAL NOT NULL,
      title TEXT DEFAULT '',
      url TEXT DEFAULT '',
      video_urls TEXT DEFAULT '[]',
      duration INTEGER DEFAULT 0,
      thumbnail TEXT DEFAULT '',
      date_added DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (anime_id) REFERENCES anime(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS watch_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      anime_id INTEGER NOT NULL,
      episode_id INTEGER NOT NULL,
      progress REAL DEFAULT 0,
      completed INTEGER DEFAULT 0,
      last_watched DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (anime_id) REFERENCES anime(id) ON DELETE CASCADE,
      FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS downloads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      anime_id INTEGER NOT NULL,
      episode_id INTEGER NOT NULL,
      url TEXT NOT NULL,
      file_path TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
      progress REAL DEFAULT 0,
      date_added DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (anime_id) REFERENCES anime(id) ON DELETE CASCADE,
      FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tracking (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      anime_id INTEGER NOT NULL,
      service TEXT NOT NULL,
      service_id TEXT DEFAULT '',
      status TEXT DEFAULT 'plan_to_watch',
      score REAL DEFAULT 0,
      episodes_watched INTEGER DEFAULT 0,
      total_episodes INTEGER DEFAULT 0,
      start_date TEXT DEFAULT '',
      finish_date TEXT DEFAULT '',
      last_synced DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (anime_id) REFERENCES anime(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      url TEXT NOT NULL,
      type TEXT DEFAULT 'website',
      enabled INTEGER DEFAULT 1,
      date_added DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS backups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      size INTEGER DEFAULT 0,
      date_created DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS extensions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      version TEXT DEFAULT '1.0.0',
      author TEXT DEFAULT 'Community',
      description TEXT DEFAULT '',
      icon TEXT DEFAULT '',
      base_url TEXT NOT NULL,
      search_url TEXT DEFAULT '/search?q={query}',
      selectors TEXT NOT NULL DEFAULT '{}',
      enabled INTEGER DEFAULT 1,
      installed INTEGER DEFAULT 1,
      date_added DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { getDb, closeDb };
