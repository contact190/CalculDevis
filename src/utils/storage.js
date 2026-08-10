/**
 * Robust Local Storage Utility using IndexedDB 
 * Bypasses the 5MB limit of localStorage
 */
const DB_NAME = 'CalculDevisDB';
const STORE_NAME = 'app_state';
const DB_VERSION = 1;

let dbInstance = null;

const openDB = () => {
  if (dbInstance) return Promise.resolve(dbInstance);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };
    request.onerror = () => reject(request.error);
  });
};

export const persistentStorage = {
  async save(key, data) {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.put(data, key);
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error("IndexedDB Save Error:", e);
      // Fallback to localStorage for small configs if IndexedDB fails
      try { localStorage.setItem(key, JSON.stringify(data)); } catch(le) {}
      return false;
    }
  },

  async load(key) {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error("IndexedDB Load Error:", e);
      const local = localStorage.getItem(key);
      return local ? JSON.parse(local) : null;
    }
  }
};
