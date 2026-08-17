import { readFile } from "node:fs/promises";

const rows = JSON.parse(await readFile(new URL("./emotional-arc-observations.json", import.meta.url), "utf8"));

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function round(value, digits = 2) {
  if (value === null || Number.isNaN(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function splitMetric(source, field) {
  const known = source.filter(row => row[field] !== null && row[field] !== undefined);
  const yes = known.filter(row => Boolean(row[field])).map(row => row.replay);
  const no = known.filter(row => !row[field]).map(row => row.replay);
  return {
    yesN: yes.length,
    yesMean: round(mean(yes)),
    noN: no.length,
    noMean: round(mean(no)),
    difference: round(mean(yes) - mean(no)),
  };
}

function correlation(source, xField, yField) {
  const known = source.filter(row => Number.isFinite(row[xField]) && Number.isFinite(row[yField]));
  const xs = known.map(row => row[xField]);
  const ys = known.map(row => row[yField]);
  const xMean = mean(xs);
  const yMean = mean(ys);
  const numerator = known.reduce((sum, row) => sum + (row[xField] - xMean) * (row[yField] - yMean), 0);
  const xDenominator = Math.sqrt(xs.reduce((sum, value) => sum + (value - xMean) ** 2, 0));
  const yDenominator = Math.sqrt(ys.reduce((sum, value) => sum + (value - yMean) ** 2, 0));
  return round(numerator / (xDenominator * yDenominator), 3);
}

function summarize(source) {
  return {
    runs: source.length,
    replayMean: round(mean(source.map(row => row.replay))),
    peak: splitMetric(source, "peak"),
    pivot: splitMetric(source, "pivot"),
    won: splitMetric(source, "won"),
    fullHp: splitMetric(source.map(row => ({ ...row, fullHp: row.finalHp === 30 })), "fullHp"),
    exposureReplayCorrelation: correlation(source, "sequence", "replay"),
  };
}

const obs = rows.filter(row => row.family === "OBS");
const obs01 = rows.filter(row => row.version === "observe-0.1");
const output = {
  caveat: "探索的な単一プレイヤー観測。因果推論や普遍的な面白さスコアではない。",
  all: summarize(rows),
  obs: summarize(obs),
  obs01: summarize(obs01),
  positiveAnchors: rows.filter(row => row.replay >= 4).map(row => ({
    id: row.id,
    version: row.version,
    won: row.won,
    peak: row.peak,
    pivot: row.pivot,
    wishlist: row.wishlist,
    bestMoment: row.bestMoment,
  })),
};

console.log(JSON.stringify(output, null, 2));
