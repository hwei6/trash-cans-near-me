# Trash Cans Near Me (Client-only PWA)

Trash Cans Near Me is a free, privacy-preserving **Progressive Web App** that helps residents and visitors locate public waste baskets, recycling containers, waste-disposal bins, and pet bag dispensers anywhere in the United States.

- **Client-only**: No servers, accounts, telemetry, or third-party analytics.
- **Data sources**: OpenStreetMap (via Overpass API) plus optional municipal datasets (Boston Big Belly sample included).
- **Installable**: Works great on phones, tablets, and desktops as a PWA.
- **Accessible**: Keyboard navigation, ARIA labeling, and high-contrast markers.

---

## Usage

1. Load the published site in your browser.
2. Zoom in to city or neighborhood level (>= 9) to trigger live bin fetching.
3. Toggle the category chips or press **Current location** to focus on your position.

---

## How It Works

- **Map engine**: MapLibre GL JS rendering OpenStreetMap tiles (high detail, no API keys needed).
- **Dynamic data fetch**: When you zoom in (>= 9) the app automatically queries the Overpass API for the visible half-degree tiles (approx. 55 km square) and caches results locally.
- **Categories**: Waste baskets, recycling containers, waste-disposal bins, and pet bag dispensers. Filters and legend colors mirror these categories.
- **Supplemental data**: An optional City of Boston Big Belly sample is bundled for offline testing; you can swap in another GeoJSON feed if CORS permits.
- **Search**: Smart autocomplete for major U.S. cities plus fuzzy matching and a free geocoder fallback for specific addresses.
- **Offline-first**: The service worker caches the app shell, remote tiles, and previously fetched bin data so the experience degrades gracefully offline.

---

## Configuration Highlights (`main.js`)

- `FETCH_GRID_SIZE_DEG`: Adjust the Overpass query grid (default 0.5 deg).
- `MIN_FETCH_ZOOM`: Minimum zoom required before issuing new Overpass requests.
- `LOCAL_PLACES`: Add or tweak autocomplete presets (city name, tokens, zoom, etc.).
- `BIGBELLY_REMOTE`: Optional municipal dataset URL if a CORS-friendly source is available; otherwise the bundled sample is used.
- Marker colors and category labels live in the `CATEGORY_META` map.

---

## Privacy & Security

- Geolocation runs only when the user taps **Current location**.
- No logs or analytics are sent anywhere; all processing happens in the browser.
- Cached data lives in `localStorage` and the service worker caches. Users can clear it via browser storage settings.
- Adopt a stricter Content Security Policy if you further restrict external origins.

---

## Data Attribution & Licenses

- Copyright OpenStreetMap contributors (Open Database License).
- Basemap tiles (c) OpenStreetMap contributors.
- City of Boston Big Belly sample (terms per Analyze Boston).
- Map rendering copyright MapLibre GL JS.

---

## Acceptance Checklist

- Initial load under ~2 MB (excluding map tiles).
- Smooth pan/zoom, clusters expand quickly, and filters respond instantly.
- Works in airplane mode with cached bins and a clear offline banner.
- Geolocation denial handled gracefully; search and manual navigation still work.
- A11y: All interactive elements are focusable with descriptive labels.

---

## Tips & Notes

- Overpass has global rate limits. The app throttles requests by tile and queues them one at a time to stay friendly. If Overpass responds with 429/5xx, the UI notifies the user and retries on the next pan/zoom.
- Encourage coverage improvements by contributing to OpenStreetMap; the popup links to editing guidance.

---

## Credits

- Maintained by hwei6
- MapLibre GL JS
- OpenStreetMap & contributors
- Analyze Boston (City of Boston Big Belly sample)
