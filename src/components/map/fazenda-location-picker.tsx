'use client'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef, useState } from 'react'
import { Locate, MapPin } from 'lucide-react'

interface FazendaLocationPickerProps {
  latitude?: number
  longitude?: number
  localizacaoHint?: string
  onLocationSelect: (lat: number, lng: number) => void
  height?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type L = any

const OSM_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const SAT_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'

async function geocodeHint(hint: string): Promise<[number, number] | null> {
  try {
    const q = encodeURIComponent(hint + ', Brasil')
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=br`,
      { headers: { 'Accept-Language': 'pt-BR' } }
    )
    const data = await res.json()
    if (data?.[0]) return [parseFloat(data[0].lat), parseFloat(data[0].lon)]
  } catch { /* ok */ }
  return null
}

function pinIcon(leaflet: L) {
  return leaflet.divIcon({
    className: '',
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="38" viewBox="0 0 26 38">
      <path fill="#16a34a" stroke="white" stroke-width="1.5" d="M13 1C8.03 1 4 5.03 4 10c0 7.5 9 18 9 18s9-10.5 9-18c0-4.97-4.03-9-9-9z"/>
      <circle fill="white" cx="13" cy="10" r="3.5"/>
    </svg>`,
    iconSize: [26, 38],
    iconAnchor: [13, 38],
  })
}

export function FazendaLocationPicker({
  latitude,
  longitude,
  localizacaoHint,
  onLocationSelect,
  height = '280px',
}: FazendaLocationPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<L>(null)
  const markerRef    = useRef<L>(null)
  const tileRef      = useRef<L>(null)
  const [satellite,  setSatellite]  = useState(false)
  const [ready,      setReady]      = useState(false)
  const [geoLoading, setGeoLoading] = useState(false)
  const [coords,     setCoords]     = useState<{ lat: number; lng: number } | null>(
    latitude && longitude ? { lat: latitude, lng: longitude } : null
  )

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    let cancelled = false

    async function init() {
      const { default: leaflet } = await import('leaflet')
      if (cancelled || !containerRef.current || mapRef.current) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (leaflet.Icon.Default.prototype as any)._getIconUrl

      let centerLat = -12.5, centerLng = -52.0, zoom = 5

      if (latitude && longitude) {
        centerLat = latitude; centerLng = longitude; zoom = 13
      } else if (localizacaoHint) {
        const gc = await geocodeHint(localizacaoHint)
        if (gc && !cancelled) { centerLat = gc[0]; centerLng = gc[1]; zoom = 12 }
      }

      if (cancelled || !containerRef.current) return

      const map = leaflet.map(containerRef.current!, { zoomControl: true, attributionControl: true })
      map.setView([centerLat, centerLng], zoom)

      const tile = leaflet.tileLayer(OSM_URL, { attribution: '© OpenStreetMap', maxZoom: 20 })
      tile.addTo(map)
      tileRef.current = tile

      // Existing marker
      if (latitude && longitude) {
        markerRef.current = leaflet.marker([latitude, longitude], { icon: pinIcon(leaflet), draggable: true }).addTo(map)
        markerRef.current.on('dragend', () => {
          const { lat, lng } = markerRef.current.getLatLng()
          setCoords({ lat, lng }); onLocationSelect(lat, lng)
        })
      }

      map.getContainer().style.cursor = 'crosshair'

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.on('click', (e: any) => {
        const { lat, lng } = e.latlng
        if (markerRef.current) markerRef.current.remove()
        markerRef.current = leaflet.marker([lat, lng], { icon: pinIcon(leaflet), draggable: true }).addTo(map)
        markerRef.current.on('dragend', () => {
          const ll = markerRef.current.getLatLng()
          setCoords({ lat: ll.lat, lng: ll.lng }); onLocationSelect(ll.lat, ll.lng)
        })
        setCoords({ lat, lng }); onLocationSelect(lat, lng)
      })

      mapRef.current = map
      setTimeout(() => { if (!cancelled && map) map.invalidateSize() }, 0)
      setTimeout(() => { if (!cancelled && map) map.invalidateSize() }, 300)
      if (!cancelled) setReady(true)
    }

    init().catch(err => console.error('[FazendaLocationPicker] init:', err))

    return () => {
      cancelled = true
      if (mapRef.current) { try { mapRef.current.remove() } catch { /* ok */ }; mapRef.current = null }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Satellite toggle ──────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    import('leaflet').then(({ default: leaflet }) => {
      if (tileRef.current) { try { tileRef.current.remove() } catch { /* ok */ } }
      const tile = leaflet.tileLayer(satellite ? SAT_URL : OSM_URL, { attribution: satellite ? '© Esri' : '© OpenStreetMap', maxZoom: 20 })
      tile.addTo(map)
      tileRef.current = tile
    }).catch(() => {/* ok */})
  }, [satellite, ready])

  // ── Geolocation ───────────────────────────────────────────────────────────
  function useMyLocation() {
    if (!navigator.geolocation) return
    setGeoLoading(true)
    navigator.geolocation.getCurrentPosition(pos => {
      const { latitude: lat, longitude: lng } = pos.coords
      const map = mapRef.current
      if (map) {
        map.flyTo([lat, lng], 15)
        import('leaflet').then(({ default: leaflet }) => {
          if (markerRef.current) markerRef.current.remove()
          markerRef.current = leaflet.marker([lat, lng], { icon: pinIcon(leaflet), draggable: true }).addTo(map)
          markerRef.current.on('dragend', () => {
            const ll = markerRef.current.getLatLng()
            setCoords({ lat: ll.lat, lng: ll.lng }); onLocationSelect(ll.lat, ll.lng)
          })
        }).catch(() => {/* ok */})
      }
      setCoords({ lat, lng }); onLocationSelect(lat, lng)
      setGeoLoading(false)
    }, () => setGeoLoading(false), { enableHighAccuracy: true, timeout: 8000 })
  }

  return (
    <div>
      <div style={{ position: 'relative' }}>
        <div ref={containerRef} style={{ height, width: '100%', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--borda, #e5e7eb)' }} />
        {ready && (
          <>
            <button onClick={() => setSatellite(v => !v)} style={{
              position: 'absolute', top: 8, left: 8, zIndex: 1000,
              background: satellite ? '#1d4ed8' : 'rgba(255,255,255,0.95)',
              color: satellite ? '#fff' : '#374151',
              border: '1px solid rgba(0,0,0,0.14)', borderRadius: 8,
              padding: '5px 11px', fontSize: 11, fontWeight: 600,
              cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
            }}>
              🛰 {satellite ? 'Mapa' : 'Satélite'}
            </button>
            <button onClick={useMyLocation} disabled={geoLoading} style={{
              position: 'absolute', top: 8, right: 8, zIndex: 1000,
              background: 'rgba(255,255,255,0.95)', color: '#374151',
              border: '1px solid rgba(0,0,0,0.14)', borderRadius: 8,
              padding: '5px 11px', fontSize: 11, fontWeight: 600,
              cursor: geoLoading ? 'wait' : 'pointer',
              boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
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
