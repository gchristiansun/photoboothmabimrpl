export function drawImageCover(ctx, img, x, y, w, h) {
  const expand = 2
  const imgRatio = img.width / img.height

  const drawHeight = h + expand * 2
  const drawWidth = img.width * ((h + expand * 2) / img.height)

  const offsetX = x + (w - drawWidth) / 2
  const offsetY = y - expand 

  ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight)
}
