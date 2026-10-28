#!/usr/bin/env node

/**
 * generate-fake-bills.mjs
 *
 * Generates 3 synthetic, clearly fake sample bill fixture files in
 * `supabase/fixtures/bills/` for local development and test uploads without
 * adding external heavy dependencies.
 *
 * Generated fixtures:
 * 1. fake_invoice_1.png - Valid PNG image with FAKE watermark and invoice details
 * 2. fake_invoice_2.jpg - Valid baseline JPEG image with FAKE watermark and metadata
 * 3. fake_invoice_3.pdf - Valid PDF-1.4 document containing "SAMPLE FAKE BILL FOR TESTING ONLY"
 *
 * Usage:
 *   node scripts/generate-fake-bills.mjs
 *   node scripts/generate-fake-bills.mjs --force
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const billsDir = path.join(rootDir, 'supabase', 'fixtures', 'bills');

// Standard 5x7 ASCII bitmap font (characters 32..90)
const FONT_5X7 = {
  ' ': [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
  '!': [0x04, 0x04, 0x04, 0x04, 0x00, 0x00, 0x04],
  '"': [0x0a, 0x0a, 0x0a, 0x00, 0x00, 0x00, 0x00],
  '#': [0x0a, 0x0a, 0x1f, 0x0a, 0x1f, 0x0a, 0x0a],
  '$': [0x04, 0x0f, 0x14, 0x0e, 0x05, 0x1e, 0x04],
  '%': [0x19, 0x19, 0x02, 0x04, 0x08, 0x13, 0x13],
  '&': [0x08, 0x14, 0x14, 0x08, 0x15, 0x12, 0x0d],
  '\'': [0x04, 0x04, 0x08, 0x00, 0x00, 0x00, 0x00],
  '(': [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02],
  ')': [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08],
  '*': [0x00, 0x04, 0x15, 0x0e, 0x15, 0x04, 0x00],
  '+': [0x00, 0x04, 0x04, 0x1f, 0x04, 0x04, 0x00],
  ',': [0x00, 0x00, 0x00, 0x00, 0x04, 0x04, 0x08],
  '-': [0x00, 0x00, 0x00, 0x1f, 0x00, 0x00, 0x00],
  '.': [0x00, 0x00, 0x00, 0x00, 0x00, 0x0c, 0x0c],
  '/': [0x01, 0x02, 0x04, 0x08, 0x10, 0x00, 0x00],
  '0': [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  '1': [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  '2': [0x0e, 0x11, 0x01, 0x06, 0x08, 0x10, 0x1f],
  '3': [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
  '4': [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  '5': [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  '6': [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  '7': [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  '8': [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  '9': [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  ':': [0x00, 0x0c, 0x0c, 0x00, 0x0c, 0x0c, 0x00],
  ';': [0x00, 0x0c, 0x0c, 0x00, 0x04, 0x04, 0x08],
  '<': [0x02, 0x04, 0x08, 0x10, 0x08, 0x04, 0x02],
  '=': [0x00, 0x1f, 0x00, 0x1f, 0x00, 0x00, 0x00],
  '>': [0x08, 0x04, 0x02, 0x01, 0x02, 0x04, 0x08],
  '?': [0x0e, 0x11, 0x01, 0x02, 0x04, 0x00, 0x04],
  '@': [0x0e, 0x11, 0x01, 0x0d, 0x15, 0x15, 0x0e],
  'A': [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  'B': [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  'C': [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  'D': [0x1c, 0x12, 0x11, 0x11, 0x11, 0x12, 0x1c],
  'E': [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  'F': [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  'G': [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f],
  'H': [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  'I': [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  'J': [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c],
  'K': [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  'L': [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  'M': [0x11, 0x1b, 0x15, 0x11, 0x11, 0x11, 0x11],
  'N': [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  'O': [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  'P': [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  'Q': [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
  'R': [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  'S': [0x0e, 0x11, 0x10, 0x0e, 0x01, 0x11, 0x0e],
  'T': [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  'U': [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  'V': [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  'W': [0x11, 0x11, 0x11, 0x15, 0x15, 0x1b, 0x11],
  'X': [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  'Y': [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
  'Z': [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  '[': [0x0e, 0x08, 0x08, 0x08, 0x08, 0x08, 0x0e],
  '\\': [0x10, 0x08, 0x04, 0x02, 0x01, 0x00, 0x00],
  ']': [0x0e, 0x02, 0x02, 0x02, 0x02, 0x02, 0x0e],
  '^': [0x04, 0x0a, 0x11, 0x00, 0x00, 0x00, 0x00],
  '_': [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x1f],
};

// Simple 2D Canvas buffer for pixel drawing
class PixelCanvas {
  constructor(width, height, defaultColor = [255, 255, 255]) {
    this.width = width;
    this.height = height;
    this.buffer = Buffer.alloc(width * height * 3);
    for (let i = 0; i < width * height; i++) {
      const idx = i * 3;
      this.buffer[idx] = defaultColor[0];
      this.buffer[idx + 1] = defaultColor[1];
      this.buffer[idx + 2] = defaultColor[2];
    }
  }

  setPixel(x, y, color) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    const idx = (y * this.width + x) * 3;
    this.buffer[idx] = color[0];
    this.buffer[idx + 1] = color[1];
    this.buffer[idx + 2] = color[2];
  }

  fillRect(startX, startY, w, h, color) {
    for (let y = startY; y < startY + h; y++) {
      for (let x = startX; x < startX + w; x++) {
        this.setPixel(x, y, color);
      }
    }
  }

  drawText(text, startX, startY, color, scale = 1) {
    const upper = text.toUpperCase();
    let currentX = startX;

    for (let c = 0; c < upper.length; c++) {
      const ch = upper[c];
      const glyph = FONT_5X7[ch] || FONT_5X7['?'];

      for (let row = 0; row < 7; row++) {
        const rowBits = glyph[row];
        for (let col = 0; col < 5; col++) {
          if ((rowBits >> (4 - col)) & 1) {
            for (let sy = 0; sy < scale; sy++) {
              for (let sx = 0; sx < scale; sx++) {
                this.setPixel(currentX + col * scale + sx, startY + row * scale + sy, color);
              }
            }
          }
        }
      }
      currentX += (5 + 1) * scale;
    }
  }
}

// Computes CRC32 checksum for PNG chunks
function computeCrc32(buf) {
  let table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makePngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(computeCrc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

/**
 * 1. Generates fake_invoice_1.png
 * Valid PNG with 8-byte signature, IHDR, IDAT, IEND, and rendered FAKE invoice watermark.
 */
function generateFakeInvoicePng() {
  const width = 640;
  const height = 480;
  const canvas = new PixelCanvas(width, height, [250, 250, 252]);

  const red = [220, 38, 38];
  const darkGray = [55, 65, 81];
  const lightGray = [226, 232, 240];
  const watermarkColor = [252, 165, 165]; // Soft red watermark

  // Outer border & header background
  canvas.fillRect(20, 20, width - 40, 6, red);
  canvas.fillRect(20, 26, width - 40, 50, lightGray);

  // Large background watermark: FAKE
  canvas.drawText('*** FAKE SAMPLE ***', 110, 180, watermarkColor, 4);
  canvas.drawText('DO NOT FILE WITH GSTN', 140, 230, watermarkColor, 2);

  // Header content
  canvas.drawText('TAX INVOICE [FAKE SAMPLE]', 35, 38, red, 3);

  // Seller Details
  canvas.drawText('SUPPLIER: SHREE GANESH DISTRIBUTORS [FAKE]', 35, 95, darkGray, 2);
  canvas.drawText('GSTIN: 27AABCS1429B1Z2 (MAHARASHTRA)', 35, 115, darkGray, 1);
  canvas.drawText('ADDRESS: SHOP 14, APMC MARKET, VASHI, NAVI MUMBAI', 35, 130, darkGray, 1);

  // Invoice Meta
  canvas.fillRect(400, 85, 210, 60, [241, 245, 249]);
  canvas.drawText('INVOICE NO: FAKE-INV-2026-001', 410, 95, darkGray, 1);
  canvas.drawText('DATE: 12-OCT-2026', 410, 110, darkGray, 1);
  canvas.drawText('PERIOD: 102026 (OCTOBER 2026)', 410, 125, darkGray, 1);

  // Buyer Details
  canvas.fillRect(20, 160, width - 40, 2, lightGray);
  canvas.drawText('BILL TO: SHARMA GENERAL STORES [FAKE]', 35, 175, darkGray, 2);
  canvas.drawText('GSTIN: 27FAKES1234A1ZJ | REGULAR TAXPAYER', 35, 195, darkGray, 1);

  // Table Header
  canvas.fillRect(20, 265, width - 40, 24, [226, 232, 240]);
  canvas.drawText('ITEM DESCRIPTION          QTY   RATE      AMOUNT', 35, 273, darkGray, 1);

  // Table Rows
  canvas.drawText('1. PREMIUM BASMATI RICE   10    1,800.00  18,000.00', 35, 300, darkGray, 1);
  canvas.drawText('2. PURE MUSTARD OIL 15L    5    1,500.00   7,500.00', 35, 320, darkGray, 1);
  canvas.drawText('3. PACKAGED MASALA MIX    20      175.00   3,500.00', 35, 340, darkGray, 1);

  // Totals & GST
  canvas.fillRect(20, 365, width - 40, 2, lightGray);
  canvas.drawText('TAXABLE VALUE : RS  29,000.00', 340, 380, darkGray, 1);
  canvas.drawText('CGST @ 2.5%   : RS     725.00', 340, 395, darkGray, 1);
  canvas.drawText('SGST @ 2.5%   : RS     725.00', 340, 410, darkGray, 1);
  canvas.fillRect(340, 425, 260, 2, red);
  canvas.drawText('TOTAL PAYABLE : RS  30,450.00', 340, 435, red, 2);

  // Footer Disclaimer
  canvas.drawText('WATERMARK: SYNTHETIC TEST FIXTURE ONLY - CREATED FOR DEV UPLOAD', 35, 460, [148, 163, 184], 1);

  // Build PNG bytes
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth: 8
  ihdr[9] = 2; // Color type: 2 (RGB)
  ihdr[10] = 0; // Compression: 0
  ihdr[11] = 0; // Filter: 0
  ihdr[12] = 0; // Interlace: 0

  const rowLen = 1 + width * 3;
  const rawData = Buffer.alloc(height * rowLen);
  for (let y = 0; y < height; y++) {
    const rawOffset = y * rowLen;
    rawData[rawOffset] = 0; // Filter None
    const bufOffset = y * width * 3;
    canvas.buffer.copy(rawData, rawOffset + 1, bufOffset, bufOffset + width * 3);
  }

  const idat = zlib.deflateSync(rawData);
  const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  return Buffer.concat([
    pngHeader,
    makePngChunk('IHDR', ihdr),
    makePngChunk('IDAT', idat),
    makePngChunk('IEND', Buffer.alloc(0))
  ]);
}

/**
 * Helper class for bit-packing JPEG scan data with 0xFF byte stuffing.
 */
class JpegBitWriter {
  constructor() {
    this.bytes = [];
    this.currentByte = 0;
    this.bitsLeft = 8;
  }

  writeBits(val, bits) {
    for (let i = bits - 1; i >= 0; i--) {
      const bit = (val >> i) & 1;
      this.currentByte = (this.currentByte << 1) | bit;
      this.bitsLeft--;
      if (this.bitsLeft === 0) {
        this.bytes.push(this.currentByte);
        if (this.currentByte === 0xff) {
          this.bytes.push(0x00); // JPEG byte-stuffing
        }
        this.currentByte = 0;
        this.bitsLeft = 8;
      }
    }
  }

  flush() {
    if (this.bitsLeft < 8) {
      this.currentByte = (this.currentByte << this.bitsLeft) | ((1 << this.bitsLeft) - 1);
      this.bytes.push(this.currentByte);
      if (this.currentByte === 0xff) {
        this.bytes.push(0x00);
      }
      this.currentByte = 0;
      this.bitsLeft = 8;
    }
  }
}

/**
 * 2. Generates fake_invoice_2.jpg
 * Valid baseline JPEG with SOI, APP0 (JFIF), COM marker containing FAKE watermark,
 * standard DQT, SOF0, DHT, SOS, scan data, and EOI.
 */
function generateFakeInvoiceJpeg() {
  const width = 640;
  const height = 480;

  // APP0 (JFIF 1.1)
  const app0 = Buffer.from([
    0xff, 0xe0, 0x00, 0x10,
    0x4a, 0x46, 0x49, 0x46, 0x00, // 'JFIF\0'
    0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00
  ]);

  // COM Marker: explicit FAKE Watermark metadata
  const comment = 'SAMPLE FAKE BILL FOR TESTING ONLY - FAKE WATERMARK - INVOICE FAKE-INV-2026-002 - PATIL HARDWARE MART';
  const comLen = Buffer.byteLength(comment, 'ascii') + 2;
  const comMarker = Buffer.concat([
    Buffer.from([0xff, 0xfe, (comLen >> 8) & 0xff, comLen & 0xff]),
    Buffer.from(comment, 'ascii')
  ]);

  // DQT: standard luminance quantization table
  const qtable = Buffer.from([
    16, 11, 10, 16, 24, 40, 51, 61,
    12, 12, 14, 19, 26, 58, 60, 55,
    14, 13, 16, 24, 40, 57, 69, 56,
    14, 17, 22, 29, 51, 87, 80, 62,
    18, 22, 37, 56, 68, 109, 103, 77,
    24, 35, 55, 64, 81, 104, 113, 92,
    49, 64, 78, 87, 103, 121, 120, 101,
    72, 92, 95, 98, 112, 100, 103, 99
  ]);
  const dqt = Buffer.concat([
    Buffer.from([0xff, 0xdb, 0x00, 0x43, 0x00]),
    qtable
  ]);

  // SOF0: Baseline DCT, 8-bit precision, height, width, 1 component (grayscale)
  const sof0 = Buffer.from([
    0xff, 0xc0, 0x00, 0x0b, 0x08,
    (height >> 8) & 0xff, height & 0xff,
    (width >> 8) & 0xff, width & 0xff,
    0x01, 0x01, 0x11, 0x00
  ]);

  // DHT DC: Standard DC Luminance Huffman table
  const dhtDc = Buffer.from([
    0xff, 0xc4, 0x00, 0x1f, 0x00,
    0x00, 0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b
  ]);

  // DHT AC: Standard AC Luminance Huffman table
  const acBits = [0, 2, 1, 3, 3, 2, 4, 3, 5, 5, 4, 4, 0, 0, 1, 0x7d];
  const acVals = [
    0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06, 0x13, 0x51, 0x61, 0x07,
    0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xa1, 0x08, 0x23, 0x42, 0xb1, 0xc1, 0x15, 0x52, 0xd1, 0xf0,
    0x24, 0x33, 0x62, 0x72, 0x82, 0x09, 0x0a, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x25, 0x26, 0x27, 0x28,
    0x29, 0x2a, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49,
    0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69,
    0x6a, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
    0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7,
    0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5,
    0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe1, 0xe2,
    0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf1, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8,
    0xf9, 0xfa
  ];
  const dhtAcLen = 2 + 1 + 16 + acVals.length;
  const dhtAc = Buffer.concat([
    Buffer.from([0xff, 0xc4, (dhtAcLen >> 8) & 0xff, dhtAcLen & 0xff, 0x10]),
    Buffer.from(acBits),
    Buffer.from(acVals)
  ]);

  // SOS: Scan Header for 1 component
  const sos = Buffer.from([
    0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00
  ]);

  // Encode 8x8 MCU blocks:
  // For each 8x8 block, write DC difference 0 (code 00, length 2) and AC End-of-Block (code 1010, length 4)
  const bw = new JpegBitWriter();
  const mcuX = Math.ceil(width / 8);
  const mcuY = Math.ceil(height / 8);

  for (let y = 0; y < mcuY; y++) {
    for (let x = 0; x < mcuX; x++) {
      // Standard DC difference = 0 (code 00, length 2 bits)
      bw.writeBits(0, 2);
      // Standard AC End-of-Block = 0x00 (code 1010 = 10, length 4 bits)
      bw.writeBits(10, 4);
    }
  }
  bw.flush();

  const scanData = Buffer.from(bw.bytes);
  const soi = Buffer.from([0xff, 0xd8]);
  const eoi = Buffer.from([0xff, 0xd9]);

  return Buffer.concat([
    soi,
    app0,
    comMarker,
    dqt,
    sof0,
    dhtDc,
    dhtAc,
    sos,
    scanData,
    eoi
  ]);
}

/**
 * 3. Generates fake_invoice_3.pdf
 * Valid PDF-1.4 with trailer and cross-reference table, containing
 * "SAMPLE FAKE BILL FOR TESTING ONLY" and sample invoice structure.
 */
function generateFakeInvoicePdf() {
  const streamContent = [
    'BT',
    '/F1 22 Tf',
    '45 740 Td',
    '(SAMPLE FAKE BILL FOR TESTING ONLY) Tj',
    '0 -32 Td',
    '/F1 14 Tf',
    '(WATERMARK: [FAKE - NOT A REAL INVOICE - FOR DEV USE ONLY]) Tj',
    '0 -36 Td',
    '/F1 16 Tf',
    '(TAX INVOICE [RULE 46 OF CGST RULES]) Tj',
    '0 -26 Td',
    '/F1 11 Tf',
    '(Invoice Number : FAKE-INV-2026-003) Tj',
    '0 -18 Td',
    '(Invoice Date   : 18-OCT-2026) Tj',
    '0 -18 Td',
    '(Return Period  : 102026) Tj',
    '0 -28 Td',
    '/F1 12 Tf',
    '(SUPPLIER (ISSUER):) Tj',
    '0 -18 Td',
    '/F1 11 Tf',
    '(Legal Name  : Krishna Industrial Suppliers [FAKE]) Tj',
    '0 -16 Td',
    '(GSTIN       : 27AABCK1234D1Z8) Tj',
    '0 -16 Td',
    '(Address     : Plot 44, MIDC Industrial Area, Pune 411018) Tj',
    '0 -28 Td',
    '/F1 12 Tf',
    '(RECIPIENT (CUSTOMER):) Tj',
    '0 -18 Td',
    '/F1 11 Tf',
    '(Trade Name  : Patil Hardware Mart [FAKE]) Tj',
    '0 -16 Td',
    '(GSTIN       : 27FAKEP5678B1ZW) Tj',
    '0 -16 Td',
    '(GST Scheme  : Composition Taxpayer) Tj',
    '0 -32 Td',
    '/F1 12 Tf',
    '(ITEMIZED PARTICULARS & TAX COMPUTATION:) Tj',
    '0 -20 Td',
    '/F1 10 Tf',
    '(1. Heavy Duty Copper Cables (100m Drum)  x 5 Drums   : INR 25,000.00) Tj',
    '0 -16 Td',
    '(2. Industrial Modular MCB Switches (Pack of 20) x 10 : INR 20,000.00) Tj',
    '0 -24 Td',
    '/F1 11 Tf',
    '(Taxable Value Total    : INR 45,000.00) Tj',
    '0 -16 Td',
    '(Central GST (CGST 9%)  : INR  4,050.00) Tj',
    '0 -16 Td',
    '(State GST (SGST 9%)    : INR  4,050.00) Tj',
    '0 -20 Td',
    '/F1 13 Tf',
    '(TOTAL INVOICE VALUE    : INR 53,100.00) Tj',
    '0 -36 Td',
    '/F1 10 Tf',
    '(NOTICE: This document is a synthetic fixture generated for local testing.) Tj',
    '0 -14 Td',
    '(Generated by scripts/generate-fake-bills.mjs. Strictly not for commercial filing.) Tj',
    'ET'
  ].join('\n');

  const streamBytes = Buffer.from(streamContent, 'utf8');
  const streamLength = streamBytes.length;

  let body = '%PDF-1.4\n';
  const offsets = [];

  function appendObj(content) {
    offsets.push(Buffer.byteLength(body, 'utf8'));
    body += content + '\n';
  }

  appendObj('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj');
  appendObj('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj');
  appendObj('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj');
  appendObj(`4 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamContent}\nendstream\nendobj`);
  appendObj('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj');

  const xrefOffset = Buffer.byteLength(body, 'utf8');
  body += 'xref\n';
  body += '0 6\n';
  body += '0000000000 65535 f \n';
  for (const off of offsets) {
    body += String(off).padStart(10, '0') + ' 00000 n \n';
  }
  body += 'trailer\n';
  body += '<< /Size 6 /Root 1 0 R >>\n';
  body += 'startxref\n';
  body += String(xrefOffset) + '\n';
  body += '%%EOF\n';

  return Buffer.from(body, 'utf8');
}

/**
 * Main generator execution
 */
export async function generateFakeBills(options = {}) {
  const force = options.force || process.argv.includes('--force');

  if (!fs.existsSync(billsDir)) {
    fs.mkdirSync(billsDir, { recursive: true });
    console.log(`Created fixtures directory: ${billsDir}`);
  }

  const generatedFiles = [
    {
      name: 'fake_invoice_1.png',
      mime: 'image/png',
      generator: generateFakeInvoicePng,
    },
    {
      name: 'fake_invoice_2.jpg',
      mime: 'image/jpeg',
      generator: generateFakeInvoiceJpeg,
    },
    {
      name: 'fake_invoice_3.pdf',
      mime: 'application/pdf',
      generator: generateFakeInvoicePdf,
    },
  ];

  const results = [];

  for (const item of generatedFiles) {
    const filePath = path.join(billsDir, item.name);
    const exists = fs.existsSync(filePath);

    if (exists && !force) {
      const existingBuf = fs.readFileSync(filePath);
      const sha256 = crypto.createHash('sha256').update(existingBuf).digest('hex');
      console.log(`  ✓ Exists: ${item.name} (${existingBuf.length} bytes, sha256: ${sha256.slice(0, 12)}...)`);
      results.push({ name: item.name, path: filePath, size: existingBuf.length, sha256, mime: item.mime });
      continue;
    }

    const buf = item.generator();
    fs.writeFileSync(filePath, buf);
    const sha256 = crypto.createHash('sha256').update(buf).digest('hex');

    console.log(`  + Created: ${item.name} (${buf.length} bytes, sha256: ${sha256.slice(0, 12)}...)`);
    results.push({ name: item.name, path: filePath, size: buf.length, sha256, mime: item.mime });
  }

  return results;
}

// Direct invocation check
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  console.log('Generating synthetic fake bill fixtures in supabase/fixtures/bills/...');
  generateFakeBills()
    .then((files) => {
      console.log(`\nSuccessfully verified ${files.length} fake sample bills.`);
      for (const f of files) {
        console.log(`  - ${f.name} [${f.mime}] -> ${f.path}`);
      }
    })
    .catch((err) => {
      console.error('Error generating fake bills:', err);
      process.exit(1);
    });
}
