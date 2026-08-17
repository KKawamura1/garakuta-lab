import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { webcrypto } from "node:crypto";

const html = await readFile(new URL("../cycle/index.html", import.meta.url), "utf8");
const source = await readFile(new URL("../cycle/app.js", import.meta.url), "utf8");
const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map(match => match[1]));

class ClassList {
  values = new Set();
  toggle(name, force) {
    if (force === undefined ? !this.values.has(name) : force) this.values.add(name);
    else this.values.delete(name);
  }
  add(name) { this.values.add(name); }
}

class Element {
  constructor(id = "") {
    this.id = id;
    this.children = [];
    this.classList = new ClassList();
    this.style = { setProperty() {} };
    this.listeners = {};
    this.dataset = {};
    this.disabled = false;
    this.open = false;
    this.textContent = "";
    this.innerHTML = "";
  }
  addEventListener(type, listener) { this.listeners[type] = listener; }
  appendChild(child) { this.children.push(child); return child; }
  append(...children) { this.children.push(...children); }
  closest() { return null; }
  querySelector(selector) {
    const match = selector.match(/data-move="([^"]+)"/);
    if (match) return moveButtons[match[1]];
    return new Element();
  }
  querySelectorAll(selector) { return selector === "[data-move]" ? Object.values(moveButtons) : []; }
  showModal() { this.open = true; }
  close() { this.open = false; }
  reset() {}
}

const elements = Object.fromEntries([...ids].map(id => [id, new Element(id)]));
const moveButtons = Object.fromEntries(["left", "right", "bench", "active"].map(move => {
  const button = new Element();
  button.dataset.move = move;
  return [move, button];
}));
const storage = new Map();
const context = vm.createContext({
  console,
  crypto: webcrypto,
  navigator: { language: "ja-JP" },
  innerWidth: 390,
  innerHeight: 844,
  matchMedia: () => ({ matches: false }),
  addEventListener() {},
  localStorage: {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value)
  },
  document: {
    querySelector(selector) {
      if (selector.startsWith("#")) {
        const id = selector.slice(1);
        assert(ids.has(id), `HTMLに #${id} がない`);
        return elements[id];
      }
      throw new Error(`未対応のselector: ${selector}`);
    },
    querySelectorAll(selector) { return selector === "[data-move]" ? Object.values(moveButtons) : []; },
    createElement: () => new Element()
  },
  FormData: class {
    get() { return ""; }
  },
  fetch: async () => ({ ok: true }),
  clearTimeout() {},
  setTimeout(callback, delay) {
    if (delay < 600) callback();
    return 1;
  }
});

vm.runInContext(source, context, { filename: "cycle/app.js" });
assert.equal(vm.runInContext("state.modules.length", context), 3);
assert.equal(vm.runInContext("activeModules().length", context), 3);

vm.runInContext("selectedId = activeModules()[1].id; moveSelected('left')", context);
assert.equal(vm.runInContext("state.stats.moves", context), 1);

await vm.runInContext("startBattle()", context);
assert.equal(vm.runInContext("state.stats.victories", context), 1, "初期3機構では必ず初戦を越えられる");
assert.equal(vm.runInContext("state.pendingReward.candidates.length", context), 2);

vm.runInContext("chooseReward(state.pendingReward.candidates[0].id)", context);
assert.equal(vm.runInContext("state.wave", context), 1);
assert.equal(vm.runInContext("state.modules.length", context), 4);
assert.equal(vm.runInContext("benchModules().length", context), 1);

vm.runInContext("selectedId = benchModules()[0].id; moveSelected('active')", context);
assert.equal(vm.runInContext("activeModules().length", context), 4);
assert.equal(vm.runInContext("payload().gameVersion", context), "cycle-0.1");
assert(vm.runInContext("state.events.some(event => event.type === 'battle_ended')", context));

console.log("cycle smoke: initialization, reorder, battle, reward, activation, telemetry OK");
