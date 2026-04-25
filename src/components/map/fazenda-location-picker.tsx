'use client'
import { useEffect, useRef, useState } from 'react'
import { Locate, MapPin } from 'lucide-react'

interface FazendaLocationPickerProps {
  latitude?: number
  longitude?: number
  /** Hint for initial map center when no coords yet (e.g. "Sorriso - MT") */
  localizacaoHint?: string
  onLocationSelect: (lat: number, lng: number) => void
  height?: string
}

const OSM_STYLE = {
  version: 8 as const,
  sources: { osm: { type: 'raster' as const, tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '© OpenStreetMap' } },
  layers: [{ id: 'osm-tiles', type: 'raster' as const, source: 'osm' }],
}
const SAT_STYLE = {
  version: 8 as const,
  sources: { esri: { type: 'raster' as const, tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, attribution: '© Esri' } },
  layers: [{ id: 'esri-tiles', type: 'raster' as const, source: 'esri' }],
}

async function geocodeHint(hint: string): Promise<[number, number] | null> {
  try {
    const q = encodeURIComponent(hint + ', Brasil')
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=br`, {
      headers: { 'Accept-Language': 'pt-BR' }
    })
    const data = await res.json()
    if (data?.[0]) return [parseFloat(data[0].lon), parseFloat(data[0].lat)]
  } catch { /* ok */ }
  return null
}

export function FazendaLocationPicker({
  latitude,
  longitude,
  localizacaoHint,
  onLocationSelect,
  height = '280px',
}: FazendaLocationPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef    = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null)
  const [satellite,  setSatellite]  = useState(false)
  const [ready,      setReady]      = useState(false)
  const [geoLoading, setGeoLoading] = useState(false)
  const [coords,     setCoords]     = useState<{ lat: number; lng: number } | null>(
    latitude && longitude ? { lat: latitude, lng: longitude } : null
  )

  // ── Init map ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    let cancelled = false

    async function init() {
      const { default: maplibregl } = await import('maplibre-gl')
      if (cancelled || !containerRef.current || mapRef.current) return

      let centerLng = -52.0, centerLat = -12.5, zoom = 5

      if (latitude && longitude) {
        centerLng = longitude; centerLat = latitude; zoom = 13
      } else if (localizacaoHint) {
        const gc = await geocodeHint(localizacaoHint)
        if (gc && !cancelled) { centerLng = gc[0]; centerLat = gc[1]; zoom = 12 }
      }

      if (cancelled || !containerRef.current) return

      try {
        const map = new maplibregl.Map({
          container: containerRef.current!,
          style: OSM_STYLE,
          center: [centerLng, centerLat],
          zoom,
          attributionControl: { compact: true },
        })

        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')

        map.on('load', () => {
          if (cancelled) return

          if (latitude && longitude) {
            markerRef.current = new maplibregl.Marker({ color: '#16a34a', draggable: true })
              .setLngLat([longitude, latitude])
              .addTo(map)
            markerRef.current.on('dragend', () => {
              const lngLat = markerRef.current.getLngLat()
              setCoords({ lat: lngLat.lat, lng: lngLat.lng })
              onLocationSelect(lngLat.lat, lngLat.lng)
            })
          }

          map.getCanvas().style.cursor = 'crosshair'
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          map.on('click', (e: any) => {
            const { lng, lat } = e.lngLat
            if (markerRef.current) markerRef.current.remove()
            markerRef.current = new maplibregl.Marker({ color: '#16a34a', draggable: true })
              .setLngLat([lng, lat])
              .addTo(map)
            markerRef.current.on('dragend', () => {
              const lngLat = markerRef.current.getLngLat()
              setCoords({ lat: lngLat.lat, lng: lngLat.lng })
              onLocationSelect(lngLat.lat, lngLat.lng)
            })
            setCoords({ lat, lng })
            onLocationSelect(lat, lng)
          })

          mapRef.current = map
          if (!cancelled) setReady(true)
        })

        map.on('error', (e: { error: Error }) => console.warn('[FazendaLocationPicker]', e.error))
      } catch (err) {
        console.error('[FazendaLocationPicker] init:', err)
      }
    }

    init().catch(err => console.error('[FazendaLocationPicker] import:', err))

    return () => {
      cancelled = true
      if (mapRef.current) {
        try { mapRef.current.remove() } catch { /* ok */ }
        mapRef.current = null
        markerRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Satellite toggle ──────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    try { map.setStyle(satellite ? SAT_STYLE : OSM_STYLE) } catch { /* ok */ }
  }, [satellite, ready])

  // ── Geolocation ───────────────────────────────────────────────────────────
  function useMyLocation() {
    if (!navigator.geolocation) return
    setGeoLoading(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude: lat, longitude: lng } = pos.coords
        const map = mapRef.current
        if (map) {
          map.flyTo({ center: [lng, lat], zoom: 15, speed: 1.4 })
          import('maplibre-gl').then(({ default: maplibregl }) => {
            if (markerRef.current) markerRef.current.remove()
            markerRef.current = new maplibregl.Marker({ color: '#16a34a', draggable: true })
              .setLngLat([lng, lat])
              .addTo(map)
            markerRef.current.on('dragend', () => {
              const lngLat = markerRef.current.getLngLat()
              setCoords({ lat: lngLat.lat, lng: lngLat.lng })
              onLocationSelect(lngLat.lat, lngLat.lng)
            })
          }).catch(() => {/* ok */})
        }
        setCoords({ lat, lng })
        onLocationSelect(lat, lng)
        setGeoLoading(false)
      },
      () => setGeoLoading(false),
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }

  return (
    <div>
      <div style={{ position: 'relative' }}>
        <div
          ref={containerRef}
          style={{ height, width: '100%', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--borda, #e5e7eb)' }}
        />
        {ready && (
          <>
            <button
              onClick={() => setSatellite(v => !v)}
              style={{
                position: 'absolute', top: 8, left: 8, zIndex: 5,
                background: satellite ? '#1d4ed8' : 'rgba(255,255,255,0.95)',
                color: satellite ? '#fff' : '#374151',
                border: '1px solid rgba(0,0,0,0.14)', borderRadius: 8,
                padding: '5px 11px', fontSize: 11, fontWeight: 600,
                cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
              }}
            >
              🛰 {satellite ? 'Mapa' : 'Satélite'}
            </button>
            <button
              onClick={useMyLocation}
              disabled={geoLoading}
              style={{
                position: 'absolute', top: 8, right: 8, zIndex: 5,
                background: 'rgba(255,255,255,0.95)', color: '#374151',
                border: '1px solid rgba(0,0,0,0.14)', borderRadius: 8,
                padding: '5px 11px', fontSize: 11, fontWeight: 600,
                cursor: geoLoading ? 'wait' : 'pointer',
                boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
                display: 'flex', alignItems: 'center', gap: 5,
              }}
              title="Usar localização atual do dispositivo"
            >
              <Locate size={12} />
              {geoLoading ? 'Buscando...' : 'Minha localização'}
            </button>
          </>
        )}
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <p className="flex items-center gap-1 text-xs" style={{ color: 'var(--fg-subtle)' }}>
          <MapPin size={11} /> Clique no mapa · arraste o pino para ajustar
        </p>
        {coords && (
          <p className="text-[10px] font-mono" style={{ color: 'var(--fg-subtle)' }}>
            {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
          </p>
        )}
      </div>
    </div>
  )
}
