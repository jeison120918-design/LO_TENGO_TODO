// db.js — Capa de almacenamiento local con IndexedDB
// Todo funciona sin conexión a internet ni servidor externo.

const DB_NAME = 'ltt_pos_db';
const DB_VERSION = 1;
let dbInstance = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (dbInstance) return resolve(dbInstance);
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;

      if (!db.objectStoreNames.contains('products')) {
        const store = db.createObjectStore('products', { keyPath: 'id', autoIncrement: true });
        store.createIndex('category', 'category', { unique: false });
      }
      if (!db.objectStoreNames.contains('sales')) {
        const store = db.createObjectStore('sales', { keyPath: 'id', autoIncrement: true });
        store.createIndex('date', 'date', { unique: false });
      }
      if (!db.objectStoreNames.contains('config')) {
        db.createObjectStore('config', { keyPath: 'key' });
      }
    };

    req.onsuccess = (e) => {
      dbInstance = e.target.result;
      resolve(dbInstance);
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

function tx(storeName, mode = 'readonly') {
  return openDB().then((db) => db.transaction(storeName, mode).objectStore(storeName));
}

const DB = {
  // ---------- PRODUCTOS ----------
  async addProduct(product) {
    const store = await tx('products', 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.add(product);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },
  async updateProduct(product) {
    const store = await tx('products', 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.put(product);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },
  async deleteProduct(id) {
    const store = await tx('products', 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },
  async getAllProducts() {
    const store = await tx('products');
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },
  async getProduct(id) {
    const store = await tx('products');
    return new Promise((resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  // ---------- VENTAS ----------
  async addSale(sale) {
    const store = await tx('sales', 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.add(sale);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },
  async getAllSales() {
    const store = await tx('sales');
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },
  async deleteSale(id) {
    const store = await tx('sales', 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  // ---------- CONFIG ----------
  async setConfig(key, value) {
    const store = await tx('config', 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.put({ key, value });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },
  async getConfig(key, fallback = null) {
    const store = await tx('config');
    return new Promise((resolve, reject) => {
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : fallback);
      req.onerror = () => reject(req.error);
    });
  },

  // ---------- BACKUP / RESTORE ----------
  async exportAll() {
    const [products, sales] = await Promise.all([this.getAllProducts(), this.getAllSales()]);
    const businessName = await this.getConfig('businessName', 'Lo Tengo Todo Boutique');
    const businessPhone = await this.getConfig('businessPhone', '');
    return {
      exportedAt: new Date().toISOString(),
      businessName,
      businessPhone,
      products,
      sales
    };
  },
  async importAll(data) {
    if (!data) return;
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const trans = db.transaction(['products', 'sales'], 'readwrite');
      const pStore = trans.objectStore('products');
      const sStore = trans.objectStore('sales');
      pStore.clear();
      sStore.clear();
      for (const p of (data.products || [])) pStore.put(p);
      for (const s of (data.sales || [])) sStore.put(s);
      trans.oncomplete = () => resolve();
      trans.onerror = () => reject(trans.error);
      trans.onabort = () => reject(trans.error);
    });
    if (data.businessName) await this.setConfig('businessName', data.businessName);
    if (data.businessPhone) await this.setConfig('businessPhone', data.businessPhone);
  },
  async wipeAll() {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const trans = db.transaction(['products', 'sales'], 'readwrite');
      trans.objectStore('products').clear();
      trans.objectStore('sales').clear();
      trans.oncomplete = () => resolve();
      trans.onerror = () => reject(trans.error);
      trans.onabort = () => reject(trans.error);
    });
  },

  // ---------- RESET TOTAL DEL SISTEMA ----------
  async deleteDatabaseCompletely() {
    // Cierra la conexión abierta antes de borrar, o el navegador bloqueará el borrado.
    if (dbInstance) {
      dbInstance.close();
      dbInstance = null;
    }
    return new Promise((resolve, reject) => {
      const req = indexedDB.deleteDatabase(DB_NAME);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      req.onblocked = () => {
        // Se resuelve igual: al recargar la página se completa el borrado.
        resolve();
      };
    });
  }
};

window.DB = DB;
