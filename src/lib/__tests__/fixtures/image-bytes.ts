/* Handcrafted image byte fixtures for the caption/upload tests. */

export function ascii(text: string): number[] {
  return [...text].map((ch) => ch.charCodeAt(0) & 0xff);
}

/** Little-endian TIFF/EXIF containing one ImageDescription. */
export function tiff(description: string): number[] {
  const value = [...ascii(description), 0];
  return [
    0x49,
    0x49,
    0x2a,
    0x00, // "II" + 42
    0x08,
    0x00,
    0x00,
    0x00, // IFD0 at offset 8
    0x01,
    0x00, // one entry
    0x0e,
    0x01, // tag 0x010E (ImageDescription)
    0x02,
    0x00, // type ASCII
    value.length & 0xff,
    (value.length >> 8) & 0xff,
    0,
    0, // count
    0x1a,
    0x00,
    0x00,
    0x00, // value offset 26
    0x00,
    0x00,
    0x00,
    0x00, // next IFD
    ...value,
  ];
}

/** Minimal JPEG: SOI + APP1(EXIF) + EOI. */
export function exifJpeg(description: string): Uint8Array<ArrayBuffer> {
  const payload = [...ascii("Exif"), 0, 0, ...tiff(description)];
  const length = payload.length + 2;
  return Uint8Array.from([
    0xff,
    0xd8,
    0xff,
    0xe1,
    (length >> 8) & 0xff,
    length & 0xff,
    ...payload,
    0xff,
    0xd9,
  ]);
}

/** Inserts an APP13 (Photoshop/IPTC) segment right after SOI. */
export function withIptcCaption(jpeg: Uint8Array, caption: string): Uint8Array<ArrayBuffer> {
  const text = ascii(caption);
  const iptc = [0x1c, 0x02, 0x78, (text.length >> 8) & 0xff, text.length & 0xff, ...text];
  const payload = [
    ...ascii("Photoshop 3.0"),
    0,
    0x38,
    0x42,
    0x49,
    0x4d, // "8BIM"
    0x04,
    0x04, // resource 0x0404
    0x00,
    0x00, // empty Pascal name (padded)
    (iptc.length >> 24) & 0xff,
    (iptc.length >> 16) & 0xff,
    (iptc.length >> 8) & 0xff,
    iptc.length & 0xff,
    ...iptc,
  ];
  const length = payload.length + 2;
  return Uint8Array.from([
    0xff,
    0xd8,
    0xff,
    0xed,
    (length >> 8) & 0xff,
    length & 0xff,
    ...payload,
    ...jpeg.slice(2),
  ]);
}

/** Minimal PNG: signature + tEXt chunk + IEND. */
export function pngWithText(keyword: string, text: string): Uint8Array<ArrayBuffer> {
  const data = [...ascii(keyword), 0, ...ascii(text)];
  return Uint8Array.from([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
    (data.length >> 24) & 0xff,
    (data.length >> 16) & 0xff,
    (data.length >> 8) & 0xff,
    data.length & 0xff,
    ...ascii("tEXt"),
    ...data,
    0,
    0,
    0,
    0, // CRC (not verified)
    0,
    0,
    0,
    0,
    ...ascii("IEND"),
    0,
    0,
    0,
    0,
  ]);
}

/** Minimal WebP (RIFF) with an EXIF chunk. */
export function webpWithExif(description: string): Uint8Array<ArrayBuffer> {
  const data = tiff(description);
  const pad = data.length % 2;
  const riffSize = 4 + 8 + data.length + pad;
  return Uint8Array.from([
    ...ascii("RIFF"),
    riffSize & 0xff,
    (riffSize >> 8) & 0xff,
    (riffSize >> 16) & 0xff,
    (riffSize >> 24) & 0xff,
    ...ascii("WEBP"),
    ...ascii("EXIF"),
    data.length & 0xff,
    (data.length >> 8) & 0xff,
    (data.length >> 16) & 0xff,
    (data.length >> 24) & 0xff,
    ...data,
    ...(pad ? [0] : []),
  ]);
}
