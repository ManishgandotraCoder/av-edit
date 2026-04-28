const DB_NAME = 'avyro-editor';
const STORE = 'pdfs';
const DB_VER = 1;

export type StoredPdfRow = {
  id: string;
  name: string;
  size: number;
  createdAt: number;
  updatedAt: number;
  buffer: ArrayBuffer;
};

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is required for the PDF library (use a supported browser).'));
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error ?? new Error('Could not open local PDF library.'));
    };
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
  });
  return dbPromise;
}

export async function idbListAll(): Promise<StoredPdfRow[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const rq = tx.objectStore(STORE).getAll();
    rq.onsuccess = () => resolve(rq.result as StoredPdfRow[]);
    rq.onerror = () => reject(rq.error ?? new Error('Could not list PDFs.'));
  });
}

export async function idbGet(id: string): Promise<StoredPdfRow | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const rq = tx.objectStore(STORE).get(id);
    rq.onsuccess = () => resolve(rq.result as StoredPdfRow | undefined);
    rq.onerror = () => reject(rq.error ?? new Error('Could not read PDF.'));
  });
}

export async function idbPut(row: StoredPdfRow): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(row);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Could not save PDF.'));
    tx.onabort = () => reject(tx.error ?? new Error('Could not save PDF.'));
  });
}

export async function idbDelete(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Could not delete PDF.'));
    tx.onabort = () => reject(tx.error ?? new Error('Could not delete PDF.'));
  });
}
