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
import { cn, culturaLabel, culturaIcon } from '@/lib/utils'
import type { Talhao, Fazenda, Produto, Aplicacao } from '@/types'
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
        usuario_id: user.id,
      })
      await loadData()
      setModalOpen(false)
      setForm({
        produto_id: '', data_aplicacao: new Date().toISOString().split('T')[0],
        dose: '', unidade_dose: 'L/ha', area_aplicada: '', observacoes: '', clima: '', temperatura: '',
      })
    } finally { setLoading(false) }
  }

  const proximas = aplicacoes.filter(a => a.status === 'proximo' || a.status === 'hoje')
  const atrasadas = aplicacoes.filter(a => a.status === 'atrasado')

  if (!talhao) return <div className="p-8 text-center text-gray-400">Talhão não encontrado</div>

  return (
    <div className="px-4 py-6 md:px-8 max-w-4xl mx-auto animate-slide-in">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href={`/fazendas/${talhao.fazenda_id}`} className="p-2 rounded-lg hover:bg-gray-100 transition">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{culturaIcon(talhao.cultura)}</span>
              <h1 className="text-xl font-bold text-gray-900">{talhao.nome}</h1>
            </div>
            <p className="text-sm text-gray-500 ml-8">
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

      {(atrasadas.length > 0 || proximas.length > 0) && (
        <div className="grid grid-cols-2 gap-3 mb-6">
          {atrasadas.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0" />
              <div>
                <div className="text-xl font-bold text-red-700">{atrasadas.length}</div>
                <div className="text-xs text-red-600">atrasada{atrasadas.length !== 1 ? 's' : ''}</div>
              </div>
            </div>
          )}
          {proximas.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center gap-3">
              <Calendar className="w-6 h-6 text-yellow-600 flex-shrink-0" />
              <div>
                <div className="text-xl font-bold text-yellow-700">{proximas.length}</div>
                <div className="text-xs text-yellow-600">próxima{proximas.length !== 1 ? 's' : ''}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {produtos.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3 mb-6">
          <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-yellow-800">Nenhum produto cadastrado</p>
            <p className="text-sm text-yellow-700">Cadastre produtos na fazenda antes de registrar aplicações.</p>
            <Link href={`/fazendas/${talhao.fazenda_id}`} className="text-sm text-yellow-700 underline mt-1 inline-block">
              Ir para Produtos →
            </Link>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-3">Histórico de Aplicações</h2>
        {aplicacoes.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <FlaskConical className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>Nenhuma aplicação registrada</p>
            {produtos.length > 0 && (
              <button onClick={() => setModalOpen(true)} className="mt-3 text-sm text-green-600 hover:underline">
                Registrar primeira aplicação →
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {aplicacoes.map(a => <AplicacaoCard key={a.id} aplicacao={a} showTalhao={false} />)}
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Registrar Aplicação" size="lg">
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
              <div className="bg-blue-50 rounded-lg px-4 py-2.5 text-sm text-blue-700">
                <span className="font-medium">Próxima aplicação calculada:</span>{' '}
                {proxima.toLocaleDateString('pt-BR')} (+{prod.prazo_medio_aplicacao} dias)
              </div>
            )
          })()}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Dose"
              type="number"
              value={form.dose}
              onChange={e => setForm(f => ({ ...f, dose: e.target.value }))}
              placeholder="Ex: 2.5"
            />
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
                { value: 'ensolarado', label: 'Ensolarado' },
                { value: 'nublado', label: 'Nublado' },
                { value: 'parcialmente_nublado', label: 'Parcialmente nublado' },
                { value: 'vento', label: 'Com vento' },
              ]}
              placeholder="Selecionar clima"
            />
            <Input
              label="Temperatura (°C)"
              type="number"
              value={form.temperatura}
              onChange={e => setForm(f => ({ ...f, temperatura: e.target.value }))}
              placeholder="Ex: 28"
            />
          </div>
          <Textarea
            label="Observações"
            value={form.observacoes}
            onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
            placeholder="Anotações sobre a aplicação..."
          />
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)} className="flex-1">Cancelar</Button>
            <Button onClick={handleSaveAplicacao} loading={loading} disabled={!form.produto_id} className="flex-1">
              Registrar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
