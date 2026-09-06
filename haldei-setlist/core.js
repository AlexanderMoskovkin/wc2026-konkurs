import { SONGS, DEFAULT_ORDER } from './data.js';
export { SONGS, DEFAULT_ORDER };
export const STORAGE_KEY = 'haldei.setlist.v1';
export const BREAK_ID = 'intermission';
export const BY_ID = new Map(SONGS.map(song => [song.id, song]));

export function validateOrder(order) {
  if (!Array.isArray(order) || order.length !== SONGS.length + 1 ||
      order.some(id => typeof id !== 'string' || (!BY_ID.has(id) && id !== BREAK_ID)) ||
      new Set(order).size !== order.length || !order.includes(BREAK_ID)) {
    throw new Error('Нужны все 25 композиций и один перерыв, без повторов.');
  }
  return [...order];
}

export function encode(order) {
  return JSON.stringify({ format: 'haldei-setlist', version: 1, order: validateOrder(order) }, null, 2);
}

export function decode(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('Файл не читается как JSON. Текущий порядок сохранён.'); }
  if (!data || data.format !== 'haldei-setlist' || data.version !== 1) {
    throw new Error('Нужен JSON, скачанный из этого редактора (версия 1).');
  }
  return validateOrder(data.order);
}

export function duration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60) % 60;
  const rest = String(seconds % 60).padStart(2, '0');
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`;
}

export function summarize(order) {
  const parts = [{ seconds: 0, songs: 0, intro: false }, { seconds: 0, songs: 0, intro: false }];
  let section = 0;
  for (const id of validateOrder(order)) {
    if (id === BREAK_ID) { section = 1; continue; }
    const song = BY_ID.get(id);
    parts[section].seconds += song.seconds;
    if (id === 'song-00') parts[section].intro = true;
    else parts[section].songs++;
  }
  return parts;
}

export function move(order, id, target) {
  const next = validateOrder(order);
  if (!next.includes(id) || !Number.isInteger(target) || target < 0 || target >= next.length) throw new Error('Неверная позиция.');
  next.splice(next.indexOf(id), 1);
  next.splice(target, 0, id);
  return next;
}

export function songCount(n) {
  const form = n % 10 === 1 && n % 100 !== 11 ? 'песня' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'песни' : 'песен';
  return `${n} ${form}`;
}
