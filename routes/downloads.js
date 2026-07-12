const express = require('express');
const router = express.Router();
const { getDb } = require('../database');

router.get('/', (req, res) => {
  const db = getDb();
  const uid = req.userId;
  const downloads = db.prepare(`
    SELECT d.*, a.title as anime_title, e.number as episode_number, e.title as episode_title
    FROM downloads d
    JOIN anime a ON d.anime_id = a.id
    JOIN episodes e ON d.episode_id = e.id
    WHERE d.user_id = ?
    ORDER BY d.date_added DESC
  `).all(uid);
  res.json(downloads);
});

router.post('/', (req, res) => {
  const db = getDb();
  const uid = req.userId;
  const { anime_id, episode_id, url } = req.body;
  if (!anime_id || !episode_id || !url) {
    return res.status(400).json({ error: 'anime_id, episode_id, and url are required' });
  }

  const existing = db.prepare('SELECT id FROM downloads WHERE episode_id = ? AND user_id = ?').get(episode_id, uid);
  if (existing) return res.status(409).json({ error: 'Episode already in downloads' });

  const result = db.prepare('INSERT INTO downloads (user_id, anime_id, episode_id, url) VALUES (?, ?, ?, ?)')
    .run(uid, anime_id, episode_id, url);
  res.status(201).json(db.prepare('SELECT * FROM downloads WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const db = getDb();
  const { status, progress, file_path } = req.body;
  db.prepare('UPDATE downloads SET status=COALESCE(?,status), progress=COALESCE(?,progress), file_path=COALESCE(?,file_path) WHERE id=?')
    .run(status, progress, file_path, req.params.id);
  res.json(db.prepare('SELECT * FROM downloads WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM downloads WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
