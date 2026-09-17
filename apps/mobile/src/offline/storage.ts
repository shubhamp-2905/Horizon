/**
 * @file Offline Local Storage Abstraction
 * Abstraction layer for SQLite and key-value persistence in zero-connectivity environments.
 */

export interface ILocalStorage {
  getItem<T>(key: string): Promise<T | null>;
  setItem<T>(key: string, value: T): Promise<void>;
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
}

export class MemoryLocalStorage implements ILocalStorage {
  private storage = new Map<string, string>();

  async getItem<T>(key: string): Promise<T | null> {
    const item = this.storage.get(key);
    if (!item) return null;
    return JSON.parse(item) as T;
  }

  async setItem<T>(key: string, value: T): Promise<void> {
    this.storage.set(key, JSON.stringify(value));
  }

  async removeItem(key: string): Promise<void> {
    this.storage.delete(key);
  }

  async clear(): Promise<void> {
    this.storage.clear();
  }
}

export const localStorage: ILocalStorage = new MemoryLocalStorage();
