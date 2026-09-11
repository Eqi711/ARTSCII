import { useRef, useState, useEffect, useCallback } from 'react'
import {
  PRESETS, measureFontAspect, prepareSource,
  recompute, redraw, buildTextGrid, buildHTMLSnippet, downloadBlob
} from './ascii'
import logo from './assets/ARTSCII_logo.png'

const DEFAULTS = {
  cols: 110, preset: 'extended', customText: '', invert: false,
  fontFamily: "'JetBrains Mono', monospace",
  charMode: 'custom', textColor: '#1c1a16', charOpacity: 1, charGlow: 0,
  minThreshold: 0, maxThreshold: 255,
  bgFillMode: 'solid', bgColor: '#f1ede2', bgFilter: 'none',
  bgExposure: 0, bgBrightness: 0, bgContrast: 0,
  bgSaturation: 0, bgWarmth: 0, bgTint: 0, bgBlur: 0,
}

function Slider({ label, id, min, max, step, value, onChange, format }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-[0.78rem]" style={{ color: 'var(--muted)' }}>{label}</label>
        <span className="font-mono text-[0.76rem] whitespace-nowrap" style={{ color: 'var(--verdigris-bright)' }}>
          {format ? format(value) : value}
        </span>
      </div>
      <input type="range" id={id} min={min} max={max} step={step} value={value}
        onChange={e => onChange(step % 1 === 0 ? parseInt(e.target.value, 10) : parseFloat(e.target.value))} />
    </div>
  )
}

function Section({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ borderBottom: '1px solid var(--line-soft)' }}>
      <button onClick={() => setOpen(value => !value)}
        className="w-full flex items-center justify-between px-5 py-3.5 font-semibold text-[0.86rem] cursor-pointer"
        style={{ color: 'var(--paper)', background: 'none', border: 'none' }}>
        {title}
        <span style={{ color: 'var(--muted)', fontFamily: 'monospace', transition: 'transform .15s', display: 'inline-block', transform: open ? 'rotate(45deg)' : 'none' }}>+</span>
      </button>
      {open && <div className="flex flex-col gap-3.5 px-5 pb-4 pt-0.5">{children}</div>}
    </div>
  )
}

export default function App() {
  const [source, setSource] = useState(null)     // { canvasEl, data, width, height }
  const [settings, setSettings] = useState(DEFAULTS)
  const [computed, setComputed] = useState(null)  // { cols, rows, chars, cellR, cellG, cellB }
  const [charAspect, setCharAspect] = useState(0.56)
  const [error, setError] = useState('')
  const [firstRender, setFirstRender] = useState(true)

  const canvasRef = useRef(null)
  const recomputeTimer = useRef(null)
  const redrawTimer = useRef(null)
  const errorTimer = useRef(null)
  const fileInputRef = useRef(null)

  const set = useCallback((key, value) => setSettings(current => ({ ...current, [key]: value })), [])

  // Show error with auto-dismiss
  const showError = useCallback((msg) => {
    setError(msg)
    clearTimeout(errorTimer.current)
    errorTimer.current = setTimeout(() => setError(''), 5000)
  }, [])

  // Load image file
  const handleFile = useCallback(async (file) => {
    if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type)) {
      showError('Please choose a JPEG, PNG, or WebP image.')
      return
    }
    try {
      const url = URL.createObjectURL(file)
      const img = await new Promise((res, rej) => {
        const i = new Image()
        i.onload = () => res(i)
        i.onerror = () => { URL.revokeObjectURL(url); rej() }
        i.src = url
      })
      setSource(prepareSource(img))
      URL.revokeObjectURL(url)
      setFirstRender(true)
    } catch {
      showError('That image could not be read. Try a different file.')
    }
  }, [showError])

  // Measure font on mount and on font change
  useEffect(() => {
    document.fonts.ready.then(() => setCharAspect(measureFontAspect(settings.fontFamily)))
  }, [settings.fontFamily])

  // Recompute (slow) — triggered by source or settings that affect character mapping
  const scheduleRecompute = useCallback((delay = 90) => {
    clearTimeout(recomputeTimer.current)
    recomputeTimer.current = setTimeout(() => {
      if (!source) return
      setComputed(recompute(source, settings, charAspect))
    }, delay)
  }, [source, settings, charAspect])

  // Redraw only (fast) — triggered by visual-only settings
  const scheduleRedraw = useCallback((delay = 16) => {
    clearTimeout(redrawTimer.current)
    redrawTimer.current = setTimeout(() => {
      if (!computed || !source || !canvasRef.current) return
      redraw(canvasRef.current, source, computed, settings, charAspect, firstRender)
      if (firstRender) setFirstRender(false)
    }, delay)
  }, [computed, source, settings, charAspect, firstRender])

  // When source or heavy settings change → recompute
  useEffect(() => {
    if (!source) return
    scheduleRecompute(0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, settings.cols, settings.preset, settings.customText, settings.invert,
      settings.minThreshold, settings.maxThreshold, settings.bgFilter, settings.bgExposure,
      settings.bgBrightness, settings.bgContrast, settings.bgSaturation, settings.bgWarmth,
      settings.bgTint, settings.bgBlur, settings.bgFillMode, charAspect])

  // When computed or visual-only settings change → redraw
  useEffect(() => {
    if (!computed || !source || !canvasRef.current) return
    scheduleRedraw(0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computed, settings.charMode, settings.textColor, settings.charOpacity,
      settings.charGlow, settings.bgColor, settings.fontFamily])

  // Paste from clipboard
  useEffect(() => {
    const handler = (e) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type?.startsWith('image/')) { handleFile(item.getAsFile()); break }
      }
    }
    window.addEventListener('paste', handler)
    return () => window.removeEventListener('paste', handler)
  }, [handleFile])

  const clearImage = () => {
    setSource(null); setComputed(null); setFirstRender(true)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const hasImage = !!source

  const exportPNG = () => {
    if (!canvasRef.current || !computed) return
    const link = Object.assign(document.createElement('a'), { download: 'ascii-art.png', href: canvasRef.current.toDataURL('image/png') })
    link.click()
  }
  const exportTXT = () => {
    if (computed) downloadBlob(new Blob([buildTextGrid(computed.cols, computed.rows, computed.chars)], { type: 'text/plain' }), 'ascii-art.txt')
  }
  const exportHTML = () => {
    if (computed) downloadBlob(new Blob([buildHTMLSnippet(computed, settings, source)], { type: 'text/html' }), 'ascii-art.html')
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="flex items-center justify-between gap-4 px-6 py-4 flex-wrap" style={{ borderBottom: '1px solid var(--line)' }}>
        <div>
          <img src={logo} alt="ARTSCII" className="block w-full max-w-[420px] h-auto" />
          <p className="mt-2 text-[0.82rem] max-w-[100ch]" style={{ color: 'var(--muted)' }}>
            convert images into ASCII masterpieces with real-time parameter controls, custom character ramps, photo filters, and instant exports to PNG, TXT, or standalone HTML files.
          </p>
        </div>
        <div className="flex gap-2.5 items-center">
          {hasImage && (
            <button onClick={clearImage} className="btn">Change image</button>
          )}
        </div>
      </header>

      <div className="flex-1 flex min-w-0">
        <aside className="flex-none w-[300px] overflow-y-auto" style={{ borderRight: '1px solid var(--line)', background: 'var(--plate-deep)' }}>
          <Section title="Characters" defaultOpen>
            <Slider label="Columns" id="cols" min={20} max={260} step={1} value={settings.cols} onChange={value => set('cols', value)} />
            <Slider label="Minimum luminance" id="min-threshold" min={0} max={255} step={1}
              value={settings.minThreshold} onChange={value => set('minThreshold', Math.min(value, settings.maxThreshold))} />
            <Slider label="Maximum luminance" id="max-threshold" min={0} max={255} step={1}
              value={settings.maxThreshold} onChange={value => set('maxThreshold', Math.max(value, settings.minThreshold))} />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="preset" className="text-[0.78rem]" style={{ color: 'var(--muted)' }}>Character ramp</label>
              <select id="preset" value={settings.preset} onChange={e => set('preset', e.target.value)}>
                {Object.entries(PRESETS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
                <option value="custom">Custom...</option>
              </select>
            </div>
            {settings.preset === 'custom' && <textarea placeholder="e.g. .:-=+*#%@" maxLength={200} value={settings.customText} onChange={e => set('customText', e.target.value)} />}
            <label className="flex items-center justify-between gap-2 text-[0.78rem]" style={{ color: 'var(--muted)' }}>
              Invert mapping
              <input type="checkbox" checked={settings.invert} onChange={e => set('invert', e.target.checked)} />
            </label>
          </Section>

          <Section title="Appearance" defaultOpen>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="font" className="text-[0.78rem]" style={{ color: 'var(--muted)' }}>Font</label>
              <select id="font" value={settings.fontFamily} onChange={e => set('fontFamily', e.target.value)}>
                {['JetBrains Mono', 'Fira Code', 'IBM Plex Mono', 'Source Code Pro', 'Space Mono'].map(font => <option key={font} value={`'${font}', monospace`}>{font}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="char-mode" className="text-[0.78rem]" style={{ color: 'var(--muted)' }}>Character color</label>
              <select id="char-mode" value={settings.charMode} onChange={e => set('charMode', e.target.value)}>
                <option value="custom">Custom color</option>
                <option value="background">Background color</option>
              </select>
            </div>
            {settings.charMode === 'custom' && (
              <div className="flex items-center justify-between text-[0.78rem]" style={{ color: 'var(--muted)' }}>
                Custom color <input type="color" value={settings.textColor} onChange={e => set('textColor', e.target.value)} />
              </div>
            )}
            <Slider label="Opacity" id="opacity" min={0.1} max={1} step={0.05} value={settings.charOpacity} format={value => value.toFixed(2)} onChange={value => set('charOpacity', value)} />
            <Slider label="Glow" id="glow" min={0} max={1} step={0.05} value={settings.charGlow} format={value => value.toFixed(2)} onChange={value => set('charGlow', value)} />
          </Section>

          <Section title="Background">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="bg-fill-mode" className="text-[0.78rem]" style={{ color: 'var(--muted)' }}>Fill mode</label>
              <select id="bg-fill-mode" value={settings.bgFillMode} onChange={e => set('bgFillMode', e.target.value)}>
                <option value="solid">Solid color</option>
                <option value="image">Source image</option>
              </select>
            </div>
            {settings.bgFillMode === 'solid' && (
              <div className="flex items-center justify-between text-[0.78rem]" style={{ color: 'var(--muted)' }}>
                Fill color <input type="color" value={settings.bgColor} onChange={e => set('bgColor', e.target.value)} />
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="bg-filter" className="text-[0.78rem]" style={{ color: 'var(--muted)' }}>Filter</label>
              <select id="bg-filter" value={settings.bgFilter} onChange={e => set('bgFilter', e.target.value)}>
                <option value="none">None</option>
                <option value="grayscale">Grayscale</option>
                <option value="sepia">Sepia</option>
                <option value="invert">Invert</option>
                <option value="vintage">Vintage</option>
                <option value="cool">Cool</option>
                <option value="noir">Noir</option>
              </select>
            </div>
            <Slider label="Exposure" id="bg-exposure" min={-100} max={100} step={1} value={settings.bgExposure} onChange={value => set('bgExposure', value)} />
            <Slider label="Brightness" id="bg-brightness" min={-100} max={100} step={1} value={settings.bgBrightness} onChange={value => set('bgBrightness', value)} />
            <Slider label="Contrast" id="bg-contrast" min={-100} max={100} step={1} value={settings.bgContrast} onChange={value => set('bgContrast', value)} />
            <Slider label="Saturation" id="bg-saturation" min={-100} max={100} step={1} value={settings.bgSaturation} onChange={value => set('bgSaturation', value)} />
            <Slider label="Warmth" id="bg-warmth" min={-100} max={100} step={1} value={settings.bgWarmth} onChange={value => set('bgWarmth', value)} />
            <Slider label="Tint" id="bg-tint" min={-100} max={100} step={1} value={settings.bgTint} onChange={value => set('bgTint', value)} />
            <Slider label="Blur" id="bg-blur" min={0} max={30} step={1} value={settings.bgBlur} format={value => `${value} px`} onChange={value => set('bgBlur', value)} />
          </Section>

          <Section title="Export" defaultOpen>
            <div className="flex flex-wrap gap-2">
              <button className="btn" disabled={!computed} onClick={exportPNG}>PNG</button>
              <button className="btn" disabled={!computed} onClick={exportTXT}>TXT</button>
              <button className="btn" disabled={!computed} onClick={exportHTML}>HTML</button>
            </div>
          </Section>
        </aside>
        <section className="flex min-h-0 flex-1 flex-col items-center justify-start gap-4 p-7" style={{ minHeight: 'calc(100vh - 120px)' }}>
          {/* Drop zone */}
          {!hasImage && (
            <Dropzone onFile={handleFile} fileInputRef={fileInputRef} />
          )}

          {/* Error banner */}
          {error && (
            <div className="max-w-[640px] w-full px-3.5 py-2.5 rounded text-[0.82rem]"
              style={{ background: '#5a2f24', color: '#f3d8ce', border: '1px solid var(--copper)' }}>
              {error}
            </div>
          )}

          {/* Canvas */}
          {hasImage && (
            <>
              <div className="inline-block max-w-full rounded-md p-5" style={{ background: 'var(--plate-deep)', border: '1px solid var(--line)' }}>
                <canvas ref={canvasRef} className="block max-w-full h-auto rounded-sm" />
              </div>
            </>
          )}
        </section>
      </div>

      <style>{`
        .btn {
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          padding: 9px 14px; border-radius: 3px; border: 1px solid var(--line);
          background: var(--plate); color: var(--paper); font-size: 0.82rem; font-weight: 600;
          cursor: pointer; transition: border-color .15s, color .15s, background .15s;
        }
        .btn:hover { border-color: var(--verdigris-bright); color: var(--verdigris-bright); }
        .btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .btn.primary { background: var(--verdigris); border-color: var(--verdigris); color: var(--plate-deep); }
        .btn.primary:hover { background: var(--verdigris-bright); border-color: var(--verdigris-bright); }
        .btn.primary:disabled { opacity: 0.4; cursor: not-allowed; }
      `}</style>
    </div>
  )
}

function Dropzone({ onFile, fileInputRef }) {
  const [dragover, setDragover] = useState(false)
  return (
    <div
      className={`flex min-h-0 flex-1 flex-col items-center justify-center text-center rounded-md cursor-pointer transition-all w-full ${dragover ? 'dragover' : ''}`}
      style={{
        border: `1.5px dashed ${dragover ? 'var(--verdigris-bright)' : 'var(--line)'}`,
        background: dragover ? 'rgba(124,154,134,0.06)' : 'transparent',
        color: 'var(--muted)',
      }}
      onClick={() => fileInputRef.current?.click()}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click() } }}
      onDragEnter={e => { e.preventDefault(); setDragover(true) }}
      onDragOver={e => { e.preventDefault(); setDragover(true) }}
      onDragLeave={e => { e.preventDefault(); setDragover(false) }}
      onDrop={e => { e.preventDefault(); setDragover(false); const f = e.dataTransfer.files?.[0]; if (f) onFile(f) }}
      tabIndex={0} role="button" aria-label="Upload an image"
    >
      <span className="font-mono text-[1.6rem] mb-2.5 block" style={{ color: 'var(--verdigris-bright)' }}>[ ]</span>
      <p className="text-[0.86rem] m-0">
        <strong style={{ color: 'var(--paper)' }}>Drop an image here</strong>, or click to browse.<br />
        You can also paste one from your clipboard.
      </p>
      <p className="text-[0.72rem] mt-2.5 m-0">JPEG / PNG / WebP</p>
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
        onChange={e => { if (e.target.files?.[0]) onFile(e.target.files[0]) }} />
    </div>
  )
}
