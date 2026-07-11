const express = require('express');
const router = express.Router();
const { getDb } = require('../database');

router.get('/', (req, res) => {
  const db = getDb();
  const sources = db.prepare('SELECT * FROM sources ORDER BY name ASC').all();
  res.json(sources);
});

router.post('/', (req, res) => {
  const db = getDb();
  const { name, url, type } = req.body;
  if (!name || !url) return res.status(400).json({ error: 'Name and URL are required' });

  const existing = db.prepare('SELECT id FROM sources WHERE name = ?').get(name);
  if (existing) return res.status(409).json({ error: 'Source already exists' });

  const result = db.prepare('INSERT INTO sources (name, url, type) VALUES (?, ?, ?)')
    .run(name, url, type || 'website');
  const source = db.prepare('SELECT * FROM sources WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(source);
});

router.put('/:id', (req, res) => {
  const db = getDb();
  const { name, url, type, enabled } = req.body;
  db.prepare('UPDATE sources SET name=COALESCE(?,name), url=COALESCE(?,url), type=COALESCE(?,type), enabled=COALESCE(?,enabled) WHERE id=?')
    .run(name, url, type, enabled !== undefined ? (enabled ? 1 : 0) : null, req.params.id);
  res.json(db.prepare('SELECT * FROM sources WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM sources WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
