import { UploadEntry } from '../types/storage';

/**
 * Reading a dropped folder.
 *
 * `dataTransfer.files` cannot see inside a directory — it reports the folder
 * itself as a single zero-byte entry that no upload can use. The File System
 * Entry API is the only way in, and it comes with two traps worth stating
 * plainly, because both fail silently:
 *
 *  1. `webkitGetAsEntry()` has to be called *synchronously* in the drop
 *     handler. The DataTransfer is neutered as soon as that handler returns,
 *     so the entries are taken before this module's first `await`.
 *  2. `readEntries()` hands back at most 100 children per call and signals the
 *     end with an empty batch. Calling it once truncates any larger folder.
 *
 * The API is still unstandardised and absent in some browsers, so every use is
 * guarded and falls back to the flat file list, which at least handles loose
 * files correctly.
 */

/** Guards a pathological or cyclic tree. Real uploads never come close. */
const MAX_DEPTH = 32;

export interface CollectedDrop {
  entries: UploadEntry[];
  /** Every folder seen, so an empty one is still recreated. */
  dirs: string[][];
}

/** Folder segments for a File picked through `<input webkitdirectory>`. */
export function relativeFolderPath(file: File): string[] {
  const rel = file.webkitRelativePath;
  if (!rel) return [];
  // "docs/notes/a.txt" -> ["docs", "notes"]
  return rel.split('/').slice(0, -1).filter(Boolean);
}

export function fromFileList(list: FileList | File[]): UploadEntry[] {
  return Array.from(list).map((file) => ({ file, path: relativeFolderPath(file) }));
}

function readFile(entry: FileSystemFileEntry): Promise<File | null> {
  return new Promise((resolve) => {
    entry.file(
      (file) => resolve(file),
      // an unreadable file should cost that one file, not the whole drop
      () => resolve(null)
    );
  });
}

function readBatch(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve) => {
    reader.readEntries(
      (entries) => resolve(entries),
      () => resolve([])
    );
  });
}

async function walk(
  entry: FileSystemEntry,
  parent: string[],
  out: CollectedDrop,
  depth: number
): Promise<void> {
  if (depth > MAX_DEPTH) return;

  if (entry.isFile) {
    const file = await readFile(entry as FileSystemFileEntry);
    if (file) out.entries.push({ file, path: parent });
    return;
  }

  if (!entry.isDirectory) return;

  const path = [...parent, entry.name];
  out.dirs.push(path);

  const reader = (entry as FileSystemDirectoryEntry).createReader();
  // keep pulling batches until one comes back empty — see trap 2 above
  for (;;) {
    const batch = await readBatch(reader);
    if (batch.length === 0) break;
    for (const child of batch) {
      await walk(child, path, out, depth + 1);
    }
  }
}

/** Everything in a drop, folders included, flattened into upload entries. */
export async function collectDroppedEntries(dataTransfer: DataTransfer): Promise<CollectedDrop> {
  // synchronous section — nothing may await before these are read
  const roots: FileSystemEntry[] = [];
  for (const item of Array.from(dataTransfer.items ?? [])) {
    if (item.kind !== 'file') continue;
    const entry = typeof item.webkitGetAsEntry === 'function' ? item.webkitGetAsEntry() : null;
    if (entry) roots.push(entry);
  }
  const flat = Array.from(dataTransfer.files ?? []);

  // no entry API, or a drop that exposed none: loose files still work
  if (roots.length === 0) return { entries: fromFileList(flat), dirs: [] };

  const out: CollectedDrop = { entries: [], dirs: [] };
  for (const root of roots) {
    await walk(root, [], out, 0);
  }
  return out;
}
