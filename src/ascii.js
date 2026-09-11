// Pure ASCII conversion logic — no React deps, extracted from original HTML

export const MAX_CANVAS_WIDTH = 800;

export const PRESETS = {
  extended: { label: 'Extended', ramp: Array.from('$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,"^`\'. ') },
  classic:  { label: 'Classic',  ramp: Array.from('@#W$9876543210?!abc;:+=-,._ ') },
  minimal:  { label: 'Minimal',  ramp: Array.from('@%#*+=-:. ') },
  blocky:   { label: 'Blocky',   ramp: Array.from('█▓▒░ ') },
  cross:    { label: 'Cross',    ramp: ['╬','╋','╪','╫','┼','┿','╂','+',' '] },
  stars:    { label: 'Stars',    ramp: ['✹','✺','✷','✸','✦','✫','✬','✭','✮','✯','✰','★','✶','✵','✴','✳','✲','✱','✧','✩','☆','◦','∙',' '] },
  circles:  { label: 'Circles',  ramp: ['⬤','⦿','◉','◎','○','◌','◦','∙',' '] },
  korean:   { label: 'Korean',   ramp: ['뾿','뽳','쁢','랖','괾','볜','휼','줚','갪','섟','믕','굄','룸','쾅','밭','늪','춤','롭','짐','핀','곬','읔','듸','딛','닌','킼','픞','튼','特','을','흠','믄','긐','극','즞','즙','늗','늘','드','느','으','ㅡ','ㅣ','ㄴ','ㅢ','ㅓ','ㅏ','ㅜ','ㅗ',' '] },
  japanese: { label: 'Japanese', ramp: ['鬱','鶴','驚','攀','羹','籬','驫','襲','靉','麤','艦','饒','鑿','警','議','導','飾','欄','飯','精','葛','葉','募','街','暑','悪','帰','転','通','動','理','野','祭','黒','春','喜','重','画','界','長','活','巻','待','施','信','音','美','急','屋','草','南','追','点','咲','看','砂','係','独','狭','首','泉','骨','前','後','計','思','苦','面','単','科','炭','洋','畑','昼','祝','度','去','今','市','右','立','台','占','辺','句','兄','古','召','凸','凹','申','且','矢','旦','外','千','三','二','一','川','人','入','刀','丁','卜','𠂉',' '] },
};

function cellBounds(index, total, size) {
  return [Math.floor((index * size) / total), Math.floor(((index + 1) * size) / total)];
}

function averageCell(data, srcW, srcH, x0, x1, y0, y1) {
  if (x1 <= x0 || y1 <= y0) {
    const x = Math.min(x0, srcW - 1), y = Math.min(y0, srcH - 1);
    const o = (y * srcW + x) * 4;
    return [data[o], data[o + 1], data[o + 2]];
  }
  let r = 0, g = 0, b = 0, n = 0;
  for (let y = y0; y < y1; y++) {
    let off = (y * srcW + x0) * 4;
    for (let x = x0; x < x1; x++, off += 4) { r += data[off]; g += data[off + 1]; b += data[off + 2]; n++; }
  }
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
}

function luminance(r, g, b) { return 0.299 * r + 0.587 * g + 0.114 * b; }

function normalizeContrast(values) {
  let min = Infinity, max = -Infinity;
  for (const v of values) { if (v < min) min = v; if (v > max) max = v; }
  const range = max - min;
  const out = new Float32Array(values.length);
  if (range < 1e-6) { out.fill(128); return out; }
  for (let i = 0; i < values.length; i++) out[i] = ((values[i] - min) * 255) / range;
  return out;
}

function mapToRampIndex(y, len) {
  return Math.min(len - 1, Math.max(0, Math.floor((y / 256) * len)));
}

const densityCache = new Map();
let densityCanvas = null;

export function measureGlyphDensity(ch) {
  if (densityCache.has(ch)) return densityCache.get(ch);
  if (!densityCanvas) densityCanvas = document.createElement('canvas');
  const size = 32;
  densityCanvas.width = densityCanvas.height = size;
  const cx = densityCanvas.getContext('2d', { willReadFrequently: true });
  cx.clearRect(0, 0, size, size);
  cx.fillStyle = '#fff'; cx.fillRect(0, 0, size, size);
  cx.fillStyle = '#000';
  cx.font = `${(size * 0.9).toFixed(0)}px monospace`;
  cx.textAlign = 'center'; cx.textBaseline = 'middle';
  cx.fillText(ch, size / 2, size / 2 + 1);
  const data = cx.getImageData(0, 0, size, size).data;
  let dark = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2] < 200) dark++;
  }
  const density = dark / (size * size);
  densityCache.set(ch, density);
  return density;
}

export function measureFontAspect(fontFamily) {
  const c = document.createElement('canvas').getContext('2d');
  c.font = `100px ${fontFamily}`;
  const m = c.measureText('M');
  return (m && m.width > 0) ? m.width / 100 : 0.56;
}

export function prepareSource(img) {
  let w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  const scale = Math.min(1, MAX_CANVAS_WIDTH / w);
  w = Math.max(1, Math.round(w * scale));
  h = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  return { canvasEl: canvas, data: ctx.getImageData(0, 0, w, h).data, width: w, height: h };
}

export function getRamp(preset, customText, invert) {
  let ramp;
  if (preset === 'custom') {
    const unique = Array.from(new Set(Array.from(customText).filter(ch => ch !== '\n' && ch !== '\r')));
    ramp = unique.length >= 2
      ? unique.slice().sort((a, b) => measureGlyphDensity(b) - measureGlyphDensity(a))
      : PRESETS.classic.ramp.slice();
  } else {
    ramp = (PRESETS[preset] || PRESETS.extended).ramp.slice();
  }
  if (ramp.length < 1) ramp = [' '];
  const si = ramp.indexOf(' ');
  if (si !== -1) ramp.splice(si, 1);
  ramp.push(' ');
  if (invert) ramp.reverse();
  return ramp;
}

export function getBgFilterString(s) {
  const f = [];
  if (s.bgFilter === 'grayscale') f.push('grayscale(100%)');
  else if (s.bgFilter === 'sepia') f.push('sepia(100%)');
  else if (s.bgFilter === 'invert') f.push('invert(100%)');
  else if (s.bgFilter === 'vintage') f.push('sepia(60%) saturate(130%)');
  else if (s.bgFilter === 'cool') f.push('hue-rotate(180deg)');
  else if (s.bgFilter === 'noir') f.push('grayscale(100%) contrast(160%)');
  if (s.bgBlur > 0) f.push(`blur(${s.bgBlur}px)`);
  const totalBrightness = Math.max(0, 100 + s.bgExposure + s.bgBrightness);
  if (totalBrightness !== 100) f.push(`brightness(${totalBrightness}%)`);
  const totalContrast = Math.max(0, 100 + s.bgContrast);
  if (totalContrast !== 100) f.push(`contrast(${totalContrast}%)`);
  const totalSat = Math.max(0, 100 + s.bgSaturation);
  if (totalSat !== 100) f.push(`saturate(${totalSat}%)`);
  if (s.bgWarmth > 0) f.push(`sepia(${s.bgWarmth * 0.5}%)`);
  else if (s.bgWarmth < 0) f.push(`hue-rotate(${s.bgWarmth * 0.5}deg)`);
  if (s.bgTint !== 0) f.push(`hue-rotate(${s.bgTint * 1.8}deg)`);
  return f.length > 0 ? f.join(' ') : 'none';
}

export function recompute(source, settings, charAspect) {
  const filterStr = getBgFilterString(settings);

  // Apply bg filter to source to get data for luminance sampling
  const { canvasEl, width: srcW, height: srcH } = source;
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = srcW; tempCanvas.height = srcH;
  const tctx = tempCanvas.getContext('2d', { willReadFrequently: true });
  tctx.filter = filterStr;
  tctx.drawImage(canvasEl, 0, 0, srcW, srcH);
  const data = tctx.getImageData(0, 0, srcW, srcH).data;

  const cols = settings.cols;
  const rows = Math.max(1, Math.round(cols * (srcH / srcW) * charAspect));

  const colB = Array.from({ length: cols }, (_, c) => cellBounds(c, cols, srcW));
  const rowB = Array.from({ length: rows }, (_, r) => cellBounds(r, rows, srcH));

  const n = cols * rows;
  const cellR = new Float32Array(n), cellG = new Float32Array(n), cellB = new Float32Array(n);
  const lum = new Float32Array(n);
  for (let r = 0; r < rows; r++) {
    const [y0, y1] = rowB[r];
    for (let c = 0; c < cols; c++) {
      const [x0, x1] = colB[c];
      const rgb = averageCell(data, srcW, srcH, x0, x1, y0, y1);
      const i = r * cols + c;
      cellR[i] = rgb[0]; cellG[i] = rgb[1]; cellB[i] = rgb[2];
      lum[i] = luminance(rgb[0], rgb[1], rgb[2]);
    }
  }

  const norm = normalizeContrast(lum);
  const ramp = getRamp(settings.preset, settings.customText, settings.invert);
  const chars = new Array(n);
  for (let i = 0; i < n; i++) {
    const val = norm[i];
    chars[i] = (lum[i] < settings.minThreshold || lum[i] > settings.maxThreshold)
      ? ' '
      : ramp[mapToRampIndex(val, ramp.length)];
  }

  return { cols, rows, chars, cellR, cellG, cellB };
}

export function redraw(canvas, source, computed, settings, charAspect, firstRender) {
  const { cols, rows, chars, cellR, cellG, cellB } = computed;
  const glowBlur = settings.charGlow * 20;
  const targetW = source.width, targetH = source.height;
  const cellW = targetW / cols, cellH = targetH / rows;

  canvas.width = targetW; canvas.height = targetH;
  const ctx = canvas.getContext('2d');

  ctx.globalAlpha = 1;
  ctx.filter = getBgFilterString(settings);
  if (settings.bgFillMode === 'image') {
    ctx.drawImage(source.canvasEl, 0, 0, targetW, targetH);
  } else {
    ctx.fillStyle = settings.bgColor;
    ctx.fillRect(0, 0, targetW, targetH);
  }

  ctx.filter = 'none';
  ctx.globalAlpha = settings.charOpacity;

  let fontSize = cellW / charAspect;
  if (settings.preset === 'korean' || settings.preset === 'japanese') fontSize *= 0.74;
  ctx.font = `${fontSize}px ${settings.fontFamily}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

  for (let r = 0; r < rows; r++) {
    const y = r * cellH + cellH / 2;
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const ch = chars[i];
      if (ch === ' ' || ch === '') continue;
      const colVal = settings.charMode === 'background'
        ? `rgb(${cellR[i] | 0},${cellG[i] | 0},${cellB[i] | 0})`
        : settings.textColor;
      ctx.fillStyle = colVal;
      if (glowBlur > 0) { ctx.shadowBlur = glowBlur; ctx.shadowColor = colVal; }
      else ctx.shadowBlur = 0;
      ctx.fillText(ch, c * cellW + cellW / 2, y);
    }
  }
  ctx.shadowBlur = 0; ctx.globalAlpha = 1;

  if (firstRender) {
    canvas.classList.remove('canvas-reveal');
    void canvas.offsetWidth;
    canvas.classList.add('canvas-reveal');
  }
}

export function buildTextGrid(cols, rows, chars) {
  return Array.from({ length: rows }, (_, r) => chars.slice(r * cols, r * cols + cols).join('')).join('\n');
}

function escapeHTML(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

export function buildHTMLSnippet(computed, settings, source) {
  const { cols, rows, chars, cellR, cellG, cellB } = computed;
  let body = '';
  for (let r = 0; r < rows; r++) {
    if (settings.charMode === 'image' || settings.charMode === 'background') {
      let runColor = null, runText = '', rowHTML = '';
      const flush = () => { if (runText) rowHTML += `<span style="color:${runColor}">${escapeHTML(runText)}</span>`; runText = ''; };
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const color = `rgb(${cellR[i] | 0},${cellG[i] | 0},${cellB[i] | 0})`;
        if (color !== runColor) { flush(); runColor = color; }
        runText += chars[i];
      }
      flush();
      body += rowHTML + '\n';
    } else {
      body += escapeHTML(chars.slice(r * cols, r * cols + cols).join('')) + '\n';
    }
  }
  const textColor = settings.charMode === 'background' ? 'inherit' : settings.textColor;
  const bodyBg = settings.bgFillMode === 'solid' ? settings.bgColor : '#000';
  const filterStyle = getBgFilterString(settings);
  let bgLayer = '';
  if (settings.bgFillMode === 'image' && source) {
    bgLayer = `<img src="${source.canvasEl.toDataURL('image/png')}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:${filterStyle};">`;
  }
  const glowBlur = settings.charGlow * 20;
  const glowStyle = glowBlur > 0 ? `text-shadow: 0 0 ${glowBlur}px currentColor;` : '';
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>ASCII art</title>
<style>
  html,body{margin:0;height:100%;background:${bodyBg};}
  .frame{position:relative;min-height:100%;display:flex;align-items:center;justify-content:center;overflow:hidden;}
  pre.ascii-art{position:relative;z-index:1;font-family:${settings.fontFamily};font-size:14px;line-height:1;color:${textColor};opacity:${settings.charOpacity};${glowStyle}white-space:pre;margin:0;padding:16px;}
</style></head>
<body><div class="frame">${bgLayer}
<pre class="ascii-art">
${body}</pre></div></body></html>`;
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
