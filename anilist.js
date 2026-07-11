const fetch = require('node-fetch');

const ANILIST_API = 'https://graphql.anilist.co';

const SEARCH_QUERY = `
query ($search: String, $page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
      id
      title { romaji english native }
      coverImage { large medium }
      bannerImage
      description
      format
      status
      episodes
      duration
      averageScore
      genres
      startDate { year month day }
      streamingEpisodes {
        title thumbnail site
      }
    }
    pageInfo { total currentPage lastPage hasNextPage }
  }
}`;

const TRENDING_QUERY = `
query ($page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    media(type: ANIME, sort: TRENDING_DESC) {
      id
      title { romaji english native }
      coverImage { large medium }
      bannerImage
      description
      format
      status
      episodes
      duration
      averageScore
      genres
      startDate { year month day }
    }
    pageInfo { total currentPage lastPage hasNextPage }
  }
}`;

const SEASON_QUERY = `
query ($season: Season, $year: Int, $page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    media(season: $season, seasonYear: $year, type: ANIME, sort: POPULARITY_DESC) {
      id
      title { romaji english native }
      coverImage { large medium }
      bannerImage
      description
      format
      status
      episodes
      duration
      averageScore
      genres
      startDate { year month day }
    }
    pageInfo { total currentPage lastPage hasNextPage }
  }
}`;

function cleanDescription(desc) {
  if (!desc) return '';
  return desc
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\n/g, ' ')
    .trim();
}

function mapAnilistAnime(media) {
  const title = media.title.english || media.title.romaji || media.title.native || '';
  const startDate = media.startDate && media.startDate.year
    ? `${media.startDate.year}-${String(media.startDate.month || 1).padStart(2, '0')}-${String(media.startDate.day || 1).padStart(2, '0')}`
    : '';

  const episodes = [];
  if (media.streamingEpisodes && media.streamingEpisodes.length > 0) {
    media.streamingEpisodes.forEach((ep, i) => {
      episodes.push({
        number: i + 1,
        title: ep.title || 'Episode ' + (i + 1),
        url: '',
        thumbnail: ep.thumbnail || '',
        site: ep.site || ''
      });
    });
  }

  return {
    id: media.id,
    title,
    title_romaji: media.title.romaji || '',
    title_native: media.title.native || '',
    cover: media.coverImage ? (media.coverImage.large || media.coverImage.medium || '') : '',
    banner: media.bannerImage || '',
    synopsis: cleanDescription(media.description),
    format: media.format || '',
    status: media.status || '',
    episodes_count: media.episodes || 0,
    duration: media.duration || 0,
    rating: media.averageScore ? media.averageScore / 10 : 0,
    genres: media.genres || [],
    year: media.startDate ? media.startDate.year : 0,
    start_date: startDate,
    source: 'AniList',
    episodes
  };
}

async function anilistRequest(query, variables) {
  const body = JSON.stringify({ query, variables });
  const res = await fetch(ANILIST_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error('AniList API error: ' + res.status + ' - ' + text.substring(0, 200));
  }
  const data = await res.json();
  return data.data;
}

async function searchAnime(query, page = 1, perPage = 20) {
  const data = await anilistRequest(SEARCH_QUERY, { search: query, page, perPage });
  const media = data.Page.media.map(mapAnilistAnime);
  return { results: media, pageInfo: data.Page.pageInfo };
}

async function getTrending(page = 1, perPage = 20) {
  const data = await anilistRequest(TRENDING_QUERY, { page, perPage });
  const media = data.Page.media.map(mapAnilistAnime);
  return { results: media, pageInfo: data.Page.pageInfo };
}

async function getSeasonal(season, year, page = 1, perPage = 20) {
  const data = await anilistRequest(SEASON_QUERY, { season, year, page, perPage });
  const media = data.Page.media.map(mapAnilistAnime);
  return { results: media, pageInfo: data.Page.pageInfo };
}

async function getAnimeById(id) {
  const intId = parseInt(id);
  const query = `
  query ($id: Int) {
    Media(id: $id, type: ANIME) {
      id
      title { romaji english native }
      coverImage { large medium }
      bannerImage
      description
      format
      status
      episodes
      duration
      averageScore
      genres
      startDate { year month day }
      characters(perPage: 10, sort: ROLE) {
        edges { role node { name { full } image { medium } } }
      }
      relations {
        edges { node { id title { romaji english } type format } relationType }
      }
      streamingEpisodes { title thumbnail site }
    }
  }`;
  const data = await anilistRequest(query, { id: intId });
  const anime = mapAnilistAnime(data.Media);

  if (data.Media.characters) {
    anime.characters = data.Media.characters.edges.map(e => ({
      name: e.node.name.full,
      image: e.node.image ? e.node.image.medium : '',
      role: e.role
    }));
  }
  if (data.Media.relations) {
    anime.relations = data.Media.relations.edges.map(e => ({
      id: e.node.id,
      title: e.node.title.english || e.node.title.romaji,
      type: e.node.type,
      format: e.node.format,
      relation: e.relationType
    }));
  }

  return anime;
}

module.exports = { searchAnime, getTrending, getSeasonal, getAnimeById };
