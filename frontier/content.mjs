export const ALLY_UNITS = Object.freeze({
  ram: {
    id: "ram",
    name: "衝角機",
    maxHp: 6,
    armor: 0,
    action: { type: "attack", target: "front", power: 6 },
  },
  echo: {
    id: "echo",
    name: "追響機",
    maxHp: 4,
    armor: 0,
    action: { type: "echo", divisor: 2 },
  },
  capacitor: {
    id: "capacitor",
    name: "蓄電機",
    maxHp: 5,
    armor: 0,
    action: { type: "charge_next", amount: 2 },
  },
  cannon: {
    id: "cannon",
    name: "集束砲機",
    maxHp: 5,
    armor: 0,
    action: { type: "charged_attack", target: "front", basePower: 2, powerPerCharge: 4 },
  },
  guard: {
    id: "guard",
    name: "防壁機",
    maxHp: 5,
    armor: 0,
    action: { type: "shield_front", amount: 3 },
  },
  sniper: {
    id: "sniper",
    name: "狙撃機",
    maxHp: 4,
    armor: 0,
    action: { type: "attack", target: "objective_or_rear", power: 3 },
  },
});

export const ENEMY_UNITS = Object.freeze({
  drone: {
    id: "drone",
    name: "小型機",
    maxHp: 3,
    armor: 0,
    action: { type: "attack", target: "front", power: 1 },
  },
  bastion: {
    id: "bastion",
    name: "防塞機",
    maxHp: 12,
    armor: 3,
    action: { type: "attack", target: "front", power: 1 },
  },
  artillery: {
    id: "artillery",
    name: "遠砲機",
    maxHp: 5,
    armor: 0,
    action: { type: "scheduled_barrage", beat: 3, power: 6 },
  },
});

export const DOCTRINES = Object.freeze({
  none: { id: "none", name: "指令なし" },
  overrun: { id: "overrun", name: "貫通処理", overflow: true },
  double_echo: { id: "double_echo", name: "二重追響", echoCount: 2 },
  brace: { id: "brace", name: "構え", braceShield: 3 },
});

export const MISSIONS = Object.freeze({
  connection: {
    id: "connection",
    name: "接続試験",
    maxBeats: 3,
    enemies: ["drone", "drone"],
    objective: { type: "eliminate_all" },
  },
  swarm: {
    id: "swarm",
    name: "群集線",
    maxBeats: 3,
    enemies: ["drone", "drone", "drone", "drone", "drone", "drone"],
    objective: { type: "eliminate_all" },
  },
  fortress: {
    id: "fortress",
    name: "遠砲要塞",
    maxBeats: 3,
    enemies: ["bastion", "artillery"],
    objective: { type: "destroy_unit", unitId: "artillery" },
  },
});

export const SQUAD_PRESETS = Object.freeze({
  burst: { id: "burst", units: ["ram", "echo"] },
  heavy: { id: "heavy", units: ["capacitor", "cannon"] },
  snipe: { id: "snipe", units: ["guard", "sniper"] },
});
