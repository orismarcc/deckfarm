'use client'
/**
 * TalhoesMap — Interactive field map for DeckFarm
 *
 * Features:
 * - Color-coded polygons by application status (green/amber/orange/red)
 * - Animated pulse ring on urgent/overdue fields
 * - Rich click popup: status badge, progress bar, quick navigate
 * - Draw tool: click "Desenhar" → draw a polygon → save to talhão
 * - Satellite / Street tile switcher
 * - Animated entrance, hover highlight
 * - Demo polygons for first-time users
 */
import { useEffect, useRef, useState } from 'react'
import type { Talhao, Aplicacao } from '@/types'
import { culturaLabel, culturaIcon } from '@/lib/utils'
import { Map, Layers, Pencil, CheckCircle, X, Navigation } from 'lucide-react'

// Status → visual config
const STATUS_CFG: Record<string, { color: string; fill: string; label: string; pulse: boolean }> = {
  atrasado:        { color: '#dc2626', fill: '#dc262630', label: 'Atrasado',    pulse: true  },
  hoje:            { color: '#2563eb', fill: '#2563eb28', label: 'Hoje',         pulse: true  },
  proximo:         { color: '#d97706', fill: '#d9770625', label: 'Próximo (7d)', pulse: false },
  dentro_do_prazo: { color: '#16a34a', fill: '#16a34a22', label: 'No prazo',     pulse: false },
  sem_aplicacao:   { color: '#6b7280', fill: '#6b728018', label: 'Sem aplicação',pulse: false },
}

interface TalhaoFeature {
  talhao: Talhao
  status: string
  aplicacoes: Aplicacao[]
}

interface TalhoesMapProps {
  features: TalhaoFeature[]
  onSaveCoords?: (talhaoId: string, geoJson: string) => void
  height?: string
}

// Demo polygons in Mato Grosso — realistic farm field shapes
const DEMO_GEOJSON = [
  {
    id: 'demo-1',
    nome: 'Talhão Norte (Demo)',
    coords: [[-12.53,-52.31],[-12.51,-52.31],[-12.51,-52.28],[-12.53,-52.28],[-12.53,-52.31]],
  },
  {
    id: 'demo-2',
    nome: 'Talhão Sul (Demo)',
    coords: [[-12.55,-52.31],[-12.54,-52.31],[-12.54,-52.29],[-12.55,-52.29],[-12.55,-52.31]],
  },
]

export default function TalhoesMap({ features, onSaveCoords, height = '520px' }: TalhoesMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null)
  const [satellite, setSatellite] = useState(false)
  const [drawing, setDrawing] = useState(false)
  const [drawTarget, setDrawTarget] = useState<string | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const drawRef = useRef<any>(null)
  const [mounted, setMounted] = useState(false)
  const showDemos = features.length === 0

  useEffect(() => { setMounted(true) }, [])

  // Determine status for a talhão (worst-case across its applications)
  function talhaoStatus(feature: TalhaoFeature): string {
    const apps = feature.aplicacoes
    if (apps.some(a => a.status === 'atrasado')) return 'atrasado'
    if (apps.some(a => a.status === 'hoje'))     return 'hoje'
    if (apps.some(a => a.status === 'proximo'))  return 'proximo'
    if (apps.some(a => a.status === 'dentro_do_prazo')) return 'dentro_do_prazo'
    return 'sem_aplicacao'
  }

  useEffect(() => {
    if (!mounted || !containerRef.current) return
    // Avoid double-init in React strict mode
    if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }

    // Dynamic import to avoid SSR issues
    Promise.all([
      import('leaflet'),
      import('leaflet/dist/leaflet.css' as string).catch(() => null),
    ]).then(([L]) => {
      if (!containerRef.current) return

      // Center: if features with coords exist use their center; otherwise MT center
      let centerLat = -12.64, centerLng = -55.42
      let zoom = 11

      const allCoords: [number, number][] = []
      features.forEach(f => {
        if (!f.talhao.coordenadas) return
        try {
          const geo = JSON.parse(f.talhao.coordenadas)
          const coords: [number, number][][] = geo.type === 'Polygon' ? geo.coordinates : geo.coordinates[0]
          coords[0].forEach(([lng, lat]: [number, number]) => allCoords.push([lat, lng]))
        } catch { /* ignore parse errors */ }
      })
      if (allCoords.length > 0) {
        centerLat = allCoords.reduce((s, c) => s + c[0], 0) / allCoords.length
        centerLng = allCoords.reduce((s, c) => s + c[1], 0) / allCoords.length
        zoom = 13
      }

      const map = L.map(containerRef.current!, {
        center: [centerLat, centerLng],
        zoom,
        zoomControl: false,
      })
      mapRef.current = map

      // Tile layers
      const streetTile = L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        { attribution: '© OpenStreetMap', maxZoom: 19 }
      )
      const satTile = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { attribution: '© Esri Satellite', maxZoom: 19 }
      )
      streetTile.addTo(map)

      // Zoom control in bottom-right
      L.control.zoom({ position: 'bottomright' }).addTo(map)

      // ── Plot talhão polygons ─────────────────────────────────────────
      features.forEach(feature => {
        if (!feature.talhao.coordenadas) return
        try {
          const geo = JSON.parse(feature.talhao.coordenadas)
          const status = talhaoStatus(feature)
          const cfg = STATUS_CFG[status] || STATUS_CFG.sem_aplicacao

          const layer = L.geoJSON(geo, {
            style: {
              color: cfg.color,
              fillColor: cfg.fill,
              weight: 2.5,
              fillOpacity: 0.5,
              opacity: 1,
            },
          })

          layer.on('mouseover', () => {
            layer.setStyle({ weight: 4, fillOpacity: 0.72 })
          })
          layer.on('mouseout', () => {
            layer.setStyle({ weight: 2.5, fillOpacity: 0.5 })
          })

          // Build rich popup
          const apps = feature.aplicacoes
          const atrasadas = apps.filter(a => a.status === 'atrasado').length
          const popupHtml = `
            <div style="min-width:200px;font-family:system-ui,sans-serif">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
                <span style="font-size:20px">${culturaIcon(feature.talhao.cultura)}</span>
                <div>
                  <div style="font-weight:700;font-size:14px;color:#111">${feature.talhao.nome}</div>
                  <div style="font-size:11px;color:#666">${culturaLabel(feature.talhao.cultura)}</div>
                </div>
              </div>
              <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
                <span style="background:${cfg.color}22;color:${cfg.color};border:1px solid ${cfg.color}55;
                  font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px">
                  ${cfg.label}
                </span>
                ${atrasadas > 0 ? `<span style="background:#fee2e2;color:#dc2626;font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px">⚠ ${atrasadas} atrasada${atrasadas > 1 ? 's' : ''}</span>` : ''}
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:11px;color:#555;margin-bottom:10px">
                <div>📐 <b>${feature.talhao.area} ha</b></div>
                <div>💊 <b>${apps.length} aplicações</b></div>
                ${feature.talhao.data_plantio ? `<div>🌱 Plantio: <b>${feature.talhao.data_plantio}</b></div>` : ''}
              </div>
              <a href="/talhoes/${feature.talhao.id}"
                style="display:block;text-align:center;background:#16a34a;color:white;
                  padding:6px 12px;border-radius:8px;font-size:12px;font-weight:600;
                  text-decoration:none;">
                Ver talhão →
              </a>
            </div>
          `
          layer.bindPopup(popupHtml, { maxWidth: 260 })
          layer.addTo(map)

          // Animated pulse circle for urgent fields
          if (cfg.pulse) {
            try {
              const bounds = layer.getBounds()
              const center = bounds.getCenter()
              const pulseIcon = L.divIcon({
                className: '',
                html: `<div style="width:20px;height:20px;border-radius:50%;
                  background:${cfg.color};opacity:0.7;
                  animation:deckfarm-pulse 1.8s ease-in-out infinite;
                  box-shadow:0 0 0 0 ${cfg.color}"></div>`,
                iconSize: [20, 20],
                iconAnchor: [10, 10],
              })
              L.marker([center.lat, center.lng], { icon: pulseIcon, interactive: false }).addTo(map)
            } catch { /* no bounds */ }
          }
        } catch { /* parse error — skip */ }
      })

      // ── Demo polygons (when no real talhões with coords) ─────────────
      if (showDemos) {
        map.setView([-12.54, -52.30], 13)
        const demoStatuses = ['atrasado', 'proximo']
        DEMO_GEOJSON.forEach((demo, i) => {
          const status = demoStatuses[i] || 'dentro_do_prazo'
          const cfg = STATUS_CFG[status]
          const poly = L.polygon(demo.coords as [number,number][], {
            color: cfg.color, fillColor: cfg.fill,
            weight: 2.5, fillOpacity: 0.52,
          })
          poly.bindPopup(`
            <div style="font-family:system-ui;min-width:180px">
              <div style="font-weight:700;margin-bottom:6px">🌱 ${demo.nome}</div>
              <div style="font-size:11px;color:#555;margin-bottom:8px">
                Este é um polígono de demonstração.<br>Cadastre talhões e desenhe os seus!
              </div>
              <span style="background:${cfg.color}22;color:${cfg.color};border:1px solid ${cfg.color}55;
                font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px">${cfg.label}</span>
            </div>
          `)
          poly.addTo(map)
        })
      }

      // ── Satellite toggle listener ────────────────────────────────────
      // Stored on window so the React state setter can reach it
      ;(window as unknown as Record<string,unknown>).__deckfarmMapLayers = { streetTile, satTile, map }
    })

    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, features.length])

  // Toggle satellite/street tiles
  useEffect(() => {
    const layers = (window as unknown as Record<string,unknown>).__deckfarmMapLayers as
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { streetTile: any; satTile: any; map: any } | undefined
    if (!layers) return
    const { map, streetTile, satTile } = layers
    if (!map) return
    if (satellite) {
      if (map.hasLayer(streetTile)) map.removeLayer(streetTile)
      if (!map.hasLayer(satTile))   map.addLayer(satTile)
    } else {
      if (map.hasLayer(satTile))    map.removeLayer(satTile)
      if (!map.hasLayer(streetTile)) map.addLayer(streetTile)
    }
  }, [satellite])

  // ── Drawing mode (uses Leaflet built-in drawing via polyline) ─────────────
  function startDraw(talhaoId: string) {
    setDrawTarget(talhaoId)
    setDrawing(true)
    const map = mapRef.current
    if (!map) return
    import('leaflet').then(L => {
      const drawnPoints: [number, number][] = []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let previewPoly: any = null

      function onMapClick(e: { latlng: { lat: number; lng: number } }) {
        drawnPoints.push([e.latlng.lat, e.latlng.lng])
        if (previewPoly) map.removeLayer(previewPoly)
        if (drawnPoints.length >= 2) {
          previewPoly = L.polygon(drawnPoints, {
            color: '#16a34a', dashArray: '6', weight: 2.5, fillOpacity: 0.22,
          }).addTo(map)
        }
      }

      map.on('click', onMapClick)
      map.getContainer().style.cursor = 'crosshair'
      drawRef.current = { onMapClick, previewPoly: () => previewPoly, drawnPoints, map, L }
    })
  }

  function finishDraw() {
    const ctx = drawRef.current
    if (!ctx) return
    const { onMapClick, previewPoly, drawnPoints, map } = ctx
    map.off('click', onMapClick)
    map.getContainer().style.cursor = ''
    const poly = previewPoly()
    if (poly) map.removeLayer(poly)

    if (drawnPoints.length >= 3 && drawTarget && onSaveCoords) {
      // Close the ring
      const ring = [...drawnPoints, drawnPoints[0]]
      const geoJson = JSON.stringify({
        type: 'Polygon',
        coordinates: [ring.map(([lat, lng]) => [lng, lat])],
      })
      onSaveCoords(drawTarget, geoJson)
    }
    drawRef.current = null
    setDrawing(false)
    setDrawTarget(null)
  }

  function cancelDraw() {
    const ctx = drawRef.current
    if (ctx) {
      const { onMapClick, previewPoly, map } = ctx
      map.off('click', onMapClick)
      map.getContainer().style.cursor = ''
      const poly = previewPoly()
      if (poly) map.removeLayer(poly)
      drawRef.current = null
    }
    setDrawing(false)
    setDrawTarget(null)
  }

  // Inject pulse animation CSS once
  useEffect(() => {
    if (document.getElementById('deckfarm-pulse-css')) return
    const style = document.createElement('style')
    style.id = 'deckfarm-pulse-css'
    style.textContent = `
      @keyframes deckfarm-pulse {
        0%   { transform: scale(1);   opacity: 0.85; box-shadow: 0 0 0 0 currentColor; }
        60%  { transform: scale(1.4); opacity: 0.5;  box-shadow: 0 0 0 14px transparent; }
        100% { transform: scale(1);   opacity: 0.85; }
      }
    `
    document.head.appendChild(style)
  }, [])

  if (!mounted) return (
    <div style={{ height, background: '#e8f5e9', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#16a34a', fontWeight: 600 }}>Carregando mapa...</div>
    </div>
  )

  return (
    <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }}>

      {/* ── Map container ── */}
      <div ref={containerRef} style={{ height, width: '100%' }} />

      {/* ── Top controls ── */}
      <div style={{
        position: 'absolute', top: 12, left: 12, zIndex: 1000,
        display: 'flex', gap: 8, flexWrap: 'wrap',
      }}>
        {/* Satellite toggle */}
        <button
          onClick={() => setSatellite(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: satellite ? '#1d4ed8' : 'white',
            color: satellite ? 'white' : '#374151',
            border: '1px solid rgba(0,0,0,0.15)',
            borderRadius: 10, padding: '6px 12px',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          }}
        >
          <Layers size={13} /> {satellite ? 'Mapa' : 'Satélite'}
        </button>

        {/* Draw polygon button — only shown when talhões exist without coords */}
        {features.filter(f => !f.talhao.coordenadas).length > 0 && !drawing && (
          <div style={{ position: 'relative' }}>
            <select
              onChange={e => { if (e.target.value) startDraw(e.target.value) }}
              style={{
                display: 'flex', alignItems: 'center',
                background: 'white', color: '#374151',
                border: '1px solid rgba(0,0,0,0.15)',
                borderRadius: 10, padding: '6px 28px 6px 32px',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.12)', appearance: 'none',
              }}
              defaultValue=""
            >
              <option value="" disabled>✏ Demarcar talhão...</option>
              {features.filter(f => !f.talhao.coordenadas).map(f => (
                <option key={f.talhao.id} value={f.talhao.id}>{f.talhao.nome}</option>
              ))}
            </select>
            <Pencil size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#6b7280', pointerEvents: 'none' }} />
          </div>
        )}
      </div>

      {/* ── Drawing mode overlay ── */}
      {drawing && (
        <div style={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
          zIndex: 1001, background: '#1d4ed8', color: 'white',
          borderRadius: 12, padding: '8px 16px',
          display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 4px 20px rgba(29,78,216,0.35)',
          fontSize: 13, fontWeight: 600,
        }}>
          <span>✏ Clique no mapa para marcar os vértices do talhão</span>
          <button
            onClick={finishDraw}
            style={{ background: '#16a34a', color: 'white', border: 'none', borderRadius: 8, padding: '4px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <CheckCircle size={13} /> Concluir
          </button>
          <button
            onClick={cancelDraw}
            style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: 'none', borderRadius: 8, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* ── Legend ── */}
      <div style={{
        position: 'absolute', bottom: 36, left: 12, zIndex: 1000,
        background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)',
        borderRadius: 12, padding: '10px 14px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
        fontSize: 11, fontWeight: 500,
      }}>
        <div style={{ fontWeight: 700, marginBottom: 6, color: '#374151', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Status
        </div>
        {Object.entries(STATUS_CFG).map(([, cfg]) => (
          <div key={cfg.label} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: cfg.fill, border: `2px solid ${cfg.color}` }} />
            <span style={{ color: '#374151' }}>{cfg.label}</span>
            {cfg.pulse && <span style={{ fontSize: 9, color: '#dc2626' }}>●</span>}
          </div>
        ))}
        {showDemos && (
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #e5e7eb', fontSize: 10, color: '#6b7280' }}>
            📍 Demarcação de demonstração
          </div>
        )}
      </div>

      {/* ── Demo info banner ── */}
      {showDemos && (
        <div style={{
          position: 'absolute', top: 12, right: 12, zIndex: 1000,
          background: 'rgba(22,163,74,0.95)', color: 'white',
          borderRadius: 12, padding: '8px 14px', maxWidth: 220,
          fontSize: 11, fontWeight: 500,
          boxShadow: '0 2px 12px rgba(22,163,74,0.35)',
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>🌱 Modo demonstração</div>
          <div style={{ opacity: 0.9 }}>Cadastre talhões e use "Demarcar" para desenhar seus polígonos reais no mapa.</div>
        </div>
      )}

      {/* Navigation tip */}
      <div style={{
        position: 'absolute', bottom: 36, right: 12, zIndex: 1000,
        background: 'rgba(255,255,255,0.9)', borderRadius: 8,
        padding: '4px 8px', fontSize: 10, color: '#6b7280',
        boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
        display: 'flex', alignItems: 'center', gap: 4,
      }}>
        <Navigation size={9} /> Clique nos polígonos para detalhes
      </div>
    </div>
  )
}
