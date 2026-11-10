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
