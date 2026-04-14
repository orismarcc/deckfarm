'use client'
import { useEffect, useRef } from 'react'
import { MapPin } from 'lucide-react'

interface TalhaoMapProps {
  latitude?: number
  longitude?: number
  coordenadas?: string
  onLocationSelect?: (lat: number, lng: number) => void
  readOnly?: boolean
  height?: string
}

export function TalhaoMap({ latitude, longitude, coordenadas, onLocationSelect, readOnly = false, height = '260px' }: TalhaoMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<unknown>(null)

  useEffect(() => {
    if (!mapRef.current || typeof window === 'undefined') return
    if (mapInstanceRef.current) return

    import('leaflet').then((L) => {
      // Fix default icon paths broken by webpack
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      })

      const defaultLat = latitude || -12.5
      const defaultLng = longitude || -55.0
      const zoom = latitude ? 14 : 5

      const map = L.map(mapRef.current!).setView([defaultLat, defaultLng], zoom)
      mapInstanceRef.current = map

      // Satellite layer (Esri)
      const satellite = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { attribution: 'Tiles © Esri', maxZoom: 19 }
      )
      // Street layer (OSM)
      const streets = L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        { attribution: '© OpenStreetMap contributors' }
      )

      satellite.addTo(map)
      L.control.layers({ 'Satélite': satellite, 'Mapa': streets }).addTo(map)

      // Existing marker
      let marker: ReturnType<typeof L.marker> | null = null
      if (latitude && longitude) {
        marker = L.marker([latitude, longitude]).addTo(map)
      }

      // Existing polygon
      if (coordenadas) {
        try {
          const geo = JSON.parse(coordenadas)
          L.geoJSON(geo, {
            style: { color: '#0A5B32', weight: 2, fillOpacity: 0.18, fillColor: '#34d399' },
          }).addTo(map)
        } catch { /* invalid geoJSON */ }
      }

      // Click to place marker
      if (!readOnly && onLocationSelect) {
        map.on('click', (e: L.LeafletMouseEvent) => {
          if (marker) marker.remove()
          marker = L.marker([e.latlng.lat, e.latlng.lng]).addTo(map)
          onLocationSelect(e.latlng.lat, e.latlng.lng)
        })
      }
    })

    return () => {
      if (mapInstanceRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(mapInstanceRef.current as any).remove()
        mapInstanceRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div>
      {/* Leaflet CSS injected via link tag */}
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <div
        ref={mapRef}
        style={{ height, width: '100%', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--borda)' }}
      />
      {!readOnly && (
        <p className="flex items-center gap-1 text-xs mt-1.5" style={{ color: 'var(--fg-subtle)' }}>
          <MapPin size={11} /> Clique no mapa para marcar a localização do talhão
        </p>
      )}
    </div>
  )
}
