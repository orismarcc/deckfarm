'use client'
/**
 * TalhoesMap — Mapa interativo de talhões (DeckFarm)
 *
 * Mesma estratégia do talhao-map.tsx que já funciona:
 *   • import('leaflet') do npm dentro de useEffect (nunca no nível de módulo)
 *   • CSS via <link rel="stylesheet"> no JSX (não import dinâmico)
 *   • Flag `cancelled` previne double-init do React StrictMode
 *   • try/catch em todo o código Leaflet evita crash no global error boundary
 *   • invalidateSize() garante que tiles renderizem dentro de tabs/containers
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import type { Talhao, Aplicacao } from '@/types'
import { culturaLabel, culturaIcon } from '@/lib/utils'

// ── Configuração visual de status ─────────────────────────────────────────────
const STATUS_CFG: Record<string, { color: string; label: string; pulse: boolean }> = {
  atrasado:        { color: '#dc2626', label: 'Atrasado',     pulse: true  },
  hoje:            { color: '#2563eb', label: 'Hoje',          pulse: true  },
  proximo:         { color: '#d97706', label: 'Próximo (7d)',  pulse: false },
  dentro_do_prazo: { color: '#16a34a', label: 'No prazo',      pulse: false },
  sem_aplicacao:   { color: '#6b7280', label: 'Sem aplicação', pulse: false },
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

// Polígonos de demonstração no Mato Grosso
const DEMO_COORDS: [number, number][][] = [
  [[-12.53,-52.31],[-12.51,-52.31],[-12.51,-52.28],[-12.53,-52.28],[-12.53,-52.31]],
  [[-12.55,-52.31],[-12.54,-52.31],[-12.54,-52.29],[-12.55,-52.29],[-12.55,-52.31]],
]
const DEMO_CFG  = [STATUS_CFG.atrasado, STATUS_CFG.proximo]
const DEMO_NAMES = ['Talhão Norte (Demo)', 'Talhão Sul (Demo)']

function worstStatus(aplicacoes: Aplicacao[]): string {
  if (!aplicacoes?.length) return 'sem_aplicacao'
  if (aplicacoes.some(a => a.status === 'atrasado'))         return 'atrasado'
  if (aplicacoes.some(a => a.status === 'hoje'))             return 'hoje'
  if (aplicacoes.some(a => a.status === 'proximo'))          return 'proximo'
  if (aplicacoes.some(a => a.status === 'dentro_do_prazo'))  return 'dentro_do_prazo'
  return 'sem_aplicacao'
}

export default function TalhoesMap({ features, onSaveCoords, height = '520px' }: TalhoesMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef     = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const layersRef  = useRef<{ street: any; sat: any } | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const drawRef    = useRef<any>(null)

  const [satellite,  setSatellite]  = useState(false)
  const [drawing,    setDrawing]    = useState(false)
  const [drawTarget, setDrawTarget] = useState<string | null>(null)
  const [ready,      setReady]      = useState(false)

  const showDemos = features.length === 0

  // ── Inicializar mapa ──────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false

    // Já existe instância — não reinicializar (proteção StrictMode)
    if (mapRef.current) return

    import('leaflet').then(L => {
      if (cancelled || !containerRef.current || mapRef.current) return

      try {
        // Fix default marker icons quebrados pelo webpack/turbopack
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (L.Icon.Default.prototype as any)._getIconUrl
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
          iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
          shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        })

        // Calcular centro a partir dos polígonos existentes
        let centerLat = -12.54, centerLng = -52.30, zoom = 13
        const allPts: [number, number][] = []
        features.forEach(f => {
          if (!f.talhao?.coordenadas) return
          try {
            const geo = JSON.parse(f.talhao.coordenadas)
            ;(geo?.coordinates?.[0] ?? []).forEach(([lng, lat]: [number, number]) => {
              allPts.push([lat, lng])
            })
          } catch { /* ignora GeoJSON inválido */ }
        })
        if (allPts.length > 0) {
          centerLat = allPts.reduce((s, p) => s + p[0], 0) / allPts.length
          centerLng = allPts.reduce((s, p) => s + p[1], 0) / allPts.length
          zoom = 14
        }

        // Criar mapa
        const map = L.map(containerRef.current, {
          center: [centerLat, centerLng],
          zoom,
          zoomControl: false,
        })
        mapRef.current = map

        // Tile layers
        const street = L.tileLayer(
          'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          { attribution: '© OpenStreetMap', maxZoom: 19 }
        )
        const sat = L.tileLayer(
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          { attribution: '© Esri', maxZoom: 19 }
        )
        street.addTo(map)
        layersRef.current = { street, sat }

        L.control.zoom({ position: 'bottomright' }).addTo(map)

        // Animação de pulso
        if (!document.getElementById('df-pulse-css')) {
          const s = document.createElement('style')
          s.id = 'df-pulse-css'
          s.textContent = `@keyframes dfpulse{0%{transform:scale(1);opacity:.85}60%{transform:scale(1.7);opacity:.3}100%{transform:scale(1);opacity:.85}}`
          document.head.appendChild(s)
        }

        // ── Polígonos reais ───────────────────────────────────────────────────
        features.forEach(f => {
          if (!f.talhao?.coordenadas) return
          try {
            const geo    = JSON.parse(f.talhao.coordenadas)
            const status = worstStatus(f.aplicacoes ?? [])
            const cfg    = STATUS_CFG[status] ?? STATUS_CFG.sem_aplicacao
            const apps   = f.aplicacoes ?? []
            const late   = apps.filter(a => a.status === 'atrasado').length

            const layer = L.geoJSON(geo, {
              style: { color: cfg.color, fillColor: cfg.color, weight: 2.5, fillOpacity: 0.35, opacity: 1 },
            })
            layer.on('mouseover', () => layer.setStyle({ weight: 4, fillOpacity: 0.55 }))
            layer.on('mouseout',  () => layer.setStyle({ weight: 2.5, fillOpacity: 0.35 }))
            layer.bindPopup(`
              <div style="min-width:200px;font-family:system-ui,sans-serif">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
                  <span style="font-size:20px">${culturaIcon(f.talhao.cultura)}</span>
                  <div>
                    <div style="font-weight:700;font-size:14px;color:#111">${f.talhao.nome}</div>
                    <div style="font-size:11px;color:#777">${culturaLabel(f.talhao.cultura) ?? f.talhao.cultura}</div>
                  </div>
                </div>
                <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
                  <span style="background:${cfg.color}20;color:${cfg.color};border:1px solid ${cfg.color}50;
                    font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px">${cfg.label}</span>
                  ${late > 0 ? `<span style="background:#fee2e2;color:#dc2626;font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px">⚠ ${late} atrasada${late > 1 ? 's' : ''}</span>` : ''}
                </div>
                <div style="font-size:11px;color:#555;margin-bottom:10px">
                  📐 <b>${f.talhao.area} ha</b>&nbsp;·&nbsp;💊 <b>${apps.length} aplicações</b>
                  ${f.talhao.data_plantio ? `<br>🌱 Plantio: <b>${f.talhao.data_plantio}</b>` : ''}
                </div>
                <a href="/talhoes/${f.talhao.id}"
                  style="display:block;text-align:center;background:#16a34a;color:white;
                  padding:6px 12px;border-radius:8px;font-size:12px;font-weight:600;text-decoration:none">
                  Ver talhão →
                </a>
              </div>
            `, { maxWidth: 260 })
            layer.addTo(map)

            // Marcador pulsante para campos urgentes
            if (cfg.pulse) {
              try {
                const center = layer.getBounds().getCenter()
                L.marker([center.lat, center.lng], {
                  icon: L.divIcon({
                    className: '',
                    html: `<div style="width:16px;height:16px;border-radius:50%;background:${cfg.color};animation:dfpulse 1.8s ease-in-out infinite"></div>`,
                    iconSize: [16, 16], iconAnchor: [8, 8],
                  }),
                  interactive: false,
                }).addTo(map)
              } catch { /* sem bounds */ }
            }
          } catch { /* skip talhão inválido */ }
        })

        // ── Polígonos de demonstração ─────────────────────────────────────────
        if (showDemos) {
          DEMO_COORDS.forEach((coords, i) => {
            const cfg = DEMO_CFG[i]
            L.polygon(coords, { color: cfg.color, fillColor: cfg.color, weight: 2.5, fillOpacity: 0.35 })
              .bindPopup(`
                <div style="font-family:system-ui;min-width:170px">
                  <div style="font-weight:700;margin-bottom:6px">🌱 ${DEMO_NAMES[i]}</div>
                  <div style="font-size:11px;color:#666;margin-bottom:8px">
                    Polígono de demonstração.<br>Cadastre talhões e demarcque!
                  </div>
                  <span style="background:${cfg.color}20;color:${cfg.color};
                    border:1px solid ${cfg.color}50;font-size:10px;font-weight:700;
                    padding:2px 8px;border-radius:999px">${cfg.label}</span>
                </div>
              `)
              .addTo(map)
          })
        }

        // Forçar recálculo de tamanho — essencial quando renderizado em aba
        setTimeout(() => { if (mapRef.current) mapRef.current.invalidateSize() }, 100)
        setTimeout(() => { if (mapRef.current) mapRef.current.invalidateSize() }, 600)

        // Observar mudanças de tamanho
        if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
          const ro = new ResizeObserver(() => {
            if (mapRef.current) mapRef.current.invalidateSize()
          })
          ro.observe(containerRef.current)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(map as any).__ro = ro
        }

        if (!cancelled) setReady(true)
      } catch (err) {
        console.error('[TalhoesMap]', err)
      }
    }).catch(err => {
      console.error('[TalhoesMap] import leaflet failed:', err)
    })

    return () => {
      cancelled = true
      if (mapRef.current) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if ((mapRef.current as any).__ro) (mapRef.current as any).__ro.disconnect()
          mapRef.current.remove()
        } catch { /* ignora erros no cleanup */ }
        mapRef.current = null
        layersRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Toggle satélite ───────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    const lrs = layersRef.current
    if (!map || !lrs || !ready) return
    try {
      if (satellite) {
        if (map.hasLayer(lrs.street)) map.removeLayer(lrs.street)
        if (!map.hasLayer(lrs.sat))   map.addLayer(lrs.sat)
      } else {
        if (map.hasLayer(lrs.sat))    map.removeLayer(lrs.sat)
        if (!map.hasLayer(lrs.street)) map.addLayer(lrs.street)
      }
    } catch { /* ignora */ }
  }, [satellite, ready])

  // ── Ferramenta de desenho ─────────────────────────────────────────────────
  const startDraw = useCallback((talhaoId: string) => {
    const map = mapRef.current
    if (!map) return
    setDrawTarget(talhaoId)
    setDrawing(true)

    import('leaflet').then(L => {
      const pts: [number, number][] = []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let preview: any = null

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      function onClick(e: any) {
        pts.push([e.latlng.lat, e.latlng.lng])
        if (preview) { try { map.removeLayer(preview) } catch { /* ok */ } }
        if (pts.length >= 2) {
          preview = L.polygon(pts, { color: '#16a34a', dashArray: '6', weight: 2.5, fillOpacity: 0.18 }).addTo(map)
        }
      }

      map.on('click', onClick)
      map.getContainer().style.cursor = 'crosshair'
      drawRef.current = { onClick, preview: () => preview, pts }
    }).catch(console.error)
  }, [])

  const finishDraw = useCallback(() => {
    const ctx = drawRef.current
    const map = mapRef.current
    if (!ctx || !map) return
    try {
      map.off('click', ctx.onClick)
      map.getContainer().style.cursor = ''
      const p = ctx.preview()
      if (p) map.removeLayer(p)

      if (ctx.pts.length >= 3 && drawTarget && onSaveCoords) {
        const ring = [...ctx.pts, ctx.pts[0]]
        onSaveCoords(drawTarget, JSON.stringify({
          type: 'Polygon',
          coordinates: [ring.map(([lat, lng]: [number, number]) => [lng, lat])],
        }))
      }
    } catch (e) { console.error('[TalhoesMap] finishDraw', e) }
    drawRef.current = null
    setDrawing(false)
    setDrawTarget(null)
  }, [drawTarget, onSaveCoords])

  const cancelDraw = useCallback(() => {
    const ctx = drawRef.current
    const map = mapRef.current
    if (ctx && map) {
      try {
        map.off('click', ctx.onClick)
        map.getContainer().style.cursor = ''
        const p = ctx.preview()
        if (p) map.removeLayer(p)
      } catch { /* ok */ }
      drawRef.current = null
    }
    setDrawing(false)
    setDrawTarget(null)
  }, [])

  // ── Render ────────────────────────────────────────────────────────────────
  const btnStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 6,
    background: 'rgba(255,255,255,0.97)', color: '#374151',
    border: '1px solid rgba(0,0,0,0.15)', borderRadius: 10,
    padding: '7px 13px', fontSize: 12, fontWeight: 600,
    cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    backdropFilter: 'blur(4px)',
  }

  return (
    <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }}>
      {/* CSS do Leaflet — mesmo padrão comprovado do talhao-map.tsx */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />

      {/* Container do mapa */}
      <div ref={containerRef} style={{ height, width: '100%', background: '#dde0e4' }} />

      {/* ── Controles superiores esquerda ── */}
      <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 1000, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          onClick={() => setSatellite(v => !v)}
          style={{ ...btnStyle, ...(satellite ? { background: '#1d4ed8', color: 'white' } : {}) }}
        >
          🛰 {satellite ? 'Mapa' : 'Satélite'}
        </button>

        {!drawing && features.filter(f => !f.talhao.coordenadas).length > 0 && (
          <select
            key="demarcar-select"
            defaultValue=""
            onChange={e => { if (e.target.value) startDraw(e.target.value) }}
            style={{ ...btnStyle, paddingLeft: 13, appearance: 'none' as const }}
          >
            <option value="" disabled>✏ Demarcar talhão...</option>
            {features.filter(f => !f.talhao.coordenadas).map(f => (
              <option key={f.talhao.id} value={f.talhao.id}>{f.talhao.nome}</option>
            ))}
          </select>
        )}
      </div>

      {/* ── Banner modo desenho ── */}
      {drawing && (
        <div style={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
          zIndex: 1001, background: '#1d4ed8', color: 'white',
          borderRadius: 12, padding: '8px 16px',
          display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 4px 20px rgba(29,78,216,0.4)',
          fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
        }}>
          <span>✏ Clique para marcar os vértices</span>
          <button onClick={finishDraw}
            style={{ background: '#16a34a', color: 'white', border: 'none', borderRadius: 8, padding: '4px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            ✓ Concluir
          </button>
          <button onClick={cancelDraw}
            style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: 'none', borderRadius: 8, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>
            ✕
          </button>
        </div>
      )}

      {/* ── Legenda ── */}
      <div style={{
        position: 'absolute', bottom: 36, left: 12, zIndex: 1000,
        background: 'rgba(255,255,255,0.97)', borderRadius: 12,
        padding: '10px 14px', boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
        fontSize: 11, fontWeight: 500, pointerEvents: 'none',
      }}>
        <div style={{ fontWeight: 700, marginBottom: 6, color: '#374151', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Status</div>
        {Object.values(STATUS_CFG).map(cfg => (
          <div key={cfg.label} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: `${cfg.color}22`, border: `2px solid ${cfg.color}`, flexShrink: 0 }} />
            <span style={{ color: '#374151' }}>{cfg.label}</span>
            {cfg.pulse && <span style={{ fontSize: 8, color: cfg.color }}>●</span>}
          </div>
        ))}
        {showDemos && (
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #e5e7eb', fontSize: 10, color: '#9ca3af' }}>📍 Modo demo</div>
        )}
      </div>

      {/* ── Dica de clique ── */}
      {!drawing && (
        <div style={{
          position: 'absolute', bottom: 36, right: 48, zIndex: 1000,
          background: 'rgba(255,255,255,0.92)', borderRadius: 8,
          padding: '4px 9px', fontSize: 10, color: '#6b7280',
          boxShadow: '0 1px 4px rgba(0,0,0,0.1)', pointerEvents: 'none',
        }}>
          🖱 Clique nos polígonos para detalhes
        </div>
      )}

      {/* ── Banner demo ── */}
      {showDemos && (
        <div style={{
          position: 'absolute', top: 12, right: 12, zIndex: 1000,
          background: 'rgba(22,163,74,0.93)', color: 'white',
          borderRadius: 12, padding: '8px 14px', maxWidth: 220,
          fontSize: 11, fontWeight: 500, boxShadow: '0 2px 12px rgba(22,163,74,0.3)',
        }}>
          <div style={{ fontWeight: 700, marginBottom: 3 }}>🌱 Modo demonstração</div>
          <div style={{ opacity: 0.9, lineHeight: 1.4 }}>Cadastre talhões e demarcque no mapa.</div>
        </div>
      )}
    </div>
  )
}
