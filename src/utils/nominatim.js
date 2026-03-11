// Nominatim usage policy: max 1 request per second
let lastNominatimCall = 0;

export async function nominatimRateLimit() {
  const elapsed = Date.now() - lastNominatimCall;
  if (elapsed < 1100) {
    await new Promise((r) => setTimeout(r, 1100 - elapsed));
  }
  lastNominatimCall = Date.now();
}

/**
 * Forward geocode: search locations by name.
 * Returns an array of { lat, lon, displayName } objects.
 */
export async function searchLocations(query, { signal } = {}) {
  if (!query || query.trim().length < 2) return [];

  await nominatimRateLimit();

  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query.trim())}&limit=5`,
    {
      signal,
      headers: { 'User-Agent': 'WeatherApp/1.0' },
    }
  );

  if (!response.ok) {
    throw new Error('Search failed');
  }

  const data = await response.json();
  return data.map((item) => ({
    lat: parseFloat(item.lat),
    lon: parseFloat(item.lon),
    displayName: item.display_name,
  }));
}
