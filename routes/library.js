const express = require('express');
const router = express.Router();
const { getDb } = require('../database');

router.get('/', (req, res) => {
  const db = getDb();
  const { category, status, search, sort } = req.query;

  let sql = `SELECT a.*, 
    GROUP_CONCAT(DISTINCT c.name) as category_names,
    GROUP_CONCAT(DISTINCT c.id) as category_ids,
    (SELECT COUNT(*) FROM episodes e WHERE e.anime_id = a.id) as episode_count,
    (SELECT COUNT(*) FROM watch_history wh JOIN episodes e ON wh.episode_id = e.id WHERE e.anime_id = a.id AND wh.completed = 1) as watched_count
    FROM anime a
    LEFT JOIN anime_categories ac ON a.id = ac.anime_id
    LEFT JOIN categories c ON ac.category_id = c.id`;

  const conditions = [];
  const params = [];

  if (category) {
    conditions.push('c.id = ?');
    params.push(parseInt(category));
  }

  if (status) {
    conditions.push('a.status = ?');
    params.push(status);
  }

  if (search) {
    conditions.push('(a.title LIKE ? OR a.alt_titles LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += ' GROUP BY a.id';

  const sortMap = {
    'title': 'a.title ASC',
    'last_read': 'COALESCE((SELECT MAX(last_watched) FROM watch_history wh JOIN episodes e ON wh.episode_id = e.id WHERE e.anime_id = a.id), a.date_added) DESC',
    'last_updated': 'a.last_updated DESC',
    'date_added': 'a.date_added DESC',
    'episodes': 'episode_count DESC',
    'rating': 'a.rating DESC',
    'unread': 'watched_count ASC'
  };
  sql += ' ORDER BY ' + (sortMap[sort] || 'a.last_updated DESC');

  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const anime = db.prepare(`
    SELECT a.*,
      (SELECT COUNT(*) FROM episodes e WHERE e.anime_id = a.id) as episode_count,
      (SELECT COUNT(*) FROM watch_history wh JOIN episodes e ON wh.episode_id = e.id WHERE e.anime_id = a.id AND wh.completed = 1) as watched_count
    FROM anime a WHERE a.id = ?
  `).get(req.params.id);

  if (!anime) return res.status(404).json({ error: 'Not found' });

  anime.genres = JSON.parse(anime.genres || '[]');
  anime.alt_titles = JSON.parse(anime.alt_titles || '[]');

  const categories = db.prepare(`
    SELECT c.* FROM categories c
    JOIN anime_categories ac ON c.id = ac.category_id
    WHERE ac.anime_id = ?
  `).all(req.params.id);
  anime.categories = categories;

  res.json(anime);
});

router.post('/', (req, res) => {
  const db = getDb();
  const { title, alt_titles, source, source_id, cover_url, synopsis, status, genres, year, episodes, duration, rating } = req.body;

  if (!title) return res.status(400).json({ error: 'Title is required' });

  const result = db.prepare(`
    INSERT INTO anime (title, alt_titles, source, source_id, cover_url, synopsis, status, genres, year, episodes, duration, rating)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    title,
    JSON.stringify(alt_titles || []),
    source || '',
    source_id || '',
    cover_url || '',
    synopsis || '',
    status || 'Unknown',
    JSON.stringify(genres || []),
    year || 0,
    episodes || 0,
    duration || 0,
    rating || 0
  );

  const anime = db.prepare('SELECT * FROM anime WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(anime);
});

router.put('/:id', (req, res) => {
  const db = getDb();
  const { title, alt_titles, cover_url, synopsis, status, genres, year, episodes, duration, rating } = req.body;

  db.prepare(`
    UPDATE anime SET
      title = COALESCE(?, title),
      alt_titles = COALESCE(?, alt_titles),
      cover_url = COALESCE(?, cover_url),
      synopsis = COALESCE(?, synopsis),
      status = COALESCE(?, status),
      genres = COALESCE(?, genres),
      year = COALESCE(?, year),
      episodes = COALESCE(?, episodes),
      duration = COALESCE(?, duration),
      rating = COALESCE(?, rating),
      last_updated = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    title, alt_titles ? JSON.stringify(alt_titles) : null,
    cover_url, synopsis, status,
    genres ? JSON.stringify(genres) : null,
    year, episodes, duration, rating,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM anime WHERE id = ?').get(req.params.id);
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM anime WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.post('/:id/categories', (req, res) => {
  const db = getDb();
  const { category_ids } = req.body;
  db.prepare('DELETE FROM anime_categories WHERE anime_id = ?').run(req.params.id);
  const insert = db.prepare('INSERT OR IGNORE INTO anime_categories (anime_id, category_id) VALUES (?, ?)');
  for (const cid of (category_ids || [])) {
    insert.run(req.params.id, cid);
  }
  res.json({ success: true });
});

module.exports = router;
