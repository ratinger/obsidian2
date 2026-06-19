#!/usr/bin/env node
/**
 * 3_nagoya — 海老名⇔総合リハビリセンター（こだま + 地下鉄・東山線回避）
 *
 * 名古屋市内ルート（路線図準拠）:
 * - 名古屋↔御器所: 桜通線（東山線不使用）
 * - 御器所↔八事: 鶴舞線（名城線ではない）
 * - 八事↔総合リハビリセンター: 名城線
 */
import fs from "node:fs/promises";
import path from "node:path";

const VAULT_ROOT = process.cwd();
const WEEKDAY = ["日", "月", "火", "水", "木", "金", "土"];
const KODAMA_DURATION_MIN = 138;
const SUBWAY_NOTE = "東山線は使わない";
const DIRECT_NOTE = "相鉄直通・乗り換えなし";

const T = {
  ebinaShinyoko: 36,
  shinyokoEbina: 36,
  shinyokoShinkansenToSotetsu: 10,
  shinyokoPrepBeforeKodama: 17,
  nagoyaShinkansenToSubway: 10,
  nagoyaSubwayToShinkansen: 10,
  nagoyaStationBuffer: 70,
  sakuraNagoyaGokiso: 15,
  transferGokisoSakuraTsurumai: 5,
  tsurumaiGokisoYagoto: 5,
  transferYagotoTsurumaiMeijo: 5,
  meijoYagotoRehabSta: 2,
  rehabStaToFacility: 3,
  subwayWaitAfterShinkansen: 5,
};

const DIRECT_TRAIN = { dep: 22 * 60 + 22, arr: 22 * 60 + 58 };

/** 往路: 名古屋→総合リハビリ（御器所経由） */
const GOKISO_OUT = [
  { event: "（徒歩）名古屋駅", mins: T.nagoyaShinkansenToSubway, note: "新幹線⇔地下鉄・約10分" },
  { event: "名古屋-御器所（桜通線）", mins: T.sakuraNagoyaGokiso, note: SUBWAY_NOTE },
  { event: "（徒歩）御器所", mins: T.transferGokisoSakuraTsurumai, note: "桜通⇔鶴舞乗換・約5分" },
  { event: "御器所-八事（鶴舞線）", mins: T.tsurumaiGokisoYagoto, note: "名城線ではない" },
  { event: "（徒歩）八事", mins: T.transferYagotoTsurumaiMeijo, note: "鶴舞⇔名城乗換・約5分" },
  { event: "八事-総合リハビリセンター（名城線）", mins: T.meijoYagotoRehabSta, note: "1駅・約2分" },
  { event: "（徒歩）総合リハビリセンター", mins: T.rehabStaToFacility, note: "駅⇔施設・約3分" },
];

/** 復路 */
const GOKISO_IN = [
  { event: "（徒歩）総合リハビリセンター", mins: T.rehabStaToFacility, note: "施設⇔駅・約3分" },
  { event: "総合リハビリセンター-八事（名城線）", mins: T.meijoYagotoRehabSta, note: "" },
  { event: "（徒歩）八事", mins: T.transferYagotoTsurumaiMeijo, note: "名城⇔鶴舞乗換・約5分" },
  { event: "八事-御器所（鶴舞線）", mins: T.tsurumaiGokisoYagoto, note: "名城線ではない" },
  { event: "（徒歩）御器所", mins: T.transferGokisoSakuraTsurumai, note: "鶴舞⇔桜通乗換・約5分" },
  { event: "御器所-名古屋（桜通線）", mins: T.sakuraNagoyaGokiso, note: SUBWAY_NOTE },
  { event: "（徒歩）名古屋駅", mins: T.nagoyaSubwayToShinkansen, note: "地下鉄⇔新幹線・約10分" },
];

function normalizeKodamaTrain(name, fallback = "こだま（号数要確認）") {
  if (!name) return fallback;
  const s = String(name).trim();
  if (/のぞみ|ひかり/i.test(s)) throw new Error(`こだまのみ使用可能です: ${s}`);
  if (/こだま/.test(s)) return s;
  if (/^\d+号?$/.test(s)) return `こだま${s.replace(/号$/, "")}`;
  return `こだま${s}`;
}

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

const TODO_HEADINGS = ["ToDoリスト", "優先項目"];

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
    .filter((n) => n.includes("名古屋やること") && n.endsWith(".md"))
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
  if (prev) return prev.path;
  const fallback = path.join(VAULT_ROOT, "202605 名古屋やること.md");
  try {
    await fs.access(fallback);
    return fallback;
  } catch {
    return null;
  }
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

function pickDirectLocalBack(arriveShinyoko, opts) {
  if (opts["local-back-depart"] && opts["local-back-arrive"]) {
    return {
      range: formatRange(
        parseTime(opts["local-back-depart"]),
        parseTime(opts["local-back-arrive"]),
      ),
      note: DIRECT_NOTE,
      waitRange: null,
    };
  }
  const atSotetsu = arriveShinyoko + T.shinyokoShinkansenToSotetsu;
  const dep = Math.max(DIRECT_TRAIN.dep, atSotetsu + 5);
  const duration = DIRECT_TRAIN.arr - DIRECT_TRAIN.dep;
  return {
    range: formatRange(dep, dep + duration),
    waitRange: dep > atSotetsu ? formatRange(atSotetsu, dep) : null,
    note: DIRECT_NOTE,
  };
}

function buildPlan(opts, todoSection = "") {
  const { y, mo, d, dt, ymd } = parseDate(opts.date);
  const depart = parseTime(opts.depart);
  const label = dateLabel(mo, d, dt);
  const yyyymm = `${y}${String(mo).padStart(2, "0")}`;

  const shinyokoArrive = depart + T.ebinaShinyoko;
  const shinyokoPrepEnd = shinyokoArrive + T.shinyokoPrepBeforeKodama;

  const outDepart = opts["out-depart"]
    ? parseTime(opts["out-depart"])
    : shinyokoPrepEnd + 15;
  const outArrive = opts["out-arrive"]
    ? parseTime(opts["out-arrive"])
    : outDepart + KODAMA_DURATION_MIN;
  const outTrain = normalizeKodamaTrain(opts["out-train"]);

  const subwayOutStart = outArrive + T.subwayWaitAfterShinkansen;
  const subwayOutRows = buildSegments(subwayOutStart, GOKISO_OUT);
  const rehabArrive = subwayOutStart + GOKISO_OUT.reduce((s, x) => s + x.mins, 0);

  const backArriveShinyoko = opts["back-arrive"]
    ? parseTime(opts["back-arrive"])
    : parseTime(opts.return) - T.shinyokoEbina;
  const backDepartNagoya = opts["back-depart"]
    ? parseTime(opts["back-depart"])
    : backArriveShinyoko - KODAMA_DURATION_MIN;
  const backTrain = normalizeKodamaTrain(opts["back-train"]);

  const shinkansenReadyBy = backDepartNagoya - T.nagoyaStationBuffer;
  const subwayInTotal = GOKISO_IN.reduce((s, x) => s + x.mins, 0);
  const rehabDepart = shinkansenReadyBy - T.nagoyaSubwayToShinkansen - subwayInTotal;

  const subwayInRows = buildSegments(rehabDepart, GOKISO_IN);
  const nagoyaWaitRange = formatRange(shinkansenReadyBy, backDepartNagoya);
  const localBack = pickDirectLocalBack(backArriveShinyoko, opts);

  const stayAtRehab = rehabDepart - rehabArrive;
  const stayHint =
    stayAtRehab > 0
      ? `約 ${Math.floor(stayAtRehab / 60)} 時間 ${stayAtRehab % 60} 分`
      : "（時刻を要確認）";

  const fmtRows = (rows) =>
    rows.map((r) => `| ${r.range} | ${r.event} | ${r.note} |`).join("\n");

  const content = `# ${yyyymm} 名古屋やること

市内ルート: 桜通線→鶴舞線→名城線（御器所経由）／東山線不使用

## ${label} 往路

| ${label} | イベント | 注意事項 |
| --- | --- | --- |
| ${formatRange(depart, shinyokoArrive)} | 海老名⇒新横浜 | ${DIRECT_NOTE} |
| ${formatRange(shinyokoArrive, shinyokoPrepEnd)} | （徒歩）新横浜駅 | トイレ・朝食・新幹線へ・約17分 |
| ${formatRange(outDepart, outArrive)} | ${outTrain} / 新横浜→名古屋 |  |
${fmtRows(subwayOutRows)}

## ${label} 復路

| ${label} | イベント | 注意事項 |
| --- | --- | --- |
| ${formatTime(rehabArrive)}-${formatTime(rehabDepart)} | 総合リハビリセンター（滞在目安 ${stayHint}） |  |
${fmtRows(subwayInRows)}
| ${nagoyaWaitRange} | 名古屋駅（新幹線ホーム待合） | 余裕約1時間10分 |
| ${formatRange(backDepartNagoya, backArriveShinyoko)} | ${backTrain} / 名古屋→新横浜 |  |
| ${formatRange(backArriveShinyoko, backArriveShinyoko + T.shinyokoShinkansenToSotetsu)} | （徒歩）新横浜駅 | 新幹線⇔相鉄・約10分 |
${localBack.waitRange ? `| ${localBack.waitRange} | 相鉄ホーム待機 | 直通発車まで |\n` : ""}| ${localBack.range} | 新横浜⇒海老名 | ${localBack.note} |
${todoSection ? `\n${todoSection}` : ""}`;

  const outFile =
    opts.output || path.join(VAULT_ROOT, `${ymd}_名古屋やること.md`);

  return { content, outFile, label, stayHint, ymd };
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.date || !args.depart || !args.return) {
    console.error(
      "Usage: node plan.mjs --date YYYY-MM-DD --depart HH:MM --return HH:MM [--base PREV.md] [--out-train ...] ...",
    );
    process.exit(1);
  }

  const { ymd } = parseDate(args.date);
  const basePath = await resolveBaseFile(ymd, args);
  const { section: todoSection, basePath: usedBase } = await loadTodoFromBase(basePath);
  const { content, outFile, label, stayHint } = buildPlan(args, todoSection);

  await fs.writeFile(outFile, content, "utf8");
  console.log(`Written: ${outFile}`);
  console.log(`Date: ${label}`);
  console.log(`Stay at rehab (approx): ${stayHint}`);
  console.log(`Todo base: ${usedBase ?? "(なし)"}`);
  console.log("---");
  console.log(content);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
