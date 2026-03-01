const BlockSize = 64;
const Size = 20;
const shift = 11;
const widthInBits = 8 * Size;
const dataSize = shift * widthInBits;

function xorBytes(dst: Uint8Array, src: Uint8Array): number {
  const n = Math.min(dst.length, src.length);
  for (let i = 0; i < n; i++) {
    dst[i] ^= src[i];
  }
  return n;
}

export class QuickXorHash {
  static readonly BlockSize = BlockSize;
  static readonly Size = Size;

  data: Uint8Array;
  size: bigint;

  constructor() {
    this.data = new Uint8Array(dataSize);
    this.size = 0n;
  }

  write(p: Uint8Array): void {
    let i = 0;
    const lastRemain = Number(this.size % BigInt(dataSize));
    if (lastRemain !== 0) {
      i += xorBytes(this.data.subarray(lastRemain), p);
    }

    if (i !== p.length) {
      while (p.length - i >= dataSize) {
        i += xorBytes(this.data, p.subarray(i));
      }
      xorBytes(this.data, p.subarray(i));
    }
    this.size += BigInt(p.length);
  }

  checkSum(): Uint8Array {
    const h = new Uint8Array(Size + 1);

    for (let i = 0; i < dataSize; i++) {
      const sh = (i * 11) % 160;
      const shiftBytes = sh >> 3;
      const shiftBits = sh & 7;
      const shifted = (this.data[i] << shiftBits) & 0xffff;
      h[shiftBytes] ^= shifted & 0xff;
      h[shiftBytes + 1] ^= (shifted >> 8) & 0xff;
    }
    h[0] ^= h[20];

    const d = this.size;
    h[Size - 8] ^= Number((d >> 0n) & 0xffn);
    h[Size - 7] ^= Number((d >> 8n) & 0xffn);
    h[Size - 6] ^= Number((d >> 16n) & 0xffn);
    h[Size - 5] ^= Number((d >> 24n) & 0xffn);
    h[Size - 4] ^= Number((d >> 32n) & 0xffn);
    h[Size - 3] ^= Number((d >> 40n) & 0xffn);
    h[Size - 2] ^= Number((d >> 48n) & 0xffn);
    h[Size - 1] ^= Number((d >> 56n) & 0xffn);

    return h.subarray(0, Size);
  }

  sum(): Uint8Array {
    return this.checkSum();
  }

  static sum(data: Uint8Array): Uint8Array {
    const q = new QuickXorHash();
    q.write(data);
    return q.checkSum();
  }

  reset(): void {
    this.data = new Uint8Array(dataSize);
    this.size = 0n;
  }
}
