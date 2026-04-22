'use client'
/**
 * TalhaoMap — Mapa de localização do talhão (pino + polígono GeoJSON).
 * Usa MapLibre GL JS (sem Leaflet, sem API key).
 */
import { useEffect, useRef, useState } from 'react'
import { MapPin } from 'lucide-react'

interface TalhaoMapProps {
  latitude?: number
  longitude?: number
  coordenadas?: string
  onLocationSelect?: (lat: number, lng: number) => void
  readOnly?: boolean
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

export function TalhaoMap({
  latitude,
  longitude,
  coordenadas,
  onLocationSelect,
  readOnly = false,
  height = '260px',
}: TalhaoMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef    = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null)
  const [satellite, setSatellite] = useState(false)
  const [ready,     setReady]     = useState(false)

  // ── CSS MapLibre ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (document.getElementById('maplibre-css')) return
    const link = document.createElement('link')
    link.id   = 'maplibre-css'
    link.rel  = 'stylesheet'
    link.href = 'https://unpkg.com/maplibre-gl@5.2.0/dist/maplibre-gl.css'
    document.head.appendChild(link)
  }, [])

  // ── Inicializar mapa ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    let cancelled = false

    import('maplibre-gl').then(({ default: maplibregl }) => {
      if (cancelled || !containerRef.current || mapRef.current) return
      try {
        const centerLng = longitude ?? -52.0
        const centerLat = latitude  ?? -12.5
        const zoom      = latitude  ? 14 : 5

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

          // Polígono GeoJSON (se houver)
          if (coordenadas) {
            try {
              const geo = JSON.parse(coordenadas)
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              map.addSource('polygon', { type: 'geojson', data: geo as any })
              map.addLayer({ id: 'polygon-fill',    type: 'fill', source: 'polygon', paint: { 'fill-color': '#16a34a', 'fill-opacity': 0.2 } })
              map.addLayer({ id: 'polygon-outline', type: 'line', source: 'polygon', paint: { 'line-color': '#16a34a', 'line-width': 2 } })
            } catch { /* GeoJSON inválido */ }
          }

          // Marcador inicial
          if (latitude && longitude) {
            markerRef.current = new maplibregl.Marker({ color: '#16a34a' })
              .setLngLat([longitude, latitude])
              .addTo(map)
          }

          // Clique para posicionar pino
          if (!readOnly && onLocationSelect) {
            map.getCanvas().style.cursor = 'crosshair'
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            map.on('click', (e: any) => {
              const { lng, lat } = e.lngLat
              if (markerRef.current) markerRef.current.remove()
              markerRef.current = new maplibregl.Marker({ color: '#16a34a' })
                .setLngLat([lng, lat])
                .addTo(map)
              onLocationSelect(lat, lng)
            })
          }

          mapRef.current = map
          if (!cancelled) setReady(true)
        })

        map.on('error', (e: { error: Error }) => console.warn('[TalhaoMap]', e.error))
      } catch (err) {
        console.error('[TalhaoMap] init:', err)
      }
    }).catch(err => console.error('[TalhaoMap] import:', err))

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

  // ── Toggle satélite ────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    try { map.setStyle(satellite ? SAT_STYLE : OSM_STYLE) } catch { /* ok */ }
  }, [satellite, ready])

  // Recriar camadas após trocar estilo
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function onStyleData() {
      try {
        if (coordenadas && !map.getSource('polygon')) {
          const geo = JSON.parse(coordenadas)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          map.addSource('polygon', { type: 'geojson', data: geo as any })
          map.addLayer({ id: 'polygon-fill',    type: 'fill', source: 'polygon', paint: { 'fill-color': '#16a34a', 'fill-opacity': 0.2 } })
          map.addLayer({ id: 'polygon-outline', type: 'line', source: 'polygon', paint: { 'line-color': '#16a34a', 'line-width': 2 } })
        }
      } catch { /* ok */ }
    }
    map.on('styledata', onStyleData)
    return () => { try { map.off('styledata', onStyleData) } catch { /* ok */ } }
  }, [ready, coordenadas])

  return (
    <div>
      {/* Toggle satélite / mapa */}
      <div style={{ position: 'relative' }}>
        <div ref={containerRef}
          style={{ height, width: '100%', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--borda, #e5e7eb)' }}
        />
        {ready && (
          <button
            onClick={() => setSatellite(v => !v)}
            style={{
              position: 'absolute', top: 8, left: 8, zIndex: 5,
              background: satellite ? '#1d4ed8' : 'rgba(255,255,255,0.95)',
              color: satellite ? '#fff' : '#374151',
              border: '1px solid rgba(0,0,0,0.14)', borderRadius: 8,
              padding: '4px 10px', fontSize: 11, fontWeight: 600,
              cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
            }}
          >
            🛰 {satellite ? 'Mapa' : 'Satélite'}
          </button>
        )}
      </div>
      {!readOnly && (
        <p className="flex items-center gap-1 text-xs mt-1.5" style={{ color: 'var(--fg-subtle)' }}>
          <MapPin size={11} /> Clique no mapa para marcar a localização do talhão
        </p>
      )}
    </div>
  )
}
