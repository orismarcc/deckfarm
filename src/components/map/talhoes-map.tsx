'use client'
/**
 * TalhoesMap — Mapa interativo de talhões (DeckFarm)
 *
 * Usa react-map-gl + MapLibre GL JS (sem Leaflet, sem API key, 100% open-source).
 * Funcionalidades:
 *  - Polígonos coloridos por status da aplicação
 *  - Popup rico ao clicar
 *  - Ferramenta de demarcação (clique nos vértices → Concluir → salva GeoJSON)
 *  - Toggle satélite (ESRI) / mapa (OpenStreetMap)
 *  - Polígonos demo para estado vazio (lúdico)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Talhao, Aplicacao } from '@/types'
import { culturaLabel, culturaIcon } from '@/lib/utils'

// Tipos MapLibre carregados dinamicamente (evita SSR)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyMap = any

// ── Configuração de status ────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { color: string; label: string }> = {
  atrasado:        { color: '#dc2626', label: 'Atrasado'     },
  hoje:            { color: '#2563eb', label: 'Hoje'          },
  proximo:         { color: '#d97706', label: 'Próximo (7d)'  },
  dentro_do_prazo: { color: '#16a34a', label: 'No prazo'      },
  sem_aplicacao:   { color: '#6b7280', label: 'Sem aplicação' },
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

// Polígonos demo Mato Grosso
const DEMO_GEO = {
  type: 'FeatureCollection' as const,
  features: [
    {
      type: 'Feature' as const,
      properties: { id: '__demo1', name: 'Talhão Norte (Demo)', color: '#dc2626', label: 'Atrasado', area: 45, apps: 0 },
      geometry: { type: 'Polygon' as const, coordinates: [[[-52.31,-12.53],[-52.28,-12.53],[-52.28,-12.51],[-52.31,-12.51],[-52.31,-12.53]]] },
    },
    {
      type: 'Feature' as const,
      properties: { id: '__demo2', name: 'Talhão Sul (Demo)', color: '#d97706', label: 'Próximo (7d)', area: 22, apps: 0 },
      geometry: { type: 'Polygon' as const, coordinates: [[[-52.31,-12.55],[-52.29,-12.55],[-52.29,-12.54],[-52.31,-12.54],[-52.31,-12.55]]] },
    },
  ],
}

function worstStatus(aplicacoes: Aplicacao[]): string {
  if (!aplicacoes?.length) return 'sem_aplicacao'
  if (aplicacoes.some(a => a.status === 'atrasado'))         return 'atrasado'
  if (aplicacoes.some(a => a.status === 'hoje'))             return 'hoje'
  if (aplicacoes.some(a => a.status === 'proximo'))          return 'proximo'
  if (aplicacoes.some(a => a.status === 'dentro_do_prazo'))  return 'dentro_do_prazo'
  return 'sem_aplicacao'
}

// Estilo de mapa OSM
const OSM_STYLE = {
  version: 8 as const,
  sources: { osm: { type: 'raster' as const, tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '© OpenStreetMap' } },
  layers: [{ id: 'osm-tiles', type: 'raster' as const, source: 'osm' }],
}

// Estilo satélite ESRI (sem API key)
const SAT_STYLE = {
  version: 8 as const,
  sources: { esri: { type: 'raster' as const, tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, attribution: '© Esri' } },
  layers: [{ id: 'esri-tiles', type: 'raster' as const, source: 'esri' }],
}

export default function TalhoesMap({ features, onSaveCoords, height = '520px' }: TalhoesMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef          = useRef<AnyMap>(null)
  const [ready,      setReady]      = useState(false)
  const [satellite,  setSatellite]  = useState(false)
  const [drawing,    setDrawing]    = useState(false)
  const [drawTarget, setDrawTarget] = useState<string | null>(null)
  const [drawPts,    setDrawPts]    = useState<[number, number][]>([])
  const [popup,      setPopup]      = useState<{ lng: number; lat: number; html: string } | null>(null)
  const drawListenerRef = useRef<((e: AnyMap) => void) | null>(null)

  const showDemos = features.length === 0

  // ── GeoJSON dos talhões reais ─────────────────────────────────────────────
  const fieldsGeo = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: features
      .filter(f => f.talhao?.coordenadas)
      .map(f => {
        const status = worstStatus(f.aplicacoes ?? [])
        const cfg    = STATUS_CFG[status] ?? STATUS_CFG.sem_aplicacao
        const apps   = f.aplicacoes ?? []
        const late   = apps.filter(a => a.status === 'atrasado').length
        let geo
        try { geo = JSON.parse(f.talhao.coordenadas!) } catch { return null }
        return {
          type: 'Feature' as const,
          properties: {
            id:    f.talhao.id,
            name:  f.talhao.nome,
            color: cfg.color,
            label: cfg.label,
            area:  f.talhao.area,
            apps:  apps.length,
            late,
            cultura: `${culturaIcon(f.talhao.cultura)} ${culturaLabel(f.talhao.cultura) ?? f.talhao.cultura}`,
            href: `/talhoes/${f.talhao.id}`,
          },
          geometry: geo,
        }
      })
      .filter(Boolean),
  }), [features])

  // (draw preview gerenciado via useEffect → map.getSource)

  // ── Inicializar MapLibre ──────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return
    let cancelled = false

    import('maplibre-gl').then(({ default: maplibregl }) => {
      if (cancelled || !mapContainerRef.current || mapRef.current) return
      try {
        // Centro: média dos polígonos, ou Mato Grosso
        let centerLng = -52.30, centerLat = -12.54, zoom = 11
        const allPts: [number, number][] = []
        features.forEach(f => {
          if (!f.talhao?.coordenadas) return
          try {
            const g = JSON.parse(f.talhao.coordenadas)
            ;(g?.coordinates?.[0] ?? []).forEach(([lng, lat]: [number, number]) => allPts.push([lng, lat]))
          } catch { /* ok */ }
        })
        if (allPts.length > 0) {
          centerLng = allPts.reduce((s, p) => s + p[0], 0) / allPts.length
          centerLat = allPts.reduce((s, p) => s + p[1], 0) / allPts.length
          zoom = 13
        }

        const map = new maplibregl.Map({
          container: mapContainerRef.current!,
          style: OSM_STYLE,
          center: [centerLng, centerLat],
          zoom,
          attributionControl: { compact: true },
        })

        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')

        map.on('load', () => {
          if (cancelled) return

          // ── Camadas dos talhões reais ────────────────────────────────────
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          map.addSource('fields', { type: 'geojson', data: (showDemos ? DEMO_GEO : fieldsGeo) as any })
          map.addLayer({ id: 'fields-fill',    type: 'fill',   source: 'fields', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.35 } })
          map.addLayer({ id: 'fields-outline', type: 'line',   source: 'fields', paint: { 'line-color': ['get', 'color'], 'line-width': 2.5 } })
          map.addLayer({ id: 'fields-labels',  type: 'symbol', source: 'fields',
            layout: { 'text-field': ['get', 'name'], 'text-size': 12, 'text-anchor': 'center' },
            paint: { 'text-color': '#111', 'text-halo-color': '#fff', 'text-halo-width': 2 },
          })

          // ── Preview do desenho ───────────────────────────────────────────
          map.addSource('draw-preview', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
          map.addLayer({ id: 'draw-fill',    type: 'fill', source: 'draw-preview', paint: { 'fill-color': '#16a34a', 'fill-opacity': 0.2 } })
          map.addLayer({ id: 'draw-outline', type: 'line', source: 'draw-preview', paint: { 'line-color': '#16a34a', 'line-width': 2, 'line-dasharray': [4, 3] } })

          // Hover e click nos campos
          map.on('mouseenter', 'fields-fill', () => { map.getCanvas().style.cursor = 'pointer' })
          map.on('mouseleave', 'fields-fill', () => { map.getCanvas().style.cursor = '' })
          map.on('click', 'fields-fill', (e: AnyMap) => {
            const props = e.features?.[0]?.properties
            if (!props || props.id?.startsWith('__demo')) {
              setPopup({ lng: e.lngLat.lng, lat: e.lngLat.lat,
                html: `<div style="font-family:system-ui;padding:4px 0"><b>🌱 ${props?.name ?? 'Demo'}</b><br><span style="font-size:11px;color:#6b7280">Polígono de demonstração</span></div>` })
              return
            }
            setPopup({
              lng: e.lngLat.lng, lat: e.lngLat.lat,
              html: `
                <div style="min-width:190px;font-family:system-ui;font-size:13px">
                  <div style="font-weight:700;margin-bottom:6px;font-size:14px">${props.cultura ?? ''} ${props.name}</div>
                  <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
                    <span style="background:${props.color}20;color:${props.color};border:1px solid ${props.color}55;
                      font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px">${props.label}</span>
                    ${props.late > 0 ? `<span style="background:#fee2e2;color:#dc2626;font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px">⚠ ${props.late} atrasada${props.late > 1 ? 's' : ''}</span>` : ''}
                  </div>
                  <div style="font-size:11px;color:#555;margin-bottom:10px">
                    📐 <b>${props.area} ha</b>&nbsp;·&nbsp;💊 <b>${props.apps} aplicações</b>
                  </div>
                  <a href="${props.href}" style="display:block;text-align:center;
                    background:#16a34a;color:#fff;padding:6px 12px;border-radius:8px;
                    font-size:12px;font-weight:600;text-decoration:none">Ver talhão →</a>
                </div>
              `,
            })
          })

          mapRef.current = map
          if (!cancelled) setReady(true)
        })

        map.on('error', (e: AnyMap) => console.warn('[TalhoesMap]', e.error))
      } catch (err) {
        console.error('[TalhoesMap] init:', err)
      }
    }).catch(err => console.error('[TalhoesMap] import:', err))

    return () => {
      cancelled = true
      if (mapRef.current) {
        try { mapRef.current.remove() } catch { /* ok */ }
        mapRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Atualizar dados quando features mudam ─────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    try {
      const src = map.getSource('fields')
      if (src) src.setData(showDemos ? DEMO_GEO : fieldsGeo)
    } catch { /* ok */ }
  }, [fieldsGeo, showDemos, ready])

  // ── Toggle satélite ───────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    try { map.setStyle(satellite ? SAT_STYLE : OSM_STYLE) } catch { /* ok */ }
  }, [satellite, ready])

  // Após trocar estilo, recriar camadas (o setStyle limpa tudo)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return

    function onStyleLoad() {
      try {
        if (!map.getSource('fields')) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          map.addSource('fields', { type: 'geojson', data: (showDemos ? DEMO_GEO : fieldsGeo) as any })
          map.addLayer({ id: 'fields-fill',    type: 'fill',   source: 'fields', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.35 } })
          map.addLayer({ id: 'fields-outline', type: 'line',   source: 'fields', paint: { 'line-color': ['get', 'color'], 'line-width': 2.5 } })
          map.addLayer({ id: 'fields-labels',  type: 'symbol', source: 'fields',
            layout: { 'text-field': ['get', 'name'], 'text-size': 12, 'text-anchor': 'center' },
            paint: { 'text-color': '#111', 'text-halo-color': '#fff', 'text-halo-width': 2 },
          })
        }
        if (!map.getSource('draw-preview')) {
          map.addSource('draw-preview', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
          map.addLayer({ id: 'draw-fill',    type: 'fill', source: 'draw-preview', paint: { 'fill-color': '#16a34a', 'fill-opacity': 0.2 } })
          map.addLayer({ id: 'draw-outline', type: 'line', source: 'draw-preview', paint: { 'line-color': '#16a34a', 'line-width': 2, 'line-dasharray': [4, 3] } })
        }
        map.on('mouseenter', 'fields-fill', () => { map.getCanvas().style.cursor = 'pointer' })
        map.on('mouseleave', 'fields-fill', () => { map.getCanvas().style.cursor = '' })
      } catch { /* ok */ }
    }

    map.on('styledata', onStyleLoad)
    return () => { try { map.off('styledata', onStyleLoad) } catch { /* ok */ } }
  }, [ready, fieldsGeo, showDemos])

  // ── Atualizar preview de desenho ──────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    try {
      const src = map.getSource('draw-preview')
      if (src) src.setData(drawPts.length >= 2 ? {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature', properties: {},
          geometry: { type: 'Polygon', coordinates: [[...drawPts, drawPts[0]]] },
        }],
      } : { type: 'FeatureCollection', features: [] })
    } catch { /* ok */ }
  }, [drawPts, ready])

  // ── Ferramenta de desenho ─────────────────────────────────────────────────
  const startDraw = useCallback((talhaoId: string) => {
    const map = mapRef.current
    if (!map) return
    setDrawTarget(talhaoId)
    setDrawPts([])
    setDrawing(true)
    setPopup(null)
    map.getCanvas().style.cursor = 'crosshair'

    const onClick = (e: AnyMap) => {
      setDrawPts(prev => [...prev, [e.lngLat.lng, e.lngLat.lat]])
    }
    map.on('click', onClick)
    drawListenerRef.current = onClick
  }, [])

  const finishDraw = useCallback(() => {
    const map = mapRef.current
    if (map && drawListenerRef.current) {
      try {
        map.off('click', drawListenerRef.current)
        map.getCanvas().style.cursor = ''
      } catch { /* ok */ }
      drawListenerRef.current = null
    }

    if (drawPts.length >= 3 && drawTarget && onSaveCoords) {
      const ring = [...drawPts, drawPts[0]]
      onSaveCoords(drawTarget, JSON.stringify({ type: 'Polygon', coordinates: [ring] }))
    }

    setDrawing(false)
    setDrawTarget(null)
    setDrawPts([])
  }, [drawPts, drawTarget, onSaveCoords])

  const cancelDraw = useCallback(() => {
    const map = mapRef.current
    if (map && drawListenerRef.current) {
      try {
        map.off('click', drawListenerRef.current)
        map.getCanvas().style.cursor = ''
      } catch { /* ok */ }
      drawListenerRef.current = null
    }
    setDrawing(false)
    setDrawTarget(null)
    setDrawPts([])
  }, [])

  // ── Popup nativo MapLibre ─────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || !popup) return

    let mlPopup: AnyMap
    import('maplibre-gl').then(({ default: maplibregl }) => {
      mlPopup = new maplibregl.Popup({ closeButton: true, maxWidth: '280px' })
        .setLngLat([popup.lng, popup.lat])
        .setHTML(popup.html)
        .addTo(map)
      mlPopup.on('close', () => setPopup(null))
    }).catch(() => {/* ok */})

    return () => { try { mlPopup?.remove() } catch { /* ok */ } }
  }, [popup, ready])

  // ── CSS do MapLibre (import dinâmico só no browser) ───────────────────────
  useEffect(() => {
    if (document.getElementById('maplibre-css')) return
    const link = document.createElement('link')
    link.id   = 'maplibre-css'
    link.rel  = 'stylesheet'
    link.href = 'https://unpkg.com/maplibre-gl@5.2.0/dist/maplibre-gl.css'
    document.head.appendChild(link)
  }, [])

  // ── Estilos dos botões ────────────────────────────────────────────────────
  const btnBase: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 6,
    background: 'rgba(255,255,255,0.97)', color: '#374151',
    border: '1px solid rgba(0,0,0,0.14)', borderRadius: 10,
    padding: '7px 13px', fontSize: 12, fontWeight: 600,
    cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.14)',
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }}>

      {/* Container do mapa MapLibre */}
      <div ref={mapContainerRef} style={{ height, width: '100%', background: '#dde0e4' }} />

      {/* ── Controles superiores esquerda ── */}
      <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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

      {/* ── Banner modo desenho ── */}
      {drawing && (
        <div style={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
          zIndex: 10, background: '#1d4ed8', color: '#fff',
          borderRadius: 12, padding: '8px 16px',
          display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 4px 20px rgba(29,78,216,0.4)',
          fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
        }}>
          <span>✏ {drawPts.length} vértice{drawPts.length !== 1 ? 's' : ''} · clique para adicionar</span>
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

      {/* ── Legenda ── */}
      <div style={{
        position: 'absolute', bottom: 36, left: 12, zIndex: 10,
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
        {showDemos && (
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #e5e7eb', fontSize: 10, color: '#9ca3af' }}>📍 Modo demo</div>
        )}
      </div>

      {/* ── Banner demo ── */}
      {showDemos && (
        <div style={{
          position: 'absolute', top: 12, right: 12, zIndex: 10,
          background: 'rgba(22,163,74,0.93)', color: '#fff',
          borderRadius: 12, padding: '8px 14px', maxWidth: 220,
          fontSize: 11, fontWeight: 500, boxShadow: '0 2px 12px rgba(22,163,74,0.3)',
        }}>
          <div style={{ fontWeight: 700, marginBottom: 3 }}>🌱 Modo demonstração</div>
          <div style={{ opacity: 0.9, lineHeight: 1.4 }}>Cadastre talhões e demarcque no mapa.</div>
        </div>
      )}

      {/* ── Dica ── */}
      {!drawing && (
        <div style={{
          position: 'absolute', bottom: 36, right: 50, zIndex: 10,
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
