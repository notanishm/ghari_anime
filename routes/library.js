const express = require('express');
const router = express.Router();
const { getDb } = require('../database');

router.get('/', (req, res) => {
  const db = getDb();
  const { category, status, search, sort } = req.query;
  const uid = req.userId;

  let sql = `SELECT a.*, 
    GROUP_CONCAT(DISTINCT c.name) as category_names,
    GROUP_CONCAT(DISTINCT c.id) as category_ids,
    (SELECT COUNT(*) FROM episodes e WHERE e.anime_id = a.id) as episode_count,
    (SELECT COUNT(*) FROM watch_history wh JOIN episodes e ON wh.episode_id = e.id WHERE e.anime_id = a.id AND wh.completed = 1 AND wh.user_id = ?) as watched_count
    FROM anime a
    LEFT JOIN anime_categories ac ON a.id = ac.anime_id
    LEFT JOIN categories c ON ac.category_id = c.id
    WHERE a.user_id = ?`;

  const params = [uid, uid];

  if (category) {
    sql += ' AND c.id = ?';
    params.push(parseInt(category));
  }

  if (status) {
    sql += ' AND a.status = ?';
    params.push(status);
  }

  if (search) {
    sql += ' AND (a.title LIKE ? OR a.alt_titles LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  sql += ' GROUP BY a.id';

  const sortMap = {
    'title': 'a.title ASC',
    'last_read': 'COALESCE((SELECT MAX(last_watched) FROM watch_history wh JOIN episodes e ON wh.episode_id = e.id WHERE e.anime_id = a.id AND wh.user_id = ?), a.date_added) DESC',
    'last_updated': 'a.last_updated DESC',
    'date_added': 'a.date_added DESC',
    'episodes': 'episode_count DESC',
    'rating': 'a.rating DESC',
    'unread': 'watched_count ASC'
  };

  if (sort === 'last_read') {
    sql += ' ORDER BY ' + sortMap[sort];
    params.push(uid);
  } else {
    sql += ' ORDER BY ' + (sortMap[sort] || 'a.last_updated DESC');
  }

  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const uid = req.userId;
  const anime = db.prepare(`
    SELECT a.*,
      (SELECT COUNT(*) FROM episodes e WHERE e.anime_id = a.id) as episode_count,
      (SELECT COUNT(*) FROM watch_history wh JOIN episodes e ON wh.episode_id = e.id WHERE e.anime_id = a.id AND wh.completed = 1 AND wh.user_id = ?) as watched_count
    FROM anime a WHERE a.id = ? AND a.user_id = ?
  `).get(uid, req.params.id, uid);

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
  const uid = req.userId;
  const { title, alt_titles, source, source_id, cover_url, synopsis, status, genres, year, episodes, duration, rating } = req.body;

  if (!title) return res.status(400).json({ error: 'Title is required' });

  const result = db.prepare(`
    INSERT INTO anime (user_id, title, alt_titles, source, source_id, cover_url, synopsis, status, genres, year, episodes, duration, rating)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    uid,
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
  const uid = req.userId;
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
    WHERE id = ? AND user_id = ?
  `).run(
    title, alt_titles ? JSON.stringify(alt_titles) : null,
    cover_url, synopsis, status,
    genres ? JSON.stringify(genres) : null,
    year, episodes, duration, rating,
    req.params.id, uid
  );

  const updated = db.prepare('SELECT * FROM anime WHERE id = ? AND user_id = ?').get(req.params.id, uid);
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  const uid = req.userId;
  db.prepare('DELETE FROM anime WHERE id = ? AND user_id = ?').run(req.params.id, uid);
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
