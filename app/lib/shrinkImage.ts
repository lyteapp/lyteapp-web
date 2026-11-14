// Shrinks a picked photo before it's uploaded, so a phone picture doesn't
// weigh several MB: at most `max` px on its long side. PNG/WebP keep their
// transparency (as PNG); anything else, or a file that wouldn't get smaller,
// goes up as it is.
export async function shrinkImage(file: File, max = 900): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file
  const bmp = await createImageBitmap(file).catch(() => null)
  if (!bmp) return file
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * scale)
  canvas.height = Math.round(bmp.height * scale)
  canvas.getContext('2d')?.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  const type = file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png'
  const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, type, 0.85))
  if (!blob || blob.size >= file.size) return file
  return new File([blob], `img.${type === 'image/jpeg' ? 'jpg' : 'png'}`, { type })
}

/** True when the picture has a see-through background (a PNG/WebP cut-out):
 *  more than 1% of it is transparent. JPEGs never are. */
export async function hasTransparency(file: Blob): Promise<boolean> {
  if (!/^image\/(png|webp|gif)$/.test(file.type)) return false
  const bmp = await createImageBitmap(file).catch(() => null)
  if (!bmp) return false
  const scale = Math.min(1, 128 / Math.max(bmp.width, bmp.height))
  const w = Math.max(1, Math.round(bmp.width * scale)), h = Math.max(1, Math.round(bmp.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return false
  ctx.drawImage(bmp, 0, 0, w, h)
  const px = ctx.getImageData(0, 0, w, h).data
  let clear = 0
  for (let i = 3; i < px.length; i += 4) if (px[i] < 240) clear++
  return clear > (w * h) / 100
}
