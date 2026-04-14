'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { getDB } from '@/lib/db'
import { criarAplicacao } from '@/lib/db/aplicacoes'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { AplicacaoCard } from '@/components/aplicacoes/aplicacao-card'
import { culturaLabel, culturaIcon } from '@/lib/utils'
import type { Talhao, Fazenda, Produto, Aplicacao } from '@/types'
import { PhotoPicker } from '@/components/ui/photo-picker'
import { ArrowLeft, Plus, FlaskConical, AlertTriangle, Calendar } from 'lucide-react'
import Link from 'next/link'

export default function TalhaoPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuthStore()
  const [talhao, setTalhao] = useState<Talhao | null>(null)
  const [fazenda, setFazenda] = useState<Fazenda | null>(null)
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [aplicacoes, setAplicacoes] = useState<Aplicacao[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({
    produto_id: '',
    data_aplicacao: new Date().toISOString().split('T')[0],
    dose: '',
    unidade_dose: 'L/ha',
    area_aplicada: '',
    observacoes: '',
    clima: '',
    temperatura: '',
  })
  const [fotos, setFotos] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const loadData = useCallback(async () => {
    const db = getDB()
    const t = await db.talhoes.get(id)
    if (!t) return
    setTalhao(t)
    const [faz, prods, apps] = await Promise.all([
      db.fazendas.get(t.fazenda_id),
      db.produtos.where('fazenda_id').equals(t.fazenda_id).toArray(),
      db.aplicacoes.where('talhao_id').equals(id).reverse().sortBy('data_aplicacao'),
    ])
    setFazenda(faz || null)
    setProdutos(prods)
    const enriched = await Promise.all(apps.map(async a => {
      const prod = await db.produtos.get(a.produto_id)
      return { ...a, produto: prod }
    }))
    setAplicacoes(enriched as Aplicacao[])
  }, [id])

  useEffect(() => { loadData() }, [loadData])

  async function handleSaveAplicacao() {
    if (!user || !form.produto_id || !form.data_aplicacao) return
    const prod = produtos.find(p => p.id === form.produto_id)
    if (!prod) return
    setLoading(true)
    try {
      await criarAplicacao({
        talhao_id: id,
        produto_id: form.produto_id,
        data_aplicacao: form.data_aplicacao,
        prazo_produto: prod.prazo_medio_aplicacao,
        dose: form.dose ? Number(form.dose) : undefined,
        unidade_dose: form.unidade_dose,
        area_aplicada: form.area_aplicada ? Number(form.area_aplicada) : talhao?.area,
        observacoes: form.observacoes,
        clima: form.clima,
        temperatura: form.temperatura ? Number(form.temperatura) : undefined,
        fotos: fotos.length > 0 ? fotos : undefined,
        usuario_id: user.id,
      })
      await loadData()
      setModalOpen(false)
      setFotos([])
      setForm({
        produto_id: '', data_aplicacao: new Date().toISOString().split('T')[0],
        dose: '', unidade_dose: 'L/ha', area_aplicada: '', observacoes: '', clima: '', temperatura: '',
      })
    } finally { setLoading(false) }
  }

  const proximas = aplicacoes.filter(a => a.status === 'proximo' || a.status === 'hoje')
  const atrasadas = aplicacoes.filter(a => a.status === 'atrasado')

  if (!talhao) return (
    <div className="flex items-center justify-center h-64" style={{ color: 'var(--fg-subtle)' }}>
      Talhão não encontrado
    </div>
  )

  return (
    <div className="px-4 py-6 md:px-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="animate-enter animate-enter-1 flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Link
            href={`/fazendas/${talhao.fazenda_id}`}
            className="p-2 rounded-xl transition flex-shrink-0"
            style={{ border: '1px solid var(--borda)', color: 'var(--fg-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-dark)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{culturaIcon(talhao.cultura)}</span>
              <h1 className="font-display text-2xl font-bold" style={{ color: 'var(--fg)' }}>
                {talhao.nome}
              </h1>
            </div>
            <p className="text-sm ml-8" style={{ color: 'var(--fg-muted)' }}>
              {fazenda?.nome} · {culturaLabel(talhao.cultura)} · {talhao.area} ha
            </p>
          </div>
        </div>
        {produtos.length > 0 && (
          <Button onClick={() => setModalOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />Registrar Aplicação
          </Button>
        )}
      </div>

      {/* Alert cards */}
      {(atrasadas.length > 0 || proximas.length > 0) && (
        <div className="animate-enter animate-enter-2 grid grid-cols-2 gap-3 mb-6">
          {atrasadas.length > 0 && (
            <div
              className="rounded-2xl p-4 flex items-center gap-3"
              style={{ background: 'hsl(0 86% 97%)', border: '1px solid hsl(0 86% 90%)' }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'hsl(0 86% 93%)' }}
              >
                <AlertTriangle className="w-5 h-5" style={{ color: 'hsl(0 72% 51%)' }} />
              </div>
              <div>
                <div className="text-xl font-bold" style={{ color: 'hsl(0 72% 40%)' }}>{atrasadas.length}</div>
                <div className="text-xs" style={{ color: 'hsl(0 72% 55%)' }}>atrasada{atrasadas.length !== 1 ? 's' : ''}</div>
              </div>
            </div>
          )}
          {proximas.length > 0 && (
            <div
              className="rounded-2xl p-4 flex items-center gap-3"
              style={{ background: 'hsl(45 100% 96%)', border: '1px solid hsl(45 100% 88%)' }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'hsl(45 100% 90%)' }}
              >
                <Calendar className="w-5 h-5" style={{ color: 'hsl(32 95% 44%)' }} />
              </div>
              <div>
                <div className="text-xl font-bold" style={{ color: 'hsl(32 95% 35%)' }}>{proximas.length}</div>
                <div className="text-xs" style={{ color: 'hsl(32 95% 50%)' }}>próxima{proximas.length !== 1 ? 's' : ''}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* No products warning */}
      {produtos.length === 0 && (
        <div
          className="animate-enter animate-enter-2 flex items-start gap-3 p-4 rounded-2xl mb-6"
          style={{ background: 'hsl(45 100% 96%)', border: '1px solid hsl(45 100% 88%)' }}
        >
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'hsl(32 95% 44%)' }} />
          <div>
            <p className="font-medium text-sm" style={{ color: 'hsl(32 95% 30%)' }}>Nenhum produto cadastrado</p>
            <p className="text-sm mt-0.5" style={{ color: 'hsl(32 95% 45%)' }}>
              Cadastre produtos na fazenda antes de registrar aplicações.{' '}
              <Link
                href={`/fazendas/${talhao.fazenda_id}`}
                className="underline font-medium"
              >
                Ir para Produtos →
              </Link>
            </p>
          </div>
        </div>
      )}

      {/* History */}
      <div className="animate-enter animate-enter-3">
        <div className="flex items-center justify-between mb-4">
          <p className="section-label">Histórico</p>
        </div>
        {aplicacoes.length === 0 ? (
          <div className="card p-14 text-center">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'var(--bg-dark)' }}
            >
              <FlaskConical className="w-7 h-7" style={{ color: 'var(--fg-subtle)' }} />
            </div>
            <p className="font-semibold mb-1" style={{ color: 'var(--fg)' }}>Nenhuma aplicação registrada</p>
            {produtos.length > 0 && (
              <button
                onClick={() => setModalOpen(true)}
                className="mt-2 text-sm font-medium"
                style={{ color: 'var(--primary)' }}
              >
                Registrar primeira aplicação →
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {aplicacoes.map((a, i) => (
              <div
                key={a.id}
                className="animate-enter"
                style={{ animationDelay: `${(i + 3) * 50}ms` }}
              >
                <AplicacaoCard aplicacao={a} showTalhao={false} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Registrar Aplicação"
        size="lg"
        footer={
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setModalOpen(false)} className="flex-1">Cancelar</Button>
            <Button onClick={handleSaveAplicacao} loading={loading} disabled={!form.produto_id} className="flex-1">
              Registrar
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Select
            label="Produto"
            value={form.produto_id}
            onChange={e => setForm(f => ({ ...f, produto_id: e.target.value }))}
            options={produtos.map(p => ({ value: p.id, label: `${p.nome} (cada ${p.prazo_medio_aplicacao}d)` }))}
            placeholder="Selecione o produto"
          />
          <Input
            label="Data da aplicação"
            type="date"
            value={form.data_aplicacao}
            onChange={e => setForm(f => ({ ...f, data_aplicacao: e.target.value }))}
          />
          {form.produto_id && (() => {
            const prod = produtos.find(p => p.id === form.produto_id)
            if (!prod || !form.data_aplicacao) return null
            const proxima = new Date(form.data_aplicacao)
            proxima.setDate(proxima.getDate() + prod.prazo_medio_aplicacao)
            return (
              <div
                className="px-4 py-3 rounded-xl text-sm"
                style={{ background: 'hsl(210 100% 97%)', color: 'hsl(210 100% 35%)' }}
              >
                <span className="font-medium">Próxima aplicação calculada:</span>{' '}
                {proxima.toLocaleDateString('pt-BR')} (+{prod.prazo_medio_aplicacao} dias)
              </div>
            )
          })()}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Dose" type="number" value={form.dose} onChange={e => setForm(f => ({ ...f, dose: e.target.value }))} placeholder="Ex: 2.5" />
            <Select
              label="Unidade"
              value={form.unidade_dose}
              onChange={e => setForm(f => ({ ...f, unidade_dose: e.target.value }))}
              options={[
                { value: 'L/ha', label: 'L/ha' },
                { value: 'kg/ha', label: 'kg/ha' },
                { value: 'g/ha', label: 'g/ha' },
                { value: 'ml/ha', label: 'ml/ha' },
              ]}
            />
          </div>
          <Input
            label="Área aplicada (ha)"
            type="number"
            value={form.area_aplicada}
            onChange={e => setForm(f => ({ ...f, area_aplicada: e.target.value }))}
            placeholder={`Padrão: ${talhao.area} ha`}
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Clima"
              value={form.clima}
              onChange={e => setForm(f => ({ ...f, clima: e.target.value }))}
              options={[
                { value: 'ensolarado', label: '☀️ Ensolarado' },
                { value: 'nublado', label: '☁️ Nublado' },
                { value: 'parcialmente_nublado', label: '⛅ Parcialmente nublado' },
                { value: 'vento', label: '💨 Com vento' },
              ]}
              placeholder="Selecionar clima"
            />
            <Input label="Temperatura (°C)" type="number" value={form.temperatura} onChange={e => setForm(f => ({ ...f, temperatura: e.target.value }))} placeholder="Ex: 28" />
          </div>
          <Textarea
            label="Observações"
            value={form.observacoes}
            onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
            placeholder="Anotações sobre a aplicação..."
          />
          <PhotoPicker
            label="Fotos da aplicação"
            photos={fotos}
            onChange={setFotos}
            maxPhotos={4}
          />
        </div>
      </Modal>
    </div>
  )
}
