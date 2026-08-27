class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() { return this.store.size; }
  clear() { this.store.clear(); }
  getItem(key: string) { return this.store.get(key) ?? null; }
  key(index: number) { return [...this.store.keys()][index] ?? null; }
  removeItem(key: string) { this.store.delete(key); }
  setItem(key: string, value: string) { this.store.set(key, String(value)); }
}

const mock = new MemoryStorage() as unknown as Storage;

// Always expose on globalThis for node and jsdom
if (!(globalThis as any).localStorage) {
  (globalThis as any).localStorage = mock;
}
if (typeof window !== "undefined" && !(window as any).localStorage) {
  (window as any).localStorage = mock;
}
// Also ensure window exists for node tests that might need it
if (typeof globalThis.window === "undefined" && typeof window !== "undefined") {
  (globalThis as any).window = window;
}
