const express = require('express');
const router = express.Router();
const { getDb } = require('../database');

router.get('/', (req, res) => {
  const db = getDb();
  const uid = req.userId;
  const categories = db.prepare(`
    SELECT c.*, COUNT(ac.anime_id) as anime_count
    FROM categories c
    LEFT JOIN anime_categories ac ON c.id = ac.category_id
    WHERE c.user_id = ?
    GROUP BY c.id
    ORDER BY c.sort_order ASC, c.name ASC
  `).all(uid);
  res.json(categories);
});

router.post('/', (req, res) => {
  const db = getDb();
  const uid = req.userId;
  const { name, color } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 as next FROM categories WHERE user_id = ?').get(uid);
  const result = db.prepare('INSERT INTO categories (user_id, name, color, sort_order) VALUES (?, ?, ?, ?)')
    .run(uid, name, color || '#6366f1', maxOrder.next);
  const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(cat);
});

router.put('/:id', (req, res) => {
  const db = getDb();
  const uid = req.userId;
  const { name, color, sort_order } = req.body;
  db.prepare('UPDATE categories SET name=COALESCE(?,name), color=COALESCE(?,color), sort_order=COALESCE(?,sort_order) WHERE id=? AND user_id=?')
    .run(name, color, sort_order, req.params.id, uid);
  res.json(db.prepare('SELECT * FROM categories WHERE id = ? AND user_id = ?').get(req.params.id, uid));
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  const uid = req.userId;
  db.prepare('DELETE FROM categories WHERE id = ? AND user_id = ?').run(req.params.id, uid);
  res.json({ success: true });
});

module.exports = router;
