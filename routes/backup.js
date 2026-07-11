const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const path = require('path');
const fs = require('fs');

router.post('/export', (req, res) => {
  const db = getDb();
  const backup = {
    version: '1.0',
    date: new Date().toISOString(),
    anime: db.prepare('SELECT * FROM anime').all(),
    categories: db.prepare('SELECT * FROM categories').all(),
    anime_categories: db.prepare('SELECT * FROM anime_categories').all(),
    episodes: db.prepare('SELECT * FROM episodes').all(),
    watch_history: db.prepare('SELECT * FROM watch_history').all(),
    tracking: db.prepare('SELECT * FROM tracking').all(),
    sources: db.prepare('SELECT * FROM sources').all(),
    settings: db.prepare('SELECT * FROM settings').all()
  };

  const backupDir = path.join(__dirname, '..', 'data', 'backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  const filename = `backup_${Date.now()}.json`;
  const filePath = path.join(backupDir, filename);
  fs.writeFileSync(filePath, JSON.stringify(backup, null, 2));

  db.prepare('INSERT INTO backups (name, file_path, size) VALUES (?, ?, ?)')
    .run(filename, filePath, fs.statSync(filePath).size);

  res.json({ success: true, filename, path: filePath });
});

router.post('/restore', (req, res) => {
  const db = getDb();
  const { backup_data } = req.body;
  if (!backup_data) return res.status(400).json({ error: 'Backup data required' });

  try {
    const data = typeof backup_data === 'string' ? JSON.parse(backup_data) : backup_data;

    db.transaction(() => {
      if (data.anime) {
        db.prepare('DELETE FROM anime').run();
        const insert = db.prepare(`INSERT INTO anime (id, title, alt_titles, source, source_id, cover_url, synopsis, status, genres, year, episodes, duration, rating, date_added, last_updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        for (const a of data.anime) {
          insert.run(a.id, a.title, a.alt_titles, a.source, a.source_id, a.cover_url, a.synopsis, a.status, a.genres, a.year, a.episodes, a.duration, a.rating, a.date_added, a.last_updated);
        }
      }
      if (data.categories) {
        db.prepare('DELETE FROM categories').run();
        const insert = db.prepare('INSERT INTO categories (id, name, sort_order, color) VALUES (?, ?, ?, ?)');
        for (const c of data.categories) insert.run(c.id, c.name, c.sort_order, c.color);
      }
      if (data.anime_categories) {
        db.prepare('DELETE FROM anime_categories').run();
        const insert = db.prepare('INSERT INTO anime_categories (anime_id, category_id) VALUES (?, ?)');
        for (const ac of data.anime_categories) insert.run(ac.anime_id, ac.category_id);
      }
      if (data.episodes) {
        db.prepare('DELETE FROM episodes').run();
        const insert = db.prepare('INSERT INTO episodes (id, anime_id, number, title, url, video_urls, duration, thumbnail, date_added) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
        for (const e of data.episodes) insert.run(e.id, e.anime_id, e.number, e.title, e.url, e.video_urls, e.duration, e.thumbnail, e.date_added);
      }
      if (data.watch_history) {
        db.prepare('DELETE FROM watch_history').run();
        const insert = db.prepare('INSERT INTO watch_history (id, anime_id, episode_id, progress, completed, last_watched) VALUES (?, ?, ?, ?, ?, ?)');
        for (const wh of data.watch_history) insert.run(wh.id, wh.anime_id, wh.episode_id, wh.progress, wh.completed, wh.last_watched);
      }
      if (data.tracking) {
        db.prepare('DELETE FROM tracking').run();
        const insert = db.prepare('INSERT INTO tracking (id, anime_id, service, service_id, status, score, episodes_watched, total_episodes, start_date, finish_date, last_synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        for (const t of data.tracking) insert.run(t.id, t.anime_id, t.service, t.service_id, t.status, t.score, t.episodes_watched, t.total_episodes, t.start_date, t.finish_date, t.last_synced);
      }
      if (data.sources) {
        db.prepare('DELETE FROM sources').run();
        const insert = db.prepare('INSERT INTO sources (id, name, url, type, enabled, date_added) VALUES (?, ?, ?, ?, ?, ?)');
        for (const s of data.sources) insert.run(s.id, s.name, s.url, s.type, s.enabled, s.date_added);
      }
    })();

    res.json({ success: true, message: 'Backup restored' });
  } catch (err) {
    res.status(400).json({ error: 'Invalid backup data' });
  }
});

router.get('/list', (req, res) => {
  const db = getDb();
  const backups = db.prepare('SELECT * FROM backups ORDER BY date_created DESC').all();
  res.json(backups);
});

module.exports = router;
