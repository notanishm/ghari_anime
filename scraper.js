const fetch = require('node-fetch');

let puppeteer;
let browserInstance = null;
let browserLaunchPromise = null;

async function getBrowser() {
  if (browserInstance && browserInstance.connected) return browserInstance;
  if (browserLaunchPromise) return browserLaunchPromise;
  puppeteer = require('puppeteer');
  browserLaunchPromise = puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--window-size=1280,720']
  });
  browserInstance = await browserLaunchPromise;
  browserLaunchPromise = null;
  browserInstance.on('disconnected', () => { browserInstance = null; });
  return browserInstance;
}

async function closeBrowser() {
  if (browserInstance) { try { await browserInstance.close(); } catch {} browserInstance = null; }
}

async function goto(page, url, fast) {
  try {
    await page.goto(url, { waitUntil: fast ? 'domcontentloaded' : 'networkidle2', timeout: fast ? 8000 : 12000 });
  } catch {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 8000 });
    } catch {}
  }
  await new Promise(r => setTimeout(r, fast ? 500 : 1000));
}

async function waitForAnySelector(page, selectors, timeout = 5000) {
  try {
    await page.waitForFunction((sels) => {
      return sels.some(sel => document.querySelector(sel));
    }, { timeout }, selectors);
  } catch {}
}

const SITE_SCRAPERS = {
  animekai: {
    name: 'AnimeKai',
    baseUrl: 'https://animekai.at',
    searchUrl: (q) => 'https://animekai.at/?s=' + encodeURIComponent(q),
    async search(page, query) {
      await goto(page, this.searchUrl(query), true);
      await waitForAnySelector(page, ['article.bs', '.bsx', '.listupd']);
      return await page.evaluate(() => {
        const results = [];
        const seen = new Set();
        document.querySelectorAll('article.bs').forEach(el => {
          const a = el.querySelector('a');
          const titleEl = el.querySelector('.tt');
          const img = el.querySelector('img');
          let title = '';
          if (titleEl) {
            const tEl = titleEl.querySelector('.t');
            title = tEl ? tEl.textContent.trim() : titleEl.innerText.split('\n')[0].trim();
          }
          title = title.replace(/\t+/g, ' ').replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
          const href = a ? a.getAttribute('href') : '';
          const cover = img ? (img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || img.getAttribute('src') || '') : '';
          if (title && href && !seen.has(href)) {
            seen.add(href);
            results.push({
              title,
              url: href.startsWith('http') ? href : location.origin + (href.startsWith('/') ? href : '/' + href),
              cover: cover.startsWith('http') ? cover : (cover ? location.origin + (cover.startsWith('/') ? cover : '/' + cover) : ''),
              meta: '',
              source: 'AnimeKai'
            });
          }
        });
        return results;
      });
    },
    async getAnimeDetails(page, url) {
      await goto(page, url, true);
      await waitForAnySelector(page, ['.entry-title', 'h1', '.episodes-ul']);
      return await page.evaluate(() => {
        const titleEl = document.querySelector('.entry-title, h1, .anime-name');
        let title = titleEl ? titleEl.textContent.trim() : document.title.split('-')[0].trim();
        title = title.replace(/\t+/g, ' ').replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
        const synopsisEl = document.querySelector('.entry-content .synopsis, .description, .storyline, .entry-content p');
        const synopsis = synopsisEl ? synopsisEl.textContent.trim() : '';
        const coverEl = document.querySelector('.thumb img, .poster img, .anime-cover img, article img');
        const cover = coverEl ? (coverEl.getAttribute('data-src') || coverEl.getAttribute('src') || '') : '';
        const episodes = [];
        document.querySelectorAll('.episodes-ul a.ep-item').forEach((el) => {
          const href = el.getAttribute('href') || '';
          const numAttr = el.getAttribute('data-number');
          const num = numAttr ? parseInt(numAttr) : 0;
          if (href && num) {
            episodes.push({
              number: num,
              title: 'Episode ' + num,
              url: href.startsWith('http') ? href : location.origin + href
            });
          }
        });
        return { title, synopsis, cover, episodes, source: 'AnimeKai' };
      });
    },
    async getVideoUrl(page, episodeUrl) {
      await goto(page, episodeUrl, true);
      await new Promise(r => setTimeout(r, 1000));
      await waitForAnySelector(page, ['#pembed iframe', '.player-embed iframe', 'iframe[src*="embed"]', 'iframe']);
      return await page.evaluate(() => {
        const selectors = [
          '#pembed iframe',
          '.player-embed iframe',
          '.embed-player iframe',
          'iframe[src*="megaplay"]',
          'iframe[src*="stream"]',
          'iframe[src*="embed"]',
          'iframe[src*="vidcloud"]',
          'iframe[src*="fembed"]',
          'iframe[src*="gogoplay"]',
          'iframe[src*="asianload"]',
          'iframe[src*="sbembed"]',
          'iframe[src*="mycloud"]',
          'iframe[src*="mp4upload"]',
          'iframe'
        ];
        for (const sel of selectors) {
          const iframe = document.querySelector(sel);
          if (iframe) {
            const src = iframe.getAttribute('src') || '';
            if (src && src.startsWith('http')) return { videoUrl: src, server: 'embed' };
          }
        }
        const allIframes = document.querySelectorAll('iframe');
        for (const f of allIframes) {
          const src = f.getAttribute('src') || '';
          if (src && src.includes('http') && !src.includes('google') && !src.includes('analytics')) {
            return { videoUrl: src, server: 'embed' };
          }
        }
        const links = document.querySelectorAll('a[href*="megaplay"], a[href*="stream"], a[href*="embed"]');
        for (const link of links) {
          const href = link.getAttribute('href') || '';
          if (href && href.startsWith('http')) return { videoUrl: href, server: 'link' };
        }
        return { videoUrl: '', server: '' };
      });
    }
  },

  aniwatch: {
    name: 'AniWatch',
    baseUrl: 'https://aniwatch.co.at',
    searchUrl: (q) => 'https://aniwatch.co.at/?s=' + encodeURIComponent(q),
    async search(page, query) {
      await goto(page, this.searchUrl(query), true);
      await waitForAnySelector(page, ['.flw-item', '.film_list-wrap']);
      return await page.evaluate(() => {
        const results = [];
        const seen = new Set();
        document.querySelectorAll('.flw-item').forEach(el => {
          const a = el.querySelector('a');
          const titleEl = el.querySelector('.film-name a, h3 a, .dynamic-name');
          const img = el.querySelector('img');
          const title = titleEl ? titleEl.textContent.trim() : '';
          const href = a ? a.getAttribute('href') : '';
          const cover = img ? (img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || img.getAttribute('src') || '') : '';
          if (title && href && !seen.has(href)) {
            seen.add(href);
            results.push({
              title,
              url: href.startsWith('http') ? href : location.origin + (href.startsWith('/') ? href : '/' + href),
              cover: cover.startsWith('http') ? cover : (cover ? location.origin + (cover.startsWith('/') ? cover : '/' + cover) : ''),
              meta: '',
              source: 'AniWatch'
            });
          }
        });
        return results;
      });
    },
    async getAnimeDetails(page, url) {
      await goto(page, url, true);
      await waitForAnySelector(page, ['.anime-name', 'h2.title', '.film-name', 'h1', '.ep-item']);
      return await page.evaluate(() => {
        const titleEl = document.querySelector('.anime-name, h2.title, .film-name, h1');
        let title = titleEl ? titleEl.textContent.trim() : document.title.split('-')[0].trim();
        title = title.replace(/\t+/g, ' ').replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
        const synopsisEl = document.querySelector('.description, .synopsis, .text, .pre-text');
        const synopsis = synopsisEl ? synopsisEl.textContent.trim() : '';
        const coverEl = document.querySelector('.poster img, .anime-poster img, .film-poster img');
        const cover = coverEl ? (coverEl.getAttribute('data-src') || coverEl.getAttribute('src') || '') : '';
        const episodes = [];
        document.querySelectorAll('.ep-item, .episode-item, .ssl-item .item').forEach((el, i) => {
          const a = el.querySelector('a');
          const numEl = el.querySelector('.number, .ep-num');
          const titleEl = el.querySelector('.title, .ep-title');
          if (a) {
            episodes.push({
              number: numEl ? parseFloat(numEl.textContent.replace(/[^0-9.]/g, '')) || (i + 1) : (i + 1),
              title: titleEl ? titleEl.textContent.trim() : 'Episode ' + (i + 1),
              url: a.getAttribute('href').startsWith('http') ? a.getAttribute('href') : location.origin + a.getAttribute('href')
            });
          }
        });
        return { title, synopsis, cover, episodes, source: 'AniWatch' };
      });
    },
    async getVideoUrl(page, episodeUrl) {
      await goto(page, episodeUrl, true);
      return await page.evaluate(() => {
        const iframe = document.querySelector('iframe[src*="embed"], iframe[src*="stream"], iframe[src*="vid"], .player-embed iframe, #pembed iframe');
        if (iframe) return { videoUrl: iframe.getAttribute('src') || '', server: 'embed' };
        return { videoUrl: '', server: '' };
      });
    }
  },

  animepahe: {
    name: 'AnimePahe',
    baseUrl: 'https://animepahe.pw',
    searchUrl: (q) => 'https://animepahe.pw/api/animepahe/search/' + encodeURIComponent(q),
    async search(page, query) {
      const results = [];
      try {
        const resp = await page.goto(this.searchUrl(query), { waitUntil: 'domcontentloaded', timeout: 10000 });
        const text = await resp.text();
        const json = JSON.parse(text);
        if (json.data) {
          json.data.forEach(item => {
            results.push({
              title: item.title || item.session || '',
              url: 'https://animepahe.pw/api/animepahe/info/' + item.session,
              cover: item.image || '',
              meta: item.type || '',
              source: 'AnimePahe'
            });
          });
        }
      } catch (err) {
        await goto(page, 'https://animepahe.pw/', true);
        const fallback = await page.evaluate((q) => {
          const r = [];
          document.querySelectorAll('.anime-list a, .tab-content a').forEach(a => {
            const title = a.textContent.trim();
            const href = a.getAttribute('href') || '';
            if (title && href) r.push({ title, url: 'https://animepahe.pw' + href });
          });
          return r;
        }, query);
        fallback.forEach(item => {
          results.push({ title: item.title, url: item.url, cover: '', meta: '', source: 'AnimePahe' });
        });
      }
      return results;
    },
    async getAnimeDetails(page, url) {
      let infoUrl = url;
      if (!url.includes('/api/')) {
        const match = url.match(/\/a\/(\d+)/);
        if (match) infoUrl = 'https://animepahe.pw/api/animepahe/info/' + match[1];
      }
      await goto(page, infoUrl, true);
      const text = await page.evaluate(() => document.body.innerText);
      let data;
      try { data = JSON.parse(text); } catch { data = {}; }
      const title = data.title || data.session || document.title.split('-')[0].trim();
      const synopsis = data.description || data.synopsis || '';
      const cover = data.image || data.cover || '';
      const episodes = [];
      if (data.episodes && Array.isArray(data.episodes)) {
        data.episodes.forEach((ep, i) => {
          episodes.push({
            number: ep.number || (i + 1),
            title: ep.title || 'Episode ' + (ep.number || (i + 1)),
            url: 'https://animepahe.pw/api/animepahe/play/' + (ep.session || ep.id || ''),
            thumbnail: ep.snapshot || ''
          });
        });
      } else {
        const epUrl = url.replace('/info/', '/play/');
        await goto(page, epUrl, true);
        const epText = await page.evaluate(() => document.body.innerText);
        let epData;
        try { epData = JSON.parse(epText); } catch { epData = {}; }
        if (epData.data && Array.isArray(epData.data)) {
          epData.data.forEach((ep, i) => {
            episodes.push({
              number: ep.number || (i + 1),
              title: ep.title || 'Episode ' + (ep.number || (i + 1)),
              url: 'https://animepahe.pw/api/animepahe/play/' + (ep.session || ep.id || ''),
              thumbnail: ep.snapshot || ''
            });
          });
        }
      }
      return { title, synopsis, cover, episodes, source: 'AnimePahe' };
    },
    async getVideoUrl(page, episodeUrl) {
      await goto(page, episodeUrl, true);
      const text = await page.evaluate(() => document.body.innerText);
      let data;
      try { data = JSON.parse(text); } catch { data = {}; }
      if (data.data) {
        const sources = data.data;
        if (Array.isArray(sources) && sources.length > 0) {
          const best = sources.find(s => s.quality === '1080p') || sources.find(s => s.quality === '720p') || sources[0];
          if (best && best.url) return { videoUrl: best.url, server: best.label || 'animepahe' };
        }
        if (sources.url) return { videoUrl: sources.url, server: 'animepahe' };
      }
      const iframe = await page.evaluate(() => {
        const f = document.querySelector('iframe');
        return f ? f.getAttribute('src') : null;
      });
      if (iframe) return { videoUrl: iframe, server: 'embed' };
      return { videoUrl: '', server: '' };
    }
  },

  kaa: {
    name: 'KickAssAnime',
    baseUrl: 'https://kaa.lt',
    searchUrl: (q) => 'https://kaa.lt/search?q=' + encodeURIComponent(q),
    async search(page, query) {
      await goto(page, this.searchUrl(query), true);
      return await page.evaluate(() => {
        const results = [];
        const seen = new Set();
        document.querySelectorAll('.search-results a, .anime-card a, .card a, a[href*="/anime/"]').forEach(a => {
          const href = a.getAttribute('href') || '';
          const titleEl = a.querySelector('.title, .name, h3, h2, span') || a;
          let title = titleEl.textContent.trim();
          title = title.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
          const img = a.querySelector('img') || a.closest('.anime-card, .card, div')?.querySelector('img');
          const cover = img ? (img.getAttribute('src') || img.getAttribute('data-src') || '') : '';
          if (title && title.length > 2 && href && !seen.has(href)) {
            seen.add(href);
            results.push({
              title,
              url: href.startsWith('http') ? href : 'https://kaa.lt' + (href.startsWith('/') ? href : '/' + href),
              cover: cover.startsWith('http') ? cover : (cover ? 'https://kaa.lt' + cover : ''),
              meta: '',
              source: 'KickAssAnime'
            });
          }
        });
        return results;
      });
    },
    async getAnimeDetails(page, url) {
      await goto(page, url, true);
      return await page.evaluate(() => {
        const titleEl = document.querySelector('.anime-title, h1, .title');
        let title = titleEl ? titleEl.textContent.trim() : document.title.split('-')[0].trim();
        title = title.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
        const synopsisEl = document.querySelector('.description, .synopsis, .text-body, p');
        const synopsis = synopsisEl ? synopsisEl.textContent.trim() : '';
        const coverEl = document.querySelector('.anime-poster img, .poster img, img');
        const cover = coverEl ? (coverEl.getAttribute('src') || coverEl.getAttribute('data-src') || '') : '';
        const episodes = [];
        document.querySelectorAll('.episode-list a, .ep-list a, a[href*="/watch/"], a[href*="/episode/"]').forEach((a, i) => {
          const href = a.getAttribute('href') || '';
          const numEl = a.querySelector('.ep-num, .number, .episode-number');
          let epNum = i + 1;
          if (numEl) {
            const match = numEl.textContent.match(/(\d+)/);
            if (match) epNum = parseInt(match[1]);
          } else {
            const match = href.match(/(?:ep|episode)[\-_]*(\d+)/i) || href.match(/\/(\d+)/);
            if (match) epNum = parseInt(match[1]);
          }
          episodes.push({
            number: epNum,
            title: a.textContent.trim().replace(/\s+/g, ' ').substring(0, 100) || 'Episode ' + epNum,
            url: href.startsWith('http') ? href : 'https://kaa.lt' + href
          });
        });
        return { title, synopsis, cover, episodes, source: 'KickAssAnime' };
      });
    },
    async getVideoUrl(page, episodeUrl) {
      await goto(page, episodeUrl, true);
      return await page.evaluate(() => {
        const iframe = document.querySelector('iframe[src*="embed"], iframe[src*="stream"], iframe[src*="vidcloud"], iframe[src*="fembed"], iframe');
        if (iframe) return { videoUrl: iframe.getAttribute('src') || '', server: 'embed' };
        const video = document.querySelector('video, video source');
        if (video) return { videoUrl: video.getAttribute('src') || '', server: 'direct' };
        return { videoUrl: '', server: '' };
      });
    }
  },

  gogoanimes: {
    name: 'Gogoanime',
    baseUrl: 'https://gogoanimes.cv',
    searchUrl: (q) => 'https://gogoanimes.cv/?s=' + encodeURIComponent(q),
    async search(page, query) {
      await goto(page, this.searchUrl(query), true);
      return await page.evaluate(() => {
        const results = [];
        const seen = new Set();
        document.querySelectorAll('a[href*="/anime/"]').forEach(a => {
          const href = a.getAttribute('href') || '';
          let title = a.textContent.trim();
          title = title.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
          const img = a.querySelector('img') || a.closest('.anime_name, li, div')?.querySelector('img');
          const cover = img ? (img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || img.getAttribute('src') || '') : '';
          if (title && title.length > 2 && href && !seen.has(href)) {
            seen.add(href);
            results.push({
              title,
              url: href.startsWith('http') ? href : location.origin + (href.startsWith('/') ? href : '/' + href),
              cover: cover.startsWith('http') ? cover : (cover ? location.origin + (cover.startsWith('/') ? cover : '/' + cover) : ''),
              meta: '',
              source: 'Gogoanime'
            });
          }
        });
        return results;
      });
    },
    async getAnimeDetails(page, url) {
      await goto(page, url, true);
      return await page.evaluate(() => {
        const titleEl = document.querySelector('h1, .anime-info h1, .title');
        let title = titleEl ? titleEl.textContent.trim() : document.title.split('-')[0].trim();
        title = title.replace(/\t+/g, ' ').replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
        const synopsisEl = document.querySelector('.description, p.story, .synopsis, .anime-info p');
        const synopsis = synopsisEl ? synopsisEl.textContent.trim() : '';
        const coverEl = document.querySelector('.anime-info img, .img img, .left-side img, img');
        const cover = coverEl ? (coverEl.getAttribute('data-src') || coverEl.getAttribute('src') || '') : '';
        const episodes = [];
        const epUl = Array.from(document.querySelectorAll('ul')).find(ul => ul.querySelectorAll('a[href*="episode"]').length > 10);
        if (epUl) {
          epUl.querySelectorAll('li a[href*="episode"]').forEach((a, i) => {
            const href = a.getAttribute('href') || '';
            const nameEl = a.querySelector('.name');
            let epNum = i + 1;
            let epTitle = 'Episode ' + epNum;
            if (nameEl) {
              const match = nameEl.textContent.match(/(\d+)/);
              if (match) epNum = parseInt(match[1]);
              epTitle = 'Episode ' + epNum;
            }
            episodes.push({ number: epNum, title: epTitle, url: href.startsWith('http') ? href : location.origin + href });
          });
        }
        const rangeButtons = [];
        document.querySelectorAll('a[data-range-start]').forEach(el => {
          rangeButtons.push({
            start: parseInt(el.getAttribute('data-range-start')),
            end: parseInt(el.getAttribute('data-range-end')),
            seri: el.getAttribute('data-seri')
          });
        });
        return { title, synopsis, cover, episodes, rangeButtons, source: 'Gogoanime' };
      });
    },
    async loadAllEpisodes(page, animeUrl, rangeButtons) {
      const allEpisodes = [];
      for (const range of rangeButtons) {
        try {
          await page.goto(animeUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
          await new Promise(r => setTimeout(r, 1000));
          await page.evaluate((start, end, seri) => {
            const btn = document.querySelector('a[data-range-start="' + start + '"]');
            if (btn) btn.click();
          }, range.start, range.end, range.seri);
          await new Promise(r => setTimeout(r, 1000));
          const eps = await page.evaluate((rangeStart, rangeEnd) => {
            const results = [];
            const epUl = Array.from(document.querySelectorAll('ul')).find(ul => ul.querySelectorAll('a[href*="episode"]').length > 10);
            if (epUl) {
              epUl.querySelectorAll('li a[href*="episode"]').forEach((a) => {
                const href = a.getAttribute('href') || '';
                const nameEl = a.querySelector('.name');
                let epNum = 0;
                if (nameEl) {
                  const match = nameEl.textContent.match(/(\d+)/);
                  if (match) epNum = parseInt(match[1]);
                }
                if (epNum && href) {
                  results.push({ number: epNum, title: 'Episode ' + epNum, url: href.startsWith('http') ? href : location.origin + href });
                }
              });
            }
            return results;
          }, range.start, range.end);
          allEpisodes.push(...eps);
        } catch (err) {
          console.error('Failed to load range', range.start, '-', range.end, err.message);
        }
      }
      return allEpisodes.sort((a, b) => a.number - b.number);
    },
    async getVideoUrl(page, episodeUrl) {
      await goto(page, episodeUrl, true);
      return await page.evaluate(() => {
        const iframe = document.querySelector('.player-embed iframe, #pembed iframe, iframe[src*="embed"], iframe[src*="stream"], iframe[src*="gogocdn"]');
        if (iframe) return { videoUrl: iframe.getAttribute('src') || '', server: 'embed' };
        return { videoUrl: '', server: '' };
      });
    }
  },

  mkissa: {
    name: 'MKissa',
    baseUrl: 'https://mkissa.to',
    searchUrl: (q) => 'https://mkissa.to/search/anime?query=' + encodeURIComponent(q),
    async search(page, query) {
      await goto(page, this.searchUrl(query), true);
      await new Promise(r => setTimeout(r, 1000));
      return await page.evaluate(() => {
        const results = [];
        const seen = new Set();
        document.querySelectorAll('article.media-card').forEach(el => {
          const linkEl = el.querySelector('a[href*="/anime/"]');
          const titleEl = el.querySelector('.media-card__title, .media-card__wl-title, h3');
          const img = el.querySelector('img');
          const href = linkEl ? linkEl.getAttribute('href') : '';
          let title = titleEl ? titleEl.textContent.trim() : '';
          title = title.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
          const cover = img ? (img.getAttribute('src') || img.getAttribute('data-src') || '') : '';
          if (title && href && !seen.has(href)) {
            seen.add(href);
            results.push({
              title,
              url: href.startsWith('http') ? href : 'https://mkissa.to' + (href.startsWith('/') ? href : '/' + href),
              cover: cover.startsWith('http') ? cover : (cover ? 'https://mkissa.to' + cover : ''),
              meta: '',
              source: 'MKissa'
            });
          }
        });
        return results;
      });
    },
    async getAnimeDetails(page, url) {
      await goto(page, url, true);
      await new Promise(r => setTimeout(r, 1000));
      return await page.evaluate(() => {
        const titleEl = document.querySelector('.entry-title, h1, .anime-title');
        let title = titleEl ? titleEl.textContent.trim() : document.title.split('-')[0].trim();
        title = title.replace(/\t+/g, ' ').replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
        const synopsisEl = document.querySelector('.description, .synopsis, .entry-content, p');
        const synopsis = synopsisEl ? synopsisEl.textContent.trim() : '';
        const coverEl = document.querySelector('.poster img, .anime-cover img, img');
        const cover = coverEl ? (coverEl.getAttribute('src') || coverEl.getAttribute('data-src') || '') : '';
        const episodes = [];
        document.querySelectorAll('a[href*="/anime/"]').forEach((a, i) => {
          const href = a.getAttribute('href') || '';
          const epMatch = href.match(/p-(\d+)/);
          if (epMatch) {
            const epNum = parseInt(epMatch[1]);
            episodes.push({
              number: epNum,
              title: 'Episode ' + epNum,
              url: href.startsWith('http') ? href : 'https://mkissa.to' + href
            });
          }
        });
        return { title, synopsis, cover, episodes, source: 'MKissa' };
      });
    },
    async getVideoUrl(page, episodeUrl) {
      await goto(page, episodeUrl, true);
      await new Promise(r => setTimeout(r, 1000));
      return await page.evaluate(() => {
        const iframe = document.querySelector('iframe.episode-player__iframe, iframe#episode-frame, iframe[src*="embed"], iframe');
        if (iframe) {
          const src = iframe.getAttribute('src') || '';
          if (src && src.startsWith('http')) return { videoUrl: src, server: 'embed' };
        }
        return { videoUrl: '', server: '' };
      });
    }
  },

  reanime: {
    name: 'ReAnime',
    baseUrl: 'https://reanime.to',
    searchUrl: (q) => 'https://reanime.to/search?q=' + encodeURIComponent(q),
    async search(page, query) {
      await goto(page, this.searchUrl(query), true);
      await new Promise(r => setTimeout(r, 2000));
      return await page.evaluate(() => {
        const results = [];
        const seen = new Set();
        document.querySelectorAll('a[href*="/anime/"]').forEach(a => {
          const href = a.getAttribute('href') || '';
          let title = '';
          const divs = a.querySelectorAll('div');
          for (const div of divs) {
            const cls = div.getAttribute('class') || '';
            if (cls.includes('px-0') && div.textContent.trim().length > 3) {
              title = div.textContent.trim().split('\n')[0].trim();
              break;
            }
          }
          if (!title) {
            const h3 = a.querySelector('h3');
            if (h3) title = h3.textContent.trim();
          }
          if (!title) {
            title = a.textContent.trim().split('\n')[0].trim();
          }
          title = title.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
          const img = a.querySelector('img');
          const cover = img ? (img.getAttribute('src') || img.getAttribute('data-src') || '') : '';
          if (title && title.length > 2 && href && href.includes('/anime/') && !seen.has(href)) {
            seen.add(href);
            results.push({
              title,
              url: href.startsWith('http') ? href : 'https://reanime.to' + (href.startsWith('/') ? href : '/' + href),
              cover: cover.startsWith('http') ? cover : (cover ? 'https://reanime.to' + cover : ''),
              meta: '',
              source: 'ReAnime'
            });
          }
        });
        return results;
      });
    },
    async getAnimeDetails(page, url) {
      await goto(page, url, true);
      await new Promise(r => setTimeout(r, 1000));
      return await page.evaluate(() => {
        const titleEl = document.querySelector('h1, .anime-title, .title');
        let title = titleEl ? titleEl.textContent.trim() : document.title.split('-')[0].trim();
        title = title.replace(/\t+/g, ' ').replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
        const synopsisEl = document.querySelector('.description, .synopsis, p');
        const synopsis = synopsisEl ? synopsisEl.textContent.trim() : '';
        const coverEl = document.querySelector('.poster img, .anime-cover img, img');
        const cover = coverEl ? (coverEl.getAttribute('src') || coverEl.getAttribute('data-src') || '') : '';
        const episodes = [];
        document.querySelectorAll('a[href*="/watch/"]').forEach((a, i) => {
          const href = a.getAttribute('href') || '';
          const epMatch = href.match(/ep=(\d+)/);
          if (epMatch) {
            episodes.push({
              number: parseInt(epMatch[1]),
              title: 'Episode ' + epMatch[1],
              url: href.startsWith('http') ? href : 'https://reanime.to' + href
            });
          }
        });
        return { title, synopsis, cover, episodes, source: 'ReAnime' };
      });
    },
    async getVideoUrl(page, episodeUrl) {
      await goto(page, episodeUrl, true);
      await new Promise(r => setTimeout(r, 1000));
      return await page.evaluate(() => {
        const iframe = document.querySelector('iframe[src*="embed"], iframe[src*="stream"], iframe');
        if (iframe) {
          const src = iframe.getAttribute('src') || '';
          if (src && src.startsWith('http')) return { videoUrl: src, server: 'embed' };
        }
        const video = document.querySelector('video, video source');
        if (video) return { videoUrl: video.getAttribute('src') || '', server: 'direct' };
        return { videoUrl: '', server: '' };
      });
    }
  },

  anidb: {
    name: 'AniDB',
    baseUrl: 'https://anidb.app',
    searchUrl: (q) => 'https://anidb.app/browse?q=' + encodeURIComponent(q),
    async search(page, query) {
      await goto(page, this.searchUrl(query), true);
      return await page.evaluate(() => {
        const results = [];
        const seen = new Set();
        document.querySelectorAll('a.anime-card').forEach(el => {
          const href = el.getAttribute('href') || '';
          const titleEl = el.querySelector('.card-overlay p, p');
          const img = el.querySelector('img');
          let title = titleEl ? titleEl.textContent.trim() : el.getAttribute('title') || '';
          title = title.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
          const cover = img ? (img.getAttribute('src') || img.getAttribute('data-src') || '') : '';
          if (title && href && !seen.has(href)) {
            seen.add(href);
            results.push({
              title,
              url: href.startsWith('http') ? href : 'https://anidb.app' + (href.startsWith('/') ? href : '/' + href),
              cover: cover.startsWith('http') ? cover : (cover ? 'https://anidb.app' + cover : ''),
              meta: '',
              source: 'AniDB'
            });
          }
        });
        return results;
      });
    },
    async getAnimeDetails(page, url) {
      await goto(page, url, true);
      await new Promise(r => setTimeout(r, 1000));
      return await page.evaluate(() => {
        const titleEl = document.querySelector('h1, .anime-title, h2');
        let title = titleEl ? titleEl.textContent.trim() : document.title.split('-')[0].trim();
        title = title.replace(/\t+/g, ' ').replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
        const synopsisEl = document.querySelector('.description, .synopsis, p');
        const synopsis = synopsisEl ? synopsisEl.textContent.trim() : '';
        const coverEl = document.querySelector('.poster img, .anime-cover img, img');
        const cover = coverEl ? (coverEl.getAttribute('src') || coverEl.getAttribute('data-src') || '') : '';
        const episodes = [];
        document.querySelectorAll('.episode-grid button[data-epid]').forEach((btn, i) => {
          const epId = btn.getAttribute('data-epid') || '';
          const label = btn.textContent.trim();
          const numMatch = label.match(/(\d+)/);
          const epNum = numMatch ? parseInt(numMatch[1]) : (i + 1);
          episodes.push({
            number: epNum,
            title: label || 'Episode ' + epNum,
            url: url.split('#')[0] + '?ep=' + epId,
            epId: epId
          });
        });
        return { title, synopsis, cover, episodes, source: 'AniDB' };
      });
    },
    async getVideoUrl(page, episodeUrl) {
      await goto(page, episodeUrl, true);
      await new Promise(r => setTimeout(r, 1000));
      return await page.evaluate(() => {
        const iframe = document.querySelector('#player iframe, iframe[src*="embed"], iframe');
        if (iframe) {
          const src = iframe.getAttribute('src') || '';
          if (src && src.startsWith('http')) return { videoUrl: src, server: 'embed' };
        }
        return { videoUrl: '', server: '' };
      });
    }
  },

  anizone: {
    name: 'AniZone',
    baseUrl: 'https://anizone.to',
    searchUrl: (q) => 'https://anizone.to/anime?search=' + encodeURIComponent(q),
    async search(page, query) {
      await goto(page, this.searchUrl(query), true);
      await new Promise(r => setTimeout(r, 1000));
      return await page.evaluate(() => {
        const results = [];
        const seen = new Set();
        document.querySelectorAll('a[href*="/anime/"]').forEach(a => {
          const href = a.getAttribute('href') || '';
          let title = '';
          const titleEl = a.querySelector('span[x-text], h3, .title, span');
          if (titleEl) title = titleEl.textContent.trim();
          else title = a.textContent.trim();
          title = title.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
          const img = a.querySelector('img') || a.closest('.swiper-slide, div')?.querySelector('img');
          const cover = img ? (img.getAttribute('src') || img.getAttribute('data-src') || '') : '';
          if (title && title.length > 2 && href && href.includes('/anime/') && !seen.has(href)) {
            seen.add(href);
            results.push({
              title,
              url: href.startsWith('http') ? href : 'https://anizone.to' + (href.startsWith('/') ? href : '/' + href),
              cover: cover.startsWith('http') ? cover : (cover ? 'https://anizone.to' + cover : ''),
              meta: '',
              source: 'AniZone'
            });
          }
        });
        return results;
      });
    },
    async getAnimeDetails(page, url) {
      await goto(page, url, true);
      await new Promise(r => setTimeout(r, 1000));
      return await page.evaluate(() => {
        const titleEl = document.querySelector('h1[x-text], h1');
        let title = titleEl ? titleEl.textContent.trim() : document.title.split('-')[0].trim();
        title = title.replace(/\t+/g, ' ').replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
        const synopsisEl = document.querySelector('.text-slate-100, .description, p');
        const synopsis = synopsisEl ? synopsisEl.textContent.trim() : '';
        const coverEl = document.querySelector('img[src*="/images/anime/"]');
        const cover = coverEl ? (coverEl.getAttribute('src') || '') : '';
        const episodes = [];
        document.querySelectorAll('a[href*="/anime/"]').forEach((a, i) => {
          const href = a.getAttribute('href') || '';
          const epMatch = href.match(/\/anime\/[^/]+\/(\d+)/);
          if (epMatch) {
            const epNum = parseInt(epMatch[1]);
            episodes.push({
              number: epNum,
              title: 'Episode ' + epNum,
              url: href.startsWith('http') ? href : 'https://anizone.to' + href
            });
          }
        });
        return { title, synopsis, cover, episodes, source: 'AniZone' };
      });
    },
    async getVideoUrl(page, episodeUrl) {
      await goto(page, episodeUrl, true);
      await new Promise(r => setTimeout(r, 1000));
      return await page.evaluate(() => {
        const player = document.querySelector('media-player[src]');
        if (player) {
          const src = player.getAttribute('src') || '';
          if (src && src.startsWith('http')) return { videoUrl: src, server: 'hls' };
        }
        const iframe = document.querySelector('iframe');
        if (iframe) {
          const src = iframe.getAttribute('src') || '';
          if (src && src.startsWith('http')) return { videoUrl: src, server: 'embed' };
        }
        return { videoUrl: '', server: '' };
      });
    }
  },

  anineko: {
    name: 'AniNeko',
    baseUrl: 'https://anineko.to',
    searchUrl: (q) => 'https://anineko.to/browser?keyword=' + encodeURIComponent(q),
    async search(page, query) {
      await goto(page, this.searchUrl(query), true);
      return await page.evaluate(() => {
        const results = [];
        const seen = new Set();
        document.querySelectorAll('article.nv-anime-card').forEach(el => {
          const linkEl = el.querySelector('a.nv-anime-thumb[href]');
          const titleEl = el.querySelector('.nv-anime-title a, .nv-anime-title');
          const img = el.querySelector('img');
          const href = linkEl ? linkEl.getAttribute('href') : '';
          let title = titleEl ? titleEl.textContent.trim() : '';
          title = title.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
          const cover = img ? (img.getAttribute('src') || img.getAttribute('data-src') || '') : '';
          if (title && href && !seen.has(href)) {
            seen.add(href);
            results.push({
              title,
              url: href.startsWith('http') ? href : 'https://anineko.to' + (href.startsWith('/') ? href : '/' + href),
              cover: cover.startsWith('http') ? cover : (cover ? 'https://anineko.to' + cover : ''),
              meta: '',
              source: 'AniNeko'
            });
          }
        });
        return results;
      });
    },
    async getAnimeDetails(page, url) {
      await goto(page, url, true);
      return await page.evaluate(() => {
        const titleEl = document.querySelector('.nv-watch-info h1, h1, .nv-title-row h1');
        let title = titleEl ? titleEl.textContent.trim() : document.title.split('-')[0].trim();
        title = title.replace(/\t+/g, ' ').replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
        const synopsisEl = document.querySelector('.description, .synopsis, p');
        const synopsis = synopsisEl ? synopsisEl.textContent.trim() : '';
        const coverEl = document.querySelector('.nv-anime-thumb img, .poster img, img');
        const cover = coverEl ? (coverEl.getAttribute('src') || coverEl.getAttribute('data-src') || '') : '';
        const episodes = [];
        document.querySelectorAll('.nv-info-episode-item a.nv-info-episode-main, a[href*="/ep-"]').forEach((a, i) => {
          const href = a.getAttribute('href') || '';
          const epMatch = href.match(/ep-(\d+)/);
          let epNum = i + 1;
          if (epMatch) epNum = parseInt(epMatch[1]);
          const strong = a.querySelector('strong');
          if (strong) {
            const m = strong.textContent.match(/(\d+)/);
            if (m) epNum = parseInt(m[1]);
          }
          episodes.push({
            number: epNum,
            title: a.textContent.trim().replace(/\s+/g, ' ').substring(0, 100) || 'Episode ' + epNum,
            url: href.startsWith('http') ? href : 'https://anineko.to' + href
          });
        });
        return { title, synopsis, cover, episodes, source: 'AniNeko' };
      });
    },
    async getVideoUrl(page, episodeUrl) {
      await goto(page, episodeUrl, true);
      return await page.evaluate(() => {
        const serverBtn = document.querySelector('button.nv-server-btn.server-video[data-video]');
        if (serverBtn) {
          const videoUrl = serverBtn.getAttribute('data-video') || '';
          if (videoUrl && videoUrl.startsWith('http')) return { videoUrl, server: 'embed' };
        }
        const iframe = document.querySelector('.nv-player-wrap iframe');
        if (iframe) {
          const src = iframe.getAttribute('src') || '';
          if (src && src.startsWith('http')) return { videoUrl: src, server: 'embed' };
        }
        return { videoUrl: '', server: '' };
      });
    }
  },

  senshi: {
    name: 'SenshiLive',
    baseUrl: 'https://senshi.live',
    searchUrl: (q) => 'https://senshi.live/browse?search=' + encodeURIComponent(q),
    async search(page, query) {
      const results = [];
      try {
        await goto(page, 'https://senshi.live/', true);
        const data = await page.evaluate(async (q) => {
          try {
            const resp = await fetch('/anime/filter', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ searchTerm: q, page: 1, limit: 20 })
            });
            return await resp.json();
          } catch { return []; }
        }, query);
        const items = Array.isArray(data) ? data : (data.data || []);
        if (Array.isArray(items)) {
          items.forEach(item => {
            const title = item.title_english || item.title || '';
            results.push({
              title,
              url: 'https://senshi.live/watch/' + (item.public_id || item.id),
              cover: item.anime_picture ? 'https://senshi.live' + item.anime_picture : '',
              meta: [item.type, item.ani_episodes ? item.ani_episodes + ' eps' : '', item.ani_year || ''].filter(Boolean).join(' · '),
              source: 'SenshiLive'
            });
          });
        }
      } catch (err) {
        await goto(page, this.searchUrl(query), true);
        const fallback = await page.evaluate(() => {
          const r = [];
          document.querySelectorAll('a[href*="/watch/"]').forEach(a => {
            const title = a.querySelector('h3')?.textContent?.trim() || a.textContent.trim();
            const href = a.getAttribute('href') || '';
            const img = a.querySelector('img');
            const cover = img ? img.getAttribute('src') || '' : '';
            if (title && href) r.push({ title, url: href, cover });
          });
          return r;
        });
        fallback.forEach(item => {
          results.push({
            title: item.title,
            url: item.url.startsWith('http') ? item.url : 'https://senshi.live' + item.url,
            cover: item.cover.startsWith('http') ? item.cover : (item.cover ? 'https://senshi.live' + item.cover : ''),
            meta: '',
            source: 'SenshiLive'
          });
        });
      }
      return results;
    },
    async getAnimeDetails(page, url) {
      const publicId = url.split('/watch/')[1];
      if (!publicId) {
        await goto(page, url, true);
        await new Promise(r => setTimeout(r, 1000));
        return await page.evaluate(() => {
          const titleEl = document.querySelector('h1, .title');
          let title = titleEl ? titleEl.textContent.trim() : document.title.split('-')[0].trim();
          return { title, synopsis: '', cover: '', episodes: [], source: 'SenshiLive' };
        });
      }
      await goto(page, 'https://senshi.live/', true);
      const data = await page.evaluate(async (pid) => {
        try {
          const animeResp = await fetch('/anime/' + pid);
          const anime = await animeResp.json();
          if (!anime || !anime.id) return null;
          const epResp = await fetch('/episodes/' + anime.id);
          const eps = await epResp.json();
          return {
            title: anime.title_english || anime.title || '',
            synopsis: anime.ani_description || '',
            cover: anime.anime_picture ? 'https://senshi.live' + anime.anime_picture : '',
            episodes: (Array.isArray(eps) ? eps : []).map(ep => ({
              number: ep.ep_id || 0,
              title: ep.ep_title || 'Episode ' + ep.ep_id,
              url: 'https://senshi.live/watch/' + pid + '?ep=' + ep.ep_id,
              epId: String(ep.ep_id)
            }))
          };
        } catch { return null; }
      }, publicId);
      if (!data) return { title: 'Unknown', synopsis: '', cover: '', episodes: [], source: 'SenshiLive' };
      return { ...data, source: 'SenshiLive' };
    },
    async getVideoUrl(page, episodeUrl) {
      const publicId = episodeUrl.split('/watch/')[1]?.split('?')[0];
      const epMatch = episodeUrl.match(/ep=(\d+)/);
      const epId = epMatch ? epMatch[1] : null;
      if (!publicId || !epId) return { videoUrl: '', server: '' };
      await goto(page, 'https://senshi.live/', true);
      const data = await page.evaluate(async (pid, eid) => {
        try {
          const animeResp = await fetch('/anime/' + pid);
          const anime = await animeResp.json();
          if (!anime || !anime.id) return null;
          const embedResp = await fetch('/episode-embeds/' + anime.id + '/' + eid);
          const embed = await embedResp.json();
          const item = Array.isArray(embed) ? embed[0] : embed;
          if (item && item.url) return { videoUrl: item.url, server: 'hls' };
          if (item && item.serverFM) return { videoUrl: item.serverFM, server: 'filemoon' };
          if (item && item.server2) return { videoUrl: item.server2, server: 'server2' };
          return null;
        } catch { return null; }
      }, publicId, epId);
      if (data) return data;
      return { videoUrl: '', server: '' };
    }
  },

  aninexus: {
    name: 'AnimeNexus',
    baseUrl: 'https://anime.nexus',
    searchUrl: (q) => 'https://anime.nexus/series?search=' + encodeURIComponent(q),
    async search(page, query) {
      const results = [];
      try {
        const response = await page.goto('https://api.anime.nexus/api/anime/shows?search=' + encodeURIComponent(query), {
          waitUntil: 'domcontentloaded',
          timeout: 15000
        });
        const text = await response.text();
        let data;
        try { data = JSON.parse(text); } catch { data = { data: [] }; }
        const shows = data.data || [];
        shows.forEach(item => {
          const title = item.title || item.name || '';
          const slug = item.slug || item.name || '';
          const id = item.id || '';
          results.push({
            title,
            url: 'https://anime.nexus/series/' + id + '/' + slug,
            cover: item.cover || item.poster || '',
            meta: [item.type, item.episodes ? item.episodes + ' eps' : '', item.year || ''].filter(Boolean).join(' · '),
            source: 'AnimeNexus'
          });
        });
      } catch (err) {
        await goto(page, this.searchUrl(query), true);
        const fallback = await page.evaluate(() => {
          const r = [];
          document.querySelectorAll('[data-slot="card"], a[href*="/series/"]').forEach(el => {
            const a = el.tagName === 'A' ? el : el.querySelector('a[href*="/series/"]');
            if (!a) return;
            const href = a.getAttribute('href') || '';
            const title = a.querySelector('h3, [data-slot="card-title"]')?.textContent?.trim() || a.textContent.trim();
            const img = a.querySelector('img');
            const cover = img ? img.getAttribute('src') || '' : '';
            if (title && href) r.push({ title, url: href, cover });
          });
          return r;
        });
        fallback.forEach(item => {
          results.push({
            title: item.title,
            url: item.url.startsWith('http') ? item.url : 'https://anime.nexus' + item.url,
            cover: item.cover,
            meta: '',
            source: 'AnimeNexus'
          });
        });
      }
      return results;
    },
    async getAnimeDetails(page, url) {
      await goto(page, url, true);
      await new Promise(r => setTimeout(r, 1000));
      return await page.evaluate(() => {
        const titleEl = document.querySelector('h1, [data-slot="card-title"]');
        let title = titleEl ? titleEl.textContent.trim() : document.title.split('-')[0].trim();
        title = title.replace(/\t+/g, ' ').replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
        const synopsisEl = document.querySelector('[data-slot="card-description"], .description, p');
        const synopsis = synopsisEl ? synopsisEl.textContent.trim() : '';
        const coverEl = document.querySelector('img[src*="poster"], img[src*="cover"], img');
        const cover = coverEl ? (coverEl.getAttribute('src') || '') : '';
        const episodes = [];
        document.querySelectorAll('a[href*="?ep="]').forEach((a, i) => {
          const href = a.getAttribute('href') || '';
          const epMatch = href.match(/ep=([^&]+)/);
          const label = a.querySelector('h3, span')?.textContent?.trim() || '';
          let epNum = i + 1;
          const numMatch = label.match(/(\d+)/);
          if (numMatch) epNum = parseInt(numMatch[1]);
          episodes.push({
            number: epNum,
            title: label || 'Episode ' + epNum,
            url: href.startsWith('http') ? href : 'https://anime.nexus' + href,
            epId: epMatch ? epMatch[1] : ''
          });
        });
        return { title, synopsis, cover, episodes, source: 'AnimeNexus' };
      });
    },
    async getVideoUrl(page, episodeUrl) {
      await goto(page, episodeUrl, true);
      await new Promise(r => setTimeout(r, 1000));
      return await page.evaluate(() => {
        const video = document.querySelector('.videojs-player video, video');
        if (video) {
          const src = video.getAttribute('src') || video.querySelector('source')?.getAttribute('src') || '';
          if (src) return { videoUrl: src, server: 'direct' };
        }
        const iframe = document.querySelector('iframe');
        if (iframe) {
          const src = iframe.getAttribute('src') || '';
          if (src && src.startsWith('http')) return { videoUrl: src, server: 'embed' };
        }
        return { videoUrl: '', server: '' };
      });
    }
  }
};

const BUILTIN_SOURCES = Object.keys(SITE_SCRAPERS).map(key => ({
  id: key,
  name: SITE_SCRAPERS[key].name,
  baseUrl: SITE_SCRAPERS[key].baseUrl,
  enabled: true,
  type: 'scraper'
}));

class ScraperEngine {
  constructor() {
    this.pagePool = [];
    this.maxPages = 10;
  }

  async getPage() {
    const browser = await getBrowser();
    if (this.pagePool.length > 0) {
      const page = this.pagePool.pop();
      try { await page.goto('about:blank', { timeout: 3000 }); } catch {}
      return page;
    }
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 720 });
    return page;
  }

  releasePage(page) {
    if (this.pagePool.length < this.maxPages) {
      this.pagePool.push(page);
    } else {
      page.close().catch(() => {});
    }
  }

  getBuiltinSources() { return BUILTIN_SOURCES; }

  async searchBuiltin(query, enabledSources) {
    const sources = Object.entries(SITE_SCRAPERS).filter(([key]) => {
      return !enabledSources || enabledSources.includes(key);
    });

    const CONCURRENCY = 8;
    const allResults = [];
    const chunks = [];
    for (let i = 0; i < sources.length; i += CONCURRENCY) {
      chunks.push(sources.slice(i, i + CONCURRENCY));
    }

    for (const chunk of chunks) {
      const promises = chunk.map(async ([key, scraperInst]) => {
        const page = await this.getPage();
        try {
          const results = await scraperInst.search(page, query);
          results.forEach(r => { r.sourceId = key; });
          return results;
        } catch (err) {
          console.error('Search failed for', key + ':', err.message);
          return [];
        } finally {
          this.releasePage(page);
        }
      });
      const chunkResults = await Promise.all(promises);
      chunkResults.forEach(r => allResults.push(...r));
    }

    return allResults;
  }

  async searchSource(sourceId, query) {
    const scraper = SITE_SCRAPERS[sourceId];
    if (!scraper) throw new Error('Source not found: ' + sourceId);
    const page = await this.getPage();
    try {
      const results = await scraper.search(page, query);
      results.forEach(r => { r.sourceId = sourceId; });
      return results;
    } finally {
      this.releasePage(page);
    }
  }

  async getAnimeDetails(sourceId, url) {
    const scraper = SITE_SCRAPERS[sourceId];
    if (!scraper) throw new Error('Source not found: ' + sourceId);
    const page = await this.getPage();
    try {
      const details = await scraper.getAnimeDetails(page, url);
      if (details.rangeButtons && details.rangeButtons.length > 0 && scraper.loadAllEpisodes) {
        const moreEps = await scraper.loadAllEpisodes(page, url, details.rangeButtons);
        if (moreEps.length > details.episodes.length) {
          details.episodes = moreEps;
        }
      }
      return details;
    } finally {
      this.releasePage(page);
    }
  }

  async getVideoUrl(sourceId, episodeUrl) {
    const scraper = SITE_SCRAPERS[sourceId];
    if (!scraper) throw new Error('Source not found: ' + sourceId);
    const page = await this.getPage();
    try {
      return await scraper.getVideoUrl(page, episodeUrl);
    } finally {
      this.releasePage(page);
    }
  }

  async checkVideoAvailability(sourceId, episodeUrl) {
    try {
      const result = await this.getVideoUrl(sourceId, episodeUrl);
      return !!(result && result.videoUrl);
    } catch {
      return false;
    }
  }

  async searchExtension(extension, query) {
    const page = await this.getPage();
    try {
      const base = extension.base_url.replace(/\/+$/, '');
      const searchPath = (extension.search_url || '/?s={query}').replace('{query}', encodeURIComponent(query));
      const url = base + searchPath;
      await goto(page, url, true);
      const selectors = typeof extension.selectors === 'string' ? JSON.parse(extension.selectors) : extension.selectors;
      return await page.evaluate((sels, baseOrigin) => {
        const results = [];
        document.querySelectorAll(sels.searchList || '.item').forEach(el => {
          const titleEl = sels.searchTitle ? el.querySelector(sels.searchTitle) : el.querySelector('a');
          const linkEl = sels.searchLink ? el.querySelector(sels.searchLink) : el.querySelector('a');
          const coverEl = sels.searchCover ? el.querySelector(sels.searchCover) : el.querySelector('img');
          const metaEl = sels.searchMeta ? el.querySelector(sels.searchMeta) : null;
          const title = titleEl ? titleEl.textContent.trim() : '';
          const href = linkEl ? linkEl.getAttribute('href') : '';
          const cover = coverEl ? (coverEl.getAttribute('data-src') || coverEl.getAttribute('src') || '') : '';
          const meta = metaEl ? metaEl.textContent.trim() : '';
          if (title && href) {
            results.push({
              title,
              url: href.startsWith('http') ? href : baseOrigin + (href.startsWith('/') ? href : '/' + href),
              cover: cover.startsWith('http') ? cover : (cover ? baseOrigin + (cover.startsWith('/') ? cover : '/' + cover) : ''),
              meta,
              source: extension.name
            });
          }
        });
        return results;
      }, selectors, base);
    } finally {
      this.releasePage(page);
    }
  }

  async close() {
    for (const p of this.pagePool) { try { await p.close(); } catch {} }
    this.pagePool = [];
    await closeBrowser();
  }
}

module.exports = new ScraperEngine();
module.exports.getBrowser = getBrowser;
module.exports.SITE_SCRAPERS = SITE_SCRAPERS;
module.exports.BUILTIN_SOURCES = BUILTIN_SOURCES;
