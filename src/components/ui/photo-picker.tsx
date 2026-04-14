'use client'
import { useRef } from 'react'
import { Camera, X } from 'lucide-react'

interface PhotoPickerProps {
  photos: string[]
  onChange: (photos: string[]) => void
  maxPhotos?: number
  label?: string
}

export function PhotoPicker({ photos, onChange, maxPhotos = 4, label = 'Fotos' }: PhotoPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    const remaining = maxPhotos - photos.length
    files.slice(0, remaining).forEach(file => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const img = document.createElement('img')
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const maxW = 800
          const scale = Math.min(1, maxW / img.width)
          canvas.width = img.width * scale
          canvas.height = img.height * scale
          const ctx = canvas.getContext('2d')!
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          const compressed = canvas.toDataURL('image/jpeg', 0.72)
          onChange([...photos, compressed])
        }
        img.src = ev.target!.result as string
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  function remove(index: number) {
    onChange(photos.filter((_, i) => i !== index))
  }

  return (
    <div>
      {label && <label className="field-label mb-2 block">{label}</label>}
      <div className="flex flex-wrap gap-2">
        {photos.map((photo, i) => (
          <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0"
            style={{ border: '1.5px solid var(--borda)' }}>
            <img src={photo} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => remove(i)}
              className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.65)', color: 'white' }}
            >
              <X size={10} />
            </button>
          </div>
        ))}
        {photos.length < maxPhotos && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-20 h-20 rounded-xl flex flex-col items-center justify-center gap-1 transition-colors flex-shrink-0"
            style={{ border: '1.5px dashed var(--borda)', color: 'var(--fg-subtle)', background: 'var(--bg)' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'hsl(160 84% 22%)'; e.currentTarget.style.color = 'hsl(160 84% 22%)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--borda)'; e.currentTarget.style.color = 'var(--fg-subtle)' }}
          >
            <Camera size={18} />
            <span className="text-[10px] font-medium">Adicionar</span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
      <p className="text-[10px] mt-1.5" style={{ color: 'var(--fg-subtle)' }}>
        Máx. {maxPhotos} fotos · Comprimidas automaticamente
      </p>
    </div>
  )
}
