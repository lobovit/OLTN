/* Alt-text extraction from embedded image metadata (no AI, no network). */

const EXIF_IMAGE_DESCRIPTION = 0x010e;
const IPTC_CAPTION_RECORD = 0x02;
const IPTC_CAPTION_DATASET = 0x78;

function decodeText(bytes: Uint8Array, start: number, length: number): string {
  const limit = Math.min(start + length, bytes.length);
  let end = start;
  while (end < limit && bytes[end] !== 0) end++;
  return new TextDecoder("utf-8").decode(bytes.subarray(start, end)).trim();
}

function be32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]) >>>
    0
  );
}

function exifDescription(bytes: Uint8Array, tiffStart: number): string | null {
  const little = bytes[tiffStart] === 0x49 && bytes[tiffStart + 1] === 0x49;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ifd = tiffStart + view.getUint32(tiffStart + 4, little);
  const entries = view.getUint16(ifd, little);
  for (let index = 0; index < entries; index++) {
    const entry = ifd + 2 + index * 12;
    if (view.getUint16(entry, little) !== EXIF_IMAGE_DESCRIPTION) continue;
    const count = view.getUint32(entry + 4, little);
    const valueStart = count > 4 ? tiffStart + view.getUint32(entry + 8, little) : entry + 8;
    const text = decodeText(bytes, valueStart, count);
    return text || null;
  }
  return null;
}

function iptcCaption(bytes: Uint8Array, start: number, length: number): string | null {
  const end = Math.min(start + length, bytes.length);
  let offset = start;
  while (offset + 5 <= end) {
    if (bytes[offset] !== 0x1c) {
      offset++;
      continue;
    }
    const record = bytes[offset + 1];
    const dataset = bytes[offset + 2];
    const size = (bytes[offset + 3] << 8) | bytes[offset + 4];
    if (record === IPTC_CAPTION_RECORD && dataset === IPTC_CAPTION_DATASET) {
      const text = decodeText(bytes, offset + 5, size);
      return text || null;
    }
    offset += 5 + size;
  }
  return null;
}

function photoshopIptc(bytes: Uint8Array, start: number, length: number): string | null {
  let offset = start;
  const end = Math.min(start + length, bytes.length);
  while (
    offset + 12 <= end &&
    bytes[offset] === 0x38 &&
    bytes[offset + 1] === 0x42 &&
    bytes[offset + 2] === 0x49 &&
    bytes[offset + 3] === 0x4d
  ) {
    const nameLength = bytes[offset + 6];
    const nameTotal = nameLength + 1 + ((nameLength + 1) % 2);
    const sizeStart = offset + 6 + nameTotal;
    const size = be32(bytes, sizeStart);
    const dataStart = sizeStart + 4;
    if (bytes[offset + 4] === 0x04 && bytes[offset + 5] === 0x04) {
      const caption = iptcCaption(bytes, dataStart, size);
      if (caption) return caption;
    }
    offset = dataStart + size + (size % 2);
  }
  return null;
}

function jpegCaption(bytes: Uint8Array): string | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let exif: string | null = null;
  let iptc: string | null = null;
  let offset = 2;
  while (offset + 4 <= bytes.length && bytes[offset] === 0xff) {
    const marker = bytes[offset + 1];
    if (marker === 0xda || marker === 0xd9) break;
    const length = view.getUint16(offset + 2);
    const payload = offset + 4;
    const isExif =
      marker === 0xe1 &&
      bytes[payload] === 0x45 &&
      bytes[payload + 1] === 0x78 &&
      bytes[payload + 2] === 0x69 &&
      bytes[payload + 3] === 0x66;
    if (isExif && !exif) exif = exifDescription(bytes, payload + 6);
    if (marker === 0xed && !iptc) iptc = photoshopIptc(bytes, payload + 14, length - 16);
    offset += 2 + length;
  }
  return iptc ?? exif;
}

function pngCaption(bytes: Uint8Array): string | null {
  let description: string | null = null;
  let title: string | null = null;
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const size = be32(bytes, offset);
    const type = String.fromCharCode(
      bytes[offset + 4],
      bytes[offset + 5],
      bytes[offset + 6],
      bytes[offset + 7],
    );
    const dataStart = offset + 8;
    if (type === "tEXt") {
      let end = dataStart;
      const limit = Math.min(dataStart + size, bytes.length);
      while (end < limit && bytes[end] !== 0) end++;
      const keyword = String.fromCharCode(...bytes.subarray(dataStart, end));
      const text = decodeText(bytes, end + 1, limit - (end + 1));
      if (keyword === "Description" && text && !description) description = text;
      if (keyword === "Title" && text && !title) title = text;
    }
    offset = dataStart + size + 4;
  }
  return description ?? title;
}

function webpCaption(bytes: Uint8Array): string | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const type = String.fromCharCode(
      bytes[offset],
      bytes[offset + 1],
      bytes[offset + 2],
      bytes[offset + 3],
    );
    const size = view.getUint32(offset + 4, true);
    if (type === "EXIF") return exifDescription(bytes, offset + 8);
    offset += 8 + size + (size % 2);
  }
  return null;
}

/** Caption embedded in the file, or null when there is none. */
export function extractImageCaption(bytes: Uint8Array): string | null {
  if (bytes.length < 4) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return jpegCaption(bytes);
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return pngCaption(bytes);
  }
  if (String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF") return webpCaption(bytes);
  return null;
}
