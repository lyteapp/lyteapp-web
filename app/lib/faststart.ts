// Videos straight off an iPhone (.mov) — and many .mp4 exports — keep their
// index (the "moov" box) at the END of the file, after all the picture data.
// A browser can't start playing until it has that index, so it has to fetch
// the end of the file first, and some (iOS Safari on a slow connection
// especially) just sit on a blank frame. This moves the index to the front,
// like `ffmpeg -movflags +faststart` / qt-faststart, without re-encoding:
// the boxes are reordered and the index's pointers into the picture data
// shifted to match. Anything unexpected → the file is returned untouched.

const CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'edts', 'mvex', 'udta'])
const MAX_BYTES = 400 * 1024 * 1024

type Box = { type: string; start: number; size: number; header: number }

function readBoxes(view: DataView, from: number, to: number): Box[] | null {
  const boxes: Box[] = []
  let i = from
  while (i + 8 <= to) {
    let size = view.getUint32(i)
    let header = 8
    const type = String.fromCharCode(view.getUint8(i + 4), view.getUint8(i + 5), view.getUint8(i + 6), view.getUint8(i + 7))
    if (size === 1) {
      if (i + 16 > to) return null
      size = view.getUint32(i + 8) * 2 ** 32 + view.getUint32(i + 12)
      header = 16
    } else if (size === 0) {
      size = to - i
    }
    if (size < header || i + size > to) return null
    boxes.push({ type, start: i, size, header })
    i += size
  }
  return i === to ? boxes : null
}

/** Adds `shift` to every chunk offset (stco / co64) that points before
 *  `limit` (i.e. into the data that moves). False when it can't be done. */
function shiftChunkOffsets(view: DataView, from: number, to: number, shift: number, limit: number): boolean {
  const boxes = readBoxes(view, from, to)
  if (!boxes) return false
  for (const b of boxes) {
    const body = b.start + b.header
    if (b.type === 'cmov') return false // compressed index: leave the file alone
    if (CONTAINERS.has(b.type)) {
      if (b.type === 'udta') continue
      if (!shiftChunkOffsets(view, body, b.start + b.size, shift, limit)) return false
    } else if (b.type === 'stco') {
      const n = view.getUint32(body + 4)
      if (body + 8 + n * 4 > b.start + b.size) return false
      for (let k = 0; k < n; k++) {
        const at = body + 8 + k * 4
        const v = view.getUint32(at)
        if (v >= limit) continue
        if (v + shift > 0xffffffff) return false
        view.setUint32(at, v + shift)
      }
    } else if (b.type === 'co64') {
      const n = view.getUint32(body + 4)
      if (body + 8 + n * 8 > b.start + b.size) return false
      for (let k = 0; k < n; k++) {
        const at = body + 8 + k * 8
        const v = view.getUint32(at) * 2 ** 32 + view.getUint32(at + 4)
        if (v >= limit) continue
        const nv = v + shift
        view.setUint32(at, Math.floor(nv / 2 ** 32))
        view.setUint32(at + 4, nv % 2 ** 32)
      }
    }
  }
  return true
}

export async function fastStart(file: File): Promise<File> {
  const isMp4Family = /^video\/(mp4|quicktime|x-m4v)$/.test(file.type) || /\.(mp4|mov|m4v)$/i.test(file.name)
  if (!isMp4Family || file.size > MAX_BYTES) return file
  try {
    const buf = new Uint8Array(await file.arrayBuffer())
    const view = new DataView(buf.buffer)
    const top = readBoxes(view, 0, buf.length)
    if (!top) return file
    const moovIdx = top.findIndex(b => b.type === 'moov')
    const mdatIdx = top.findIndex(b => b.type === 'mdat')
    if (moovIdx < 0 || mdatIdx < 0 || moovIdx < mdatIdx) return file // already playable from the start
    const moov = top[moovIdx]
    const moovCopy = buf.slice(moov.start, moov.start + moov.size)
    const moovView = new DataView(moovCopy.buffer)
    // everything from the first mdat up to where the index was moves forward by its size
    if (!shiftChunkOffsets(moovView, moov.header, moov.size, moov.size, moov.start)) return file
    const parts: Uint8Array[] = []
    top.forEach((b, k) => { if (k < mdatIdx) parts.push(buf.subarray(b.start, b.start + b.size)) })
    parts.push(moovCopy)
    top.forEach((b, k) => { if (k >= mdatIdx && k !== moovIdx) parts.push(buf.subarray(b.start, b.start + b.size)) })
    return new File(parts as BlobPart[], file.name, { type: file.type, lastModified: file.lastModified })
  } catch {
    return file
  }
}
