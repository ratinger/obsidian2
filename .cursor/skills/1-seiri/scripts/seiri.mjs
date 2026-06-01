#!/usr/bin/env node
/**
 * 1_seiri — 00_temporary → 02_stored + index
 * Run from vault root: node .cursor/skills/1-seiri/scripts/seiri.mjs
 */
import fs from "node:fs/promises";
import path from "node:path";

const VAULT_ROOT = process.cwd();
const TEMP_FOLDER = "00_temporary";
const STORED_FOLDER = "02_stored";
const INDEX_FILE = "01_index/index.md";
const DATE_PREFIX_RE = /^\d{8}_/;
const SUMMARY_LENGTH = 40;
const SEIRI_START = "<!-- vault-seiri:start -->";
const SEIRI_END = "<!-- vault-seiri:end -->";

const KEYWORD_TAGS = [
  { pattern: /obsidian/i, tag: "Obsidian" },
  { pattern: /claude/i, tag: "Claude" },
  { pattern: /\bmcp\b/i, tag: "MCP" },
  { pattern: /notebooklm/i, tag: "NotebookLM" },
  { pattern: /日記|ジャーナリング|内省/, tag: "日記" },
  { pattern: /音声|ボイス|文字起こし/, tag: "音声入力" },
  { pattern: /知識ベース|ノート/, tag: "知識管理" },
  { pattern: /介護|老後|終活/, tag: "介護" },
  { pattern: /ai|生成ai|人工知能/i, tag: "AI" },
  { pattern: /プログラミング|コード|開発/, tag: "開発" },
  { pattern: /ブログ|記事|クリップ/, tag: "記事" },
];

function formatDatePrefix(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function formatDateHeading(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function stripExtension(name) {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(0, i) : name;
}

function normalizeTag(tag) {
  return String(tag)
    .trim()
    .replace(/^#/, "")
    .replace(/[\[\]"']/g, "")
    .replace(/[\\/:*?"<>|]/g, "")
    .slice(0, 30);
}

function parseFrontmatter(content) {
  const normalized = content.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) {
    return { frontmatter: {}, body: normalized };
  }
  const end = normalized.indexOf("\n---\n", 4);
  if (end === -1) return { frontmatter: {}, body: normalized };
  const yaml = normalized.slice(4, end);
  return {
    frontmatter: parseSimpleYaml(yaml),
    body: normalized.slice(end + 5),
  };
}

function parseSimpleYaml(yaml) {
  const obj = {};
  const lines = yaml.split("\n");
  let list = null;

  for (const line of lines) {
    const listMatch = line.match(/^\s+-\s+(.+)$/);
    if (listMatch && list) {
      list.push(unquoteYamlValue(listMatch[1]));
      continue;
    }
    list = null;
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1];
    const value = kv[2].trim();
    if (!value) {
      list = [];
      obj[key] = list;
      continue;
    }
    if (value.startsWith("[") && value.endsWith("]")) {
      obj[key] = value
        .slice(1, -1)
        .split(",")
        .map((v) => unquoteYamlValue(v.trim()))
        .filter(Boolean);
      continue;
    }
    obj[key] = unquoteYamlValue(value);
  }
  return obj;
}

function unquoteYamlValue(value) {
  const v = value.trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    return v.slice(1, -1);
  }
  return v;
}

function stringifyFrontmatter(obj) {
  const lines = ["---"];
  for (const [key, value] of Object.entries(obj)) {
    if (value == null || value === "") continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      lines.push(`${key}:`);
      for (const item of value) {
        lines.push(`  - ${yamlQuote(item)}`);
      }
      continue;
    }
    lines.push(`${key}: ${yamlQuote(value)}`);
  }
  lines.push("---");
  return lines.join("\n");
}

function yamlQuote(value) {
  const s = String(value);
  if (/[:#\n\r]/.test(s) || s.includes('"')) {
    return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return s;
}

function stripSeiriBlock(body) {
  const start = body.indexOf(SEIRI_START);
  if (start === -1) return body.trimStart();
  const end = body.indexOf(SEIRI_END, start);
  if (end === -1) return body.trimStart();
  return (body.slice(0, start) + body.slice(end + SEIRI_END.length)).trimStart();
}

function extractHashtags(text) {
  const tags = [];
  const re = /#([^\s#`[\],.;:!?）】）]+)/gu;
  let match;
  while ((match = re.exec(text))) {
    const tag = normalizeTag(match[1]);
    if (tag.length >= 2) tags.push(tag);
  }
  return tags;
}

function extractKeywordTags(text) {
  const tags = [];
  for (const { pattern, tag } of KEYWORD_TAGS) {
    if (pattern.test(text)) tags.push(tag);
  }
  return tags;
}

function extractTitleTags(title) {
  if (!title) return [];
  const tags = [];
  const cleaned = title
    .replace(/\|.*$/, "")
    .replace(/[「」『』【】\[\]()（）]/g, " ")
    .replace(/×/g, " ");
  for (const { pattern, tag } of KEYWORD_TAGS) {
    if (pattern.test(cleaned)) tags.push(tag);
  }
  const parts = cleaned.split(/[\s　、。・\-—–ー]+/).filter((p) => p.length >= 2);
  for (const part of parts.slice(0, 3)) {
    if (part.length <= 12 && !/^\d+$/.test(part)) tags.push(part);
  }
  return tags;
}

function pickTags(candidates, min = 2, max = 5) {
  const seen = new Set();
  const result = [];
  for (const raw of candidates) {
    const tag = normalizeTag(raw);
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(tag);
    if (result.length >= max) break;
  }
  if (result.length < min) {
    for (const tag of ["メモ", "整理済み", "ストック", "インプット", "参考"]) {
      if (result.length >= min) break;
      const key = tag.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        result.push(tag);
      }
    }
  }
  return result.slice(0, max);
}

function generateTags(fileName, frontmatter, body) {
  const title =
    frontmatter.title || stripExtension(fileName.replace(/^\d{8}_/, ""));
  const scanText = [title, body.slice(0, 2000)].join("\n");
  const existing = [];
  if (Array.isArray(frontmatter.tags)) existing.push(...frontmatter.tags);
  else if (typeof frontmatter.tags === "string") {
    existing.push(...frontmatter.tags.split(/[,、\s]+/));
  }
  return pickTags(
    [
      ...existing,
      ...extractKeywordTags(scanText),
      ...extractTitleTags(title),
      ...extractHashtags(body.slice(0, 1500)),
    ],
    2,
    5,
  );
}

function cleanSummarySource(text) {
  return text
    .replace(/^#+\s+/gm, "")
    .replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`>#|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function trimToLength(text, length = SUMMARY_LENGTH) {
  const cleaned = cleanSummarySource(text);
  if (!cleaned) return "";
  if (cleaned.length <= length) return cleaned;
  const slice = cleaned.slice(0, length);
  const breakAt = Math.max(
    slice.lastIndexOf("。"),
    slice.lastIndexOf("、"),
    slice.lastIndexOf(" "),
  );
  if (breakAt > length * 0.55) return slice.slice(0, breakAt + 1).trim();
  return slice.trimEnd() + "…";
}

function generateSummary(fileName, frontmatter, body) {
  const stripped = stripSeiriBlock(body);
  const title = frontmatter.title || stripExtension(fileName);
  if (frontmatter.summary) return trimToLength(frontmatter.summary);
  const fromTitle = trimToLength(
    cleanSummarySource(String(title).replace(/\|.*$/, "")),
  );
  if (fromTitle.length >= 12) return fromTitle;
  const paragraphs = stripped
    .split(/\n{2,}/)
    .map((p) => cleanSummarySource(p))
    .filter((p) => p.length >= 8);
  if (paragraphs.length > 0) return trimToLength(paragraphs[0]);
  return trimToLength(title) || "内容要約なし";
}

function buildTagLine(tags) {
  return tags.map((t) => `#${t}`).join(" ");
}

function applyMetadata(content, tags, summary) {
  const { frontmatter, body } = parseFrontmatter(content);
  const cleanBody = stripSeiriBlock(body);
  const merged = { ...frontmatter, tags, summary };
  const metaBlock = [
    SEIRI_START,
    buildTagLine(tags),
    "",
    `> ${summary}`,
    SEIRI_END,
    "",
  ].join("\n");
  return `${stringifyFrontmatter(merged)}\n\n${metaBlock}${cleanBody}`;
}

function formatIndexEntry(tags, summary, linkPath) {
  return `- ${buildTagLine(tags)} — ${summary} — [[${linkPath}]]`;
}

function appendIndexEntries(existingContent, dateHeading, entries) {
  const header = "# インデックス\n\n整理済みノートの一覧。\n\n";
  let content = existingContent?.trim() ? existingContent : header;
  if (!content.trimStart().startsWith("# インデックス")) {
    content = header + content;
  }
  const sectionHeader = `## ${dateHeading}`;
  const blocks = entries.map((e) =>
    formatIndexEntry(e.tags, e.summary, e.linkPath),
  );
  if (content.includes(sectionHeader)) {
    const insertAt = content.indexOf(sectionHeader) + sectionHeader.length;
    const after = content.slice(insertAt);
    const nextSection = after.search(/\n## /);
    const prefix = content.slice(0, insertAt);
    const sectionBody =
      nextSection === -1 ? after : after.slice(0, nextSection);
    const suffix = nextSection === -1 ? "" : after.slice(nextSection);
    const linesToAdd = blocks.filter((b) => !content.includes(b));
    if (linesToAdd.length === 0) return content;
    return `${prefix}${sectionBody.trimEnd()}\n\n${linesToAdd.join("\n")}${suffix}`;
  }
  return `${content.trimEnd()}\n\n${sectionHeader}\n\n${blocks.join("\n")}\n`;
}

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function resolveUniquePath(targetPath) {
  if (!(await exists(targetPath))) return targetPath;
  const dot = targetPath.lastIndexOf(".");
  const hasExt = dot > targetPath.lastIndexOf(path.sep);
  const base = hasExt ? targetPath.slice(0, dot) : targetPath;
  const ext = hasExt ? targetPath.slice(dot) : "";
  let n = 2;
  while (await exists(`${base}_${n}${ext}`)) n += 1;
  return `${base}_${n}${ext}`;
}

function buildStoredName(fileName, datePrefix) {
  if (DATE_PREFIX_RE.test(fileName)) return fileName;
  return `${datePrefix}_${fileName}`;
}

async function main() {
  const tempDir = path.join(VAULT_ROOT, TEMP_FOLDER);
  const storedDir = path.join(VAULT_ROOT, STORED_FOLDER);
  const datePrefix = formatDatePrefix();
  const dateHeading = formatDateHeading();

  if (!(await exists(tempDir))) {
    console.log(`${TEMP_FOLDER} がありません`);
    process.exit(0);
  }

  await fs.mkdir(storedDir, { recursive: true });

  const names = await fs.readdir(tempDir);
  const files = [];
  for (const name of names) {
    const full = path.join(tempDir, name);
    const stat = await fs.stat(full);
    if (stat.isFile()) files.push(name);
  }

  if (files.length === 0) {
    console.log(`${TEMP_FOLDER} に移動するファイルがありません`);
    process.exit(0);
  }

  const indexEntries = [];

  for (const name of files) {
    const srcPath = path.join(tempDir, name);
    const originalContent = await fs.readFile(srcPath, "utf8");
    const { frontmatter, body } = parseFrontmatter(originalContent);
    const tags = generateTags(name, frontmatter, body);
    const summary = generateSummary(name, frontmatter, body);
    const enriched = applyMetadata(originalContent, tags, summary);

    await fs.writeFile(srcPath, enriched, "utf8");

    const newName = buildStoredName(name, datePrefix);
    let targetPath = path.join(storedDir, newName);
    targetPath = await resolveUniquePath(targetPath);
    await fs.rename(srcPath, targetPath);

    const rel = path.relative(VAULT_ROOT, targetPath).replace(/\\/g, "/");
    indexEntries.push({
      tags,
      summary,
      linkPath: stripExtension(rel),
    });
    console.log(`OK: ${name} → ${rel}`);
    console.log(`    tags: ${tags.join(", ")}`);
    console.log(`    summary: ${summary}`);
  }

  const indexPath = path.join(VAULT_ROOT, INDEX_FILE);
  await fs.mkdir(path.dirname(indexPath), { recursive: true });
  let existing = "";
  if (await exists(indexPath)) {
    existing = await fs.readFile(indexPath, "utf8");
  }
  await fs.writeFile(
    indexPath,
    appendIndexEntries(existing, dateHeading, indexEntries),
    "utf8",
  );
  console.log(`\nUpdated ${INDEX_FILE} (${indexEntries.length} entries)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
