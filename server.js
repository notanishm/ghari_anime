const express = require('express');
const path = require('path');
const cors = require('cors');
const { getDb, closeDb } = require('./database');

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err.message);
});
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err && err.message ? err.message : err);
});

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: 0, etag: false }));

app.use('/api/library', require('./routes/library'));
app.use('/api/episodes', require('./routes/episodes'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/sources', require('./routes/sources'));
app.use('/api/tracking', require('./routes/tracking'));
app.use('/api/downloads', require('./routes/downloads'));
app.use('/api/backup', require('./routes/backup'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/extensions', require('./routes/extensions'));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`GharAnime running on http://localhost:${PORT}`);
  console.log(`Open your browser to http://localhost:${PORT}`);
});
