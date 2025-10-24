const STATUS = document.getElementById('status');
const FILTER_CHIPS = [...document.querySelectorAll('.chip')];
const SEARCH_INPUT = document.getElementById('search');
const SEARCH_BTN = document.getElementById('searchBtn');
const LOCATE_BTN = document.getElementById('locateBtn');
const SEARCH_SUGGESTIONS_EL = document.getElementById('searchSuggestions');


const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';

const BIGBELLY_LOCAL = './data/boston_bigbelly.sample.geojson';
const BIGBELLY_REMOTE = null;

const LS_FEATURES_KEY = 'tcnm:features:v1';
const LS_TIMESTAMP_KEY = 'tcnm:ts:v1';
const LS_CELLS_KEY = 'tcnm:cells:v1';
const LEGACY_FEATURES_KEY = 'mlbtrash:features:v1';
const LEGACY_TIMESTAMP_KEY = 'mlbtrash:ts:v1';
const LEGACY_CELLS_KEY = 'mlbtrash:cells:v1';
const CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;

const FETCH_GRID_SIZE_DEG = 0.5;
const MIN_FETCH_ZOOM = 9;

let ALL_FEATURES = [];
let ACTIVE_FILTER = 'all';
let CURRENT_SUGGESTIONS = [];
let HIGHLIGHT_INDEX = -1;
let GEOCODE_ABORT = null;
let suggestionHideTimer = null;
const REQUESTED_CELLS = new Set();
const COMPLETED_CELLS = new Set();
const FETCH_QUEUE = [];
let FETCH_ACTIVE = false;
let LAST_FETCH_STATUS = 0;

const PRECACHE_REGIONS = [
  [-71.25, 42.20, -70.95, 42.45]
];

const CATEGORY_META = {
  trash: { label: 'Waste basket', color: '#22c55e' },
  recycling: { label: 'Recycling', color: '#60a5fa' },
  waste_disposal: { label: 'Waste disposal', color: '#a855f7' },
  bag: { label: 'Bag dispenser', color: '#ec4899' },
  other: { label: 'Other waste-related', color: '#475569' }
};

const CATEGORY_COLOR_EXPRESSION = (() => {
  const expr = ['match', ['get', '__class']];
  Object.entries(CATEGORY_META).forEach(([key, meta]) => {
    if (key === 'other') return;
    expr.push(key, meta.color);
  });
  expr.push('other', CATEGORY_META.other.color);
  expr.push(CATEGORY_META.other.color);
  return expr;
})();

const LOCAL_PLACES = [
  { name: 'New York City, NY', subtitle: 'Five boroughs', center: [-74.0060, 40.7128], zoom: 12.5, tokens: ['nyc', 'new york', 'manhattan', 'brooklyn'] },
  { name: 'Los Angeles, CA', subtitle: 'Southern California', center: [-118.2437, 34.0522], zoom: 12, tokens: ['los angeles', 'la', 'hollywood'] },
  { name: 'Chicago, IL', subtitle: 'Lakefront & Loop', center: [-87.6298, 41.8781], zoom: 12.5, tokens: ['chicago', 'chi', 'windy city'] },
  { name: 'Houston, TX', subtitle: 'Downtown & Midtown', center: [-95.3698, 29.7604], zoom: 12.5, tokens: ['houston', 'htx'] },
  { name: 'Phoenix, AZ', subtitle: 'Valley of the Sun', center: [-112.0740, 33.4484], zoom: 12.5, tokens: ['phoenix', 'phx'] },
  { name: 'Philadelphia, PA', subtitle: 'Center City', center: [-75.1652, 39.9526], zoom: 12.7, tokens: ['philadelphia', 'philly'] },
  { name: 'San Antonio, TX', subtitle: 'River Walk', center: [-98.4936, 29.4241], zoom: 12.7, tokens: ['san antonio', 'satx', 'alamo'] },
  { name: 'San Diego, CA', subtitle: 'Gaslamp & Balboa', center: [-117.1611, 32.7157], zoom: 12.7, tokens: ['san diego', 'sd'] },
  { name: 'Dallas, TX', subtitle: 'Downtown & Uptown', center: [-96.7970, 32.7767], zoom: 12.6, tokens: ['dallas', 'dfw'] },
  { name: 'San Jose, CA', subtitle: 'Silicon Valley core', center: [-121.8863, 37.3382], zoom: 12.8, tokens: ['san jose', 'sj'] },
  { name: 'Austin, TX', subtitle: 'Downtown & UT', center: [-97.7431, 30.2672], zoom: 12.8, tokens: ['austin', 'atx'] },
  { name: 'Jacksonville, FL', subtitle: 'River city', center: [-81.6557, 30.3322], zoom: 12.4, tokens: ['jacksonville', 'jax'] },
  { name: 'San Francisco, CA', subtitle: 'Bay Area hub', center: [-122.4194, 37.7749], zoom: 12.8, tokens: ['san francisco', 'sf', 'frisco'] },
  { name: 'Seattle, WA', subtitle: 'Puget Sound', center: [-122.3321, 47.6062], zoom: 12.6, tokens: ['seattle', 'sea'] },
  { name: 'Denver, CO', subtitle: 'Mile High City', center: [-104.9903, 39.7392], zoom: 12.5, tokens: ['denver', 'mile high'] },
  { name: 'Miami, FL', subtitle: 'South Beach & Downtown', center: [-80.1918, 25.7617], zoom: 12.8, tokens: ['miami', 'miami beach'] },
  { name: 'Atlanta, GA', subtitle: 'Downtown & Midtown', center: [-84.3880, 33.7490], zoom: 12.6, tokens: ['atlanta', 'atl'] },
  { name: 'Washington, DC', subtitle: 'National Capital', center: [-77.0369, 38.9072], zoom: 12.8, tokens: ['washington dc', 'dc', 'district of columbia'] },
  { name: 'Portland, OR', subtitle: 'Bridges & Pearl', center: [-122.6765, 45.5234], zoom: 12.7, tokens: ['portland', 'pdx'] },
  { name: 'Las Vegas, NV', subtitle: 'The Strip & Downtown', center: [-115.1398, 36.1699], zoom: 12.9, tokens: ['las vegas', 'vegas', 'lv'] },
  { name: 'Minneapolis, MN', subtitle: 'Twin Cities', center: [-93.2650, 44.9778], zoom: 12.7, tokens: ['minneapolis', 'mpls'] },
  { name: 'Detroit, MI', subtitle: 'Motor City', center: [-83.0458, 42.3314], zoom: 12.6, tokens: ['detroit', 'motor city'] },
  { name: 'Boston, MA', subtitle: 'City proper', center: [-71.057, 42.3601], zoom: 12.6, tokens: ['boston', 'bos'] },
  { name: 'Cambridge, MA', subtitle: 'Across the Charles', center: [-71.1056, 42.3736], zoom: 13.2, tokens: ['cambridge', 'kendall', 'mit'] },
  { name: 'Somerville, MA', subtitle: 'Squares & Assembly', center: [-71.0995, 42.3876], zoom: 13.2, tokens: ['somerville', 'davis square'] },
  { name: 'Philadelphia Suburbs, PA', subtitle: 'Main Line', center: [-75.2738, 40.0405], zoom: 12.8, tokens: ['main line', 'ardmore'] },
  { name: 'Nashville, TN', subtitle: 'Music City', center: [-86.7816, 36.1627], zoom: 12.7, tokens: ['nashville', 'music city'] },
  { name: 'Charlotte, NC', subtitle: 'Uptown', center: [-80.8431, 35.2271], zoom: 12.6, tokens: ['charlotte', 'clt'] },
  { name: 'Pittsburgh, PA', subtitle: 'Three Rivers', center: [-79.9959, 40.4406], zoom: 12.7, tokens: ['pittsburgh', 'steel city'] },
  { name: 'Columbus, OH', subtitle: 'Short North', center: [-82.9988, 39.9612], zoom: 12.6, tokens: ['columbus', 'cbus'] },
  { name: 'Salt Lake City, UT', subtitle: 'Wasatch Front', center: [-111.8910, 40.7608], zoom: 12.8, tokens: ['salt lake city', 'slc'] },
  { name: 'New Orleans, LA', subtitle: 'French Quarter', center: [-90.0715, 29.9511], zoom: 12.8, tokens: ['new orleans', 'nola'] },
  { name: 'Kansas City, MO', subtitle: 'Downtown & Plaza', center: [-94.5786, 39.0997], zoom: 12.7, tokens: ['kansas city', 'kc'] },
  { name: 'Honolulu, HI', subtitle: 'Oahu core', center: [-157.8583, 21.3069], zoom: 12.8, tokens: ['honolulu', 'oahu', 'waikiki'] },
  { name: 'Anchorage, AK', subtitle: 'Cook Inlet', center: [-149.9003, 61.2181], zoom: 12.4, tokens: ['anchorage', 'ak'] },
  { name: 'Boulder, CO', subtitle: 'Front Range', center: [-105.2705, 40.0150], zoom: 13, tokens: ['boulder'] },
  { name: 'Madison, WI', subtitle: 'Isthmus', center: [-89.4012, 43.0731], zoom: 13, tokens: ['madison', 'uw'] }
];

const GEOCODE_ENDPOINT = 'https://geocode.maps.co/search';
const GEOCODE_CACHE = new Map();

const MAP_STYLE = {
  version: 8,
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: 'OpenStreetMap contributors',
      maxzoom: 19
    }
  },
  layers: [
    {
      id: 'osm-base',
      type: 'raster',
      source: 'osm',
      minzoom: 0,
      maxzoom: 19
    }
  ]
};

const map = new maplibregl.Map({
  container: 'map',
  style: MAP_STYLE,
  center: [-98.5795, 39.8283],
  zoom: 4.4,
  maxZoom: 19,
  minZoom: 3
});

map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
map.addControl(new maplibregl.AttributionControl({ compact: true }));
map.addControl(new maplibregl.FullscreenControl(), 'top-right');
map.addControl(new maplibregl.ScaleControl({ unit: 'imperial', maxWidth: 150 }), 'top-left');

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./service-worker.js').catch(console.error);
}

function setStatus(msg) {
  STATUS.textContent = msg;
}
function clearStatusSoon(ms = 2500) {
  setTimeout(() => {
    setStatus('');
  }, ms);
}

function classifyFeature(props = {}) {
  const p = props || {};
  const existing = (p.__class || p.type || p.category || '').toString().toLowerCase();
  if (existing && CATEGORY_META[existing]) return existing;

  const amenity = (p.amenity || '').toString().toLowerCase();
  const vending = (p.vending || '').toString().toLowerCase();
  const vendingSpecific = Object.keys(p)
    .filter(k => k.startsWith('vending:'))
    .map(k => `${k}:${String(p[k]).toLowerCase()}`);
  const isBag = vending.includes('excrement_bag') || vending.includes('excrement') ||
    vendingSpecific.some(v => v.includes('excrement_bag') || v.includes('excrement_bags'));
  if (amenity === 'vending_machine' && isBag) return 'bag';
  if (amenity === 'waste_disposal') return 'waste_disposal';
  if (amenity === 'recycling') return 'recycling';
  if (amenity === 'waste_basket') return 'trash';
  return 'other';
}

function featureKey(f) {
  if (f.properties && f.properties['@id']) return String(f.properties['@id']);
  const [lng, lat] = f.geometry.coordinates;
  const rlat = Math.round(lat * 300);
  const rlng = Math.round(lng * 300);
  return `xy:${rlng}:${rlat}`;
}

function mergeDedup(existing, incoming) {
  const map = new Map(existing.map(f => [featureKey(f), f]));
  let added = 0;
  for (const f of incoming) {
    const key = featureKey(f);
    if (!map.has(key)) added += 1;
    map.set(key, f);
  }
  return { merged: [...map.values()], added };
}

function ensureClassified(features) {
  return (features || []).map(f => {
    const props = { ...(f.properties || {}) };
    if (!props.__class) {
      props.__class = classifyFeature(props);
    }
    return { ...f, properties: props };
  });
}

function asGeoJSON(features) {
  return { type: 'FeatureCollection', features };
}

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function listRecyclingTags(props = {}) {
  const tags = [];
  Object.keys(props).forEach((key) => {
    if (key.startsWith('recycling:')) {
      const raw = String(props[key]).toLowerCase();
      if (raw === 'yes' || raw === '1' || raw === 'true') {
        tags.push(key.replace('recycling:', '').replace(/_/g, ' '));
      }
    }
  });
  return tags.join(', ');
}

function buildFeatureDetails(props = {}) {
  const rows = [];
  const amenity = props.amenity;
  const waste = props.waste || props['waste:disposal'];
  const vending = props.vending || props['vending:excrement_bags'];
  const recycling = listRecyclingTags(props);
  const operator = props.operator;
  const access = props.access;
  const description = props.note || props.description || props.notes;
  if (amenity) rows.push({ label: 'Amenity tag', value: amenity });
  if (waste) rows.push({ label: 'Waste tag', value: waste });
  if (recycling) rows.push({ label: 'Recycling', value: recycling });
  if (vending) rows.push({ label: 'Vending tag', value: vending });
  if (operator) rows.push({ label: 'Operator', value: operator });
  if (access) rows.push({ label: 'Access', value: access });
  if (description) rows.push({ label: 'Notes', value: description });
  return rows;
}

function describeGeolocationError(error) {
  if (!error || typeof error.code !== 'number') {
    return 'Unable to determine your location.';
  }
  switch (error.code) {
    case error.PERMISSION_DENIED:
    case 1:
      return 'Location permission denied. Allow access for this site in your browser settings.';
    case error.POSITION_UNAVAILABLE:
    case 2:
      return 'Location information is unavailable. Try moving closer to a window or enabling GPS.';
    case error.TIMEOUT:
    case 3:
      return 'Timed out while retrieving location. Please try again.';
    default:
      return 'Unable to determine your location.';
  }
}

function saveCache() {
  try {
    localStorage.setItem(LS_FEATURES_KEY, JSON.stringify(ALL_FEATURES));
    localStorage.setItem(LS_TIMESTAMP_KEY, String(Date.now()));
    localStorage.setItem(LS_CELLS_KEY, JSON.stringify([...COMPLETED_CELLS]));
    localStorage.removeItem(LEGACY_FEATURES_KEY);
    localStorage.removeItem(LEGACY_TIMESTAMP_KEY);
    localStorage.removeItem(LEGACY_CELLS_KEY);
  } catch (err) {
    console.warn('Cache write failed', err);
  }
}

function restoreCache() {
  try {
    const rawTs = localStorage.getItem(LS_TIMESTAMP_KEY) || localStorage.getItem(LEGACY_TIMESTAMP_KEY) || '0';
    const stored = localStorage.getItem(LS_FEATURES_KEY) || localStorage.getItem(LEGACY_FEATURES_KEY);
    const storedCells = localStorage.getItem(LS_CELLS_KEY) || localStorage.getItem(LEGACY_CELLS_KEY);
    const ts = parseInt(rawTs || '0', 10);
    const stale = !Number.isFinite(ts) || (Date.now() - ts) > CACHE_MAX_AGE_MS;
    if (!stale && stored) {
      ALL_FEATURES = ensureClassified(JSON.parse(stored));
      applyFilterToSource(ACTIVE_FILTER);
      if (ALL_FEATURES.length) {
        setStatus(`Loaded ${ALL_FEATURES.length} cached bins.`);
        LAST_FETCH_STATUS = Date.now();
      }
      localStorage.setItem(LS_FEATURES_KEY, JSON.stringify(ALL_FEATURES));
      localStorage.setItem(LS_TIMESTAMP_KEY, String(ts));
      if (storedCells) localStorage.setItem(LS_CELLS_KEY, storedCells);
      localStorage.removeItem(LEGACY_FEATURES_KEY);
      localStorage.removeItem(LEGACY_TIMESTAMP_KEY);
      localStorage.removeItem(LEGACY_CELLS_KEY);
    } else if (stale) {
      localStorage.removeItem(LS_FEATURES_KEY);
      localStorage.removeItem(LS_TIMESTAMP_KEY);
      localStorage.removeItem(LS_CELLS_KEY);
      localStorage.removeItem(LEGACY_FEATURES_KEY);
      localStorage.removeItem(LEGACY_TIMESTAMP_KEY);
      localStorage.removeItem(LEGACY_CELLS_KEY);
    }
    if (storedCells) {
      JSON.parse(storedCells).forEach(id => COMPLETED_CELLS.add(id));
    }
  } catch (err) {
    console.warn('Cache restore failed', err);
    localStorage.removeItem(LS_FEATURES_KEY);
    localStorage.removeItem(LS_TIMESTAMP_KEY);
    localStorage.removeItem(LS_CELLS_KEY);
    localStorage.removeItem(LEGACY_FEATURES_KEY);
    localStorage.removeItem(LEGACY_TIMESTAMP_KEY);
    localStorage.removeItem(LEGACY_CELLS_KEY);
    ALL_FEATURES = [];
  }
}

function quantize(value) {
  return Math.floor(value / FETCH_GRID_SIZE_DEG);
}

function cellId(lonIndex, latIndex) {
  return `${lonIndex}:${latIndex}`;
}

function buildCellBounds(lonIndex, latIndex) {
  const west = lonIndex * FETCH_GRID_SIZE_DEG;
  const south = latIndex * FETCH_GRID_SIZE_DEG;
  const east = west + FETCH_GRID_SIZE_DEG;
  const north = south + FETCH_GRID_SIZE_DEG;
  return [
    Math.max(-180, west),
    Math.max(-85, south),
    Math.min(180, east),
    Math.min(85, north)
  ];
}

function cellsForBounds(bounds) {
  if (!bounds) return [];
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  const lonStart = quantize(sw.lng);
  const lonEnd = quantize(ne.lng);
  const latStart = quantize(sw.lat);
  const latEnd = quantize(ne.lat);
  const cells = [];
  for (let lonIndex = Math.min(lonStart, lonEnd); lonIndex <= Math.max(lonStart, lonEnd); lonIndex++) {
    for (let latIndex = Math.min(latStart, latEnd); latIndex <= Math.max(latStart, latEnd); latIndex++) {
      cells.push({ id: cellId(lonIndex, latIndex), bbox: buildCellBounds(lonIndex, latIndex) });
    }
  }
  return cells;
}

async function precacheRegions() {
  for (const [west, south, east, north] of PRECACHE_REGIONS) {
    try {
      setStatus('Prefetching Greater Boston bins...');
      const features = await fetchOverpassBBox([west, south, east, north]);
      integrateFeatures(features, 'Overpass');
    } catch (err) {
      console.warn('Prefetch failed:', err);
    }
  }
  clearStatusSoon(1800);
}
function integrateFeatures(newFeatures, sourceLabel = 'Overpass') {
  if (!Array.isArray(newFeatures) || !newFeatures.length) return 0;
  const normalized = ensureClassified(newFeatures);
  const { merged, added } = mergeDedup(ALL_FEATURES, normalized);
  if (!added) return 0;
  ALL_FEATURES = merged;
  applyFilterToSource(ACTIVE_FILTER);
  LAST_FETCH_STATUS = Date.now();
  saveCache();
  setStatus(`Added ${added} bins (${sourceLabel}).`);
  clearStatusSoon(2600);
  return added;
}

function enqueueCells(cells, { prioritize = false, force = false } = {}) {
  if (!cells.length) return;
  let queued = 0;
  cells.forEach(cell => {
    if (COMPLETED_CELLS.has(cell.id) || REQUESTED_CELLS.has(cell.id)) return;
    REQUESTED_CELLS.add(cell.id);
    const payload = force ? { ...cell, force: true } : { ...cell };
    if (prioritize) {
      FETCH_QUEUE.unshift(payload);
    } else {
      FETCH_QUEUE.push(payload);
    }
    queued += 1;
  });
  if (queued) processFetchQueue();
}

async function processFetchQueue() {
  if (FETCH_ACTIVE || !FETCH_QUEUE.length) return;
  const cell = FETCH_QUEUE.shift();
  if (!cell) return;
  const forced = Boolean(cell.force);
  if (map.getZoom() < MIN_FETCH_ZOOM && !forced) {
    FETCH_QUEUE.unshift(cell);
    return;
  }
  FETCH_ACTIVE = true;
  setStatus('Loading bins...');
  try {
    const features = await fetchOverpassBBox(cell.bbox);
    const added = integrateFeatures(features, 'Overpass');
    COMPLETED_CELLS.add(cell.id);
    if (!added) {
      saveCache();
      setStatus('No bins found in this tile yet.');
      clearStatusSoon(2200);
    }
    REQUESTED_CELLS.delete(cell.id);
  } catch (err) {
    console.warn('Cell fetch failed', err);
    REQUESTED_CELLS.delete(cell.id);
    setStatus('Overpass fetch failed; retry after a moment.');
    clearStatusSoon(3500);
  } finally {
    FETCH_ACTIVE = false;
    processFetchQueue();
  }
}

function queueCellsForBounds(bounds, options = {}) {
  if (!bounds) return;
  const force = Boolean(options.force);
  if (!force && map.getZoom() < MIN_FETCH_ZOOM) {
    if (Date.now() - LAST_FETCH_STATUS > 2000) {
      setStatus('Zoom in (>= 9) to load bins.');
      clearStatusSoon(2600);
      LAST_FETCH_STATUS = Date.now();
    }
    return;
  }
  enqueueCells(cellsForBounds(bounds), options);
}

function slugify(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function levenshtein(a, b) {
  if (a === b) return 0;
  const aLen = a.length;
  const bLen = b.length;
  if (aLen === 0) return bLen;
  if (bLen === 0) return aLen;
  const matrix = Array.from({ length: aLen + 1 }, () => new Array(bLen + 1));
  for (let i = 0; i <= aLen; i++) matrix[i][0] = i;
  for (let j = 0; j <= bLen; j++) matrix[0][j] = j;
  for (let i = 1; i <= aLen; i++) {
    for (let j = 1; j <= bLen; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[aLen][bLen];
}

function scorePlace(normalizedQuery, place) {
  if (!normalizedQuery) return 0;
  let best = 0;
  const tokens = [place.name, ...(place.tokens || [])];
  for (const token of tokens) {
    const normalizedToken = slugify(token);
    if (!normalizedToken) continue;
    if (normalizedToken === normalizedQuery) {
      best = Math.max(best, 400);
      continue;
    }
    if (normalizedToken.startsWith(normalizedQuery)) {
      best = Math.max(best, 320 - (normalizedToken.length - normalizedQuery.length));
    }
    const idx = normalizedToken.indexOf(normalizedQuery);
    if (idx >= 0) {
      best = Math.max(best, 260 - idx * 5);
    }
    const dist = levenshtein(normalizedQuery, normalizedToken.slice(0, Math.max(normalizedToken.length, normalizedQuery.length)));
    best = Math.max(best, 220 - dist * 12);
  }
  return best;
}

function rankPlaces(query) {
  const normalizedQuery = slugify(query);
  if (!normalizedQuery) return [];
  return LOCAL_PLACES
    .map(place => ({ place, score: scorePlace(normalizedQuery, place) }))
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score);
}

function clearSuggestionHideTimer() {
  if (suggestionHideTimer) {
    clearTimeout(suggestionHideTimer);
    suggestionHideTimer = null;
  }
}

async function fetchOverpassBBox(bbox) {
  const [w,s,e,n] = bbox;
  const query = `[out:json][timeout:25];
(
  node["amenity"="waste_basket"](${s},${w},${n},${e});
  node["amenity"="waste_disposal"](${s},${w},${n},${e});
  node["amenity"="recycling"](${s},${w},${n},${e});
  node["amenity"="vending_machine"]["vending"="excrement_bags"](${s},${w},${n},${e});
  node["amenity"="vending_machine"]["vending"="dog_excrement_bags"](${s},${w},${n},${e});
  node["amenity"="vending_machine"]["vending"="dog_waste_bags"](${s},${w},${n},${e});
  node["amenity"="vending_machine"]["vending"="pet_waste_bags"](${s},${w},${n},${e});
  node["amenity"="vending_machine"]["vending"="waste_bags"](${s},${w},${n},${e});
  node["vending"="excrement_bags"](${s},${w},${n},${e});
  node["vending:excrement_bags"="yes"](${s},${w},${n},${e});
);
out body;`;
  const body = new URLSearchParams({ data: query });
  const resp = await fetch(OVERPASS_ENDPOINT, {
    method: 'POST',
    body,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'Accept': 'application/json'
    },
    mode: 'cors'
  });
  if (!resp.ok) throw new Error('Overpass error ' + resp.status);
  const data = await resp.json();
  const feats = (data.elements || [])
    .filter(el => el.type === 'node' && typeof el.lat === 'number' && typeof el.lon === 'number')
    .map(el => ({
      type: 'Feature',
      properties: {
        '@id': el.id,
        source: 'OpenStreetMap',
        ...(el.tags || {})
      },
      geometry: { type: 'Point', coordinates: [el.lon, el.lat] }
    }));
  return feats;
}

async function fetchBigBelly() {
  const url = BIGBELLY_REMOTE || BIGBELLY_LOCAL;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error('Big Belly dataset fetch failed');
  const gj = await resp.json();
  const feats = (gj.features || []).map(f => {
    const g = f.geometry;
    if (!g || g.type !== 'Point') return null;
    const props = { ...(f.properties || {}), source: f.properties?.source || 'Analyze Boston' };
    if (!props.type) props.type = 'trash';
    return { type: 'Feature', properties: props, geometry: g };
  }).filter(Boolean);
  return feats;
}

async function loadSupplementalDatasets() {
  try {
    const bellyFeats = await fetchBigBelly();
    integrateFeatures(bellyFeats, 'Analyze Boston sample');
  } catch (err) {
    console.warn('Big Belly dataset failed', err);
  }
}

function addSourcesAndLayers() {
  if (map.getSource('bins')) return;

  map.addSource('bins', {
    type: 'geojson',
    data: asGeoJSON([]),
    cluster: true,
    clusterRadius: 60,
    clusterMaxZoom: 16
  });

  map.addLayer({
    id: 'clusters',
    type: 'circle',
    source: 'bins',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': [
        'step', ['get', 'point_count'],
        '#60a5fa', 50, '#22c55e', 150, '#c084fc'
      ],
      'circle-radius': [
        'step', ['get', 'point_count'],
        18, 50, 24, 150, 32
      ],
      'circle-opacity': 0.85
    }
  });

  map.addLayer({
    id: 'cluster-count',
    type: 'symbol',
    source: 'bins',
    filter: ['has', 'point_count'],
    layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 12 },
    paint: { 'text-color': '#ffffff' }
  });

  map.addLayer({
    id: 'unclustered-point',
    type: 'circle',
    source: 'bins',
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': CATEGORY_COLOR_EXPRESSION,
      'circle-radius': 6,
      'circle-stroke-color': '#0b1221',
      'circle-stroke-width': 1.5
    }
  });

  const popup = new maplibregl.Popup({ closeButton: true, closeOnClick: true });
  map.on('click', 'unclustered-point', (e) => {
    const f = e.features[0];
    const p = f.properties || {};
    const cls = p.__class || 'other';
    const meta = CATEGORY_META[cls] || CATEGORY_META.other;
    const src = p.source || 'Unknown';
    const name = p.name || meta.label || 'Public receptacle';
    const coord = f.geometry.coordinates.slice();
    const detailItems = buildFeatureDetails(p)
      .map(row => `<li class="detail-item"><span class="label">${escapeHtml(row.label)}</span><span class="value">${escapeHtml(row.value)}</span></li>`)
      .join('');
    const detailSection = detailItems ? `<ul class="detail-list">${detailItems}</ul>` : '';
    const html = `
      <div class="popup">
        <h3>${escapeHtml(name)}</h3>
        <div class="muted">Category: ${escapeHtml(meta.label)} - Source: ${escapeHtml(src)}</div>
        ${detailSection}
        <div class="muted">OSM edit help: <a href="https://learnosm.org/en/mobile-mapping/field-papers/" target="_blank" rel="noopener">How to add / fix on OSM</a></div>
      </div>`;
    popup.setLngLat(coord).setHTML(html).addTo(map);
  });

  map.on('click', 'clusters', (e) => {
    const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
    const clusterId = features[0].properties.cluster_id;
    const source = map.getSource('bins');
    source.getClusterExpansionZoom(clusterId, (err, zoom) => {
      if (err) return;
      map.easeTo({ center: features[0].geometry.coordinates, zoom });
    });
  });

  map.on('mouseenter', 'unclustered-point', () => map.getCanvas().style.cursor = 'pointer');
  map.on('mouseleave', 'unclustered-point', () => map.getCanvas().style.cursor = '');
  map.on('mouseenter', 'clusters', () => map.getCanvas().style.cursor = 'pointer');
  map.on('mouseleave', 'clusters', () => map.getCanvas().style.cursor = '');
}

function applyFilterToSource(filter) {
  const source = map.getSource('bins');
  if (!source) return 0;
  const all = ALL_FEATURES;
  let filtered = all;
  if (filter && filter !== 'all') filtered = all.filter(f => (f.properties?.__class) === filter);
  source.setData(asGeoJSON(filtered));
  return filtered.length;
}

function renderSuggestions() {
  SEARCH_SUGGESTIONS_EL.innerHTML = '';
  SEARCH_SUGGESTIONS_EL.classList.remove('visible');
  SEARCH_INPUT.setAttribute('aria-expanded', 'false');
  SEARCH_INPUT.removeAttribute('aria-activedescendant');
  if (!CURRENT_SUGGESTIONS.length) return;
  CURRENT_SUGGESTIONS.forEach((entry, index) => {
    const item = document.createElement('div');
    item.className = 'search-suggestion';
    if (index === HIGHLIGHT_INDEX) item.classList.add('active');
    item.setAttribute('role', 'option');
    item.dataset.index = String(index);
    const suggestionId = `search-option-${index}`;
    item.id = suggestionId;
    item.setAttribute('aria-selected', index === HIGHLIGHT_INDEX ? 'true' : 'false');
    item.tabIndex = -1;
    const title = document.createElement('span');
    title.className = 'suggestion-title';
    title.textContent = entry.place.name;
    const subtitle = document.createElement('span');
    subtitle.className = 'subtitle';
    subtitle.textContent = entry.place.subtitle || 'United States';
    item.appendChild(title);
    item.appendChild(subtitle);
    item.addEventListener('mousedown', (e) => {
      e.preventDefault();
      commitSuggestion(index);
    });
    SEARCH_SUGGESTIONS_EL.appendChild(item);
  });
  SEARCH_SUGGESTIONS_EL.classList.add('visible');
  SEARCH_INPUT.setAttribute('aria-expanded', 'true');
  if (HIGHLIGHT_INDEX >= 0 && CURRENT_SUGGESTIONS[HIGHLIGHT_INDEX]) {
    SEARCH_INPUT.setAttribute('aria-activedescendant', `search-option-${HIGHLIGHT_INDEX}`);
  }
}

function hideSuggestions() {
  CURRENT_SUGGESTIONS = [];
  HIGHLIGHT_INDEX = -1;
  SEARCH_SUGGESTIONS_EL.innerHTML = '';
  SEARCH_SUGGESTIONS_EL.classList.remove('visible');
  SEARCH_INPUT.setAttribute('aria-expanded', 'false');
  SEARCH_INPUT.removeAttribute('aria-activedescendant');
}

function updateSuggestions(query) {
  clearSuggestionHideTimer();
  const trimmed = (query || '').trim();
  if (!trimmed) {
    hideSuggestions();
    return;
  }
  CURRENT_SUGGESTIONS = rankPlaces(trimmed).slice(0, 7);
  HIGHLIGHT_INDEX = -1;
  if (!CURRENT_SUGGESTIONS.length) {
    hideSuggestions();
    return;
  }
  renderSuggestions();
}

function highlightSuggestion(index) {
  if (!CURRENT_SUGGESTIONS.length) return;
  const max = CURRENT_SUGGESTIONS.length - 1;
  if (index < 0) {
    HIGHLIGHT_INDEX = -1;
    renderSuggestions();
    return;
  }
  HIGHLIGHT_INDEX = Math.max(0, Math.min(index, max));
  renderSuggestions();
}

function flyToPlace(place) {
  if (!place) return;
  hideSuggestions();
  const zoomTarget = Math.min(place.zoom ?? 13.2, map.getMaxZoom() - 0.2);
  map.easeTo({ center: place.center, zoom: zoomTarget, duration: 900 });
  const [lon, lat] = place.center;
  const bounds = new maplibregl.LngLatBounds(
    new maplibregl.LngLat(lon - FETCH_GRID_SIZE_DEG, lat - FETCH_GRID_SIZE_DEG),
    new maplibregl.LngLat(lon + FETCH_GRID_SIZE_DEG, lat + FETCH_GRID_SIZE_DEG)
  );
  queueCellsForBounds(bounds, { prioritize: true, force: true });
  setStatus(`Showing: ${place.name}`);
  clearStatusSoon(2800);
}

function commitSuggestion(index) {
  clearSuggestionHideTimer();
  const entry = CURRENT_SUGGESTIONS[index];
  if (!entry) return;
  SEARCH_INPUT.value = entry.place.name;
  flyToPlace(entry.place);
}

async function geocodeRemote(query) {
  const trimmed = (query || '').trim();
  if (!trimmed) return null;
  const cacheKey = trimmed.toLowerCase();
  if (GEOCODE_CACHE.has(cacheKey)) {
    return GEOCODE_CACHE.get(cacheKey);
  }
  if (GEOCODE_ABORT) {
    try {
      GEOCODE_ABORT.abort();
    } catch (err) {
      console.warn('Abort previous geocode failed', err);
    }
  }
  const controller = new AbortController();
  GEOCODE_ABORT = controller;
  const url = `${GEOCODE_ENDPOINT}?q=${encodeURIComponent(trimmed)}&limit=5`;
  let resp;
  try {
    resp = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
  } finally {
    if (GEOCODE_ABORT === controller) GEOCODE_ABORT = null;
  }
  if (!resp.ok) throw new Error('Geocode error ' + resp.status);
  const data = await resp.json();
  const first = Array.isArray(data) ? data[0] : null;
  if (!first) {
    GEOCODE_CACHE.set(cacheKey, null);
    return null;
  }
  const lat = parseFloat(first.lat);
  const lon = parseFloat(first.lon);
  const box = first.boundingbox;
  let bounds = null;
  if (Array.isArray(box) && box.length === 4) {
    const south = parseFloat(box[0]);
    const north = parseFloat(box[1]);
    const west = parseFloat(box[2]);
    const east = parseFloat(box[3]);
    if (Number.isFinite(south) && Number.isFinite(north) && Number.isFinite(west) && Number.isFinite(east)) {
      bounds = [[west, south], [east, north]];
    }
  }
  const result = {
    center: [lon, lat],
    bounds,
    label: first.display_name || trimmed
  };
  GEOCODE_CACHE.set(cacheKey, result);
  return result;
}

async function handleSearch() {
  const query = (SEARCH_INPUT.value || '').trim();
  if (!query) {
    setStatus('Enter a neighborhood, city, or address.');
    clearStatusSoon(2500);
    return;
  }
  clearSuggestionHideTimer();
  hideSuggestions();
  const ranked = rankPlaces(query);
  const bestLocal = ranked.length ? ranked[0] : null;

  if (bestLocal && bestLocal.score >= 260) {
    flyToPlace(bestLocal.place);
    return;
  }

  setStatus('Searching address...');
  try {
    const geocoded = await geocodeRemote(query);
    if (geocoded) {
      if (geocoded.bounds) {
        map.fitBounds(geocoded.bounds, { padding: 60, maxZoom: Math.min(16, map.getMaxZoom()), duration: 900 });
        const boundsObj = new maplibregl.LngLatBounds(
          new maplibregl.LngLat(geocoded.bounds[0][0], geocoded.bounds[0][1]),
          new maplibregl.LngLat(geocoded.bounds[1][0], geocoded.bounds[1][1])
        );
        queueCellsForBounds(boundsObj, { prioritize: true, force: true });
      } else if (geocoded.center.every(Number.isFinite)) {
        const zoomTarget = Math.min(15, map.getMaxZoom() - 0.2);
        map.easeTo({ center: geocoded.center, zoom: zoomTarget, duration: 900 });
        const [lon, lat] = geocoded.center;
        const localBounds = new maplibregl.LngLatBounds(
          new maplibregl.LngLat(lon - FETCH_GRID_SIZE_DEG, lat - FETCH_GRID_SIZE_DEG),
          new maplibregl.LngLat(lon + FETCH_GRID_SIZE_DEG, lat + FETCH_GRID_SIZE_DEG)
        );
        queueCellsForBounds(localBounds, { prioritize: true, force: true });
      }
      setStatus(`Showing: ${geocoded.label}`);
      clearStatusSoon(2800);
      return;
    }
  } catch (err) {
    console.warn('Geocode lookup failed', err);
  }

  if (bestLocal) {
    flyToPlace(bestLocal.place);
  } else {
    setStatus('No matches found yet. Try a nearby landmark.');
    clearStatusSoon(3200);
  }
}

async function locateOnce() {
  if (!navigator.geolocation) {
    setStatus('Geolocation is not supported in this browser.');
    clearStatusSoon(3000);
    return;
  }

  try {
    if (navigator.permissions && navigator.permissions.query) {
      const state = await navigator.permissions.query({ name: 'geolocation' });
      if (state.state === 'denied') {
        setStatus('Location permission is blocked. Enable access for this site in your browser settings.');
        clearStatusSoon(4000);
        return;
      }
    }
  } catch (err) {
    console.warn('Permission query failed', err);
  }

  setStatus('Requesting current location...');
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      const targetZoom = Math.min(Math.max(map.getZoom(), 15), map.getMaxZoom() - 0.2);
      map.easeTo({ center: [longitude, latitude], zoom: targetZoom });
      const bounds = new maplibregl.LngLatBounds(
        new maplibregl.LngLat(longitude - FETCH_GRID_SIZE_DEG, latitude - FETCH_GRID_SIZE_DEG),
        new maplibregl.LngLat(longitude + FETCH_GRID_SIZE_DEG, latitude + FETCH_GRID_SIZE_DEG)
      );
      queueCellsForBounds(bounds, { prioritize: true, force: true });
      if (Number.isFinite(accuracy)) {
        setStatus(`Centered on your location (accuracy +/- ${Math.round(accuracy)} m).`);
      } else {
        setStatus('Centered on your location.');
      }
      clearStatusSoon(3200);
    },
    (err) => {
      console.warn('Geolocation failed', err);
      setStatus(describeGeolocationError(err));
      clearStatusSoon(4000);
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
  );
}

FILTER_CHIPS.forEach(chip => {
  chip.addEventListener('click', () => {
    FILTER_CHIPS.forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    ACTIVE_FILTER = chip.dataset.filter || 'all';
    const count = applyFilterToSource(ACTIVE_FILTER);
    const meta = CATEGORY_META[ACTIVE_FILTER];
    if (!ALL_FEATURES.length) {
      setStatus('Loading bins...');
      return;
    }
    if (ACTIVE_FILTER === 'all') {
      setStatus(`Showing all ${count} locations.`);
    } else if (meta) {
      setStatus(`Showing ${count} ${meta.label.toLowerCase()}${count === 1 ? '' : 's'}.`);
    } else {
      setStatus(`Showing ${count} locations.`);
    }
    clearStatusSoon(2200);
  });
  chip.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') chip.click(); });
});

SEARCH_BTN.addEventListener('click', () => {
  handleSearch();
});

SEARCH_INPUT.addEventListener('input', (e) => {
  updateSuggestions(e.target.value);
});

SEARCH_INPUT.addEventListener('focus', () => {
  if (SEARCH_INPUT.value.trim()) updateSuggestions(SEARCH_INPUT.value);
});

SEARCH_INPUT.addEventListener('blur', () => {
  clearSuggestionHideTimer();
  suggestionHideTimer = setTimeout(() => hideSuggestions(), 150);
});

SEARCH_INPUT.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (!CURRENT_SUGGESTIONS.length) updateSuggestions(SEARCH_INPUT.value);
    if (CURRENT_SUGGESTIONS.length) {
      const next = (HIGHLIGHT_INDEX + 1) % CURRENT_SUGGESTIONS.length;
      highlightSuggestion(next);
    }
    return;
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (!CURRENT_SUGGESTIONS.length) updateSuggestions(SEARCH_INPUT.value);
    if (CURRENT_SUGGESTIONS.length) {
      const next = HIGHLIGHT_INDEX <= 0 ? CURRENT_SUGGESTIONS.length - 1 : HIGHLIGHT_INDEX - 1;
      highlightSuggestion(next);
    } else {
      highlightSuggestion(-1);
    }
    return;
  }
  if (e.key === 'Enter') {
    e.preventDefault();
    if (HIGHLIGHT_INDEX >= 0 && CURRENT_SUGGESTIONS[HIGHLIGHT_INDEX]) {
      commitSuggestion(HIGHLIGHT_INDEX);
    } else {
      handleSearch();
    }
    return;
  }
  if (e.key === 'Escape') {
    hideSuggestions();
    return;
  }
});

LOCATE_BTN.addEventListener('click', locateOnce);

map.on('load', async () => {
  addSourcesAndLayers();
  restoreCache();
  applyFilterToSource(ACTIVE_FILTER);
  queueCellsForBounds(map.getBounds(), { prioritize: true });
  await precacheRegions();
  await loadSupplementalDatasets();
  if (!ALL_FEATURES.length) {
    setStatus('Zoom in on a city to load bins.');
    clearStatusSoon(3000);
  }
  processFetchQueue();
  map.on('moveend', () => {
    queueCellsForBounds(map.getBounds(), { prioritize: true });
    processFetchQueue();
  });
  map.on('zoomend', () => {
    queueCellsForBounds(map.getBounds(), { prioritize: true });
    processFetchQueue();
  });
});
