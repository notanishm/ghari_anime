const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const scraper = require('../scraper');
const anilist = require('../anilist');

router.get('/', (req, res) => {
  const db = getDb();
  const exts = db.prepare('SELECT * FROM extensions ORDER BY name ASC').all();
  res.json(exts.map(e => ({ ...e, selectors: JSON.parse(e.selectors || '{}') })));
});

router.get('/sources', (req, res) => {
  res.json(scraper.getBuiltinSources());
});

router.post('/install', (req, res) => {
  const db = getDb();
  const { name, version, author, description, icon, base_url, search_url, selectors } = req.body;
  if (!name || !base_url || !selectors) {
    return res.status(400).json({ error: 'name, base_url, and selectors are required' });
  }
  const existing = db.prepare('SELECT id FROM extensions WHERE name = ?').get(name);
  if (existing) {
    db.prepare(`UPDATE extensions SET version=?, author=?, description=?, icon=?, base_url=?, search_url=?, selectors=?, installed=1 WHERE id=?`)
      .run(version || '1.0.0', author || 'Community', description || '', icon || '', base_url, search_url || '/search?q={query}', JSON.stringify(selectors), existing.id);
    return res.json(db.prepare('SELECT * FROM extensions WHERE id = ?').get(existing.id));
  }
  const result = db.prepare(`INSERT INTO extensions (name, version, author, description, icon, base_url, search_url, selectors) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(name, version || '1.0.0', author || 'Community', description || '', icon || '', base_url, search_url || '/search?q={query}', JSON.stringify(selectors));
  res.status(201).json(db.prepare('SELECT * FROM extensions WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const db = getDb();
  const { enabled } = req.body;
  if (enabled !== undefined) {
    db.prepare('UPDATE extensions SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, req.params.id);
  }
  res.json(db.prepare('SELECT * FROM extensions WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM extensions WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.post('/search', async (req, res) => {
  const { query, source } = req.body;
  if (!query) return res.status(400).json({ error: 'Query is required' });

  const SOURCE_MAP = {
    'animekai': 'animekai', 'AnimeKai': 'animekai',
    'aniwatch': 'aniwatch', 'AniWatch': 'aniwatch',
    'animepahe': 'animepahe', 'AnimePahe': 'animepahe',
    'kaa': 'kaa', 'KickAssAnime': 'kaa',
    'gogoanimes': 'gogoanimes', 'Gogoanime': 'gogoanimes',
    'mkissa': 'mkissa', 'MKissa': 'mkissa',
    'reanime': 'reanime', 'ReAnime': 'reanime',
    'anidb': 'anidb', 'AniDB': 'anidb',
    'anizone': 'anizone', 'AniZone': 'anizone',
    'anineko': 'anineko', 'AniNeko': 'anineko',
    'senshi': 'senshi', 'SenshiLive': 'senshi',
    'aninexus': 'aninexus', 'AnimeNexus': 'aninexus'
  };

  try {
    if (source === 'anilist') {
      const results = await anilist.searchAnime(query);
      return res.json(results.results.map(a => ({
        ...a,
        url: 'anilist://' + a.id,
        source: 'AniList',
        sourceId: 'anilist'
      })));
    }

    const sourceId = SOURCE_MAP[source] || source;
    const builtIn = scraper.getBuiltinSources().find(s => s.id === sourceId);
    if (builtIn) {
      const results = await scraper.searchSource(sourceId, query);
      return res.json(results);
    }

    const db = getDb();
    const ext = db.prepare('SELECT * FROM extensions WHERE id = ? OR name = ?').get(source, source);
    if (ext) {
      ext.selectors = JSON.parse(ext.selectors || '{}');
      const results = await scraper.searchExtension(ext, query);
      return res.json(results);
    }

    res.status(404).json({ error: 'Source not found' });
  } catch (err) {
    console.error('Search error:', err.message);
    res.status(500).json({ error: 'Search failed: ' + err.message });
  }
});

router.post('/search-all', async (req, res) => {
  const { query, enabledSources } = req.body;
  if (!query) return res.status(400).json({ error: 'Query is required' });

  const allResults = [];

  try {
    const siteResults = await scraper.searchBuiltin(query, enabledSources);
    allResults.push(...siteResults);
  } catch (err) {
    console.error('Site search failed:', err.message);
  }

  res.json(allResults);
});

router.post('/scrape-anime', async (req, res) => {
  const { source, url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  const SOURCE_MAP = {
    'animekai': 'animekai', 'AnimeKai': 'animekai',
    'aniwatch': 'aniwatch', 'AniWatch': 'aniwatch',
    'animepahe': 'animepahe', 'AnimePahe': 'animepahe',
    'kaa': 'kaa', 'KickAssAnime': 'kaa',
    'gogoanimes': 'gogoanimes', 'Gogoanime': 'gogoanimes',
    'mkissa': 'mkissa', 'MKissa': 'mkissa',
    'reanime': 'reanime', 'ReAnime': 'reanime',
    'anidb': 'anidb', 'AniDB': 'anidb',
    'anizone': 'anizone', 'AniZone': 'anizone',
    'anineko': 'anineko', 'AniNeko': 'anineko',
    'senshi': 'senshi', 'SenshiLive': 'senshi',
    'aninexus': 'aninexus', 'AnimeNexus': 'aninexus'
  };

  try {
    if (source === 'anilist' || (typeof url === 'string' && url.startsWith('anilist://'))) {
      const id = url.replace('anilist://', '');
      const anime = await anilist.getAnimeById(id);
      return res.json(anime);
    }

    const sourceId = SOURCE_MAP[source] || source;
    const builtIn = scraper.getBuiltinSources().find(s => s.id === sourceId);
    if (builtIn) {
      const details = await scraper.getAnimeDetails(sourceId, url);
      if (details.episodes && details.episodes.length > 0) {
        const firstEp = details.episodes[0];
        if (firstEp.url) {
          try {
            const video = await scraper.getVideoUrl(sourceId, firstEp.url);
            details.hasVideo = !!(video && video.videoUrl);
          } catch {
            details.hasVideo = false;
          }
        } else {
          details.hasVideo = false;
        }
      } else {
        details.hasVideo = false;
      }
      return res.json({ ...details, source: builtIn.name, sourceId: builtIn.id });
    }

    res.status(404).json({ error: 'Source not found' });
  } catch (err) {
    console.error('Scrape error:', err.message);
    res.status(500).json({ error: 'Scraping failed: ' + err.message });
  }
});

router.post('/get-video', async (req, res) => {
  const { source, url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  const SOURCE_MAP = {
    'animekai': 'animekai', 'AnimeKai': 'animekai',
    'aniwatch': 'aniwatch', 'AniWatch': 'aniwatch',
    'animepahe': 'animepahe', 'AnimePahe': 'animepahe',
    'kaa': 'kaa', 'KickAssAnime': 'kaa',
    'gogoanimes': 'gogoanimes', 'Gogoanime': 'gogoanimes',
    'mkissa': 'mkissa', 'MKissa': 'mkissa',
    'reanime': 'reanime', 'ReAnime': 'reanime',
    'anidb': 'anidb', 'AniDB': 'anidb',
    'anizone': 'anizone', 'AniZone': 'anizone',
    'anineko': 'anineko', 'AniNeko': 'anineko',
    'senshi': 'senshi', 'SenshiLive': 'senshi',
    'aninexus': 'aninexus', 'AnimeNexus': 'aninexus'
  };

  try {
    const sourceId = SOURCE_MAP[source] || source;
    const builtIn = scraper.getBuiltinSources().find(s => s.id === sourceId);
    if (builtIn) {
      const video = await scraper.getVideoUrl(sourceId, url);
      return res.json(video);
    }
    res.status(404).json({ error: 'Source not found' });
  } catch (err) {
    console.error('Video extraction error:', err.message);
    res.status(500).json({ error: 'Video extraction failed: ' + err.message });
  }
});

router.get('/anilist/trending', async (req, res) => {
  try {
    const results = await anilist.getTrending();
    res.json(results.results.map(a => ({ ...a, url: 'anilist://' + a.id, source: 'AniList' })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/anilist/seasonal', async (req, res) => {
  try {
    const now = new Date();
    const month = now.getMonth();
    let season = 'WINTER';
    if (month >= 2 && month <= 4) season = 'SPRING';
    else if (month >= 5 && month <= 7) season = 'SUMMER';
    else if (month >= 8 && month <= 10) season = 'FALL';
    const year = now.getFullYear();
    const results = await anilist.getSeasonal(season, year);
    res.json(results.results.map(a => ({ ...a, url: 'anilist://' + a.id, source: 'AniList' })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/check-video', async (req, res) => {
  const { source, url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  const SOURCE_MAP = {
    'animekai': 'animekai', 'AnimeKai': 'animekai',
    'aniwatch': 'aniwatch', 'AniWatch': 'aniwatch',
    'animepahe': 'animepahe', 'AnimePahe': 'animepahe',
    'kaa': 'kaa', 'KickAssAnime': 'kaa',
    'gogoanimes': 'gogoanimes', 'Gogoanime': 'gogoanimes',
    'mkissa': 'mkissa', 'MKissa': 'mkissa',
    'reanime': 'reanime', 'ReAnime': 'reanime',
    'anidb': 'anidb', 'AniDB': 'anidb',
    'anizone': 'anizone', 'AniZone': 'anizone',
    'anineko': 'anineko', 'AniNeko': 'anineko',
    'senshi': 'senshi', 'SenshiLive': 'senshi',
    'aninexus': 'aninexus', 'AnimeNexus': 'aninexus'
  };

  try {
    const sourceId = SOURCE_MAP[source] || source;
    const builtIn = scraper.getBuiltinSources().find(s => s.id === sourceId);
    if (builtIn) {
      const available = await scraper.checkVideoAvailability(sourceId, url);
      return res.json({ available });
    }
    res.status(404).json({ error: 'Source not found' });
  } catch (err) {
    res.json({ available: false });
  }
});

module.exports = router;
