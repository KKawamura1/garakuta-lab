import { createRun } from "../core/run.mjs";
import { renderObservation } from "../core/render.mjs";
import { describeRun } from "../core/metrics.mjs";
import { PREDICTIONS, WORRY_CATEGORIES, UPDATE_KINDS, MARKER_KINDS } from "../core/arc.mjs";

const SAVE_KEY = "garakuta-agent-view-session";
const $ = selector => document.querySelector(selector);

let session = load();
let run = rebuild();
let message = "";

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (saved?.seed !== undefined && Array.isArray(saved.actions)) return saved;
  } catch (_) {}
  return fresh();
}

function fresh() {
  return {
    seed: Math.floor(Math.random() * 100000),
    playerId: "human-agent-view",
    startedAt: new Date().toISOString(),
    actions: [], survey: null
  };
}

function rebuild() {
  const next = createRun({ seed: session.seed, playerId: session.playerId });
  session.actions.forEach(action => next.act(action));
  return next;
}

function persist() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(session));
  $("#json").value = JSON.stringify(session, null, 2);
}

function act(action) {
  const result = run.act(action);
  if (!result.ok) {
    message = `✗ ${result.error}`;
  } else {
    session.actions.push(action);
    message = `✓ ${action.type}`;
    persist();
  }
  draw();
}

function el(tag, props = {}, children = []) {
  const node = Object.assign(document.createElement(tag), props);
  children.forEach(child => node.appendChild(child));
  return node;
}

function row(...children) {
  return el("div", { className: "row" }, children);
}

function select(options, mapper = value => value) {
  const node = el("select");
  options.forEach(option => node.appendChild(el("option", { value: mapper(option), textContent: String(option.label ?? option) })));
  return node;
}

function draw() {
  const observation = run.observe();
  $("#view").textContent = renderObservation(observation);
  const controls = $("#controls");
  controls.innerHTML = "";

  if (observation.done) {
    if (session.survey) {
      controls.appendChild(el("p", { className: "msg", textContent: "アンケートは記録済みです。「新しいラン」で次へ。" }));
      return;
    }
    controls.appendChild(surveyForm());
    return;
  }

  if (observation.phase === "reward") {
    const reason = el("input", { type: "text", placeholder: "選んだ理由" });
    const update = select(UPDATE_KINDS);
    controls.appendChild(row(el("label", { textContent: "報酬" }), reason, update));
    const buttons = observation.offer.map(item => el("button", {
      className: "primary",
      textContent: `${item.choice}. ${item.part.name}`,
      onclick: () => act({ type: "take", choice: item.choice, reason: reason.value, update: update.value, updateText: "" })
    }));
    buttons.push(el("button", {
      textContent: "全部見送る（◆2）",
      onclick: () => act({ type: "skipAll", reason: reason.value })
    }));
    controls.appendChild(row(...buttons));
    controls.appendChild(markRow());
    controls.appendChild(el("p", { className: "msg", textContent: message }));
    return;
  }

  const parts = select(observation.inventory.map(part => ({ label: `${part.id} ${part.name}`, value: part.id })), option => option.value);
  const slots = select([1, 2, 3, 4, 5]);
  const slotsB = select([1, 2, 3, 4, 5]);
  controls.appendChild(row(
    parts, slots,
    el("button", { textContent: "置く", onclick: () => act({ type: "place", partId: parts.value, slot: slots.value }) }),
    el("button", { textContent: "外す", onclick: () => act({ type: "remove", slot: slots.value }) }),
    el("button", { textContent: "分解◆1", onclick: () => act({ type: "scrapPart", partId: parts.value }) })
  ));
  controls.appendChild(row(
    el("label", { textContent: "入替" }), slots.cloneNode(true), slotsB,
    el("button", {
      textContent: "枠を入れ替える",
      onclick: () => act({ type: "swap", slotA: slots.value, slotB: slotsB.value })
    }),
    el("button", { textContent: "修復◆1でHP+5", onclick: () => act({ type: "repair" }) })
  ));

  const prediction = select(PREDICTIONS);
  const worry = select(WORRY_CATEGORIES);
  const worryText = el("input", { type: "text", placeholder: "なぜそう思うか" });
  controls.appendChild(row(el("label", { textContent: "戦う前に" }), prediction, worry, worryText));
  controls.appendChild(row(el("button", {
    className: "primary",
    textContent: "このガラクタで戦う",
    onclick: () => act({ type: "battle", prediction: prediction.value, worry: worry.value, worryText: worryText.value })
  })));
  controls.appendChild(markRow());
  controls.appendChild(el("p", { className: "msg", textContent: message }));
}

function markRow() {
  const kind = select(MARKER_KINDS);
  const note = el("input", { type: "text", placeholder: "ひとこと（任意）" });
  return row(
    el("label", { textContent: "気持ち" }), kind, note,
    el("button", { textContent: "記録", onclick: () => act({ type: "mark", kind: kind.value, note: note.value }) })
  );
}

function surveyForm() {
  const replay = select([1, 2, 3, 4, 5]);
  const settledAt = el("input", { type: "text", placeholder: "勝敗が実質決まった戦闘番号（なければ なし）" });
  const bestMoment = el("input", { type: "text", placeholder: "一番良かった瞬間" });
  const friction = el("input", { type: "text", placeholder: "退屈・理不尽だったところ" });
  const pivot = select(["あった", "なかった"]);
  const runStory = el("input", { type: "text", placeholder: "このランを一言で" });
  const wrap = el("div", { className: "controls" }, [
    row(el("label", { textContent: "もう一度遊びたいか" }), replay, el("label", { textContent: "方針転換" }), pivot),
    row(settledAt), row(bestMoment), row(friction), row(runStory),
    row(el("button", {
      className: "primary",
      textContent: "記録する",
      onclick: () => {
        const survey = {
          replay: Number(replay.value), settledAt: settledAt.value || "なし",
          bestMoment: bestMoment.value, friction: friction.value,
          pivot: pivot.value, runStory: runStory.value
        };
        session.survey = survey;
        session.trace = run.finish(survey);
        session.metrics = describeRun(session.trace);
        persist();
        message = "記録しました。下の「記録を取り出す」からJSONをコピーできます。";
        draw();
      }
    }))
  ]);
  return wrap;
}

$("#newRun").addEventListener("click", () => {
  if (!confirm("今のランを捨てて新しく始めますか？")) return;
  session = fresh();
  run = rebuild();
  message = "";
  persist();
  draw();
});

$("#copyJson").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText($("#json").value);
    message = "コピーしました。";
  } catch (_) {
    $("#json").select();
    message = "選択しました。手動でコピーしてください。";
  }
  draw();
});

persist();
draw();
