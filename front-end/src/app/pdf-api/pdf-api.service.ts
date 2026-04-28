import { Injectable } from '@angular/core';

import { idbDelete, idbGet, idbListAll, idbPut, type StoredPdfRow } from './pdf-storage.idb';

export type PdfMeta = {
  id: string;
  name: string;
  size: number;
  createdAt: number;
  updatedAt: number;
};

@Injectable({ providedIn: 'root' })
export class PdfApiService {
  private assertValidPdf(bytes: Uint8Array) {
    if (bytes.byteLength < 5) {
      throw new Error('Empty PDF (no bytes).');
    }
    const a = new Uint8Array(5);
    a.set(bytes.subarray(0, 5));
    const head = new TextDecoder('utf-8').decode(a);
    if (head !== '%PDF-') {
      if (a[0] === 0x3c) {
        throw new Error('Corrupt PDF in local library (HTML-looking data instead of PDF).');
      }
      throw new Error('Not a valid PDF (missing %PDF- header).');
    }
  }

  private metaFromRow(row: StoredPdfRow): PdfMeta {
    const { id, name, size, createdAt, updatedAt } = row;
    return { id, name, size, createdAt, updatedAt };
  }

  private isLikelyPdfUpload(file: File): boolean {
    const mt = String(file.type ?? '').toLowerCase();
    if (mt === 'application/pdf') return true;
    if (mt === 'application/octet-stream' || mt === 'binary/octet-stream') return true;
    return false;
  }

  async list(): Promise<PdfMeta[]> {
    const rows = await idbListAll();
    return rows
      .map((row) => this.metaFromRow(row))
      .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  }

  async upload(file: File): Promise<PdfMeta> {
    if (!this.isLikelyPdfUpload(file)) {
      throw new Error('Only PDF upload supported (application/pdf or octet-stream).');
    }
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    this.assertValidPdf(bytes);

    const id = crypto.randomUUID();
    const now = Date.now();
    const row: StoredPdfRow = {
      id,
      name: file.name ?? 'document.pdf',
      size: bytes.byteLength,
      createdAt: now,
      updatedAt: now,
      buffer
    };

    try {
      await idbPut(row);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'QuotaExceededError') {
        throw new Error('Browser storage full. Delete some PDFs or free disk space.');
      }
      throw e;
    }
    return this.metaFromRow(row);
  }

  async getMeta(id: string): Promise<PdfMeta> {
    const row = await idbGet(id);
    if (!row) throw new Error('Not found.');
    return this.metaFromRow(row);
  }

  async getBytes(id: string): Promise<Uint8Array> {
    const row = await idbGet(id);
    if (!row) {
      throw new Error('PDF not found.');
    }
    const buf = new Uint8Array(row.buffer.byteLength);
    buf.set(new Uint8Array(row.buffer));
    this.assertValidPdf(buf);
    return buf;
  }

  async saveBytes(id: string, bytes: Uint8Array): Promise<PdfMeta> {
    this.assertValidPdf(bytes);
    const prev = await idbGet(id);
    if (!prev) throw new Error('Not found.');
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const buffer = copy.buffer.slice(copy.byteOffset, copy.byteOffset + copy.byteLength) as ArrayBuffer;
    const now = Date.now();
    const row: StoredPdfRow = {
      ...prev,
      buffer,
      size: copy.byteLength,
      updatedAt: now
    };
    try {
      await idbPut(row);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'QuotaExceededError') {
        throw new Error('Browser storage full. Delete some PDFs or free disk space.');
      }
      throw e;
    }
    return this.metaFromRow(row);
  }

  async delete(id: string): Promise<void> {
    const prev = await idbGet(id);
    if (!prev) throw new Error('Not found.');
    await idbDelete(id);
  }
}
