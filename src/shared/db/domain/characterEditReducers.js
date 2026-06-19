import { normalizeCharacterRuntimeShape } from "./characterShape.js";

function toFiniteNumber(value, fallback = 0) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function roundMoney(value) {
  return Number.parseFloat(toFiniteNumber(value, 0).toFixed(2));
}

function normalizeBase(character) {
  return normalizeCharacterRuntimeShape(character);
}

export function setCharacterGold(character, amount) {
  const next = normalizeBase(character);
  next.gold = roundMoney(Math.max(0, toFiniteNumber(amount, 0)));
  return next;
}

export function adjustCharacterGold(character, amount) {
  const next = normalizeBase(character);
  return setCharacterGold(next, toFiniteNumber(next.gold, 0) + toFiniteNumber(amount, 0));
}

export function setCharacterAttribute(character, key, value) {
  const next = normalizeBase(character);
  next.stats.attributes[key] = toFiniteNumber(value, 0);
  return next;
}

export function adjustCharacterAttribute(character, key, amount) {
  const next = normalizeBase(character);
  return setCharacterAttribute(
    next,
    key,
    toFiniteNumber(next.stats.attributes[key], 0) + toFiniteNumber(amount, 0)
  );
}

export function setCharacterHp(character, value) {
  const next = normalizeBase(character);
  next.stats.hp.current = Math.max(0, toFiniteNumber(value, 0));
  return next;
}

export function adjustCharacterHp(character, amount) {
  const next = normalizeBase(character);
  return setCharacterHp(next, toFiniteNumber(next.stats.hp.current, 0) + toFiniteNumber(amount, 0));
}

export function setCharacterTempHp(character, value) {
  const next = normalizeBase(character);
  next.stats.hp.temp = Math.max(0, toFiniteNumber(value, 0));
  return next;
}

export function adjustCharacterTempHp(character, amount) {
  const next = normalizeBase(character);
  return setCharacterTempHp(next, toFiniteNumber(next.stats.hp.temp, 0) + toFiniteNumber(amount, 0));
}

export function setCharacterMaxHp(character, value) {
  const next = normalizeBase(character);
  next.stats.hp.max = Math.max(1, toFiniteNumber(value, 1));
  return next;
}

export function adjustCharacterMaxHp(character, amount) {
  const next = normalizeBase(character);
  return setCharacterMaxHp(next, toFiniteNumber(next.stats.hp.max, 1) + toFiniteNumber(amount, 0));
}

export function setCharacterSpeed(character, key, value) {
  const next = normalizeBase(character);
  next.stats.speed[key] = Math.max(0, toFiniteNumber(value, 0));
  return next;
}

export function adjustCharacterSpeed(character, key, amount) {
  const next = normalizeBase(character);
  return setCharacterSpeed(next, key, toFiniteNumber(next.stats.speed[key], 0) + toFiniteNumber(amount, 0));
}

export function setCharacterClassDc(character, value) {
  const next = normalizeBase(character);
  next.stats.class_dc = Math.max(0, toFiniteNumber(value, 10));
  return next;
}

export function adjustCharacterClassDc(character, amount) {
  const next = normalizeBase(character);
  return setCharacterClassDc(next, toFiniteNumber(next.stats.class_dc, 10) + toFiniteNumber(amount, 0));
}

export function setCharacterDailyCraftingMax(character, value) {
  const next = normalizeBase(character);
  next.dailyCraftingMax = Math.max(0, Math.trunc(toFiniteNumber(value, 0)));
  return next;
}
