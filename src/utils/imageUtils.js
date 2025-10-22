export function drawImageCover(ctx, img, x, y, w, h, scale = 1) {
  const expand = 2
  
  // Gunakan scale untuk hitung ukuran gambar
  const drawWidth = img.width * scale
  const drawHeight = img.height * scale

  // Posisikan gambar di tengah slot
  const offsetX = x + (w - drawWidth) / 2
  const offsetY = y + (h - drawHeight) / 2

  ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight)
}
