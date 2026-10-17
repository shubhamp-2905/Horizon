import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export interface GeocodeItem {
  place_id: string;
  display_name: string;
  name: string;
  lat: number;
  lon: number;
  type?: string;
  city?: string;
  state?: string;
  country?: string;
  postcode?: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  // 1. Direct coordinate check: e.g. "18.5204, 73.8567" or "18.5204 73.8567"
  const coordMatch = q.match(/^([-+]?\d{1,2}(?:\.\d+)?)[,\s]+([-+]?\d{1,3}(?:\.\d+)?)$/);
  if (coordMatch) {
    const lat = parseFloat(coordMatch[1]);
    const lon = parseFloat(coordMatch[2]);
    if (!isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      return NextResponse.json({
        results: [
          {
            place_id: `coord-${lat.toFixed(6)}-${lon.toFixed(6)}`,
            display_name: `Coordinates: ${lat.toFixed(6)}° N, ${lon.toFixed(6)}° E`,
            name: `${lat.toFixed(6)}, ${lon.toFixed(6)}`,
            lat,
            lon,
            type: 'coordinate',
          },
        ],
      });
    }
  }

  const results: GeocodeItem[] = [];

  // 2. Primary: Photon (Komoot OSM Global Geocoder) - Fast, global, highly responsive autocomplete
  try {
    const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=10`;
    const photonRes = await fetch(photonUrl, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (photonRes.ok) {
      const data = await photonRes.json();
      if (data && Array.isArray(data.features)) {
        for (const feat of data.features) {
          const props = feat.properties || {};
          const coords = feat.geometry?.coordinates || [];
          if (coords.length >= 2) {
            const lon = parseFloat(coords[0]);
            const lat = parseFloat(coords[1]);
            const name = props.name || props.street || q;
            const parts = [
              props.name,
              props.street,
              props.district,
              props.city,
              props.state,
              props.postcode,
              props.country,
            ].filter(Boolean);
            const displayName = parts.length > 0 ? parts.join(', ') : name;

            results.push({
              place_id: `photon-${props.osm_id || Math.random()}`,
              display_name: displayName,
              name,
              lat,
              lon,
              type: props.osm_value || props.type || 'location',
              city: props.city,
              state: props.state,
              country: props.country,
              postcode: props.postcode,
            });
          }
        }
      }
    }
  } catch (err) {
    console.warn('Photon geocoding error:', err);
  }

  // 3. Fallback / Enrichment: Nominatim with compliant User-Agent if Photon returned few results
  if (results.length < 4) {
    try {
      const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        q
      )}&limit=8&addressdetails=1`;
      const nomRes = await fetch(nominatimUrl, {
        headers: {
          'User-Agent': 'Horizon-Admin-Dashboard/1.0 (geocoding@horizon.earth)',
          'Accept-Language': 'en',
        },
      });

      if (nomRes.ok) {
        const nomData = await nomRes.json();
        if (Array.isArray(nomData)) {
          for (const item of nomData) {
            const lat = parseFloat(item.lat);
            const lon = parseFloat(item.lon);
            // Avoid duplicates
            const isDup = results.some(
              (r) => Math.abs(r.lat - lat) < 0.001 && Math.abs(r.lon - lon) < 0.001
            );
            if (!isDup) {
              results.push({
                place_id: `nom-${item.place_id}`,
                display_name: item.display_name,
                name: item.name || item.display_name.split(',')[0],
                lat,
                lon,
                type: item.type || item.class || 'place',
                city: item.address?.city || item.address?.town || item.address?.village,
                state: item.address?.state,
                country: item.address?.country,
                postcode: item.address?.postcode,
              });
            }
          }
        }
      }
    } catch (err) {
      console.warn('Nominatim fallback geocoding error:', err);
    }
  }

  return NextResponse.json({ results });
}
