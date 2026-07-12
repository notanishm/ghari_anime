const express = require('express');
const router = express.Router();
const { getDb } = require('../database');

router.get('/:animeId', (req, res) => {
  const db = getDb();
  const uid = req.userId;
  const tracking = db.prepare('SELECT * FROM tracking WHERE anime_id = ? AND user_id = ?').all(req.params.animeId, uid);
  res.json(tracking);
});

router.post('/:animeId', (req, res) => {
  const db = getDb();
  const uid = req.userId;
  const { service, service_id, status, score, episodes_watched, total_episodes, start_date, finish_date } = req.body;

  if (!service) return res.status(400).json({ error: 'Service is required' });

  const existing = db.prepare('SELECT id FROM tracking WHERE anime_id = ? AND service = ? AND user_id = ?')
    .get(req.params.animeId, service, uid);

  if (existing) {
    db.prepare(`UPDATE tracking SET service_id=?, status=?, score=?, episodes_watched=?, total_episodes=?, start_date=?, finish_date=?, last_synced=CURRENT_TIMESTAMP WHERE id=?`)
      .run(service_id || '', status || 'plan_to_watch', score || 0, episodes_watched || 0, total_episodes || 0, start_date || '', finish_date || '', existing.id);
    return res.json(db.prepare('SELECT * FROM tracking WHERE id = ?').get(existing.id));
  }

  const result = db.prepare('INSERT INTO tracking (user_id, anime_id, service, service_id, status, score, episodes_watched, total_episodes, start_date, finish_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(uid, req.params.animeId, service, service_id || '', status || 'plan_to_watch', score || 0, episodes_watched || 0, total_episodes || 0, start_date || '', finish_date || '');

  res.status(201).json(db.prepare('SELECT * FROM tracking WHERE id = ?').get(result.lastInsertRowid));
});

router.delete('/:animeId/:service', (req, res) => {
  const db = getDb();
  const uid = req.userId;
  db.prepare('DELETE FROM tracking WHERE anime_id = ? AND service = ? AND user_id = ?')
    .run(req.params.animeId, req.params.service, uid);
  res.json({ success: true });
});

module.exports = router;
