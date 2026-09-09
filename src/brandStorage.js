// Preserve saved drafts, voices and preferences when the product name changes.
export function migrateBrandStorage() {
  if (typeof window === 'undefined') return;
  for (const storageName of ['localStorage', 'sessionStorage']) {
    try {
      const storage = window[storageName];
      const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i));
      for (const oldKey of keys) {
        if (!oldKey?.startsWith('nichecut_')) continue;
        // Obsolete bearer tokens must not be copied into the new namespace.
        if (oldKey === 'nichecut_token') { storage.removeItem(oldKey); continue; }
        const newKey = oldKey.replace(/^nichecut_/, 'kappgen_');
        if (storage.getItem(newKey) === null) storage.setItem(newKey, storage.getItem(oldKey));
        storage.removeItem(oldKey);
      }
    } catch { /* Storage unavailable or full: leave remaining legacy data intact. */ }
  }
}
