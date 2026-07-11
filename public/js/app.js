let currentAnimeId = null;
let currentEpisodeIndex = 0;
let currentEpisodes = [];
let currentAnime = null;
let playerAnimeId = null;
let playerEpisodes = [];

document.addEventListener('DOMContentLoaded', () => {
  initGlassSidebar();
  initNavigation();
  loadLibrary();
  loadSettings();
  loadBackups();
});

function initGlassSidebar() {
  const sidebar = document.getElementById('sidebar');
  const isWebkit = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
  const isFirefox = /Firefox/.test(navigator.userAgent);

  if (isWebkit || isFirefox) {
    sidebar.classList.add('glass-sidebar--fallback');
    return;
  }

  const div = document.createElement('div');
  div.style.backdropFilter = 'url(#sidebar-glass-filter)';
  const supportsFilter = div.style.backdropFilter !== '';

  if (!supportsFilter) {
    sidebar.classList.add('glass-sidebar--fallback');
    return;
  }

  function updateMap() {
    const rect = sidebar.getBoundingClientRect();
    const w = rect.width || 240;
    const h = rect.height || window.innerHeight;
    const edge = Math.min(w, h) * 0.035;

    const svg = `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="sr-grad" x1="100%" y1="0%" x2="0%" y2="0%">
          <stop offset="0%" stop-color="#0000"/>
          <stop offset="100%" stop-color="red"/>
        </linearGradient>
        <linearGradient id="sb-grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#0000"/>
          <stop offset="100%" stop-color="blue"/>
        </linearGradient>
      </defs>
      <rect width="${w}" height="${h}" fill="black"/>
      <rect width="${w}" height="${h}" rx="0" fill="url(#sr-grad)"/>
      <rect width="${w}" height="${h}" rx="0" fill="url(#sb-grad)" style="mix-blend-mode:difference"/>
      <rect x="${edge}" y="${edge}" width="${w - edge*2}" height="${h - edge*2}" rx="0" fill="hsl(0 0% 50% / 0.93)" style="filter:blur(11px)"/>
    </svg>`;

    const img = document.getElementById('sidebar-fe-image');
    if (img) img.setAttribute('href', 'data:image/svg+xml,' + encodeURIComponent(svg));

    const red = document.getElementById('sidebar-red-ch');
    const green = document.getElementById('sidebar-green-ch');
    const blue = document.getElementById('sidebar-blue-ch');
    if (red) { red.setAttribute('scale', '-180'); red.setAttribute('xChannelSelector', 'R'); red.setAttribute('yChannelSelector', 'G'); }
    if (green) { green.setAttribute('scale', '-170'); green.setAttribute('xChannelSelector', 'R'); green.setAttribute('yChannelSelector', 'G'); }
    if (blue) { blue.setAttribute('scale', '-160'); blue.setAttribute('xChannelSelector', 'R'); blue.setAttribute('yChannelSelector', 'G'); }
  }

  updateMap();
  window.addEventListener('resize', () => setTimeout(updateMap, 0));

  const mainContent = document.getElementById('main-content');
  if (mainContent) {
    let ticking = false;
    mainContent.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const scrollY = mainContent.scrollTop;
          const maxScroll = 300;
          const ratio = Math.min(scrollY / maxScroll, 1);
          const blurAmt = 11 + ratio * 6;
          const satAmt = 1.2 + ratio * 0.4;
          const brightAmt = 1 + ratio * 0.08;
          const borderAlpha = 0.08 + ratio * 0.1;
          const shadowAlpha = 0.2 + ratio * 0.15;
          sidebar.style.backdropFilter = `url(#sidebar-glass-filter) saturate(${satAmt}) brightness(${brightAmt})`;
          sidebar.style.webkitBackdropFilter = sidebar.style.backdropFilter;
          sidebar.style.borderRightColor = `rgba(255,255,255,${borderAlpha})`;
          sidebar.style.boxShadow = `inset 0 0 ${80 + ratio * 40}px rgba(255,255,255,${0.03 + ratio * 0.02}), inset 0 1px 0 0 rgba(255,255,255,${0.06 + ratio * 0.04}), 4px 0 ${24 + ratio * 12}px rgba(0,0,0,${shadowAlpha})`;
          const fallback = sidebar.querySelector('.glass-sidebar--fallback');
          if (sidebar.classList.contains('glass-sidebar--fallback')) {
            sidebar.style.backdropFilter = `blur(${blurAmt}px) saturate(${satAmt}) brightness(${brightAmt})`;
            sidebar.style.webkitBackdropFilter = sidebar.style.backdropFilter;
          }
          ticking = false;
        });
        ticking = true;
      }
    });
  }
}

function initNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const page = item.dataset.page;
      showPage(page);
    });
  });

  document.getElementById('library-search').addEventListener('input', debounce(loadLibrary, 300));
  document.getElementById('library-sort').addEventListener('change', loadLibrary);
  document.getElementById('library-filter').addEventListener('change', loadLibrary);
}

function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById(`page-${page}`);
  if (el) el.classList.add('active');

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const nav = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (nav) nav.classList.add('active');

  if (page === 'library') loadLibrary();
  if (page === 'extensions') loadExtensions();
  if (page === 'tracking') loadTracking();
  if (page === 'updates') loadUpdates();
  if (page === 'browse') loadBrowseFilters();
}

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

async function loadLibrary() {
  const grid = document.getElementById('library-grid');
  grid.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📚</div><p>Loading...</p></div>';

  try {
    const params = {};
    const search = document.getElementById('library-search').value;
    const sort = document.getElementById('library-sort').value;
    const filter = document.getElementById('library-filter').value;

    if (search) params.search = search;
    if (sort) params.sort = sort;
    if (filter) params.status = filter;

    const animeList = await API.library.list(params);
    renderLibrary(animeList);
  } catch (err) {
    grid.innerHTML = `<div class="empty-state"><p>Error loading library: ${err.message}</p></div>`;
  }
}

function renderLibrary(animeList) {
  const grid = document.getElementById('library-grid');
  if (!animeList || animeList.length === 0) {
    grid.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📚</div><h3>Your library is empty</h3><p>Add anime to get started!</p></div>';
    return;
  }

  grid.innerHTML = animeList.map(a => {
    const total = a.episode_count || 0;
    const watched = a.watched_count || 0;
    const progress = total > 0 ? Math.round((watched / total) * 100) : 0;
    const statusBadge = a.status === 'Currently Airing' ? 'Airing' : a.status === 'Finished' ? 'Finished' : '';

    return `
      <div class="anime-card" onclick="showAnimeDetail(${a.id})">
        <div class="anime-card-cover">
          ${a.cover_url ? `<img class="anime-card-cover" src="${a.cover_url}" alt="${a.title}" onerror="this.parentElement.textContent='🎬'">` : '🎬'}
        </div>
        ${statusBadge ? `<div class="anime-card-badge">${statusBadge}</div>` : ''}
        <div class="anime-card-info">
          <div class="anime-card-title">${a.title}</div>
          <div class="anime-card-meta">
            <span>${a.episode_count || 0} eps</span>
            <span>${watchedCount(a)} watched</span>
          </div>
        </div>
        ${total > 0 ? `<div class="anime-card-progress"><div class="anime-card-progress-fill" style="width:${Math.round((a.watched_count||0)/(a.episode_count||1)*100)}%"></div></div>` : ''}
      </div>
    `;
  }).join('');
}

function watchedCount(a) {
  const w = a.watched_count || 0;
  const t = a.episode_count || 0;
  return t > 0 ? `${w}/${t}` : '0';
}

async function showAnimeDetail(id) {
  currentAnimeId = id;
  try {
    const anime = await API.library.get(id);
    const episodes = await API.episodes.list(id);
    const tracking = await API.tracking.get(id);
    currentAnime = anime;
    currentEpisodes = episodes;

    const content = document.getElementById('anime-detail-content');
    const genres = anime.genres || [];
    const categories = anime.categories || [];

    const coverHtml = anime.cover_url
      ? '<img class="anime-detail-cover" src="' + anime.cover_url + '" alt="' + anime.title + '" onerror="this.style.display=\'none\';this.parentElement.textContent=\'🎬\'">'
      : '🎬';
    const ratingHtml = anime.rating ? '<span>★ ' + anime.rating + '</span>' : '';
    const genresHtml = genres.map(function(g) { return '<span>' + g + '</span>'; }).join('');

    const episodesHtml = episodes.map(function(ep) {
      var status = ep.completed ? 'watched' : (ep.progress > 0 ? 'in-progress' : '');
      var hasVideo = (ep.video_urls && ep.video_urls.length > 0) || ep.url;
      var playBtn = hasVideo
        ? '<button class="btn btn-sm" onclick="event.stopPropagation();playEpisode(' + anime.id + ',' + ep.id + ')">▶</button>'
        : '';
      var vidUrl = (ep.video_urls && ep.video_urls[0]) || ep.url || '';
      return '<div class="episode-item ' + status + '" onclick="playEpisode(' + anime.id + ',' + ep.id + ')">'
        + '<span class="episode-number">Ep ' + ep.number + '</span>'
        + '<span class="episode-title">' + (ep.title || 'Episode ' + ep.number) + '</span>'
        + '<div class="episode-actions">'
        + playBtn
        + '</div></div>';
    }).join('');

    content.innerHTML = '<div class="anime-detail-content">'
      + '<div>'
      + '<div class="anime-detail-cover" style="background:var(--bg-tertiary);display:flex;align-items:center;justify-content:center;font-size:64px;color:var(--text-muted)">'
      + coverHtml
      + '</div></div>'
      + '<div class="anime-detail-info">'
      + '<h2>' + anime.title + '</h2>'
      + '<div class="anime-detail-meta">'
      + (anime.source ? '<span style="background:var(--accent);color:white;padding:2px 8px;border-radius:4px;font-size:11px">' + anime.source + '</span>' : '')
      + '<span>' + (anime.status || 'Unknown') + '</span>'
      + '<span>' + (anime.year || '?') + '</span>'
      + '<span>' + (anime.episode_count || 0) + ' Episodes</span>'
      + ratingHtml
      + '</div>'
      + '<div class="anime-detail-meta">' + genresHtml + '</div>'
      + '<p class="anime-detail-synopsis">' + (anime.synopsis || 'No synopsis available.') + '</p>'
      + '<div class="anime-detail-actions">'
      + '<button class="btn btn-primary" onclick="continueWatching(' + anime.id + ')">▶ Continue Watching</button>'
      + '<button class="btn btn-secondary" onclick="showEditAnimeModal(' + anime.id + ')">✏️ Edit</button>'
      + '<button class="btn btn-secondary" onclick="showTrackingModal(' + anime.id + ')">📊 Track</button>'
      + '<button class="btn btn-danger" onclick="deleteAnime(' + anime.id + ')">🗑️ Delete</button>'
      + '</div>'
      + '<div class="episode-list-container">'
      + '<h3>Episodes (' + episodes.length + ')</h3>'
      + '<div class="episode-list" style="max-height:600px;overflow-y:auto">'
      + episodesHtml
      + '</div></div>'
      + '</div></div>';

    showPage('anime-detail');
  } catch (err) {
    alert('Error loading anime: ' + err.message);
  }
}

async function continueWatching(animeId) {
  try {
    const ep = await API.episodes.getContinue(animeId);
    if (ep) playEpisode(animeId, ep.id);
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

async function playEpisode(animeId, episodeId) {
  try {
    const episodes = await API.episodes.list(animeId);
    const anime = await API.library.get(animeId);
    const idx = episodes.findIndex(e => e.id === episodeId);
    if (idx === -1) return;

    currentAnimeId = animeId;
    currentEpisodeIndex = idx;
    currentEpisodes = episodes;
    playerAnimeId = animeId;
    playerEpisodes = episodes;

    const ep = episodes[idx];
    const videoUrl = ep.video_urls && ep.video_urls.length > 0 ? ep.video_urls[0] : '';

    const player = document.getElementById('video-player');
    const display = document.getElementById('episode-title-display');

    if (videoUrl) {
      player.src = videoUrl;
      player.load();
      player.play().catch(() => {});
      display.textContent = 'Ep ' + ep.number + (ep.title ? ' - ' + ep.title : '');
      updatePlayerProgress(ep);
      showPage('player');
    } else if (ep.url && anime.source) {
      showPage('player');
      display.textContent = 'Ep ' + ep.number + (ep.title ? ' - ' + ep.title : '');
      var wrapper = document.getElementById('player-wrapper');
      wrapper.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted)">Loading video...</div>';
      API.extensions.getVideo(anime.source, ep.url).then(function(result) {
        if (result.videoUrl && result.server !== 'gdrive-folder' && result.server !== 'gdrive-private') {
          wrapper.innerHTML = '<iframe src="' + result.videoUrl + '" style="width:100%;height:70vh;border:none;border-radius:8px" allowfullscreen></iframe>';
        } else {
          wrapper.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:12px;color:var(--text-muted)">'
            + '<p>Cannot play this video directly</p>'
            + '<button class="btn btn-primary" onclick="window.open(\'' + ep.url + '\', \'_blank\')">Open in Browser</button>'
            + '</div>';
        }
      }).catch(function(err) {
        wrapper.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:12px;color:var(--text-muted)">'
          + '<p>Error: ' + err.message + '</p>'
          + '<button class="btn btn-secondary" onclick="window.open(\'' + ep.url + '\', \'_blank\')">Open in Browser</button>'
          + '</div>';
      });
      updatePlayerProgress(ep);
    } else {
      player.removeAttribute('src');
      player.load();
      display.textContent = 'Ep ' + ep.number + (ep.title ? ' - ' + ep.title : '');
      showPage('player');
    }
  } catch (err) {
    alert('Error loading episode: ' + err.message);
  }
}

function nextEpisode() {
  if (currentEpisodeIndex < currentEpisodes.length - 1) {
    const next = currentEpisodes[currentEpisodeIndex + 1];
    playEpisode(currentAnimeId, next.id);
  }
}

function prevEpisode() {
  if (currentEpisodeIndex > 0) {
    const prev = currentEpisodes[currentEpisodeIndex - 1];
    playEpisode(currentAnimeId, prev.id);
  }
}

function closePlayer() {
  var player = document.getElementById('video-player');
  if (player) {
    player.pause();
    player.removeAttribute('src');
    player.load();
  }
  var wrapper = document.getElementById('player-wrapper');
  if (wrapper) {
    wrapper.innerHTML = '<video id="video-player" controls autoplay></video>';
  }
  if (currentAnimeId) {
    showAnimeDetail(currentAnimeId);
  } else if (scrapedAnimeData) {
    backToScrapedDetail();
  } else {
    showPage('library');
  }
}

async function markEpisodeWatched() {
  if (!currentAnimeId || currentEpisodes.length === 0) return;
  const ep = currentEpisodes[currentEpisodeIndex];
  try {
    await API.episodes.updateProgress(currentAnimeId, ep.id, { progress: 1, completed: true });
    ep.completed = 1;
    ep.progress = 1;
    updatePlayerProgress(ep);
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

function updatePlayerProgress(ep) {
  const fill = document.getElementById('player-progress-fill');
  if (ep.completed) {
    fill.style.width = '100%';
  } else if (ep.progress) {
    fill.style.width = `${Math.round(ep.progress * 100)}%`;
  } else {
    fill.style.width = '0%';
  }
}

async function loadTracking() {
  try {
    const animeList = await API.library.list();
    const stats = { watching: 0, completed: 0, plan_to_watch: 0, on_hold: 0, dropped: 0, total: animeList.length };

    const container = document.getElementById('tracking-list');
    container.innerHTML = animeList.map(a => {
      const w = a.watched_count || 0;
      const t = a.episode_count || 0;
      const status = w >= t && t > 0 ? 'completed' : w > 0 ? 'watching' : 'plan_to_watch';
      stats[status === 'completed' ? 'completed' : status === 'watching' ? 'watching' : 'plan_to_watch']++;

      return `
        <div class="tracking-item" onclick="showAnimeDetail(${a.id})">
          <span class="tracking-title">${a.title}</span>
          <span class="tracking-status ${status}">${status.replace(/_/g, ' ')}</span>
          <span style="font-size:12px;color:var(--text-muted)">${a.watched_count||0}/${a.episode_count||0}</span>
        </div>
      `;
    }).join('');

    document.getElementById('stat-watching').textContent = stats.watching;
    document.getElementById('stat-completed').textContent = stats.completed;
    document.getElementById('stat-plan').textContent = stats.plan_to_watch;
    document.getElementById('stat-onhold').textContent = stats.on_hold;
    document.getElementById('stat-dropped').textContent = stats.dropped;
    document.getElementById('stat-total').textContent = stats.total;
  } catch (err) {
    document.getElementById('tracking-list').innerHTML = '<div class="empty-state"><p>Error loading tracking</p></div>';
  }
}

async function loadUpdates() {
  const container = document.getElementById('updates-list');
  try {
    const animeList = await API.library.list({ sort: 'last_updated' });
    if (animeList.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🔄</div><p>No anime in library</p></div>';
      return;
    }
    container.innerHTML = animeList.slice(0, 20).map(a => `
      <div class="update-item" onclick="showAnimeDetail(${a.id})">
        <span class="update-title">${a.title}</span>
        <span class="update-count">${a.episode_count || 0} episodes</span>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = '<div class="empty-state"><p>Error loading updates</p></div>';
  }
}

async function checkUpdates() {
  await loadUpdates();
  alert('Update check complete!');
}

async function loadCategories() {
  const container = document.getElementById('categories-list');
  try {
    const categories = await API.categories.list();
    container.innerHTML = categories.map(c => `
      <div class="category-item">
        <div style="display:flex;align-items:center">
          <div class="category-color" style="background:${c.color}"></div>
          <span class="category-name">${c.name}</span>
        </div>
        <span class="category-count">${c.anime_count || 0} anime</span>
        <div>
          <button class="btn btn-sm" onclick="editCategory(${c.id}, '${c.name}', '${c.color}')">✏️</button>
          <button class="btn btn-sm btn-danger" onclick="deleteCategory(${c.id})">✕</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = '<div class="empty-state"><p>Error loading categories</p></div>';
  }
}

async function loadSources() {
  const container = document.getElementById('sources-list');
  try {
    const sources = await API.sources.list();
    container.innerHTML = sources.map(s => `
      <div class="source-item">
        <span class="source-name">${s.name}</span>
        <span class="source-url">${s.url}</span>
        <span style="font-size:12px;color:var(--text-muted)">${s.type}</span>
        <div>
          <button class="btn btn-sm" onclick="toggleSource(${s.id}, ${s.enabled ? 0 : 1})">${s.enabled ? 'Disable' : 'Enable'}</button>
          <button class="btn btn-sm btn-danger" onclick="deleteSource(${s.id})">✕</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = '<div class="empty-state"><p>Error loading sources</p></div>';
  }
}

async function loadSettings() {
  try {
    const settings = await API.settings.get();
    if (settings.theme) {
      document.getElementById('setting-theme').value = settings.theme;
      applyTheme(settings.theme);
    }
    if (settings.accent_color) {
      document.getElementById('setting-accent').value = settings.accent_color;
      document.documentElement.style.setProperty('--accent', settings.accent_color);
    }
  } catch (err) {}
}

async function saveSetting(key, value) {
  await API.settings.set({ [key]: value });
  if (key === 'theme') applyTheme(value);
  if (key === 'accent_color') document.documentElement.style.setProperty('--accent', value);
}

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light') {
    root.style.setProperty('--bg-primary', '#f5f5ff');
    root.style.setProperty('--bg-secondary', '#ffffff');
    root.style.setProperty('--bg-tertiary', '#e8e8f0');
    root.style.setProperty('--bg-card', '#ffffff');
    root.style.setProperty('--bg-hover', '#f0f0f8');
    root.style.setProperty('--text-primary', '#1a1a2e');
    root.style.setProperty('--text-secondary', '#4a4a6a');
    root.style.setProperty('--text-muted', '#8a8aaa');
    root.style.setProperty('--border', '#d0d0e0');
  } else if (theme === 'amoled') {
    root.style.setProperty('--bg-primary', '#000000');
    root.style.setProperty('--bg-secondary', '#0a0a0a');
    root.style.setProperty('--bg-tertiary', '#111111');
    root.style.setProperty('--bg-card', '#0d0d0d');
    root.style.setProperty('--bg-hover', '#1a1a1a');
    root.style.setProperty('--text-primary', '#e0e0e0');
    root.style.setProperty('--text-secondary', '#808080');
    root.style.setProperty('--text-muted', '#505050');
    root.style.setProperty('--border', '#1a1a1a');
  } else {
    root.style.setProperty('--bg-primary', '#0f0f1a');
    root.style.setProperty('--bg-secondary', '#1a1a2e');
    root.style.setProperty('--bg-tertiary', '#16213e');
    root.style.setProperty('--bg-card', '#1e1e36');
    root.style.setProperty('--bg-hover', '#2a2a4a');
    root.style.setProperty('--text-primary', '#e0e0ff');
    root.style.setProperty('--text-secondary', '#a0a0c0');
    root.style.setProperty('--text-muted', '#6b6b8a');
    root.style.setProperty('--border', '#2a2a4a');
  }
}

function showModal(html) {
  const overlay = document.getElementById('modal-overlay');
  const content = document.getElementById('modal-content');
  content.innerHTML = html;
  overlay.classList.add('active');
}

function closeModal(event) {
  if (!event || event.target === document.getElementById('modal-overlay')) {
    document.getElementById('modal-overlay').classList.remove('active');
  }
}

function showAddAnimeModal() {
  showModal(`
    <h3>Add Anime to Library</h3>
    <form onsubmit="addAnime(event)">
      <div class="form-group">
        <label>Title *</label>
        <input type="text" id="add-title" required>
      </div>
      <div class="form-group">
        <label>Cover URL</label>
        <input type="url" id="add-cover" placeholder="https://...">
      </div>
      <div class="form-group">
        <label>Synopsis</label>
        <textarea id="add-synopsis"></textarea>
      </div>
      <div class="form-group">
        <label>Status</label>
        <select id="add-status">
          <option value="Unknown">Unknown</option>
          <option value="Currently Airing">Currently Airing</option>
          <option value="Finished">Finished</option>
          <option value="Not Yet Aired">Not Yet Aired</option>
        </select>
      </div>
      <div class="form-group">
        <label>Year</label>
        <input type="number" id="add-year" value="2024">
      </div>
      <div class="form-group">
        <label>Genres (comma separated)</label>
        <input type="text" id="add-genres" placeholder="Action, Comedy, Drama">
      </div>
      <div class="form-group">
        <label>Episode Count</label>
        <input type="number" id="add-episodes" value="12">
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Add to Library</button>
      </div>
    </form>
  `);
}

async function addAnime(event) {
  event.preventDefault();
  const title = document.getElementById('add-title').value;
  const cover_url = document.getElementById('add-cover').value;
  const synopsis = document.getElementById('add-synopsis').value;
  const status = document.getElementById('add-status').value;
  const year = parseInt(document.getElementById('add-year').value) || 0;
  const genres = document.getElementById('add-genres').value.split(',').map(g => g.trim()).filter(Boolean);
  const episodes = parseInt(document.getElementById('add-episodes').value) || 0;

  try {
    await API.library.create({ title, cover_url, synopsis, status, year, genres, episodes });
    closeModal();
    loadLibrary();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

async function deleteAnime(id) {
  if (!confirm('Delete this anime from library?')) return;
  await API.library.delete(id);
  showPage('library');
}

function showEditAnimeModal(id) {
  const anime = currentAnime;
  showModal(`
    <h3>Edit Anime</h3>
    <form onsubmit="editAnime(event, ${id})">
      <div class="form-group">
        <label>Title</label>
        <input type="text" id="edit-title" value="${anime.title}">
      </div>
      <div class="form-group">
        <label>Cover URL</label>
        <input type="url" id="edit-cover" value="${anime.cover_url || ''}">
      </div>
      <div class="form-group">
        <label>Synopsis</label>
        <textarea id="edit-synopsis">${anime.synopsis || ''}</textarea>
      </div>
      <div class="form-group">
        <label>Status</label>
        <select id="edit-status">
          <option value="Unknown" ${anime.status === 'Unknown' ? 'selected' : ''}>Unknown</option>
          <option value="Currently Airing" ${anime.status === 'Currently Airing' ? 'selected' : ''}>Currently Airing</option>
          <option value="Finished" ${anime.status === 'Finished' ? 'selected' : ''}>Finished</option>
          <option value="Not Yet Aired" ${anime.status === 'Not Yet Aired' ? 'selected' : ''}>Not Yet Aired</option>
        </select>
      </div>
      <div class="form-group">
        <label>Year</label>
        <input type="number" id="edit-year" value="${anime.year || ''}">
      </div>
      <div class="form-group">
        <label>Genres (comma separated)</label>
        <input type="text" id="edit-genres" value="${(anime.genres || []).join(', ')}">
      </div>
      <div class="form-group">
        <label>Episode Count</label>
        <input type="number" id="edit-episodes" value="${anime.episodes || 0}">
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Save</button>
      </div>
    </form>
  `);
}

async function editAnime(event, id) {
  event.preventDefault();
  const title = document.getElementById('edit-title').value;
  const cover_url = document.getElementById('edit-cover').value;
  const synopsis = document.getElementById('edit-synopsis').value;
  const status = document.getElementById('edit-status').value;
  const year = parseInt(document.getElementById('edit-year').value) || 0;
  const genres = document.getElementById('edit-genres').value.split(',').map(g => g.trim()).filter(Boolean);
  const episodes = parseInt(document.getElementById('edit-episodes').value) || 0;

  await API.library.update(id, { title, cover_url, synopsis, status, year, genres, episodes });
  closeModal();
  showAnimeDetail(id);
}

async function showAddCategoryModal() {
  showModal(`
    <h3>New Category</h3>
    <form onsubmit="addCategory(event)">
      <div class="form-group">
        <label>Name</label>
        <input type="text" id="cat-name" required>
      </div>
      <div class="form-group">
        <label>Color</label>
        <input type="color" id="cat-color" value="#6366f1">
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Create</button>
      </div>
    </form>
  `);
}

async function addCategory(event) {
  event.preventDefault();
  const name = document.getElementById('cat-name').value;
  const color = document.getElementById('cat-color').value;
  await API.categories.create({ name, color });
  closeModal();
  loadCategories();
}

async function editCategory(id, name, color) {
  showModal(`
    <h3>Edit Category</h3>
    <form onsubmit="updateCategory(event, ${id})">
      <div class="form-group">
        <label>Name</label>
        <input type="text" id="edit-cat-name" value="${name}">
      </div>
      <div class="form-group">
        <label>Color</label>
        <input type="color" id="edit-cat-color" value="${color}">
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Save</button>
      </div>
    </form>
  `);
}

async function updateCategory(event, id) {
  event.preventDefault();
  const name = document.getElementById('edit-cat-name').value;
  const color = document.getElementById('edit-cat-color').value;
  await API.categories.update(id, { name, color });
  closeModal();
  loadCategories();
}

async function deleteCategory(id) {
  if (!confirm('Delete this category?')) return;
  await API.categories.delete(id);
  loadCategories();
}

async function deleteSource(id) {
  if (!confirm('Delete this source?')) return;
  await API.sources.delete(id);
  loadSources();
}

async function toggleSource(id, enabled) {
  await API.sources.update(id, { enabled });
  loadSources();
}

function showAddSourceModal() {
  showModal(`
    <h3>Add Source</h3>
    <form onsubmit="addSource(event)">
      <div class="form-group">
        <label>Name</label>
        <input type="text" id="source-name" required placeholder="Crunchyroll">
      </div>
      <div class="form-group">
        <label>URL</label>
        <input type="url" id="source-url" required placeholder="https://www.crunchyroll.com">
      </div>
      <div class="form-group">
        <label>Type</label>
        <select id="source-type">
          <option value="website">Website</option>
          <option value="api">API</option>
        </select>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Add Source</button>
      </div>
    </form>
  `);
}

async function addSource(event) {
  event.preventDefault();
  const name = document.getElementById('source-name').value;
  const url = document.getElementById('source-url').value;
  const type = document.getElementById('source-type').value;
  await API.sources.create({ name, url, type });
  closeModal();
  loadSources();
}

function showTrackingModal(animeId) {
  showModal(`
    <h3>Track on External Service</h3>
    <form onsubmit="setTracking(event, ${animeId})">
      <div class="form-group">
        <label>Service</label>
        <select id="track-service">
          <option value="MyAnimeList">MyAnimeList</option>
          <option value="AniList">AniList</option>
          <option value="Kitsu">Kitsu</option>
          <option value="Simkl">Simkl</option>
        </select>
      </div>
      <div class="form-group">
        <label>Status</label>
        <select id="track-status">
          <option value="watching">Watching</option>
          <option value="completed">Completed</option>
          <option value="plan_to_watch">Plan to Watch</option>
          <option value="on_hold">On Hold</option>
          <option value="dropped">Dropped</option>
        </select>
      </div>
      <div class="form-group">
        <label>Score (1-10)</label>
        <input type="number" id="track-score" min="0" max="10" step="0.5" value="0">
      </div>
      <div class="form-group">
        <label>Episodes Watched</label>
        <input type="number" id="track-episodes" value="0">
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Save</button>
      </div>
    </form>
  `);
}

async function setTracking(event, animeId) {
  event.preventDefault();
  const service = document.getElementById('track-service').value;
  const status = document.getElementById('track-status').value;
  const score = parseFloat(document.getElementById('track-score').value) || 0;
  const episodes_watched = parseInt(document.getElementById('track-episodes').value) || 0;

  await API.tracking.set(animeId, { service, status, score, episodes_watched });
  closeModal();
  showAnimeDetail(animeId);
}

async function exportBackup() {
  try {
    const result = await API.backup.export();
    alert(`Backup created: ${result.filename}`);
    loadBackups();
  } catch (err) {
    alert('Error creating backup: ' + err.message);
  }
}

async function importBackup(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    await API.backup.restore(text);
    alert('Backup restored successfully!');
    loadLibrary();
    loadBackups();
  } catch (err) {
    alert('Error restoring backup: ' + err.message);
  }
}

async function loadBackups() {
  const container = document.getElementById('backup-list');
  if (!container) return;
  try {
    const backups = await API.backup.list();
    container.innerHTML = backups.map(b => `
      <div class="tracking-item">
        <span class="tracking-title">${b.name}</span>
        <span class="tracking-status">${new Date(b.date_created).toLocaleDateString()} - ${(b.size / 1024).toFixed(1)} KB</span>
      </div>
    `).join('');
  } catch (err) {}
}

let activeBrowseSource = null;

function loadBrowseFilters() {
  const container = document.getElementById('browse-filters');
  const sources = [
    { id: 'all', name: 'All Sources' },
    { id: 'animekai', name: 'AnimeKai' },
    { id: 'aniwatch', name: 'AniWatch' },
    { id: 'animepahe', name: 'AnimePahe' },
    { id: 'kaa', name: 'KickAssAnime' },
    { id: 'gogoanimes', name: 'Gogoanime' },
    { id: 'mkissa', name: 'MKissa' },
    { id: 'reanime', name: 'ReAnime' },
    { id: 'anidb', name: 'AniDB' },
    { id: 'anizone', name: 'AniZone' },
    { id: 'anineko', name: 'AniNeko' },
    { id: 'senshi', name: 'SenshiLive' },
    { id: 'aninexus', name: 'AnimeNexus' }
  ];
  container.innerHTML = sources.map(s =>
    '<button class="browse-source-filter' + (s.id === 'all' ? ' active' : '') + '" onclick="setBrowseSource(\'' + s.id + '\', this)">' + s.name + '</button>'
  ).join('');
  activeBrowseSource = 'all';
}

function setBrowseSource(source, btn) {
  document.querySelectorAll('.browse-source-filter').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  activeBrowseSource = source;
}

function browseSearch() {
  const query = document.getElementById('browse-search').value;
  if (!query) return;
  const container = document.getElementById('browse-results');

  const skeletonHtml = '<div class="search-skeletons">'
    + Array(8).fill('').map(() =>
      '<div class="anime-card skeleton-card">'
        + '<div class="anime-card-cover skeleton-pulse"></div>'
        + '<div class="anime-card-info">'
        + '<div class="skeleton-text skeleton-pulse" style="width:80%;height:14px;margin-bottom:6px"></div>'
        + '<div class="skeleton-text skeleton-pulse" style="width:50%;height:10px"></div>'
        + '</div></div>'
    ).join('')
    + '</div>';
  container.innerHTML = skeletonHtml;

  const searchPromise = activeBrowseSource && activeBrowseSource !== 'all'
    ? API.extensions.search(query, activeBrowseSource)
    : API.extensions.searchAll(query, getEnabledExtensions());

  searchPromise.then(function(results) {
    if (!results || results.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>No results found</p></div>';
      return;
    }
    container.innerHTML = results.map(function(r) {
      var dataStr = JSON.stringify(r).replace(/"/g, '&quot;');
      var coverHtml = r.cover
        ? '<img src="' + r.cover + '" alt="' + r.title + '" onerror="this.parentElement.textContent=\'🎬\'">'
        : '🎬';
      var metaParts = [];
      if (r.meta) metaParts.push(r.meta);
      if (r.rating) metaParts.push('★ ' + r.rating);
      if (r.status) metaParts.push(r.status);
      if (r.episodes_count) metaParts.push(r.episodes_count + ' eps');
      return '<div class="anime-card" onclick="showScrapedAnime(' + dataStr + ')">'
        + '<div class="anime-card-cover">'
        + coverHtml
        + '<div class="result-source-badge">' + (r.source || 'Unknown') + '</div>'
        + '</div>'
        + '<div class="anime-card-info">'
        + '<div class="anime-card-title">' + r.title + '</div>'
        + '<div class="anime-card-meta"><span>' + metaParts.join(' · ') + '</span></div>'
        + '</div></div>';
    }).join('');
  }).catch(function(err) {
    container.innerHTML = '<div class="empty-state"><p>Search failed: ' + err.message + '</p></div>';
  });
}

let scrapedAnimeData = null;

function showScrapedAnime(data) {
  scrapedAnimeData = data;
  var container = document.getElementById('scraped-anime-content');

  if (data.url && (data.url.startsWith('anilist://') || data.source === 'AniList')) {
    container.innerHTML = '<div class="empty-state"><p>Loading details from AniList...</p></div>';
    showPage('scraped-anime');
    var animeId = data.url.replace('anilist://', '');
    API.extensions.scrapeAnime('anilist', data.url).then(function(details) {
      scrapedAnimeData = { ...data, ...details };
      var genresHtml = (details.genres || []).map(function(g) { return '<span>' + g + '</span>'; }).join('');
      var charsHtml = '';
      if (details.characters && details.characters.length > 0) {
        charsHtml = '<h3>Characters</h3><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">'
          + details.characters.slice(0, 10).map(function(c) {
            return '<div style="text-align:center"><img src="' + (c.image || '') + '" style="width:40px;height:40px;border-radius:50%;object-fit:cover"><div style="font-size:10px;max-width:60px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + c.name + '</div></div>';
          }).join('') + '</div>';
      }
      var epHtml = '';
      if (details.episodes && details.episodes.length > 0) {
        epHtml = '<h3>Episodes (' + details.episodes.length + ')</h3><div class="episode-list" style="max-height:600px;overflow-y:auto">'
          + details.episodes.map(function(ep) {
            return '<div class="episode-item" onclick="playScrapedEpisode(' + JSON.stringify(JSON.stringify(ep)).replace(/"/g, '&quot;') + ')">'
              + '<span class="episode-number">Ep ' + ep.number + '</span>'
              + '<span class="episode-title">' + ep.title + '</span>'
              + '</div>';
          }).join('') + '</div>';
      }
      container.innerHTML = '<div class="scraped-anime-content">'
        + '<div>'
        + '<div class="anime-detail-cover" style="background:var(--bg-tertiary);border-radius:8px;overflow:hidden">'
        + (details.cover ? '<img src="' + details.cover + '" style="width:100%;display:block">' : '<div style="padding:60px;text-align:center;font-size:64px">🎬</div>')
        + '</div></div>'
        + '<div class="anime-detail-info">'
        + '<h2>' + details.title + '</h2>'
        + '<div class="anime-detail-meta">'
        + '<span>' + (details.status || '') + '</span>'
        + '<span>' + (details.format || '') + '</span>'
        + '<span>' + (details.episodes_count || '?') + ' Episodes</span>'
        + (details.rating ? '<span>★ ' + details.rating + '/10</span>' : '')
        + '<span>' + (details.year || '') + '</span>'
        + '</div>'
        + '<div class="anime-detail-meta">' + genresHtml + '</div>'
        + '<p class="anime-detail-synopsis">' + (details.synopsis || 'No synopsis available.') + '</p>'
        + '<div class="anime-detail-actions">'
        + '<button class="btn btn-primary" onclick="addScrapedToLibrary()">+ Add to Library</button>'
        + '</div>'
        + charsHtml
        + epHtml
        + '</div></div>';
    }).catch(function(err) {
      container.innerHTML = '<div class="empty-state"><p>Error loading details: ' + err.message + '</p></div>';
    });
    return;
  }

  if (data.url && data.source && data.source !== 'AniList') {
    container.innerHTML = '<div class="empty-state"><p>Loading details from ' + data.source + '...</p></div>';
    showPage('scraped-anime');
    var sourceId = data.sourceId || data.source;
    Promise.all([
      API.extensions.scrapeAnime(sourceId, data.url).catch(function() { return null; }),
      API.extensions.search(data.title || data.source, 'anilist').catch(function() { return []; })
    ]).then(function(results) {
      var details = results[0];
      var anilistResults = results[1];
      if (!details) {
        container.innerHTML = '<div class="empty-state"><p>Failed to load details</p></div>';
        return;
      }
      scrapedAnimeData = { ...data, ...details, sourceId: sourceId };
      if (details.hasVideo === false) {
        container.innerHTML = '<div class="empty-state">'
          + '<div style="font-size:48px;margin-bottom:12px">🚫</div>'
          + '<h3>No Video Available</h3>'
          + '<p style="color:var(--text-muted);margin-top:8px">This source does not have playable videos for this anime.</p>'
          + '<button class="btn btn-secondary" onclick="showPage(\'browse\')" style="margin-top:16px">← Back to Browse</button>'
          + '</div>';
        return;
      }
      var anilistBanner = '';
      if (anilistResults && anilistResults.length > 0) {
        var al = anilistResults[0];
        var alGenres = (al.genres || []).map(function(g) { return '<span>' + g + '</span>'; }).join(' ');
        anilistBanner = '<div class="anilist-banner" style="background:var(--bg-card);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:16px">'
          + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">'
          + '<span style="background:#2e51a2;color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600">AniList</span>'
          + '<span style="font-weight:600">' + al.title + '</span>'
          + (al.rating ? '<span style="color:var(--accent);font-size:13px">★ ' + al.rating + '/10</span>' : '')
          + '</div>'
          + (alGenres ? '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px">' + alGenres + '</div>' : '')
          + (al.episodes_count ? '<div style="font-size:13px;color:var(--text-muted)">' + al.episodes_count + ' Episodes · ' + (al.year || '') + ' · ' + (al.status || '') + '</div>' : '')
          + (al.synopsis ? '<p style="font-size:12px;color:var(--text-muted);margin-top:8px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">' + al.synopsis.substring(0, 300) + '</p>' : '')
          + '</div>';
      }
      var epHtml = '';
      if (details.episodes && details.episodes.length > 0) {
        var epListJson = JSON.stringify(details.episodes.map(function(ep) { return { sourceId: sourceId, url: ep.url, number: ep.number, title: ep.title }; })).replace(/"/g, '&quot;');
        epHtml = '<h3>Episodes (' + details.episodes.length + ')</h3><div class="episode-list" style="max-height:600px;overflow-y:auto">'
          + details.episodes.map(function(ep) {
            var epData = JSON.stringify({ sourceId: sourceId, url: ep.url }).replace(/"/g, '&quot;');
            return '<div class="episode-item" onclick="playScrapedEpisode(' + epData + ', ' + epListJson + ')">'
              + '<span class="episode-number">Ep ' + ep.number + '</span>'
              + '<span class="episode-title">' + ep.title + '</span>'
              + '</div>';
          }).join('') + '</div>';
      }
      container.innerHTML = '<div class="scraped-anime-content">'
        + '<div>'
        + '<div class="anime-detail-cover" style="background:var(--bg-tertiary);border-radius:8px;overflow:hidden">'
        + (details.cover ? '<img src="' + details.cover + '" style="width:100%;display:block">' : '<div style="padding:60px;text-align:center;font-size:64px">🎬</div>')
        + '</div></div>'
        + '<div class="anime-detail-info">'
        + '<h2>' + details.title + '</h2>'
        + anilistBanner
        + '<p class="anime-detail-synopsis">' + (details.synopsis || 'No synopsis available.') + '</p>'
        + '<div class="anime-detail-actions">'
        + '<button class="btn btn-primary" onclick="addScrapedToLibrary()">+ Add to Library</button>'
        + '<button class="btn btn-secondary" onclick="window.open(\'' + data.url + '\', \'_blank\')">Open in Browser</button>'
        + '</div>'
        + epHtml
        + '</div></div>';
    }).catch(function(err) {
      container.innerHTML = '<div class="empty-state"><p>Error loading details: ' + err.message + '</p></div>';
    });
    return;
  }

  container.innerHTML = '<div class="scraped-anime-content">'
    + '<div>'
    + '<div class="anime-detail-cover" style="background:var(--bg-tertiary);border-radius:8px;overflow:hidden">'
    + (data.cover ? '<img src="' + data.cover + '" style="width:100%;display:block">' : '<div style="padding:60px;text-align:center;font-size:64px">🎬</div>')
    + '</div></div>'
    + '<div class="anime-detail-info">'
    + '<h2>' + data.title + '</h2>'
    + '<div class="anime-detail-meta">'
    + (data.meta ? '<span>' + data.meta + '</span>' : '')
    + (data.rating ? '<span>★ ' + data.rating + '</span>' : '')
    + '</div>'
    + '<p class="anime-detail-synopsis">' + (data.synopsis || 'No synopsis available.') + '</p>'
    + '<div class="anime-detail-actions">'
    + '<button class="btn btn-primary" onclick="addScrapedToLibrary()">+ Add to Library</button>'
    + '</div></div></div>';
  showPage('scraped-anime');
}

let scrapedEpisodes = [];
let scrapedCurrentIdx = -1;

function playScrapedEpisode(epData, episodeList) {
  var data = typeof epData === 'string' ? JSON.parse(epData) : epData;
  var url = data.url;
  var sourceId = data.sourceId || (scrapedAnimeData && scrapedAnimeData.sourceId) || '';

  if (!url) { alert('No episode URL available'); return; }

  if (episodeList && episodeList.length > 0) {
    scrapedEpisodes = episodeList;
    scrapedCurrentIdx = episodeList.findIndex(function(e) { return e.url === url; });
  }

  if (sourceId) {
    var playerContainer = document.getElementById('scraped-anime-content');
    playerContainer.innerHTML = '<div class="empty-state"><p>Loading video...</p></div>';

    API.extensions.getVideo(sourceId, url).then(function(result) {
      if (result.videoUrl && result.server !== 'gdrive-folder' && result.server !== 'gdrive-private') {
        renderScrapedPlayer(result.videoUrl, data, sourceId);
      } else if (result.server === 'gdrive-folder' || result.server === 'gdrive-private') {
        var msg = result.error || 'This is a Google Drive folder. Open it in your browser to select a video file.';
        playerContainer.innerHTML = '<div class="empty-state">'
          + '<p>' + msg + '</p>'
          + '<div style="display:flex;gap:8px;justify-content:center;margin-top:12px">'
          + '<button class="btn btn-primary" onclick="window.open(\'' + url + '\', \'_blank\')">Open Google Drive</button>'
          + '<button class="btn btn-secondary" onclick="history.back()">← Back</button>'
          + '</div></div>';
      } else {
        window.open(url, '_blank');
      }
    }).catch(function(err) {
      playerContainer.innerHTML = '<div class="empty-state"><p>Error: ' + err.message + '</p>'
        + '<button class="btn btn-secondary" onclick="window.open(\'' + url + '\', \'_blank\')">Open in Browser</button>'
        + '<button class="btn btn-secondary" onclick="history.back()">← Back</button></div>';
    });
  } else {
    window.open(url, '_blank');
  }
}

function renderScrapedPlayer(videoUrl, currentEp, sourceId) {
  var container = document.getElementById('scraped-anime-content');
  var prevBtn = '';
  var nextBtn = '';
  if (scrapedEpisodes.length > 0 && scrapedCurrentIdx >= 0) {
    if (scrapedCurrentIdx > 0) {
      var prev = scrapedEpisodes[scrapedCurrentIdx - 1];
      var prevData = JSON.stringify({ sourceId: sourceId, url: prev.url }).replace(/"/g, '&quot;');
      prevBtn = '<button class="btn btn-secondary" onclick="playScrapedEpisode(' + prevData + ', window._scrapedEpList)">← Previous</button>';
    }
    if (scrapedCurrentIdx < scrapedEpisodes.length - 1) {
      var next = scrapedEpisodes[scrapedCurrentIdx + 1];
      var nextData = JSON.stringify({ sourceId: sourceId, url: next.url }).replace(/"/g, '&quot;');
      nextBtn = '<button class="btn btn-secondary" onclick="playScrapedEpisode(' + nextData + ', window._scrapedEpList)">Next →</button>';
    }
  }
  window._scrapedEpList = scrapedEpisodes;
  var epLabel = currentEp.title || ('Ep ' + (scrapedCurrentIdx >= 0 ? scrapedEpisodes[scrapedCurrentIdx].number : ''));
  container.style.display = 'block';
  container.innerHTML = '<div class="player-container">'
    + '<button class="btn btn-secondary player-back" onclick="backToScrapedDetail()">← Back</button>'
    + '<div id="player-wrapper">'
    + '<iframe src="' + videoUrl + '" style="width:100%;height:70vh;border:none;border-radius:8px" allowfullscreen></iframe>'
    + '</div>'
    + '<div class="player-controls">'
    + '<div class="episode-nav">'
    + prevBtn
    + '<span id="episode-title-display" style="font-weight:600;font-size:16px">' + epLabel + '</span>'
    + nextBtn
    + '</div></div></div>';
}

function backToScrapedDetail() {
  if (scrapedAnimeData) {
    showScrapedAnime(scrapedAnimeData);
  } else {
    showPage('browse');
  }
}

function addScrapedToLibrary() {
  if (!scrapedAnimeData) return;
  var d = scrapedAnimeData;
  var payload = {
    title: d.title || d.title_romaji || 'Unknown',
    cover_url: d.cover || '',
    synopsis: d.synopsis || '',
    status: d.status || 'Unknown',
    year: d.year || 0,
    genres: d.genres || [],
    episodes: d.episodes_count || (d.episodes ? d.episodes.length : 0),
    rating: d.rating || 0,
    source: d.source || d.sourceId || '',
    source_id: d.url || ''
  };
  API.library.create(payload).then(function(anime) {
    var animeId = anime.id;
    var eps = d.episodes || [];
    if (eps.length === 0) {
      alert('Added to library!');
      showPage('library');
      return;
    }
    var promises = eps.map(function(ep) {
      return API.episodes.create({
        anime_id: animeId,
        number: ep.number,
        title: ep.title || 'Episode ' + ep.number,
        url: ep.url || '',
        video_urls: ep.video_urls || []
      });
    });
    Promise.all(promises).then(function() {
      alert('Added to library with ' + eps.length + ' episodes!');
      showPage('library');
    }).catch(function() {
      alert('Added to library (episodes may have failed)');
      showPage('library');
    });
  }).catch(function(err) {
    alert('Error: ' + err.message);
  });
}

const ALL_EXTENSIONS = [
  { id: 'animekai', name: 'AnimeKai', baseUrl: 'https://animekai.at' },
  { id: 'aniwatch', name: 'AniWatch', baseUrl: 'https://aniwatch.co.at' },
  { id: 'animepahe', name: 'AnimePahe', baseUrl: 'https://animepahe.pw' },
  { id: 'kaa', name: 'KickAssAnime', baseUrl: 'https://kaa.lt' },
  { id: 'gogoanimes', name: 'Gogoanime', baseUrl: 'https://gogoanimes.cv' },
  { id: 'mkissa', name: 'MKissa', baseUrl: 'https://mkissa.to' },
  { id: 'reanime', name: 'ReAnime', baseUrl: 'https://reanime.to' },
  { id: 'anidb', name: 'AniDB', baseUrl: 'https://anidb.app' },
  { id: 'anizone', name: 'AniZone', baseUrl: 'https://anizone.to' },
  { id: 'anineko', name: 'AniNeko', baseUrl: 'https://anineko.to' },
  { id: 'senshi', name: 'SenshiLive', baseUrl: 'https://senshi.live' },
  { id: 'aninexus', name: 'AnimeNexus', baseUrl: 'https://anime.nexus' }
];

function getEnabledExtensions() {
  const allIds = ALL_EXTENSIONS.map(e => e.id);
  try {
    const stored = localStorage.getItem('enabledExtensions');
    if (stored) {
      const parsed = JSON.parse(stored);
      const merged = [...new Set([...parsed, ...allIds])];
      return merged;
    }
  } catch {}
  return allIds;
}

function setEnabledExtensions(ids) {
  localStorage.setItem('enabledExtensions', JSON.stringify(ids));
}

function isExtensionEnabled(id) {
  return getEnabledExtensions().includes(id);
}

function loadExtensions() {
  const container = document.getElementById('extensions-list');
  const enabled = getEnabledExtensions();
  container.innerHTML = ALL_EXTENSIONS.map(function(ext) {
    const isEnabled = enabled.includes(ext.id);
    return '<div class="extension-card" style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:var(--bg-card);border-radius:8px;margin-bottom:8px">'
      + '<div style="display:flex;align-items:center;gap:12px;flex:1;min-width:0">'
      + '<div style="width:40px;height:40px;border-radius:8px;background:var(--bg-tertiary);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">🧩</div>'
      + '<div style="min-width:0">'
      + '<div style="font-weight:600;font-size:14px">' + ext.name + '</div>'
      + '<div style="font-size:12px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + ext.baseUrl + '</div>'
      + '<div id="ext-status-' + ext.id + '" class="ext-status checking">Checking...</div>'
      + '</div></div>'
      + '<label style="position:relative;display:inline-block;width:48px;height:26px;cursor:pointer;flex-shrink:0">'
      + '<input type="checkbox" ' + (isEnabled ? 'checked' : '') + ' onchange="toggleExtension(\'' + ext.id + '\', this.checked)" style="opacity:0;width:0;height:0">'
      + '<span style="position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background:' + (isEnabled ? 'var(--accent)' : 'var(--bg-tertiary)') + ';border-radius:13px;transition:0.3s"></span>'
      + '<span style="position:absolute;height:20px;width:20px;left:' + (isEnabled ? '24px' : '3px') + ';bottom:3px;background:white;border-radius:50%;transition:0.3s"></span>'
      + '</label></div>';
  }).join('');

  ALL_EXTENSIONS.forEach(function(ext) {
    checkExtensionVideo(ext.id, ext.baseUrl);
  });
}

async function checkExtensionVideo(extId, baseUrl) {
  const statusEl = document.getElementById('ext-status-' + extId);
  if (!statusEl) return;
  try {
    const searchUrl = baseUrl;
    const testUrls = {
      'animekai': 'https://animekai.at/',
      'aniwatch': 'https://aniwatch.co.at/',
      'animepahe': 'https://animepahe.pw/',
      'kaa': 'https://kaa.lt/',
      'gogoanimes': 'https://gogoanimes.cv/',
      'mkissa': 'https://mkissa.to/',
      'reanime': 'https://reanime.to/',
      'anidb': 'https://anidb.app/',
      'anizone': 'https://anizone.to/',
      'anineko': 'https://anineko.to/',
      'senshi': 'https://senshi.live/',
      'aninexus': 'https://anime.nexus/'
    };
    const testUrl = testUrls[extId] || baseUrl;
    const res = await fetch(testUrl, { method: 'HEAD', mode: 'no-cors' }).catch(function() { return { ok: false }; });
    statusEl.className = 'ext-status available';
    statusEl.textContent = 'Available';
  } catch (err) {
    statusEl.className = 'ext-status unavailable';
    statusEl.textContent = 'Unavailable';
  }
}

function toggleExtension(id, enabled) {
  let enabledList = getEnabledExtensions();
  if (enabled) {
    if (!enabledList.includes(id)) enabledList.push(id);
  } else {
    enabledList = enabledList.filter(function(e) { return e !== id; });
  }
  setEnabledExtensions(enabledList);
  loadExtensions();
}
