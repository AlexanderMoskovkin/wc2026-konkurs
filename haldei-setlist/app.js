import { DEFAULT_ORDER, STORAGE_KEY, BREAK_ID, BY_ID, validateOrder, encode, decode, duration, summarize, songCount, move } from './core.js';

const $ = id => document.getElementById(id);
const list = $('setlist');
let order = [...DEFAULT_ORDER];
let gesture = null;
let ignoreClickUntil = 0;
let importRequest = 0;

function announce(text) { $('announcement').textContent = text; }
function notice(text = '') { $('notice').textContent = text; $('notice').hidden = !text; }
function saved(ok) {
  $('save-state').textContent = ok ? 'Сохранено' : 'Не сохранено';
  $('save-state').classList.toggle('error', !ok);
}
function persist() {
  try { localStorage.setItem(STORAGE_KEY, encode(order)); saved(true); return true; }
  catch { saved(false); notice('Браузер не разрешил сохранение. Скачай JSON, чтобы не потерять порядок.'); return false; }
}
try {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw !== null) order = decode(raw);
  $('save-state').textContent = raw === null ? 'Исходный порядок' : 'Сохранено';
} catch {
  saved(false);
  notice('Не удалось восстановить сохранённый список. Показан исходный порядок. Старые данные не перезаписаны.');
}

function fromDOM() { return [...list.children].map(row => row.dataset.id); }
function titleOf(id) { return id === BREAK_ID ? 'Перерыв' : BY_ID.get(id).title; }
function updateSummary(ids = order) {
  const parts = summarize(ids);
  parts.forEach((part, index) => {
    $(`time-${index + 1}`).textContent = duration(part.seconds);
    $(`count-${index + 1}`).textContent = songCount(part.songs) + (part.intro ? ' + вступление' : '');
  });
  $('time-all').textContent = duration(parts[0].seconds + parts[1].seconds);
  let number = 0;
  for (const [index, row] of [...list.children].entries()) {
    if (row.dataset.id === BREAK_ID) {
      number = 0;
      row.querySelector('.song-meta').textContent = `Дальше II отделение · ${duration(parts[1].seconds)}`;
    } else {
      row.querySelector('.number').textContent = row.dataset.id === 'song-00' ? '♪' : String(++number).padStart(2, '0');
    }
    row.querySelector('[data-action="up"]').disabled = index === 0;
    row.querySelector('[data-action="down"]').disabled = index === ids.length - 1;
  }
}
function rowFor(id) { return [...list.children].find(row => row.dataset.id === id); }
function reorderDOM(ids) { for (const id of ids) list.append(rowFor(id)); updateSummary(ids); }
function closeMenus() {
  for (const row of list.children) {
    row.querySelector('.move-actions').hidden = true;
    row.querySelector('.handle').setAttribute('aria-expanded', 'false');
  }
}
function render() {
  list.replaceChildren();
  for (const id of order) {
    const row = document.createElement('li');
    row.dataset.id = id;
    row.className = id === BREAK_ID ? 'intermission' : 'song';
    if (id !== BREAK_ID) {
      const number = document.createElement('span'); number.className = 'number'; number.setAttribute('aria-hidden', 'true'); row.append(number);
    }
    const info = document.createElement('div'); info.className = 'song-info';
    const title = document.createElement('div'); title.className = 'song-title'; title.textContent = id === BREAK_ID ? 'Перерыв · 15 мин' : titleOf(id); title.title = title.textContent;
    const meta = document.createElement('div'); meta.className = 'song-meta';
    if (id !== BREAK_ID) {
      const song = BY_ID.get(id);
      const time = document.createElement('span'); time.textContent = duration(song.seconds); time.title = 'Длительность · мин:сек';
      const bpm = document.createElement('span'); bpm.textContent = song.bpm === null ? '—' : String(song.bpm);
      bpm.title = song.bpm === null ? 'Темп не указан' : `${song.bpm} BPM`; bpm.setAttribute('aria-label', bpm.title);
      meta.append(time, bpm);
    }
    info.append(title, meta); row.append(info);
    const handle = document.createElement('button');
    handle.type = 'button'; handle.className = 'handle'; handle.textContent = '⠿';
    handle.setAttribute('aria-label', `Переместить: ${titleOf(id)}`);
    handle.setAttribute('aria-expanded', 'false');
    handle.title = 'Перетащи или нажми для кнопок перемещения. На клавиатуре — стрелки вверх/вниз.';
    row.append(handle);
    const actions = document.createElement('div'); actions.className = 'move-actions'; actions.hidden = true;
    for (const [action, text, label] of [['up', '↑ Выше', 'Поднять'], ['down', '↓ Ниже', 'Опустить'], ['close', 'Готово', 'Закончить перемещение']]) {
      const button = document.createElement('button'); button.type = 'button'; button.dataset.action = action;
      button.textContent = text; button.setAttribute('aria-label', `${label}: ${titleOf(id)}`); actions.append(button);
    }
    row.append(actions); list.append(row);
  }
  updateSummary();
}
function commit(ids) { order = validateOrder(ids); notice(); updateSummary(); persist(); }
function step(id, direction, focusHandle = false) {
  const index = order.indexOf(id);
  const nextIndex = Math.max(0, Math.min(order.length - 1, index + direction));
  if (nextIndex === index) return;
  const next = move(order, id, nextIndex);
  reorderDOM(next); commit(next);
  announce(`${titleOf(id)}: позиция ${nextIndex + 1}.`);
  if (focusHandle) rowFor(id).querySelector('.handle').focus({ preventScroll: true });
  rowFor(id).scrollIntoView({ block: 'nearest' });
}
list.addEventListener('click', event => {
  if (performance.now() < ignoreClickUntil) return;
  const row = event.target.closest('li[data-id]'); if (!row) return;
  const id = row.dataset.id;
  if (event.target.closest('.handle')) {
    const open = row.querySelector('.move-actions').hidden;
    closeMenus(); row.querySelector('.move-actions').hidden = !open;
    row.querySelector('.handle').setAttribute('aria-expanded', String(open));
  }
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'up' || action === 'down') step(id, action === 'up' ? -1 : 1);
  if (action === 'close') { closeMenus(); row.querySelector('.handle').focus(); }
});
list.addEventListener('keydown', event => {
  const handle = event.target.closest('.handle');
  if (!handle || gesture || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
  event.preventDefault(); step(handle.closest('li').dataset.id, event.key === 'ArrowUp' ? -1 : 1, true);
});

function positionDrag() {
  const g = gesture; if (!g?.active) return;
  g.ghost.style.top = `${g.y - g.offsetY}px`;
  const before = [...list.children].find(row => row !== g.row && g.y < row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2);
  if (before) list.insertBefore(g.row, before); else list.append(g.row);
  updateSummary(fromDOM());
}
function scrollFrame() {
  const g = gesture; if (!g?.active) return;
  const top = document.querySelector('.header').getBoundingClientRect().bottom + 45;
  const bottom = window.innerHeight - 65;
  let delta = 0;
  if (g.y < top) delta = -Math.min(16, (top - g.y) / 4);
  else if (g.y > bottom) delta = Math.min(16, (g.y - bottom) / 4);
  if (delta) { window.scrollBy(0, delta); positionDrag(); }
  g.frame = requestAnimationFrame(scrollFrame);
}
list.addEventListener('pointerdown', event => {
  const handle = event.target.closest('.handle');
  if (!handle || gesture || !event.isPrimary || event.button !== 0) return;
  const row = handle.closest('li');
  gesture = { pointerId: event.pointerId, row, startY: event.clientY, y: event.clientY, startX: event.clientX, initial: [...order], active: false };
});
window.addEventListener('pointermove', event => {
  const g = gesture; if (!g || event.pointerId !== g.pointerId) return;
  g.y = event.clientY;
  if (!g.active && Math.hypot(event.clientY - g.startY, event.clientX - g.startX) < 6) return;
  event.preventDefault();
  if (!g.active) {
    closeMenus();
    list.setPointerCapture(event.pointerId);
    g.active = true;
    const rect = g.row.getBoundingClientRect(); g.offsetY = g.startY - rect.top;
    g.ghost = g.row.cloneNode(true); g.ghost.classList.add('drag-ghost');
    g.ghost.setAttribute('aria-hidden', 'true'); g.ghost.inert = true;
    Object.assign(g.ghost.style, { left: `${rect.left}px`, width: `${rect.width}px`, height: `${rect.height}px` });
    document.body.append(g.ghost); g.row.classList.add('drag-placeholder');
    document.body.classList.add('dragging'); g.frame = requestAnimationFrame(scrollFrame);
  }
  positionDrag();
}, { passive: false });
function finishDrag(cancel = false) {
  const g = gesture; if (!g) return;
  gesture = null;
  if (list.hasPointerCapture(g.pointerId)) list.releasePointerCapture(g.pointerId);
  if (!g.active) return;
  cancelAnimationFrame(g.frame); g.ghost.remove(); g.row.classList.remove('drag-placeholder'); document.body.classList.remove('dragging');
  ignoreClickUntil = performance.now() + 300;
  if (cancel) { reorderDOM(g.initial); announce('Перемещение отменено.'); }
  else { commit(fromDOM()); announce(`${titleOf(g.row.dataset.id)} перемещён. Порядок обновлён.`); }
}
window.addEventListener('pointerup', event => { if (gesture?.pointerId === event.pointerId) finishDrag(); });
window.addEventListener('pointercancel', event => { if (gesture?.pointerId === event.pointerId) finishDrag(true); });
window.addEventListener('blur', () => finishDrag(true));
window.addEventListener('keydown', event => { if (event.key === 'Escape') { finishDrag(true); closeMenus(); } });
document.addEventListener('visibilitychange', () => { if (document.hidden) finishDrag(true); });

$('export').addEventListener('click', () => {
  finishDrag(true);
  const url = URL.createObjectURL(new Blob([encode(order)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url;
  link.download = `haldei-setlist-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  announce('JSON подготовлен для скачивания.');
});
$('import').addEventListener('click', () => { finishDrag(true); $('file').click(); });
$('file').addEventListener('change', async event => {
  const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
  const request = ++importRequest;
  try {
    if (file.size > 100000) throw new Error('Файл слишком большой. Выбери JSON, скачанный из редактора.');
    const next = decode(await file.text());
    if (request !== importRequest) return;
    finishDrag(true); order = next; render(); notice();
    if (persist()) notice('Порядок из JSON загружен и сохранён.');
    announce('Порядок из JSON загружен.');
  } catch (error) { notice(error.message); }
});
render();
