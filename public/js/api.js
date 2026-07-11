const API = {
  async request(method, url, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'Request failed');
    }
    return res.json();
  },

  get(url) { return this.request('GET', url); },
  post(url, body) { return this.request('POST', url, body); },
  put(url, body) { return this.request('PUT', url, body); },
  delete(url) { return this.request('DELETE', url); },

  library: {
    list(params) {
      const q = new URLSearchParams(params || {}).toString();
      return API.get('/api/library' + (q ? '?' + q : ''));
    },
    get(id) { return API.get('/api/library/' + id); },
    create(data) { return API.post('/api/library', data); },
    update(id, data) { return API.put('/api/library/' + id, data); },
    delete(id) { return API.delete('/api/library/' + id); },
    setCategories(id, category_ids) { return API.post('/api/library/' + id + '/categories', { category_ids }); }
  },

  episodes: {
    list(animeId) { return API.get('/api/episodes/' + animeId); },
    create(data) { return API.post('/api/episodes', data); },
    updateProgress(animeId, episodeId, data) { return API.put('/api/episodes/' + animeId + '/episodes/' + episodeId + '/progress', data); },
    getContinue(animeId) { return API.get('/api/episodes/' + animeId + '/continue'); }
  },

  categories: {
    list() { return API.get('/api/categories'); },
    create(data) { return API.post('/api/categories', data); },
    update(id, data) { return API.put('/api/categories/' + id, data); },
    delete(id) { return API.delete('/api/categories/' + id); }
  },

  sources: {
    list() { return API.get('/api/sources'); },
    create(data) { return API.post('/api/sources', data); },
    update(id, data) { return API.put('/api/sources/' + id, data); },
    delete(id) { return API.delete('/api/sources/' + id); }
  },

  tracking: {
    get(animeId) { return API.get('/api/tracking/' + animeId); },
    set(animeId, data) { return API.post('/api/tracking/' + animeId, data); },
    remove(animeId, service) { return API.delete('/api/tracking/' + animeId + '/' + service); }
  },

  downloads: {
    list() { return API.get('/api/downloads'); },
    create(data) { return API.post('/api/downloads', data); },
    update(id, data) { return API.put('/api/downloads/' + id, data); },
    delete(id) { return API.delete('/api/downloads/' + id); }
  },

  backup: {
    export() { return API.post('/api/backup/export'); },
    restore(data) { return API.post('/api/backup/restore', { backup_data: data }); },
    list() { return API.get('/api/backup/list'); }
  },

  settings: {
    get() { return API.get('/api/settings'); },
    set(data) { return API.put('/api/settings', data); }
  },

  extensions: {
    list() { return API.get('/api/extensions'); },
    sources() { return API.get('/api/extensions/sources'); },
    install(data) { return API.post('/api/extensions/install', data); },
    update(id, data) { return API.put('/api/extensions/' + id, data); },
    uninstall(id) { return API.delete('/api/extensions/' + id); },
    search(query, source) { return API.post('/api/extensions/search', { query, source }); },
    searchAll(query, enabledSources) { return API.post('/api/extensions/search-all', { query, enabledSources }); },
    scrapeAnime(source, url) { return API.post('/api/extensions/scrape-anime', { source, url }); },
    getVideo(source, url) { return API.post('/api/extensions/get-video', { source, url }); },
    checkVideo(source, url) { return API.post('/api/extensions/check-video', { source, url }); },
    trending() { return API.get('/api/extensions/anilist/trending'); },
    seasonal() { return API.get('/api/extensions/anilist/seasonal'); }
  }
};
