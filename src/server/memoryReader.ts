import fs from "fs/promises";
import path from "path";

export type MemoryEntryType = "daily" | "longterm" | "obsidian";

export interface MemoryEntry {
  id: string;
  type: MemoryEntryType;
  title: string;
  path: string;
  modifiedAt: string;
  sizeBytes: number;
  preview: string;
  content?: string;
}

const WORKSPACE = "/Users/nigel/.openclaw/workspace";
const MEMORY_DIR = path.join(WORKSPACE, "memory");
const OBSIDIAN_DIR = path.join(WORKSPACE, "obsidian-vault", "Jarvis");
const MEMORY_FILE = path.join(WORKSPACE, "MEMORY.md");

const PREVIEW_LINES = 20;

async function readFilePreview(filePath: string, maxLines = PREVIEW_LINES): Promise<string> {
  try {
    const stat = await fs.stat(filePath);
    const content = await fs.readFile(filePath, "utf-8");
    const lines = content.split("\n").slice(0, maxLines);
    return lines.join("\n");
  } catch {
    return "";
  }
}

async function getFileModifiedAt(filePath: string): Promise<string> {
  try {
    const stat = await fs.stat(filePath);
    return stat.mtime.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

async function getFileSize(filePath: string): Promise<number> {
  try {
    const stat = await fs.stat(filePath);
    return stat.size;
  } catch {
    return 0;
  }
}

export async function readMemoryFiles(includeContent = false): Promise<MemoryEntry[]> {
  const entries: MemoryEntry[] = [];

  // Long-term memory: MEMORY.md
  try {
    const modifiedAt = await getFileModifiedAt(MEMORY_FILE);
    const sizeBytes = await getFileSize(MEMORY_FILE);
    const preview = await readFilePreview(MEMORY_FILE);
    const content = includeContent ? await fs.readFile(MEMORY_FILE, "utf-8") : undefined;

    entries.push({
      id: "memory-md",
      type: "longterm",
      title: "Long-term Memory (MEMORY.md)",
      path: MEMORY_FILE,
      modifiedAt,
      sizeBytes,
      preview,
      content,
    });
  } catch {
    // file not found — skip
  }

  // Daily memory: memory/YYYY-MM-DD.md
  try {
    const files = await fs.readdir(MEMORY_DIR);
    const mdFiles = files.filter((f) => f.endsWith(".md")).sort().reverse();

    for (const file of mdFiles) {
      const filePath = path.join(MEMORY_DIR, file);
      const modifiedAt = await getFileModifiedAt(filePath);
      const sizeBytes = await getFileSize(filePath);
      const preview = await readFilePreview(filePath);
      const content = includeContent ? await fs.readFile(filePath, "utf-8") : undefined;

      entries.push({
        id: `daily-${file.replace(".md", "")}`,
        type: "daily",
        title: file.replace(".md", ""),
        path: filePath,
        modifiedAt,
        sizeBytes,
        preview,
        content,
      });
    }
  } catch {
    // directory not found — skip
  }

  // Obsidian vault: obsidian-vault/Jarvis/
  try {
    const files = await fs.readdir(OBSIDIAN_DIR);
    const mdFiles = files.filter((f) => f.endsWith(".md"));

    for (const file of mdFiles) {
      const filePath = path.join(OBSIDIAN_DIR, file);
      const modifiedAt = await getFileModifiedAt(filePath);
      const sizeBytes = await getFileSize(filePath);
      const preview = await readFilePreview(filePath);
      const content = includeContent ? await fs.readFile(filePath, "utf-8") : undefined;

      entries.push({
        id: `obsidian-${file.replace(".md", "")}`,
        type: "obsidian",
        title: file.replace(".md", ""),
        path: filePath,
        modifiedAt,
        sizeBytes,
        preview,
        content,
      });
    }
  } catch {
    // directory not found — skip
  }

  return entries;
}
