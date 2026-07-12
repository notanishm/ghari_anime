const express = require('express');
const router = express.Router();
const { getDb } = require('../database');

router.get('/:animeId', (req, res) => {
  const db = getDb();
  const uid = req.userId;
  const episodes = db.prepare(`
    SELECT e.*, wh.progress, wh.completed, wh.last_watched
    FROM episodes e
    LEFT JOIN watch_history wh ON e.id = wh.episode_id AND wh.user_id = ?
    WHERE e.anime_id = ?
    ORDER BY e.number DESC
  `).all(uid, req.params.animeId);

  episodes.forEach(ep => {
    ep.video_urls = JSON.parse(ep.video_urls || '[]');
  });

  res.json(episodes);
});

router.post('/', (req, res) => {
  const db = getDb();
  const { anime_id, number, title, url, video_urls, duration, thumbnail } = req.body;

  if (!anime_id || number === undefined) {
    return res.status(400).json({ error: 'anime_id and number are required' });
  }

  const existing = db.prepare('SELECT id FROM episodes WHERE anime_id = ? AND number = ?').get(anime_id, number);
  if (existing) {
    db.prepare(`UPDATE episodes SET title=?, url=?, video_urls=?, duration=?, thumbnail=? WHERE id=?`)
      .run(title || '', url || '', JSON.stringify(video_urls || []), duration || 0, thumbnail || '', existing.id);
    const ep = db.prepare('SELECT * FROM episodes WHERE id = ?').get(existing.id);
    return res.json(ep);
  }

  const result = db.prepare(`
    INSERT INTO episodes (anime_id, number, title, url, video_urls, duration, thumbnail)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(anime_id, number, title || '', url || '', JSON.stringify(video_urls || []), duration || 0, thumbnail || '');

  const ep = db.prepare('SELECT * FROM episodes WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(ep);
});

router.put('/:animeId/episodes/:episodeId/progress', (req, res) => {
  const db = getDb();
  const uid = req.userId;
  const { progress, completed } = req.body;

  const existing = db.prepare('SELECT id FROM watch_history WHERE anime_id = ? AND episode_id = ? AND user_id = ?')
    .get(req.params.animeId, req.params.episodeId, uid);

  if (existing) {
    db.prepare('UPDATE watch_history SET progress=?, completed=?, last_watched=CURRENT_TIMESTAMP WHERE id=?')
      .run(progress || 0, completed ? 1 : 0, existing.id);
  } else {
    db.prepare('INSERT INTO watch_history (user_id, anime_id, episode_id, progress, completed) VALUES (?, ?, ?, ?, ?)')
      .run(uid, req.params.animeId, req.params.episodeId, progress || 0, completed ? 1 : 0);
  }

  res.json({ success: true });
});

router.get('/:animeId/continue', (req, res) => {
  const db = getDb();
  const uid = req.userId;
  const episode = db.prepare(`
    SELECT e.*, wh.progress, wh.completed
    FROM episodes e
    LEFT JOIN watch_history wh ON e.id = wh.episode_id AND wh.user_id = ?
    WHERE e.anime_id = ? AND (wh.completed IS NULL OR wh.completed = 0)
    ORDER BY e.number ASC
    LIMIT 1
  `).get(uid, req.params.animeId);

  if (!episode) {
    const first = db.prepare('SELECT * FROM episodes WHERE anime_id = ? ORDER BY number ASC LIMIT 1').get(req.params.animeId);
    return res.json(first || null);
  }

  episode.video_urls = JSON.parse(episode.video_urls || '[]');
  res.json(episode);
});

module.exports = router;
