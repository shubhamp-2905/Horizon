'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface LocationPickerMapProps {
  latitude: number;
  longitude: number;
  onChange: (lat: number, lng: number, address?: string) => void;
  radiusMeters?: number;
}

interface SearchResult {
  place_id: number | string;
  display_name: string;
  lat: string;
  lon: string;
}

const PRESET_LOCATIONS = [
  { name: 'Pune Center', lat: 18.5204, lng: 73.8567 },
  { name: 'Hinjewadi IT Park', lat: 18.5912, lng: 73.7389 },
  { name: 'Kothrud', lat: 18.5074, lng: 73.8077 },
  { name: 'Viman Nagar', lat: 18.5679, lng: 73.9143 },
  { name: 'Mumbai', lat: 19.0760, lng: 72.8777 },
  { name: 'Bengaluru', lat: 12.9716, lng: 77.5946 },
  { name: 'New Delhi', lat: 28.6139, lng: 77.2090 },
];

export const LocationPickerMap: React.FC<LocationPickerMapProps> = ({
  latitude,
  longitude,
  onChange,
  radiusMeters = 50,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<string>('');
  const [isLocating, setIsLocating] = useState(false);

  // Custom emerald pin icon matching Horizon brand
  const createPinIcon = useCallback(() => {
    return L.divIcon({
      className: 'horizon-pin-marker',
      html: `
        <div style="position:relative; width:34px; height:34px; display:flex; align-items:center; justify-content:center;">
          <div style="position:absolute; width:18px; height:18px; background:#15803D; opacity:0.35; border-radius:50%; animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>
          <div style="background:#15803D; width:30px; height:30px; border-radius:50% 50% 50% 0; transform:rotate(-45deg); display:flex; align-items:center; justify-content:center; box-shadow:0 3px 10px rgba(21,128,61,0.4); border:2.5px solid #FFFFFF;">
            <div style="width:9px; height:9px; background:#FFFFFF; border-radius:50%; transform:rotate(45deg);"></div>
          </div>
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 32],
      popupAnchor: [0, -30],
    });
  }, []);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const initialLat = isNaN(latitude) ? 18.5204 : latitude;
    const initialLng = isNaN(longitude) ? 73.8567 : longitude;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 14,
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);

    const pinIcon = createPinIcon();

    // Draggable marker
    const marker = L.marker([initialLat, initialLng], {
      draggable: true,
      icon: pinIcon,
    }).addTo(map);

    // Geographic scope radius circle
    const circle = L.circle([initialLat, initialLng], {
      radius: radiusMeters,
      color: '#15803D',
      fillColor: '#22C55E',
      fillOpacity: 0.15,
      weight: 1.5,
    }).addTo(map);

    // Marker drag handler
    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      circle.setLatLng(pos);
      onChange(parseFloat(pos.lat.toFixed(6)), parseFloat(pos.lng.toFixed(6)));
    });

    // Map click handler: moves pin & circle
    map.on('click', (e: L.LeafletMouseEvent) => {
      const clickedLat = parseFloat(e.latlng.lat.toFixed(6));
      const clickedLng = parseFloat(e.latlng.lng.toFixed(6));
      marker.setLatLng([clickedLat, clickedLng]);
      circle.setLatLng([clickedLat, clickedLng]);
      onChange(clickedLat, clickedLng);
    });

    mapInstanceRef.current = map;
    markerRef.current = marker;
    circleRef.current = circle;

    // Invalidate size to ensure tiles render properly inside modal
    setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
    };
  }, [createPinIcon, onChange, radiusMeters]); // Initial mount only

  // Sync external coordinate changes with map
  useEffect(() => {
    if (!mapInstanceRef.current || !markerRef.current || !circleRef.current) return;
    if (isNaN(latitude) || isNaN(longitude)) return;

    const currentPos = markerRef.current.getLatLng();
    if (
      Math.abs(currentPos.lat - latitude) > 0.0001 ||
      Math.abs(currentPos.lng - longitude) > 0.0001
    ) {
      markerRef.current.setLatLng([latitude, longitude]);
      circleRef.current.setLatLng([latitude, longitude]);
      mapInstanceRef.current.setView([latitude, longitude], mapInstanceRef.current.getZoom(), {
        animate: true,
      });
    }
  }, [latitude, longitude]);

  // Update circle radius when prop changes
  useEffect(() => {
    if (circleRef.current) {
      circleRef.current.setRadius(radiusMeters);
    }
  }, [radiusMeters]);

  // Geocoding search handler using OpenStreetMap Nominatim
  const handleSearch = async (queryText: string) => {
    if (!queryText.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    setIsSearching(true);
    setShowDropdown(true);

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          queryText.trim()
        )}&limit=5&addressdetails=1`
      );

      if (res.ok) {
        const data: SearchResult[] = await res.json();
        setSearchResults(data);
      } else {
        // Fallback filter over presets
        const filtered = PRESET_LOCATIONS.filter((p) =>
          p.name.toLowerCase().includes(queryText.toLowerCase())
        ).map((p, idx) => ({
          place_id: `preset-${idx}`,
          display_name: `${p.name}, India`,
          lat: p.lat.toString(),
          lon: p.lng.toString(),
        }));
        setSearchResults(filtered);
      }
    } catch {
      // Offline fallback
      const filtered = PRESET_LOCATIONS.filter((p) =>
        p.name.toLowerCase().includes(queryText.toLowerCase())
      ).map((p, idx) => ({
        place_id: `preset-${idx}`,
        display_name: `${p.name}, India`,
        lat: p.lat.toString(),
        lon: p.lng.toString(),
      }));
      setSearchResults(filtered);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectLocation = (result: SearchResult) => {
    const lat = parseFloat(parseFloat(result.lat).toFixed(6));
    const lng = parseFloat(parseFloat(result.lon).toFixed(6));
    setSelectedAddress(result.display_name);
    setSearchQuery(result.display_name.split(',')[0]);
    setShowDropdown(false);

    if (mapInstanceRef.current && markerRef.current && circleRef.current) {
      markerRef.current.setLatLng([lat, lng]);
      circleRef.current.setLatLng([lat, lng]);
      mapInstanceRef.current.setView([lat, lng], 15, { animate: true });
    }

    onChange(lat, lng, result.display_name);
  };

  const handleSelectPreset = (preset: (typeof PRESET_LOCATIONS)[0]) => {
    setSelectedAddress(preset.name);
    setSearchQuery(preset.name);
    setShowDropdown(false);

    if (mapInstanceRef.current && markerRef.current && circleRef.current) {
      markerRef.current.setLatLng([preset.lat, preset.lng]);
      circleRef.current.setLatLng([preset.lat, preset.lng]);
      mapInstanceRef.current.setView([preset.lat, preset.lng], 15, { animate: true });
    }

    onChange(preset.lat, preset.lng, preset.name);
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const lat = parseFloat(pos.coords.latitude.toFixed(6));
        const lng = parseFloat(pos.coords.longitude.toFixed(6));
        setSelectedAddress('Current Device Location');
        setSearchQuery('My Current Location');
        if (mapInstanceRef.current && markerRef.current && circleRef.current) {
          markerRef.current.setLatLng([lat, lng]);
          circleRef.current.setLatLng([lat, lng]);
          mapInstanceRef.current.setView([lat, lng], 15, { animate: true });
        }
        onChange(lat, lng, 'Current Location');
      },
      () => {
        setIsLocating(false);
        alert('Could not access current location. Please check browser permissions.');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* Search Input Bar with Geocoding Autocomplete */}
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <span
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: '14px',
                color: '#667085',
                pointerEvents: 'none',
              }}
            >
              🔍
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                handleSearch(e.target.value);
              }}
              onFocus={() => {
                if (searchQuery.trim().length > 1) setShowDropdown(true);
              }}
              placeholder="Search place, city, or address (e.g. Pune, Kothrud, Hinjewadi)..."
              className="form-input-text"
              style={{
                paddingLeft: '36px',
                paddingRight: isSearching ? '36px' : '12px',
                height: '40px',
                fontSize: '13px',
                background: '#FFFFFF',
                borderColor: '#D0D5DD',
              }}
            />
            {isSearching && (
              <span
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: '12px',
                  color: '#15803D',
                  fontWeight: 600,
                }}
              >
                ⟳
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleLocateMe}
            disabled={isLocating}
            className="btn btn-secondary btn-sm"
            style={{
              height: '40px',
              padding: '0 14px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
              background: '#F8F9FA',
              borderColor: '#EAECF0',
              color: '#344054',
              fontSize: '12px',
              fontWeight: 600,
            }}
            title="Locate my position via GPS"
          >
            <span>🎯</span>
            <span>{isLocating ? 'Locating...' : 'My Location'}</span>
          </button>
        </div>

        {/* Dropdown search suggestions */}
        {showDropdown && searchResults.length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              zIndex: 1000,
              marginTop: '4px',
              background: '#FFFFFF',
              borderRadius: '8px',
              border: '1px solid #EAECF0',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
              maxHeight: '220px',
              overflowY: 'auto',
            }}
          >
            {searchResults.map((item) => (
              <div
                key={item.place_id}
                onClick={() => handleSelectLocation(item)}
                style={{
                  padding: '10px 14px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  color: '#101828',
                  borderBottom: '1px solid #F2F4F7',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#F9FAFB';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#FFFFFF';
                }}
              >
                <span style={{ color: '#15803D', fontSize: '13px' }}>📍</span>
                <span style={{ flex: 1, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  {item.display_name}
                </span>
                <span style={{ fontSize: '11px', color: '#98A2B3', fontFamily: 'monospace' }}>
                  {parseFloat(item.lat).toFixed(4)}, {parseFloat(item.lon).toFixed(4)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preset Quick Chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', color: '#667085', fontWeight: 600 }}>Quick Presets:</span>
        {PRESET_LOCATIONS.map((preset) => (
          <button
            key={preset.name}
            type="button"
            onClick={() => handleSelectPreset(preset)}
            style={{
              background:
                Math.abs(latitude - preset.lat) < 0.001 && Math.abs(longitude - preset.lng) < 0.001
                  ? '#ECFDF5'
                  : '#F8F9FA',
              border:
                Math.abs(latitude - preset.lat) < 0.001 && Math.abs(longitude - preset.lng) < 0.001
                  ? '1px solid #15803D'
                  : '1px solid #EAECF0',
              color:
                Math.abs(latitude - preset.lat) < 0.001 && Math.abs(longitude - preset.lng) < 0.001
                  ? '#15803D'
                  : '#475467',
              borderRadius: '16px',
              padding: '3px 10px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {preset.name}
          </button>
        ))}
      </div>

      {/* Interactive Leaflet Map Container */}
      <div
        style={{
          position: 'relative',
          borderRadius: '10px',
          overflow: 'hidden',
          border: '1px solid #EAECF0',
          boxShadow: '0 1px 3px rgba(16, 24, 40, 0.05)',
        }}
      >
        <div
          ref={mapContainerRef}
          style={{
            height: '240px',
            width: '100%',
            background: '#F2F4F7',
            zIndex: 1,
          }}
        />

        {/* Floating Instruction overlay */}
        <div
          style={{
            position: 'absolute',
            bottom: '8px',
            right: '8px',
            zIndex: 400,
            background: 'rgba(255, 255, 255, 0.92)',
            backdropFilter: 'blur(4px)',
            borderRadius: '6px',
            padding: '4px 8px',
            fontSize: '10px',
            color: '#475467',
            fontWeight: 500,
            border: '1px solid #EAECF0',
            pointerEvents: 'none',
          }}
        >
          💡 Click or drag pin to adjust location
        </div>
      </div>

      {/* Captured PostGIS Coordinates Badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#F8FAF9',
          border: '1px solid #E2E8F0',
          borderRadius: '8px',
          padding: '8px 12px',
          fontSize: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#15803D',
              display: 'inline-block',
            }}
          />
          <span style={{ color: '#344054', fontWeight: 600 }}>Captured Coordinates:</span>
          <span
            style={{
              fontFamily: 'monospace',
              color: '#15803D',
              fontWeight: 700,
              background: '#ECFDF5',
              padding: '2px 8px',
              borderRadius: '4px',
              border: '1px solid #D1FAE5',
            }}
          >
            {latitude.toFixed(6)}° N, {longitude.toFixed(6)}° E
          </span>
        </div>

        <span style={{ fontSize: '11px', color: '#98A2B3', fontWeight: 500 }}>
          WGS84 · SRID 4326
        </span>
      </div>

      {selectedAddress && (
        <div style={{ fontSize: '11px', color: '#475467', paddingLeft: '4px' }}>
          📍 <strong style={{ color: '#101828' }}>Target:</strong> {selectedAddress}
        </div>
      )}
    </div>
  );
};

export default LocationPickerMap;
