const API = {
  async request(method, url, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
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
    list(params) { return Promise.resolve(Store.library.list(params)); },
    get(id) { return Promise.resolve(Store.library.get(id)); },
    create(data) { return Promise.resolve(Store.library.create(data)); },
    update(id, data) { return Promise.resolve(Store.library.update(id, data)); },
    delete(id) { return Promise.resolve(Store.library.delete(id)); },
    setCategories(id, category_ids) { return Promise.resolve(Store.library.setCategories(id, category_ids)); }
  },

  episodes: {
    list(animeId) { return Promise.resolve(Store.episodes.list(animeId)); },
    create(data) { return Promise.resolve(Store.episodes.create(data)); },
    updateProgress(animeId, episodeId, data) { return Promise.resolve(Store.episodes.updateProgress(animeId, episodeId, data)); },
    getContinue(animeId) { return Promise.resolve(Store.episodes.getContinue(animeId)); }
  },

  categories: {
    list() { return Promise.resolve(Store.categories.list()); },
    create(data) { return Promise.resolve(Store.categories.create(data)); },
    update(id, data) { return Promise.resolve(Store.categories.update(id, data)); },
    delete(id) { return Promise.resolve(Store.categories.delete(id)); }
  },

  sources: {
    list() { return API.get('/api/sources'); },
    create(data) { return API.post('/api/sources', data); },
    update(id, data) { return API.put('/api/sources/' + id, data); },
    delete(id) { return API.delete('/api/sources/' + id); }
  },

  tracking: {
    get(animeId) { return Promise.resolve(Store.tracking.get(animeId)); },
    set(animeId, data) { return Promise.resolve(Store.tracking.set(animeId, data)); },
    remove(animeId, service) { return Promise.resolve(Store.tracking.remove(animeId, service)); }
  },

  downloads: {
    list() { return Promise.resolve(Store.downloads.list()); },
    create(data) { return Promise.resolve(Store.downloads.create(data)); },
    update(id, data) { return Promise.resolve(Store.downloads.update(id, data)); },
    delete(id) { return Promise.resolve(Store.downloads.delete(id)); }
  },

  backup: {
    export() { return Promise.resolve(Store.backup.export()); },
    restore(data) { return Promise.resolve(Store.backup.restore(data)); },
    list() { return Promise.resolve(Store.backup.list()); }
  },

  settings: {
    get() { return Promise.resolve(Store.settings.get()); },
    set(data) { return Promise.resolve(Store.settings.set(data)); }
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
