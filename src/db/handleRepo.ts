import { db } from "./db";
import type { StoredHandle } from "./types";

export const handleRepo = {
  async save(
    handle: FileSystemFileHandle | FileSystemDirectoryHandle,
    options?: { id?: string; purpose?: StoredHandle["purpose"] }
  ) {
    const id = options?.id || crypto.randomUUID();
    const entry: StoredHandle =
      handle.kind === "file"
        ? {
            id,
            handle,
            kind: "file",
            purpose: options?.purpose
          }
        : {
            id,
            handle,
            kind: "directory",
            purpose: options?.purpose
          };
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
