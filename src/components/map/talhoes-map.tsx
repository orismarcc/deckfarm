'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Talhao, Aplicacao } from '@/types'
import { culturaLabel, culturaIcon } from '@/lib/utils'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type L = any

const STATUS_CFG: Record<string, { color: string; label: string }> = {
  atrasado:        { color: '#dc2626', label: 'Atrasado'     },
  hoje:            { color: '#2563eb', label: 'Hoje'         },
  proximo:         { color: '#d97706', label: 'Próximo (7d)' },
  dentro_do_prazo: { color: '#16a34a', label: 'No prazo'     },
  sem_aplicacao:   { color: '#6b7280', label: 'Sem aplicação'},
}

export interface TalhaoFeature {
  talhao: Talhao
  status: string
  aplicacoes: Aplicacao[]
}

interface TalhoesMapProps {
  features: TalhaoFeature[]
  onSaveCoords?: (talhaoId: string, geoJson: string) => void
  height?: string
  fazendaLatitude?: number
  fazendaLongitude?: number
  fazendaLocalizacao?: string
}

// Demo polygons (Mato Grosso region) — GeoJSON [lng, lat]
const DEMO_POLYGONS = [
  { name: 'Talhão Norte (Demo)', color: '#dc2626', label: 'Atrasado',
    coords: [[-12.53,-52.31],[-12.53,-52.28],[-12.51,-52.28],[-12.51,-52.31]] as [number,number][] },
  { name: 'Talhão Sul (Demo)',   color: '#d97706', label: 'Próximo (7d)',
    coords: [[-12.55,-52.31],[-12.55,-52.29],[-12.54,-52.29],[-12.54,-52.31]] as [number,number][] },
]

function worstStatus(aplicacoes: Aplicacao[]): string {
  if (!aplicacoes?.length) return 'sem_aplicacao'
  if (aplicacoes.some(a => a.status === 'atrasado'))        return 'atrasado'
  if (aplicacoes.some(a => a.status === 'hoje'))            return 'hoje'
  if (aplicacoes.some(a => a.status === 'proximo'))         return 'proximo'
  if (aplicacoes.some(a => a.status === 'dentro_do_prazo')) return 'dentro_do_prazo'
  return 'sem_aplicacao'
}

// GeoJSON Polygon coordinates [lng,lat][] → Leaflet LatLng [lat,lng][]
function geoToLeaflet(ring: [number, number][]): [number, number][] {
  return ring.map(([lng, lat]) => [lat, lng])
}

async function geocodeCity(loc: string): Promise<[number, number] | null> {
  try {
    const q = encodeURIComponent(loc + ', Brasil')
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=br`,
      { headers: { 'Accept-Language': 'pt-BR' } }
    )
    const data = await res.json()
    if (data?.[0]) return [parseFloat(data[0].lat), parseFloat(data[0].lon)]
  } catch { /* ok */ }
  return null
}

export default function TalhoesMap({
  features,
  onSaveCoords,
  height = '520px',
  fazendaLatitude,
  fazendaLongitude,
  fazendaLocalizacao,
}: TalhoesMapProps) {
  const containerRef  = useRef<HTMLDivElement>(null)
  const mapRef        = useRef<L>(null)
  const layersRef     = useRef<L[]>([])       // field polygon layers
  const drawLayersRef = useRef<L[]>([])        // in-progress drawing layers
  const [ready,      setReady]      = useState(false)
  const [satellite,  setSatellite]  = useState(false)
  const [drawing,    setDrawing]    = useState(false)
  const [drawTarget, setDrawTarget] = useState<string | null>(null)
  const [drawPts,    setDrawPts]    = useState<[number, number][]>([]) // [lat, lng]
  const tileLayerRef  = useRef<L>(null)
  const showDemos = features.length === 0

  const OSM_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
  const SAT_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'

  // ── Build field layer data ─────────────────────────────────────────────────
  const fieldData = useMemo(() => features.map(f => {
    const status = worstStatus(f.aplicacoes ?? [])
    const cfg = STATUS_CFG[status] ?? STATUS_CFG.sem_aplicacao
    let ring: [number,number][] | null = null
    if (f.talhao.coordenadas) {
      try {
        const geo = JSON.parse(f.talhao.coordenadas)
        ring = geoToLeaflet(geo.coordinates[0])
      } catch { /* ok */ }
    }
    return { talhao: f.talhao, cfg, ring, apps: f.aplicacoes ?? [], late: (f.aplicacoes ?? []).filter(a => a.status === 'atrasado').length }
  }), [features])

  // ── Render field polygons onto map ─────────────────────────────────────────
  const renderFields = useCallback((leaflet: L, map: L) => {
    layersRef.current.forEach(l => { try { l.remove() } catch { /* ok */ } })
    layersRef.current = []

    if (showDemos) {
      DEMO_POLYGONS.forEach(d => {
        const poly = leaflet.polygon(d.coords, {
          color: d.color, fillColor: d.color, fillOpacity: 0.25, weight: 2,
        }).addTo(map)
        poly.bindPopup(`<b>🌱 ${d.name}</b><br><span style="font-size:11px;color:#6b7280">Polígono de demonstração</span>`)
        layersRef.current.push(poly)
      })
      return
    }

    fieldData.forEach(({ talhao, cfg, ring, apps, late }) => {
      if (!ring) return
      const poly = leaflet.polygon(ring, {
        color: cfg.color, fillColor: cfg.color, fillOpacity: 0.3, weight: 2.5,
      }).addTo(map)

      poly.bindPopup(`
        <div style="min-width:180px;font-family:system-ui;font-size:13px">
          <div style="font-weight:700;margin-bottom:6px;font-size:14px">
            ${culturaIcon(talhao.cultura)} ${talhao.nome}
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
            <span style="background:${cfg.color}20;color:${cfg.color};border:1px solid ${cfg.color}55;
              font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px">${cfg.label}</span>
            ${late > 0 ? `<span style="background:#fee2e2;color:#dc2626;font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px">⚠ ${late} atrasada${late > 1 ? 's' : ''}</span>` : ''}
          </div>
          <div style="font-size:11px;color:#555;margin-bottom:10px">
            📐 <b>${talhao.area} ha</b> · 💊 <b>${apps.length} aplicações</b>
          </div>
          <a href="/talhoes/${talhao.id}" style="display:block;text-align:center;
            background:#16a34a;color:#fff;padding:6px 12px;border-radius:8px;
            font-size:12px;font-weight:600;text-decoration:none">Ver talhão →</a>
        </div>
      `, { maxWidth: 260 })

      layersRef.current.push(poly)

      // Label
      try {
        const center = poly.getBounds().getCenter()
        const label = leaflet.divIcon({
          className: '',
          html: `<div style="font-size:11px;font-weight:700;color:#111;text-shadow:0 0 3px white,0 0 3px white;pointer-events:none;white-space:nowrap">${talhao.nome}</div>`,
          iconAnchor: [0, 0],
        })
        const marker = leaflet.marker(center, { icon: label, interactive: false }).addTo(map)
        layersRef.current.push(marker)
      } catch { /* ok */ }
    })
  }, [fieldData, showDemos])

  // ── Render draw preview ───────────────────────────────────────────────────
  const renderDrawPreview = useCallback((leaflet: L, map: L, pts: [number,number][]) => {
    drawLayersRef.current.forEach(l => { try { l.remove() } catch { /* ok */ } })
    drawLayersRef.current = []
    if (pts.length === 0) return

    // Vertex dots
    pts.forEach(pt => {
      const dot = leaflet.circleMarker(pt, { radius: 5, color: '#16a34a', fillColor: '#16a34a', fillOpacity: 1, weight: 2 }).addTo(map)
      drawLayersRef.current.push(dot)
    })

    // Line preview
    if (pts.length >= 2) {
      const line = leaflet.polyline([...pts, pts[0]], { color: '#16a34a', weight: 2, dashArray: '6 4' }).addTo(map)
      drawLayersRef.current.push(line)
    }
    if (pts.length >= 3) {
      const fill = leaflet.polygon(pts, { color: '#16a34a', fillColor: '#16a34a', fillOpacity: 0.15, weight: 0 }).addTo(map)
      drawLayersRef.current.push(fill)
    }
  }, [])

  // ── Initialize Leaflet ────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    let cancelled = false

    async function init() {
      const leaflet = (await import('leaflet')).default
      if (cancelled || !containerRef.current || mapRef.current) return

      // Fix broken default icon paths in webpack
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (leaflet.Icon.Default.prototype as any)._getIconUrl

      // Determine center
      let centerLat = -12.54, centerLng = -52.30, zoom = 11

      const allPts: [number,number][] = []
      features.forEach(f => {
        if (!f.talhao?.coordenadas) return
        try {
          const g = JSON.parse(f.talhao.coordenadas)
          ;(g?.coordinates?.[0] ?? []).forEach(([lng, lat]: [number,number]) => allPts.push([lat, lng]))
        } catch { /* ok */ }
      })

      if (allPts.length > 0) {
        centerLat = allPts.reduce((s, p) => s + p[0], 0) / allPts.length
        centerLng = allPts.reduce((s, p) => s + p[1], 0) / allPts.length
        zoom = 13
      } else if (fazendaLatitude && fazendaLongitude) {
        centerLat = fazendaLatitude; centerLng = fazendaLongitude; zoom = 13
      } else if (fazendaLocalizacao) {
        const gc = await geocodeCity(fazendaLocalizacao)
        if (gc && !cancelled) { centerLat = gc[0]; centerLng = gc[1]; zoom = 12 }
      }

      if (cancelled || !containerRef.current) return

      const map = leaflet.map(containerRef.current, { zoomControl: true, attributionControl: true })
      map.setView([centerLat, centerLng], zoom)

      const tile = leaflet.tileLayer(OSM_URL, { attribution: '© OpenStreetMap', maxZoom: 20 })
      tile.addTo(map)
      tileLayerRef.current = tile

      renderFields(leaflet, map)

      mapRef.current = map
      if (!cancelled) setReady(true)
    }

    init().catch(err => console.error('[TalhoesMap] init:', err))

    return () => {
      cancelled = true
      if (mapRef.current) {
        try { mapRef.current.remove() } catch { /* ok */ }
        mapRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Re-render polygons when data changes ──────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    import('leaflet').then(m => renderFields(m.default, map)).catch(() => {/* ok */})
  }, [fieldData, showDemos, ready, renderFields])

  // ── Satellite toggle ──────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    import('leaflet').then(({ default: leaflet }) => {
      if (tileLayerRef.current) { try { tileLayerRef.current.remove() } catch { /* ok */ } }
      const tile = leaflet.tileLayer(satellite ? SAT_URL : OSM_URL, { attribution: satellite ? '© Esri' : '© OpenStreetMap', maxZoom: 20 })
      tile.addTo(map)
      tileLayerRef.current = tile
    }).catch(() => {/* ok */})
  }, [satellite, ready])

  // ── Draw preview update ───────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    import('leaflet').then(m => renderDrawPreview(m.default, map, drawPts)).catch(() => {/* ok */})
  }, [drawPts, ready, renderDrawPreview])

  // ── Start drawing ─────────────────────────────────────────────────────────
  const startDraw = useCallback((talhaoId: string) => {
    const map = mapRef.current
    if (!map) return
    setDrawTarget(talhaoId); setDrawPts([]); setDrawing(true)
    map.getContainer().style.cursor = 'crosshair'
  }, [])

  // Click handler lives as a map event — attach/detach when drawing changes
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    if (!drawing) {
      map.getContainer().style.cursor = ''
      return
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function onClick(e: any) {
      setDrawPts(prev => [...prev, [e.latlng.lat, e.latlng.lng]])
    }
    map.on('click', onClick)
    return () => { try { map.off('click', onClick) } catch { /* ok */ } }
  }, [drawing, ready])

  const finishDraw = useCallback(() => {
    const map = mapRef.current
    if (map) map.getContainer().style.cursor = ''
    if (drawPts.length >= 3 && drawTarget && onSaveCoords) {
      // Convert [lat,lng] → GeoJSON [lng,lat] with closing point
      const ring = [...drawPts.map(([lat, lng]) => [lng, lat] as [number,number]), [drawPts[0][1], drawPts[0][0]] as [number,number]]
      onSaveCoords(drawTarget, JSON.stringify({ type: 'Polygon', coordinates: [ring] }))
    }
    drawLayersRef.current.forEach(l => { try { l.remove() } catch { /* ok */ } })
    drawLayersRef.current = []
    setDrawing(false); setDrawTarget(null); setDrawPts([])
  }, [drawPts, drawTarget, onSaveCoords])

  const cancelDraw = useCallback(() => {
    const map = mapRef.current
    if (map) map.getContainer().style.cursor = ''
    drawLayersRef.current.forEach(l => { try { l.remove() } catch { /* ok */ } })
    drawLayersRef.current = []
    setDrawing(false); setDrawTarget(null); setDrawPts([])
  }, [])

  const btnBase: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 6,
    background: 'rgba(255,255,255,0.97)', color: '#374151',
    border: '1px solid rgba(0,0,0,0.14)', borderRadius: 10,
    padding: '7px 13px', fontSize: 12, fontWeight: 600,
    cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.14)',
  }

  return (
    <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }}>
      <div ref={containerRef} style={{ height, width: '100%', background: '#dde0e4' }} />

      {/* Top-left controls */}
      <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 1000, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={() => setSatellite(v => !v)}
          style={{ ...btnBase, ...(satellite ? { background: '#1d4ed8', color: '#fff', borderColor: '#1d4ed8' } : {}) }}>
          🛰 {satellite ? 'Mapa' : 'Satélite'}
        </button>

        {!drawing && features.filter(f => !f.talhao.coordenadas).length > 0 && (
          <select defaultValue=""
            onChange={e => { if (e.target.value) startDraw(e.target.value) }}
            style={{ ...btnBase, paddingLeft: 13, appearance: 'none' as const }}>
            <option value="" disabled>✏ Demarcar talhão...</option>
            {features.filter(f => !f.talhao.coordenadas).map(f => (
              <option key={f.talhao.id} value={f.talhao.id}>{f.talhao.nome}</option>
            ))}
          </select>
        )}
      </div>

      {/* Drawing mode banner */}
      {drawing && (
        <div style={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
          zIndex: 1000, background: '#1d4ed8', color: '#fff',
          borderRadius: 12, padding: '8px 16px',
          display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 4px 20px rgba(29,78,216,0.4)',
          fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
        }}>
          <span>✏ {drawPts.length} vértice{drawPts.length !== 1 ? 's' : ''} · clique no mapa</span>
          <button onClick={finishDraw} disabled={drawPts.length < 3}
            style={{ background: drawPts.length >= 3 ? '#16a34a' : '#6b7280', color: '#fff', border: 'none', borderRadius: 8, padding: '4px 12px', fontSize: 12, fontWeight: 700, cursor: drawPts.length >= 3 ? 'pointer' : 'not-allowed' }}>
            ✓ Concluir
          </button>
          <button onClick={cancelDraw}
            style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none', borderRadius: 8, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>
            ✕
          </button>
        </div>
      )}

      {/* Legend */}
      <div style={{
        position: 'absolute', bottom: 36, left: 12, zIndex: 1000,
        background: 'rgba(255,255,255,0.97)', borderRadius: 12,
        padding: '10px 14px', boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
        fontSize: 11, fontWeight: 500, pointerEvents: 'none',
      }}>
        <div style={{ fontWeight: 700, marginBottom: 6, color: '#374151', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Status</div>
        {Object.values(STATUS_CFG).map(cfg => (
          <div key={cfg.label} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: `${cfg.color}25`, border: `2px solid ${cfg.color}`, flexShrink: 0 }} />
            <span style={{ color: '#374151' }}>{cfg.label}</span>
          </div>
        ))}
        {showDemos && <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #e5e7eb', fontSize: 10, color: '#9ca3af' }}>📍 Modo demo</div>}
      </div>

      {/* Demo banner */}
      {showDemos && (
        <div style={{
          position: 'absolute', top: 12, right: 12, zIndex: 1000,
          background: 'rgba(22,163,74,0.93)', color: '#fff',
          borderRadius: 12, padding: '8px 14px', maxWidth: 220,
          fontSize: 11, fontWeight: 500, boxShadow: '0 2px 12px rgba(22,163,74,0.3)',
        }}>
          <div style={{ fontWeight: 700, marginBottom: 3 }}>🌱 Modo demonstração</div>
          <div style={{ opacity: 0.9, lineHeight: 1.4 }}>Cadastre talhões e demarcque no mapa.</div>
        </div>
      )}

      {!drawing && (
        <div style={{
          position: 'absolute', bottom: 36, right: 50, zIndex: 1000,
          background: 'rgba(255,255,255,0.9)', borderRadius: 8,
          padding: '4px 9px', fontSize: 10, color: '#6b7280',
          boxShadow: '0 1px 4px rgba(0,0,0,0.1)', pointerEvents: 'none',
        }}>
          🖱 Clique nos polígonos para detalhes
        </div>
      )}
    </div>
  )
}
