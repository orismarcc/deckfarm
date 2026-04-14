'use client'
import { useEffect, useState } from 'react'
import { Cloud, Sun, CloudRain, Wind, Droplets, AlertTriangle } from 'lucide-react'

interface WeatherData {
  temp: number
  humidity: number
  wind: number
  precipitation: number
  weatherCode: number
  forecast: { date: string; maxTemp: number; minTemp: number; precip: number }[]
}

function WeatherIcon({ code, size = 20 }: { code: number; size?: number }) {
  if (code === 0) return <Sun size={size} className="text-amber-400" />
  if (code <= 3) return <Cloud size={size} style={{ color: 'var(--fg-muted)' }} />
  if (code <= 82) return <CloudRain size={size} className="text-blue-400" />
  return <Cloud size={size} style={{ color: 'var(--fg-muted)' }} />
}

function weatherLabel(code: number): string {
  if (code === 0) return 'Céu limpo'
  if (code <= 3) return 'Parcialmente nublado'
  if (code <= 48) return 'Nublado'
  if (code <= 67) return 'Chuviscos'
  if (code <= 82) return 'Chuva'
  if (code >= 95) return 'Trovoada'
  return 'Variável'
}

function applicationStatus(wind: number, precip: number, code: number) {
  if (wind > 15) return { ok: false, msg: `Vento forte (${Math.round(wind)} km/h) — aguardar` }
  if (precip > 0.5) return { ok: false, msg: 'Chuva prevista — não aplicar' }
  if (code >= 51) return { ok: false, msg: 'Condição adversa — aguardar' }
  return { ok: true, msg: 'Condições favoráveis para aplicação' }
}

interface WeatherWidgetProps {
  latitude?: number
  longitude?: number
  localizacao?: string
  compact?: boolean
}

export function WeatherWidget({ latitude, longitude, localizacao, compact = false }: WeatherWidgetProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchWeather(lat: number, lng: number) {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,weather_code&daily=precipitation_sum,temperature_2m_max,temperature_2m_min&timezone=America%2FSao_Paulo&forecast_days=3`
        )
        if (!res.ok) throw new Error()
        const d = await res.json()
        setWeather({
          temp: Math.round(d.current.temperature_2m),
          humidity: d.current.relative_humidity_2m,
          wind: d.current.wind_speed_10m,
          precipitation: d.current.precipitation,
          weatherCode: d.current.weather_code,
          forecast: d.daily.time.map((date: string, i: number) => ({
            date,
            maxTemp: Math.round(d.daily.temperature_2m_max[i]),
            minTemp: Math.round(d.daily.temperature_2m_min[i]),
            precip: d.daily.precipitation_sum[i],
          })),
        })
      } catch {
        setError('Não foi possível carregar a previsão')
      } finally {
        setLoading(false)
      }
    }

    if (latitude && longitude) {
      fetchWeather(latitude, longitude)
    } else if (localizacao) {
      fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(localizacao + ', Brasil')}&format=json&limit=1`)
        .then(r => r.json())
        .then(results => {
          if (results.length > 0) fetchWeather(parseFloat(results[0].lat), parseFloat(results[0].lon))
          else setError('Localização não encontrada')
        })
        .catch(() => setError('Erro ao buscar localização'))
    }
  }, [latitude, longitude, localizacao])

  if (!latitude && !longitude && !localizacao) return null

  if (loading) return (
    <div className="rounded-2xl p-4 animate-pulse" style={{ background: 'var(--bg-card)', border: '1px solid var(--borda)' }}>
      <div className="h-3 rounded w-28 mb-2" style={{ background: 'var(--bg-dark)' }} />
      <div className="h-7 rounded w-16" style={{ background: 'var(--bg-dark)' }} />
    </div>
  )

  if (error) return (
    <div className="rounded-xl p-3 flex items-center gap-2 text-sm"
      style={{ background: 'hsl(4 80% 97%)', color: 'hsl(4 72% 45%)', border: '1px solid hsl(4 80% 88%)' }}>
      <AlertTriangle size={14} /> {error}
    </div>
  )

  if (!weather) return null

  const app = applicationStatus(weather.wind, weather.precipitation, weather.weatherCode)

  if (compact) {
    return (
      <div className="rounded-xl px-3 py-2 flex items-center gap-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--borda)' }}>
        <WeatherIcon code={weather.weatherCode} size={16} />
        <span className="font-semibold text-sm" style={{ color: 'var(--fg)' }}>{weather.temp}°C</span>
        <span className="text-xs" style={{ color: 'var(--fg-muted)' }}>{weatherLabel(weather.weatherCode)}</span>
        <div className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ background: app.ok ? 'hsl(160 84% 22% / 0.10)' : 'hsl(4 80% 97%)', color: app.ok ? 'hsl(160 84% 22%)' : 'hsl(4 72% 45%)' }}>
          {app.ok ? '✓ Aplicar' : '✗ Aguardar'}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--borda)', boxShadow: 'var(--shadow-card)' }}>
      {/* Header */}
      <div className="px-5 py-4" style={{ background: 'linear-gradient(135deg, hsl(215 40% 20%), hsl(225 50% 28%))', color: 'white' }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[10px] opacity-60 uppercase tracking-wider">Previsão do Tempo</p>
            {localizacao && <p className="text-sm opacity-75 mt-0.5">{localizacao}</p>}
          </div>
          <WeatherIcon code={weather.weatherCode} size={26} />
        </div>
        <div className="flex items-end gap-3">
          <span className="text-4xl font-bold">{weather.temp}°C</span>
          <span className="text-sm opacity-70 mb-1">{weatherLabel(weather.weatherCode)}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="px-5 py-3 grid grid-cols-3 gap-2">
        {[
          { icon: <Droplets size={13} className="text-blue-400" />, value: `${weather.humidity}%`, label: 'Umidade' },
          { icon: <Wind size={13} style={{ color: 'var(--fg-muted)' }} />, value: `${Math.round(weather.wind)} km/h`, label: 'Vento' },
          { icon: <CloudRain size={13} className="text-blue-300" />, value: `${weather.precipitation} mm`, label: 'Chuva' },
        ].map(s => (
          <div key={s.label} className="text-center">
            <div className="flex justify-center mb-1">{s.icon}</div>
            <div className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>{s.value}</div>
            <div className="text-[10px]" style={{ color: 'var(--fg-subtle)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Application banner */}
      <div className="mx-4 mb-3 px-3 py-2 rounded-xl flex items-center gap-2 text-sm font-medium"
        style={{ background: app.ok ? 'hsl(160 84% 22% / 0.08)' : 'hsl(4 80% 97%)', color: app.ok ? 'hsl(160 84% 22%)' : 'hsl(4 72% 45%)' }}>
        {app.ok ? '✓' : '⚠'} {app.msg}
      </div>

      {/* 3-day forecast */}
      <div className="px-5 pb-4">
        <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--fg-subtle)' }}>Próximos 3 dias</p>
        <div className="space-y-2">
          {weather.forecast.map((day, i) => {
            const d = new Date(day.date + 'T12:00:00')
            const label = i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : d.toLocaleDateString('pt-BR', { weekday: 'short' })
            return (
              <div key={day.date} className="flex items-center gap-2">
                <span className="text-xs w-14 flex-shrink-0" style={{ color: 'var(--fg-muted)' }}>{label}</span>
                <div className="flex-1 h-1.5 rounded-full" style={{ background: 'var(--borda)' }}>
                  <div className="h-1.5 rounded-full bg-blue-300" style={{ width: `${Math.min(100, day.precip * 8)}%` }} />
                </div>
                <span className="text-xs font-medium w-20 text-right flex-shrink-0" style={{ color: 'var(--fg)' }}>
                  {day.minTemp}° / {day.maxTemp}°
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
