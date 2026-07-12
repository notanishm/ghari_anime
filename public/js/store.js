const Store = {
  _get(key) {
    try { return JSON.parse(localStorage.getItem('gh_' + key)); }
    catch { return null; }
  },
  _set(key, val) {
    localStorage.setItem('gh_' + key, JSON.stringify(val));
  },
  _nextId(key) {
    const items = this._get(key) || [];
    return items.length > 0 ? Math.max(...items.map(i => i.id)) + 1 : 1;
  },

  _all(key) { return this._get(key) || []; },
  _find(key, id) { return this._all(key).find(i => i.id === id); },
  _upsert(key, item) {
    const items = this._all(key);
    const idx = items.findIndex(i => i.id === item.id);
    if (idx >= 0) items[idx] = item;
    else items.push(item);
    this._set(key, items);
    return item;
  },
  _remove(key, id) {
    this._set(key, this._all(key).filter(i => i.id !== id));
  },

  library: {
    list(params) {
      let items = Store._all('library');
      if (params?.search) {
        const q = params.search.toLowerCase();
        items = items.filter(a => a.title.toLowerCase().includes(q) || (a.alt_titles || '').toLowerCase().includes(q));
      }
      if (params?.status) items = items.filter(a => a.status === params.status);
      if (params?.sort) {
        const s = params.sort;
        if (s === 'title') items.sort((a, b) => a.title.localeCompare(b.title));
        else if (s === 'date_added') items.sort((a, b) => (b.date_added || '').localeCompare(a.date_added || ''));
        else if (s === 'rating') items.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        else items.sort((a, b) => (b.last_updated || '').localeCompare(a.last_updated || ''));
      } else {
        items.sort((a, b) => (b.last_updated || '').localeCompare(a.last_updated || ''));
      }
      items.forEach(a => {
        const eps = Store._all('episodes').filter(e => e.anime_id === a.id);
        const wh = Store._all('watch_history');
        a.episode_count = eps.length;
        a.watched_count = eps.filter(e => wh.some(h => h.episode_id === e.id && h.anime_id === a.id && h.completed)).length;
        a.category_names = '';
        a.category_ids = '';
      });
      return items;
    },
    get(id) { return Store._find('library', id); },
    create(data) {
      const id = Store._nextId('library');
      const item = { ...data, id, date_added: new Date().toISOString(), last_updated: new Date().toISOString() };
      return Store._upsert('library', item);
    },
    update(id, data) {
      const existing = Store._find('library', id);
      if (!existing) return null;
      const item = { ...existing, ...data, id, last_updated: new Date().toISOString() };
      return Store._upsert('library', item);
    },
    delete(id) {
      Store._remove('library', id);
      Store._set('episodes', Store._all('episodes').filter(e => e.anime_id !== id));
      Store._set('watch_history', Store._all('watch_history').filter(h => h.anime_id !== id));
      Store._set('tracking', Store._all('tracking').filter(t => t.anime_id !== id));
      return true;
    },
    setCategories(id, categoryIds) {
      Store._set('anime_categories', Store._all('anime_categories').filter(ac => ac.anime_id !== id));
      const all = Store._all('anime_categories');
      categoryIds.forEach(cid => all.push({ anime_id: id, category_id: cid }));
      Store._set('anime_categories', all);
    }
  },

  episodes: {
    list(animeId) {
      return Store._all('episodes').filter(e => e.anime_id === animeId).map(ep => {
        const wh = Store._all('watch_history').find(h => h.episode_id === ep.id && h.anime_id === animeId);
        return { ...ep, progress: wh?.progress || 0, completed: wh?.completed || 0, last_watched: wh?.last_watched || null };
      });
    },
    create(data) {
      const existing = Store._all('episodes').find(e => e.anime_id === data.anime_id && e.number === data.number);
      if (existing) {
        const updated = { ...existing, ...data };
        Store._upsert('episodes', updated);
        return updated;
      }
      const id = Store._nextId('episodes');
      const item = { ...data, id, date_added: new Date().toISOString() };
      return Store._upsert('episodes', item);
    },
    updateProgress(animeId, episodeId, data) {
      const all = Store._all('watch_history');
      const idx = all.findIndex(h => h.anime_id === animeId && h.episode_id === episodeId);
      const item = { anime_id: animeId, episode_id: episodeId, progress: data.progress || 0, completed: data.completed ? 1 : 0, last_watched: new Date().toISOString() };
      if (idx >= 0) all[idx] = item;
      else { item.id = Store._nextId('watch_history'); all.push(item); }
      Store._set('watch_history', all);
      return { success: true };
    },
    getContinue(animeId) {
      const eps = Store._all('episodes').filter(e => e.anime_id === animeId).sort((a, b) => a.number - b.number);
      const wh = Store._all('watch_history');
      const unwatched = eps.find(e => !wh.some(h => h.episode_id === e.id && h.anime_id === animeId && h.completed));
      return unwatched || eps[0] || null;
    }
  },

  categories: {
    list() {
      const cats = Store._all('categories');
      const ac = Store._all('anime_categories');
      return cats.map(c => ({ ...c, anime_count: ac.filter(a => a.category_id === c.id).length }));
    },
    create(data) {
      const id = Store._nextId('categories');
      const item = { ...data, id, sort_order: data.sort_order || 0 };
      return Store._upsert('categories', item);
    },
    update(id, data) {
      const existing = Store._find('categories', id);
      if (!existing) return null;
      return Store._upsert('categories', { ...existing, ...data, id });
    },
    delete(id) {
      Store._remove('categories', id);
      Store._set('anime_categories', Store._all('anime_categories').filter(ac => ac.category_id !== id));
      return true;
    }
  },

  tracking: {
    get(animeId) { return Store._all('tracking').filter(t => t.anime_id === animeId); },
    set(animeId, data) {
      const all = Store._all('tracking');
      const idx = all.findIndex(t => t.anime_id === animeId && t.service === data.service);
      const item = { ...data, anime_id: animeId, id: idx >= 0 ? all[idx].id : Store._nextId('tracking'), last_synced: new Date().toISOString() };
      if (idx >= 0) all[idx] = item;
      else all.push(item);
      Store._set('tracking', all);
      return item;
    },
    remove(animeId, service) {
      Store._set('tracking', Store._all('tracking').filter(t => !(t.anime_id === animeId && t.service === service)));
      return true;
    }
  },

  downloads: {
    list() {
      const dl = Store._all('downloads');
      const lib = Store._all('library');
      const eps = Store._all('episodes');
      return dl.map(d => {
        const a = lib.find(l => l.id === d.anime_id);
        const e = eps.find(ep => ep.id === d.episode_id);
        return { ...d, anime_title: a?.title || '', episode_number: e?.number || 0, episode_title: e?.title || '' };
      });
    },
    create(data) {
      const existing = Store._all('downloads').find(d => d.episode_id === data.episode_id);
      if (existing) return null;
      const id = Store._nextId('downloads');
      return Store._upsert('downloads', { ...data, id, date_added: new Date().toISOString() });
    },
    update(id, data) {
      const existing = Store._find('downloads', id);
      if (!existing) return null;
      return Store._upsert('downloads', { ...existing, ...data, id });
    },
    delete(id) { Store._remove('downloads', id); return true; }
  },

  settings: {
    get() { return Store._get('settings') || {}; },
    set(data) {
      const s = Store._get('settings') || {};
      Object.assign(s, data);
      Store._set('settings', s);
      return { success: true };
    }
  },

  backup: {
    export() {
      return {
        version: '1.0',
        date: new Date().toISOString(),
        library: Store._all('library'),
        categories: Store._all('categories'),
        anime_categories: Store._all('anime_categories'),
        episodes: Store._all('episodes'),
        watch_history: Store._all('watch_history'),
        tracking: Store._all('tracking'),
        downloads: Store._all('downloads'),
        settings: Store._get('settings') || {}
      };
    },
    restore(data) {
      if (data.library) Store._set('library', data.library);
      if (data.categories) Store._set('categories', data.categories);
      if (data.anime_categories) Store._set('anime_categories', data.anime_categories);
      if (data.episodes) Store._set('episodes', data.episodes);
      if (data.watch_history) Store._set('watch_history', data.watch_history);
      if (data.tracking) Store._set('tracking', data.tracking);
      if (data.downloads) Store._set('downloads', data.downloads);
      if (data.settings) Store._set('settings', data.settings);
      return { success: true };
    },
    list() { return Store._all('backups'); }
  }
};
