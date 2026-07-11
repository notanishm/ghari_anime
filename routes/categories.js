const express = require('express');
const router = express.Router();
const { getDb } = require('../database');

router.get('/', (req, res) => {
  const db = getDb();
  const categories = db.prepare(`
    SELECT c.*, COUNT(ac.anime_id) as anime_count
    FROM categories c
    LEFT JOIN anime_categories ac ON c.id = ac.category_id
    GROUP BY c.id
    ORDER BY c.sort_order ASC, c.name ASC
  `).all();
  res.json(categories);
});

router.post('/', (req, res) => {
  const db = getDb();
  const { name, color } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 as next FROM categories').get();
  const result = db.prepare('INSERT INTO categories (name, color, sort_order) VALUES (?, ?, ?)')
    .run(name, color || '#6366f1', maxOrder.next);
  const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(cat);
});

router.put('/:id', (req, res) => {
  const db = getDb();
  const { name, color, sort_order } = req.body;
  db.prepare('UPDATE categories SET name=COALESCE(?,name), color=COALESCE(?,color), sort_order=COALESCE(?,sort_order) WHERE id=?')
    .run(name, color, sort_order, req.params.id);
  res.json(db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
