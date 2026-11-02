// Original geometric icon, rendered without external libraries or network access.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const dir = path.resolve(__dirname, '../extension/icons');
fs.mkdirSync(dir, { recursive: true });
function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  let crc = 0xffffffff;
  for (const byte of body) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  const size = Buffer.alloc(4), check = Buffer.alloc(4);
  size.writeUInt32BE(data.length); check.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([size, body, check]);
}
for (const size of [16, 32, 48, 128]) {
  const rows = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const sum = [0, 0, 0]; let alpha = 0;
    for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) {
      const u = (x + (sx + .5) / 4) * 128 / size - 64;
      const v = (y + (sy + .5) / 4) * 128 / size - 64;
      // Blue tile, white speech bubble, and a contrasting block badge.
      if (Math.hypot(Math.max(Math.abs(u) - 32, 0), Math.max(Math.abs(v) - 32, 0)) > 16) continue;
      let color = [38, 91, 190];
      const bubble = Math.hypot(Math.max(Math.abs(u + 5) - 20, 0), Math.max(Math.abs(v + 8) - 13, 0)) <= 8;
      const tail = v >= 9 && v <= 24 && u >= -31 && u <= -13 - (v - 9);
      if (bubble || tail) color = [255, 255, 255];
      if (v >= -16 && v <= -12 && u >= -24 && u <= 10) color = [173, 198, 238];
      if (v >= -5 && v <= -1 && u >= -24 && u <= -3) color = [173, 198, 238];
      const bx = u - 20, by = v - 20, r = Math.hypot(bx, by);
      if (r <= 23) color = [255, 255, 255];
      if (r <= 20) color = [219, 52, 72];
      if ((r >= 11 && r <= 15) || (Math.abs(bx - by) <= 2.7 && r <= 13)) color = [255, 255, 255];
      color.forEach((c, i) => { sum[i] += c; }); alpha++;
    }
    const offset = y * (size * 4 + 1) + 1 + x * 4;
    for (let i = 0; i < 3; i++) rows[offset + i] = alpha ? Math.round(sum[i] / alpha) : 0;
    rows[offset + 3] = Math.round(alpha * 255 / 16);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
  fs.writeFileSync(path.join(dir, `icon-${size}.png`), Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(rows)), chunk('IEND', Buffer.alloc(0)),
  ]));
}
