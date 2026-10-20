// Phone photos are often 4000px+ and several MB. Plant.id only needs ~1000px,
// so we shrink photos in the browser first: faster uploads, same accuracy.

const MAX_SIDE = 1024

/**
 * Resize an image (File, Blob, or a <canvas>/<video> frame) to a JPEG Blob.
 * @param {CanvasImageSource} source  something we can draw onto a canvas
 * @param {number} width   source width in pixels
 * @param {number} height  source height in pixels
 */
export function toJpeg(source, width, height) {
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height)

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
}

/** Shrink a photo the user picked with <input type="file"> */
export async function shrinkFile(file) {
  // createImageBitmap also respects the photo's EXIF rotation
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const blob = await toJpeg(bitmap, bitmap.width, bitmap.height)
  bitmap.close()
  return blob
}

/** Grab the current frame of the live camera <video> as a JPEG */
export function captureVideoFrame(video) {
  return toJpeg(video, video.videoWidth, video.videoHeight)
}
