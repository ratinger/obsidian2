#!/usr/bin/env node
/**
 * Parse 01_index/index.md entries for 2_question.
 * Run from vault root: node .cursor/skills/2-question/scripts/list-index.mjs
 */
import fs from "node:fs/promises";
import path from "node:path";

const VAULT_ROOT = process.cwd();
const INDEX_FILE = "01_index/index.md";
const ENTRY_RE =
  /^- ((?:#[^\s#]+(?:\s+|$))+?)—\s*(.+?)\s*—\s*\[\[([^\]]+)\]\]\s*$/;

async function main() {
  const indexPath = path.join(VAULT_ROOT, INDEX_FILE);
  let content;
  try {
    content = await fs.readFile(indexPath, "utf8");
  } catch {
    console.error(`Missing ${INDEX_FILE}`);
    process.exit(1);
  }

  const entries = [];
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(ENTRY_RE);
    if (!m) continue;
    const tags = [...m[1].matchAll(/#([^\s#]+)/g)].map((x) => x[1]);
    entries.push({ tags, summary: m[2].trim(), link: m[3] });
  }

  if (entries.length === 0) {
    console.log("No index entries found.");
    process.exit(0);
  }

  console.log(JSON.stringify({ indexFile: INDEX_FILE, count: entries.length, entries }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
