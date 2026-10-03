// Envoltorio mínimo de IndexedDB (clave → Blob). Sustituible por Object Storage + API.

export function idbStore(dbName, storeName) {
  let dbPromise = null;

  function open() {
    if (typeof indexedDB === "undefined") return Promise.reject(new Error("IndexedDB no disponible en este navegador"));
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(dbName, 1);
        req.onupgradeneeded = () => {
          if (!req.result.objectStoreNames.contains(storeName)) req.result.createObjectStore(storeName);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        req.onblocked = () => reject(new Error("IndexedDB bloqueada por otra pestaña"));
      }).catch((err) => {
        dbPromise = null;
        throw err;
      });
    }
    return dbPromise;
  }

  function run(mode, fn) {
    return open().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const req = fn(tx.objectStore(storeName));
      tx.oncomplete = () => resolve(req ? req.result : undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error("Transacción cancelada"));
    }));
  }

  return {
    get: (key) => run("readonly", (s) => s.get(key)),
    set: (key, value) => run("readwrite", (s) => s.put(value, key)),
    del: (key) => run("readwrite", (s) => s.delete(key)),
    keys: () => run("readonly", (s) => s.getAllKeys())
  };
}

export const imageDB = idbStore("ruta_ba_images_v2", "images");
export const documentDB = idbStore("ruta_ba_documents_v1", "files");
