#!/usr/bin/env node
/**
 * 4_yachiyo — 海老名⇔星野栞さん宅（八千代緑が丘・小田急/東西線）
 */
import fs from "node:fs/promises";
import path from "node:path";

const VAULT_ROOT = process.cwd();
const WEEKDAY = ["日", "月", "火", "水", "木", "金", "土"];
const TRANSFER_NOTE = "新宿1回・乗換最小";

const T = {
  ebinaShinjuku: 75,
  shinjukuTransfer: 5,
  shinjukuOtemachi: 15,
  otemachiYachiyo: 45,
  walkHome: 5,
  otemachiDinner: 90,
  defaultTozaiDep: 9 * 60 + 40,
};

const TODO_HEADINGS = ["ToDoリスト", "優先項目"];

/** 往路: 海老名→星野栞さん宅 */
const OUT_SEG = [
  { event: "海老名-新宿（相鉄・小田急直通）", key: "ebinaShinjuku", note: TRANSFER_NOTE },
  { event: "（徒歩）新宿", key: "shinjukuTransfer", note: "千代田線乗換" },
  { event: "新宿-大手町（千代田線）", key: "shinjukuOtemachi", note: "" },
];

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        args[key] = next;
        i++;
      } else args[key] = true;
    }
  }
  return args;
}

function parseTime(t) {
  const m = String(t).trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) throw new Error(`Invalid time: ${t}`);
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function formatTime(mins) {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

function formatRange(start, end) {
  return `${formatTime(start)}-${formatTime(end)}`;
}

function parseDate(dateStr) {
  const m = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) throw new Error(`Invalid date: ${dateStr} (use YYYY-MM-DD)`);
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const d = parseInt(m[3], 10);
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) {
    throw new Error(`Invalid date: ${dateStr}`);
  }
  return {
    y,
    mo,
    d,
    dt,
    ymd: `${y}${String(mo).padStart(2, "0")}${String(d).padStart(2, "0")}`,
  };
}

function dateLabel(mo, d, dt) {
  return `${mo}/${d}(${WEEKDAY[dt.getDay()]})`;
}

function buildSegments(startMin, segments) {
  let t = startMin;
  return segments.map((seg) => {
    const s = t;
    t += seg.mins;
    return { range: formatRange(s, t), event: seg.event, note: seg.note || "" };
  });
}

function fileDateKey(name) {
  const m = name.match(/^(\d{8})_/);
  if (m) return m[1];
  const m2 = name.match(/^(\d{6})\s/);
  if (m2) return `${m2[1]}15`;
  return "00000000";
}

async function listPlanFiles() {
  const names = await fs.readdir(VAULT_ROOT);
  return names
    .filter((n) => n.includes("八千代やること") && n.endsWith(".md"))
    .map((n) => ({ name: n, path: path.join(VAULT_ROOT, n), dateKey: fileDateKey(n) }));
}

async function resolveBaseFile(targetYmd, opts) {
  if (opts.base || opts.previous) {
    const p = path.resolve(VAULT_ROOT, opts.base || opts.previous);
    await fs.access(p);
    return p;
  }
  const files = await listPlanFiles();
  const prev = files
    .filter((f) => f.dateKey < targetYmd && !f.name.startsWith(`${targetYmd}_`))
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey))[0];
  return prev?.path ?? null;
}

function extractSection(content, headings) {
  for (const heading of headings) {
    const start = content.search(new RegExp(`^## ${heading}\\s*$`, "m"));
    if (start < 0) continue;
    const rest = content.slice(start);
    const next = rest.slice(1).search(/^## /m);
    const block = next < 0 ? rest : rest.slice(0, next + 1);
    return `${block.trim()}\n`;
  }
  return "";
}

async function loadTodoFromBase(basePath) {
  if (!basePath) return { section: "", basePath: null };
  const raw = await fs.readFile(basePath, "utf8");
  const section = extractSection(raw, TODO_HEADINGS);
  return { section, basePath };
}

function ebinaToOtemachiMins() {
  return T.ebinaShinjuku + T.shinjukuTransfer + T.shinjukuOtemachi;
}

function otemachiToEbinaMins() {
  return ebinaToOtemachiMins();
}

function buildPlan(opts, todoSection = "") {
  const { y, mo, d, dt, ymd } = parseDate(opts.date);
  const depart = parseTime(opts.depart);
  const returnEbina = parseTime(opts.return);
  const label = dateLabel(mo, d, dt);
  const yyyymm = `${y}${String(mo).padStart(2, "0")}`;

  const tozaiDep = opts["tozai-depart"]
    ? parseTime(opts["tozai-depart"])
    : T.defaultTozaiDep;
  const tozaiArr = opts["tozai-arrive"]
    ? parseTime(opts["tozai-arrive"])
    : tozaiDep + T.otemachiYachiyo;

  const otemachiArr = depart + ebinaToOtemachiMins();
  const morningMins = Math.max(0, tozaiDep - otemachiArr);
  const homeArr = tozaiArr + T.walkHome;

  const outRows = [];
  let t = depart;
  for (const seg of OUT_SEG) {
    const s = t;
    t += T[seg.key];
    outRows.push({
      range: formatRange(s, t),
      event: seg.event,
      note: seg.note,
    });
  }
  if (morningMins > 0) {
    outRows.push({
      range: formatRange(t, t + morningMins),
      event: "大手町（モーニング・丸善）",
      note: `${formatTime(tozaiDep)}東西線発まで`,
    });
    t += morningMins;
  }
  outRows.push({
    range: formatRange(t, t + T.otemachiYachiyo),
    event: "大手町-八千代緑が丘（東西線）",
    note: "東葉直通優先",
  });
  t += T.otemachiYachiyo;
  outRows.push({
    range: formatRange(t, t + T.walkHome),
    event: "（徒歩）星野栞さん宅",
    note: "約5分",
  });

  const backEbinaLeg = otemachiToEbinaMins();
  const homeDepart =
    returnEbina - backEbinaLeg - T.otemachiDinner - T.otemachiYachiyo - T.walkHome;

  const stayMins = homeDepart - homeArr;
  const stayHint =
    stayMins > 0
      ? `約 ${Math.floor(stayMins / 60)} 時間 ${stayMins % 60} 分`
      : "（時刻を要確認）";

  const inRows = buildSegments(homeDepart, [
    { event: "（徒歩）星野栞さん宅", mins: T.walkHome, note: "約5分" },
    { event: "八千代緑が丘-大手町（東西線）", mins: T.otemachiYachiyo, note: "東葉直通優先" },
    { event: "大手町（大戸屋・夕食）", mins: T.otemachiDinner, note: "約1.5時間" },
    { event: "大手町-新宿（千代田線）", mins: T.shinjukuOtemachi, note: "" },
    { event: "（徒歩）新宿", mins: T.shinjukuTransfer, note: "小田急乗換" },
    { event: "新宿-海老名（相鉄・小田急直通）", mins: T.ebinaShinjuku, note: TRANSFER_NOTE },
  ]);

  const fmtRows = (rows) =>
    rows.map((r) => `| ${r.range} | ${r.event} | ${r.note} |`).join("\n");

  const content = `# ${yyyymm} 八千代やること

目的地: 星野栞さん宅（八千代緑が丘駅から徒歩約5分）
ルート: 相鉄・小田急直通 → 新宿 → 千代田線 → 大手町 → 東西線 → 八千代緑が丘

## ${label} 往路

| ${label} | イベント | 注意事項 |
| --- | --- | --- |
${fmtRows(outRows)}

## ${label} 復路

| ${label} | イベント | 注意事項 |
| --- | --- | --- |
| ${formatTime(homeArr)}-${formatTime(homeDepart)} | 星野栞さん宅（滞在目安 ${stayHint}） |  |
${fmtRows(inRows)}
${todoSection ? `\n${todoSection}` : ""}`;

  const outFile =
    opts.output || path.join(VAULT_ROOT, `${ymd}_八千代やること.md`);

  return {
    content,
    outFile,
    label,
    stayHint,
    tozaiDep: formatTime(tozaiDep),
    morningMins,
  };
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.date || !args.depart || !args.return) {
    console.error(
      "Usage: node plan.mjs --date YYYY-MM-DD --depart HH:MM --return HH:MM [--tozai-depart HH:MM] [--base PREV.md]",
    );
    process.exit(1);
  }

  const { ymd } = parseDate(args.date);
  const basePath = await resolveBaseFile(ymd, args);
  const { section: todoSection, basePath: usedBase } = await loadTodoFromBase(basePath);
  const { content, outFile, label, stayHint, tozaiDep, morningMins } = buildPlan(
    args,
    todoSection,
  );

  await fs.writeFile(outFile, content, "utf8");
  console.log(`Written: ${outFile}`);
  console.log(`Date: ${label}`);
  console.log(`Tozai depart (Otemachi): ${tozaiDep}`);
  console.log(`Morning at Otemachi: ${morningMins} min`);
  console.log(`Stay at home (approx): ${stayHint}`);
  console.log(`Todo base: ${usedBase ?? "(なし)"}`);
  console.log("---");
  console.log(content);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
