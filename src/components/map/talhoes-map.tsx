'use client'
/**
 * TalhoesMap — Interactive farm field map for DeckFarm
 *
 * CSS loaded via <link> CDN tag (same pattern as talhao-map.tsx that works).
 * Features:
 * - Color-coded polygons by application status
 * - Animated pulse rings for urgent/overdue fields
 * - Rich click popup: status badge, area, apps count, link to talhão
 * - Draw tool: click "Demarcar" → place vertices → Concluir → saves GeoJSON
 * - Satellite (ESRI) / Street (OSM) tile switcher
 * - Demo polygons for first-time users (no talhões with coords)
 */
import { useEffect, useRef, useState } from 'react'
import type { Talhao, Aplicacao } from '@/types'
import { culturaLabel, culturaIcon } from '@/lib/utils'
import { Layers, Pencil, CheckCircle, X, Navigation } from 'lucide-react'

// ── Status visual config ───────────────────────────────────────────────────
const STATUS_CFG: Record<string, { color: string; fill: string; label: string; pulse: boolean }> = {
  atrasado:        { color: '#dc2626', fill: '#dc262630', label: 'Atrasado',     pulse: true  },
  hoje:            { color: '#2563eb', fill: '#2563eb28', label: 'Hoje',          pulse: true  },
  proximo:         { color: '#d97706', fill: '#d9770625', label: 'Próximo (7d)',  pulse: false },
  dentro_do_prazo: { color: '#16a34a', fill: '#16a34a22', label: 'No prazo',      pulse: false },
  sem_aplicacao:   { color: '#6b7280', fill: '#6b728018', label: 'Sem aplicação', pulse: false },
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
}

// Demo polygons in Mato Grosso
const DEMO_COORDS: [number, number][][] = [
  [[-12.53,-52.31],[-12.51,-52.31],[-12.51,-52.28],[-12.53,-52.28],[-12.53,-52.31]],
  [[-12.55,-52.31],[-12.54,-52.31],[-12.54,-52.29],[-12.55,-52.29],[-12.55,-52.31]],
]
const DEMO_STATUSES = ['atrasado', 'proximo']
const DEMO_NAMES   = ['Talhão Norte (Demo)', 'Talhão Sul (Demo)']

function worstStatus(aplicacoes: Aplicacao[]): string {
  if (aplicacoes.some(a => a.status === 'atrasado'))       return 'atrasado'
  if (aplicacoes.some(a => a.status === 'hoje'))           return 'hoje'
  if (aplicacoes.some(a => a.status === 'proximo'))        return 'proximo'
  if (aplicacoes.some(a => a.status === 'dentro_do_prazo')) return 'dentro_do_prazo'
  return 'sem_aplicacao'
}

export default function TalhoesMap({ features, onSaveCoords, height = '520px' }: TalhoesMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef      = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const layersRef   = useRef<{ street: any; sat: any }>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const drawCtxRef  = useRef<any>(null)

  const [satellite, setSatellite] = useState(false)
  const [drawing,   setDrawing]   = useState(false)
  const [drawTarget, setDrawTarget] = useState<string | null>(null)
  const showDemos = features.length === 0

  // ── Initialize map ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return
    // Tear down any previous instance (React StrictMode double-mount)
    if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }

    import('leaflet').then((L) => {
      if (!containerRef.current) return

      // Fix broken default marker icons in webpack/turbopack
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl:        'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl:      'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      })

      // Compute map center from existing polygon coords (or Mato Grosso)
      let centerLat = -12.54, centerLng = -52.30, zoom = 13
      const allPts: [number, number][] = []
      features.forEach(f => {
        if (!f.talhao.coordenadas) return
        try {
          const geo = JSON.parse(f.talhao.coordenadas)
          const ring: [number, number][] = geo.coordinates?.[0] ?? []
          ring.forEach(([lng, lat]) => allPts.push([lat, lng]))
        } catch { /* ignore */ }
      })
      if (allPts.length > 0) {
        centerLat = allPts.reduce((s, p) => s + p[0], 0) / allPts.length
        centerLng = allPts.reduce((s, p) => s + p[1], 0) / allPts.length
        zoom = 14
      }

      const map = L.map(containerRef.current!, { center: [centerLat, centerLng], zoom, zoomControl: false })
      mapRef.current = map

      const street = L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        { attribution: '© OpenStreetMap', maxZoom: 19 }
      )
      const sat = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { attribution: '© Esri Satellite', maxZoom: 19 }
      )
      street.addTo(map)
      layersRef.current = { street, sat }

      L.control.zoom({ position: 'bottomright' }).addTo(map)

      // ── Inject pulse animation once ──────────────────────────────────────
      if (!document.getElementById('deckfarm-pulse-css')) {
        const s = document.createElement('style')
        s.id = 'deckfarm-pulse-css'
        s.textContent = `
          @keyframes deckfarm-pulse {
            0%   { transform:scale(1);   opacity:.85; box-shadow:0 0 0 0 currentColor }
            60%  { transform:scale(1.5); opacity:.45; box-shadow:0 0 0 16px transparent }
            100% { transform:scale(1);   opacity:.85 }
          }
        `
        document.head.appendChild(s)
      }

      // ── Real talhão polygons ─────────────────────────────────────────────
      features.forEach(f => {
        if (!f.talhao.coordenadas) return
        try {
          const geo    = JSON.parse(f.talhao.coordenadas)
          const status = worstStatus(f.aplicacoes)
          const cfg    = STATUS_CFG[status] || STATUS_CFG.sem_aplicacao
          const apps   = f.aplicacoes
          const late   = apps.filter(a => a.status === 'atrasado').length

          const layer = L.geoJSON(geo, {
            style: { color: cfg.color, fillColor: cfg.color, weight: 2.5, fillOpacity: 0.35, opacity: 1 },
          })
          layer.on('mouseover', () => layer.setStyle({ weight: 4, fillOpacity: 0.55 }))
          layer.on('mouseout',  () => layer.setStyle({ weight: 2.5, fillOpacity: 0.35 }))

          layer.bindPopup(`
            <div style="min-width:200px;font-family:system-ui,sans-serif">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
                <span style="font-size:22px">${culturaIcon(f.talhao.cultura)}</span>
                <div>
                  <div style="font-weight:700;font-size:14px;color:#111">${f.talhao.nome}</div>
                  <div style="font-size:11px;color:#777">${culturaLabel(f.talhao.cultura)}</div>
                </div>
              </div>
              <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
                <span style="background:${cfg.color}22;color:${cfg.color};border:1px solid ${cfg.color}55;
                  font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px">${cfg.label}</span>
                ${late > 0 ? `<span style="background:#fee2e2;color:#dc2626;font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px">⚠ ${late} atrasada${late > 1 ? 's' : ''}</span>` : ''}
              </div>
              <div style="font-size:11px;color:#555;margin-bottom:10px">
                📐 <b>${f.talhao.area} ha</b> &nbsp;·&nbsp; 💊 <b>${apps.length} aplicações</b>
                ${f.talhao.data_plantio ? `<br>🌱 Plantio: <b>${f.talhao.data_plantio}</b>` : ''}
              </div>
              <a href="/talhoes/${f.talhao.id}" style="display:block;text-align:center;
                background:#16a34a;color:white;padding:6px 12px;border-radius:8px;
                font-size:12px;font-weight:600;text-decoration:none">Ver talhão →</a>
            </div>
          `, { maxWidth: 260 })

          layer.addTo(map)

          // Pulse marker for urgent fields
          if (cfg.pulse) {
            try {
              const center = layer.getBounds().getCenter()
              L.marker([center.lat, center.lng], {
                icon: L.divIcon({
                  className: '',
                  html: `<div style="width:18px;height:18px;border-radius:50%;background:${cfg.color};
                    animation:deckfarm-pulse 1.8s ease-in-out infinite"></div>`,
                  iconSize: [18, 18],
                  iconAnchor: [9, 9],
                }),
                interactive: false,
              }).addTo(map)
            } catch { /* no bounds */ }
          }
        } catch { /* skip */ }
      })

      // ── Demo polygons ────────────────────────────────────────────────────
      if (showDemos) {
        DEMO_COORDS.forEach((coords, i) => {
          const cfg = STATUS_CFG[DEMO_STATUSES[i]]
          L.polygon(coords, { color: cfg.color, fillColor: cfg.color, weight: 2.5, fillOpacity: 0.35 })
            .bindPopup(`
              <div style="font-family:system-ui;min-width:170px">
                <div style="font-weight:700;margin-bottom:6px">🌱 ${DEMO_NAMES[i]}</div>
                <div style="font-size:11px;color:#666;margin-bottom:8px">
                  Polígono de demonstração.<br>Cadastre talhões e use "Demarcar"!
                </div>
                <span style="background:${cfg.color}22;color:${cfg.color};
                  border:1px solid ${cfg.color}55;font-size:10px;font-weight:700;
                  padding:2px 8px;border-radius:999px">${cfg.label}</span>
              </div>
            `)
            .addTo(map)
        })
      }
    })

    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [features.length])

  // ── Satellite toggle ──────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    const lrs = layersRef.current
    if (!map || !lrs) return
    if (satellite) {
      if (map.hasLayer(lrs.street)) map.removeLayer(lrs.street)
      if (!map.hasLayer(lrs.sat))   map.addLayer(lrs.sat)
    } else {
      if (map.hasLayer(lrs.sat))    map.removeLayer(lrs.sat)
      if (!map.hasLayer(lrs.street)) map.addLayer(lrs.street)
    }
  }, [satellite])

  // ── Draw tool ─────────────────────────────────────────────────────────────
  function startDraw(talhaoId: string) {
    const map = mapRef.current
    if (!map) return
    setDrawTarget(talhaoId)
    setDrawing(true)

    import('leaflet').then(L => {
      const pts: [number, number][] = []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let preview: any = null

      function onClick(e: { latlng: { lat: number; lng: number } }) {
        pts.push([e.latlng.lat, e.latlng.lng])
        if (preview) map.removeLayer(preview)
        if (pts.length >= 2) {
          preview = L.polygon(pts, { color: '#16a34a', dashArray: '6', weight: 2.5, fillOpacity: 0.18 }).addTo(map)
        }
      }

      map.on('click', onClick)
      map.getContainer().style.cursor = 'crosshair'
      drawCtxRef.current = { onClick, getPreview: () => preview, pts, map }
    })
  }

  function finishDraw() {
    const ctx = drawCtxRef.current
    if (!ctx) return
    ctx.map.off('click', ctx.onClick)
    ctx.map.getContainer().style.cursor = ''
    const p = ctx.getPreview()
    if (p) ctx.map.removeLayer(p)

    if (ctx.pts.length >= 3 && drawTarget && onSaveCoords) {
      const ring = [...ctx.pts, ctx.pts[0]]
      onSaveCoords(drawTarget, JSON.stringify({
        type: 'Polygon',
        coordinates: [ring.map(([lat, lng]: [number, number]) => [lng, lat])],
      }))
    }
    drawCtxRef.current = null
    setDrawing(false)
    setDrawTarget(null)
  }

  function cancelDraw() {
    const ctx = drawCtxRef.current
    if (ctx) {
      ctx.map.off('click', ctx.onClick)
      ctx.map.getContainer().style.cursor = ''
      const p = ctx.getPreview()
      if (p) ctx.map.removeLayer(p)
      drawCtxRef.current = null
    }
    setDrawing(false)
    setDrawTarget(null)
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.13)' }}>
      {/* Leaflet CSS — same CDN approach as talhao-map.tsx */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />

      {/* Map container */}
      <div ref={containerRef} style={{ height, width: '100%' }} />

      {/* ── Top-left controls ── */}
      <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 1000, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {/* Satellite toggle */}
        <button
          onClick={() => setSatellite(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: satellite ? '#1d4ed8' : 'rgba(255,255,255,0.95)',
            color: satellite ? 'white' : '#374151',
            border: '1px solid rgba(0,0,0,0.15)', borderRadius: 10,
            padding: '6px 12px', fontSize: 12, fontWeight: 600,
            cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <Layers size={13} /> {satellite ? 'Mapa' : 'Satélite'}
        </button>

        {/* Draw selector — only for talhões without coords */}
        {!drawing && features.filter(f => !f.talhao.coordenadas).length > 0 && (
          <div style={{ position: 'relative' }}>
            <Pencil size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#6b7280', pointerEvents: 'none' }} />
            <select
              defaultValue=""
              onChange={e => { if (e.target.value) startDraw(e.target.value) }}
              style={{
                background: 'rgba(255,255,255,0.95)', color: '#374151',
                border: '1px solid rgba(0,0,0,0.15)', borderRadius: 10,
                padding: '6px 28px 6px 28px', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                appearance: 'none', backdropFilter: 'blur(4px)',
              }}
            >
              <option value="" disabled>✏ Demarcar talhão...</option>
              {features.filter(f => !f.talhao.coordenadas).map(f => (
                <option key={f.talhao.id} value={f.talhao.id}>{f.talhao.nome}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ── Drawing mode banner ── */}
      {drawing && (
        <div style={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
          zIndex: 1001, background: '#1d4ed8', color: 'white',
          borderRadius: 12, padding: '8px 16px',
          display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 4px 20px rgba(29,78,216,0.4)',
          fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
        }}>
          <span>✏ Clique no mapa para marcar os vértices</span>
          <button onClick={finishDraw} style={{
            background: '#16a34a', color: 'white', border: 'none',
            borderRadius: 8, padding: '4px 12px', fontSize: 12,
            fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <CheckCircle size={13} /> Concluir
          </button>
          <button onClick={cancelDraw} style={{
            background: 'rgba(255,255,255,0.2)', color: 'white', border: 'none',
            borderRadius: 8, padding: '4px 10px', fontSize: 12, cursor: 'pointer',
          }}>
            <X size={13} />
          </button>
        </div>
      )}

      {/* ── Legend ── */}
      <div style={{
        position: 'absolute', bottom: 36, left: 12, zIndex: 1000,
        background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)',
        borderRadius: 12, padding: '10px 14px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.12)', fontSize: 11, fontWeight: 500,
      }}>
        <div style={{ fontWeight: 700, marginBottom: 6, color: '#374151', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Status
        </div>
        {Object.values(STATUS_CFG).map(cfg => (
          <div key={cfg.label} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: cfg.fill || `${cfg.color}22`, border: `2px solid ${cfg.color}` }} />
            <span style={{ color: '#374151' }}>{cfg.label}</span>
            {cfg.pulse && <span style={{ fontSize: 9, color: '#dc2626' }}>●</span>}
          </div>
        ))}
        {showDemos && (
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #e5e7eb', fontSize: 10, color: '#6b7280' }}>
            📍 Modo demonstração
          </div>
        )}
      </div>

      {/* ── Demo info banner ── */}
      {showDemos && (
        <div style={{
          position: 'absolute', top: 12, right: 12, zIndex: 1000,
          background: 'rgba(22,163,74,0.93)', color: 'white',
          borderRadius: 12, padding: '8px 14px', maxWidth: 220,
          fontSize: 11, fontWeight: 500, boxShadow: '0 2px 12px rgba(22,163,74,0.35)',
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>🌱 Modo demonstração</div>
          <div style={{ opacity: 0.9 }}>Cadastre talhões e use &ldquo;Demarcar&rdquo; para desenhar seus polígonos reais.</div>
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
