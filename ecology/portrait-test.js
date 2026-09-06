import { portraitSvg } from "./content/portraits.mjs";

const CHARACTERS = [
  { id: "warden", name: "ゴウ", role: "大槌・前衛", scale: "1.4倍" },
  { id: "lancer", name: "ナギ", role: "槍・前衛", scale: "1.1倍" },
  { id: "mender", name: "ツグミ", role: "支援", scale: "1倍" },
  { id: "guardian", name: "ヒバナ", role: "守り", scale: "1倍" },
  { id: "tactician", name: "ゲンゾウ", role: "参謀", scale: "1.1倍" },
];

const figures = document.querySelector("#portrait-test-figures");
const legend = document.querySelector("#portrait-test-legend");

figures.innerHTML = CHARACTERS.map((character) =>
  "<div class=\"vn-figure portrait-test-figure\" data-character=\"" + character.id
    + "\" aria-label=\"" + character.name + "\">"
    + portraitSvg(character.id)
    + "</div>"
).join("");

legend.innerHTML = CHARACTERS.map((character) =>
  "<div><b>" + character.name + "</b><small>" + character.role + " · " + character.scale + "</small></div>"
).join("");
