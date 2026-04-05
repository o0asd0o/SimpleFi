/**
 * Generates placeholder PNG icons for the SimpleFi PWA.
 * Uses only Node.js built-ins — no extra dependencies required.
 * Run: node scripts/generate-icons.cjs
 */

const zlib = require('zlib')
const fs = require('fs')
const path = require('path')

// SimpleFi purple: #7c3aed
const R = 124, G = 58, B = 237

function crc32(buf) {
  let crc = 0xffffffff
  for (const byte of buf) {
    crc ^= byte
    for (let k = 0; k < 8; k++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const crcInput = Buffer.concat([typeBytes, data])
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(crcInput))
  return Buffer.concat([len, typeBytes, data, crcBuf])
}

function generatePNG(size) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8  // bit depth
  ihdr[9] = 2  // color type: RGB

  // Each row: [filter=0][R,G,B × size]
  const row = Buffer.alloc(1 + size * 3)
  for (let i = 0; i < size; i++) {
    row[1 + i * 3] = R
    row[2 + i * 3] = G
    row[3 + i * 3] = B
  }
  const raw = Buffer.concat(Array.from({ length: size }, () => row))
  const idat = zlib.deflateSync(raw)

  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

const publicDir = path.join(__dirname, '..', 'public')
fs.mkdirSync(publicDir, { recursive: true })

for (const size of [192, 512]) {
  const dest = path.join(publicDir, `icon-${size}.png`)
  fs.writeFileSync(dest, generatePNG(size))
  console.log(`✓ ${dest}`)
}
console.log('Done. Replace with branded icons before shipping.')
