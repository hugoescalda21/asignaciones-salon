// Firestore y Storage simulados en memoria (el mismo de 20-territorios), para las pruebas del Salón.
// Firestore y Storage falsos, compartidos por varias pestañas mediante window.__store (cada contexto tiene el suyo;
// para simular "otro usuario" se copia el estado de uno a otro).
function installMock(store, email) {
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const listeners = [];
  const notify = () => setTimeout(() => listeners.forEach(fn => fn()), 0);
  function getPath(path) { return path.split('/').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), store.docs); }
  function docGet(path) { return store.docs[path]; }
  function setDeep(obj, keys, v) { let o = obj; keys.slice(0, -1).forEach(k => { if (typeof o[k] !== 'object' || o[k] === null || Array.isArray(o[k])) o[k] = {}; o = o[k]; }); if (v && v.__del) delete o[keys[keys.length - 1]]; else o[keys[keys.length - 1]] = clone(v); }
  function merge(a, b) { Object.keys(b).forEach(k => { if (b[k] && b[k].__del) delete a[k]; else if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) merge(a[k], b[k]); else a[k] = clone(b[k]); }); }
  function snap(path) { const d = docGet(path); return { exists: d !== undefined, id: path.split('/').pop(), data: () => (d === undefined ? undefined : clone(d)) }; }
  function docRef(path) {
    return {
      id: path.split('/').pop(),
      get: async () => snap(path),
      onSnapshot: (cb) => { const fn = () => cb(snap(path)); listeners.push(fn); fn(); return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; },
      update: async (...args) => {
        if (docGet(path) === undefined) { const e = new Error('not found'); e.code = 'not-found'; throw e; }
        store.writes.push({ path, args: args.map(a => a && a.s ? a.s.join('.') : a) });
        if (args.length === 1 && typeof args[0] === 'object' && !args[0].s) { Object.keys(args[0]).forEach(k => setDeep(store.docs[path], k.split('.'), args[0][k])); }
        else for (let i = 0; i < args.length; i += 2) setDeep(store.docs[path], args[i].s, args[i + 1]);
        notify();
      },
      set: async (obj, opt) => { store.writes.push({ path, set: true }); if (opt && opt.merge && docGet(path)) merge(store.docs[path], obj); else store.docs[path] = clone(obj); notify(); },
      delete: async () => { delete store.docs[path]; notify(); },
      collection: (n) => colRef(path + '/' + n)
    };
  }
  function colRef(path) {
    return {
      doc: (id) => docRef(path + '/' + id),
      add: async () => ({}),
      where: () => colRef(path),
      onSnapshot: (cb) => {
        const fn = () => cb({ docs: Object.keys(store.docs).filter(k => k.startsWith(path + '/') && !k.slice(path.length + 1).includes('/')).map(k => snap(k)), forEach(f) { this.docs.forEach(f); } });
        listeners.push(fn); fn(); return () => {};
      }
    };
  }
  window.firebase = {
    firestore: Object.assign(() => fbDb, { FieldPath: function (...s) { this.s = s; }, FieldValue: { delete: () => ({ __del: true }), arrayUnion: (x) => x } }),
    storage: () => ({ ref: (p) => ({ put: async () => { store.uploads.push(p); }, getDownloadURL: async () => 'https://example.com/' + p, delete: async () => {} }) })
  };
  fbDb = { collection: (n) => colRef(n) };
  currentUser = { email, getIdToken: async () => 't' };
}

module.exports = { installMock };
