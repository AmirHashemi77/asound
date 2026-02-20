import { db } from "./db";
import type { StoredHandle } from "./types";

export const handleRepo = {
  async save(handle: FileSystemFileHandle) {
    const id = crypto.randomUUID();
    const entry: StoredHandle = { id, handle };
    await db.handles.put(entry);
    return entry;
  },
  async get(id: string) {
    return db.handles.get(id);
  },
  async clear() {
    await db.handles.clear();
  }
};
