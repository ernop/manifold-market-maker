const $ = id => document.getElementById(id);
const REFRESH_MS = 15000;
const DAY = 86400000;
let board = null, selectedId = null, renderedKey = null, loading = false, lastGood = null;
const criteria = new Map();

//-------VERDICTS-------
const LABELS = {YES:'YES', NO:'NO', CANCEL:'N/A', WAIT:'Wait', YOUR_CALL:'Your call', PENDING:'Pending', NONE:'No recommendation', ERROR:'Error', ANSWERS:'Per answer'};
const ORDER = ['YES', 'NO', 'CANCEL', 'PERCENT', 'YOUR_CALL', 'WAIT', 'NONE'];
const GROUPS = ['Error', 'Ready', 'Your call', 'Wait', 'Pending research', 'Open again', 'Resolved'];
const isPercent = verdict => /^\d{1,2}%$/.test(verdict);
const actionable = verdict => ['YES', 'NO', 'CANCEL'].includes(verdict) || isPercent(verdict);
const verdictClass = verdict => 'verdict verdict-' + (isPercent(verdict) ? 'PERCENT' : verdict);
const verdictLabel = verdict => isPercent(verdict) ? verdict : LABELS[verdict] || verdict;

function badge(verdict, text) {
  const node = element('span', text ?? verdictLabel(verdict), verdictClass(verdict));
  node.title = {YES:'Resolve YES', NO:'Resolve NO', CANCEL:'Resolve N/A (cancel)', WAIT:'Outcome not knowable yet',
    YOUR_CALL:'Needs your own observation or judgment', PENDING:'No research note yet', NONE:'The research note has no row for this answer',
    ERROR:'See the error in the detail panel', ANSWERS:'Each answer has its own recommendation'}[verdict] || (isPercent(verdict) ? `Resolve to ${verdict} (partial)` : '');
  return node;
}

//-------DOM HELPERS-------
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
// Controls act on press (mousedown); keyboard activation still arrives as a detail-less click.
function onPress(node, action) {
  node.addEventListener('mousedown', event => { if (event.button === 0) { event.preventDefault(); run(() => action(event)); } });
  node.addEventListener('click', event => { if (event.detail === 0) run(() => action(event)); });
}
function pressButton(text, action) {
  const node = element('button', text); node.type = 'button'; onPress(node, action); return node;
}
function externalLink(text, href, className) {
  const node = element('a', text, className); node.href = href; node.target = '_blank'; node.rel = 'noreferrer'; return node;
}
function notice(message) { $('notice').textContent = message; $('notice').hidden = !message; }
async function run(action) { try { await action(); } catch (error) { notice(error.message); } }
async function api(path) {
  const response = await fetch(path);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}
// Links, **bold** and `code` from research notes, built as DOM nodes rather than HTML.
function inline(text) {
  const fragment = document.createDocumentFragment();
  const url = String.raw`https?:\/\/(?:[^\s()<>]|\([^\s()<>]*\))+`;
  const pattern = new RegExp(String.raw`\[([^\]]+)\]\((${url})\)|\*\*([^*]+)\*\*|` + '`([^`]+)`' + `|(${url})`, 'g');
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) fragment.append(text.slice(last, match.index));
    if (match[1]) fragment.append(externalLink(match[1], match[2]));
    else if (match[3]) fragment.append(element('strong', match[3]));
    else if (match[4]) fragment.append(element('code', match[4]));
    else fragment.append(externalLink(match[5], match[5]));
    last = match.index + match[0].length;
  }
  if (last < text.length) fragment.append(text.slice(last));
  return fragment;
}
const plain = text => text.replace(/\[([^\]]+)\]\(([^)\s]+(?:\([^)\s]*\))?[^)\s]*)\)/g, '$1 ($2)').replace(/\*\*|`/g, '');

//-------FORMATTING-------
const isoDate = ms => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const clock = ms => new Date(ms).toLocaleTimeString();
function span(ms) {
  if (ms < 3600000) return Math.max(1, Math.round(ms / 60000)) + 'min';
  if (ms < DAY) return (ms / 3600000).toFixed(1) + 'h';
  if (ms < 30.4375 * DAY) return Math.round(ms / DAY) + 'd';
  if (ms < 365.25 * DAY) return (ms / (30.4375 * DAY)).toFixed(1) + 'mo';
  return (ms / (365.25 * DAY)).toFixed(1) + 'y';
}
const percent = value => value == null ? '—' : (100 * value).toFixed(1) + '%';

//-------CLASSIFICATION-------
function status(market, now = Date.now()) {
  if (market.isResolved) return 'resolved';
  return market.closeTime && market.closeTime <= now ? 'closed' : 'open';
}
const openAnswers = market => (market.answers || []).filter(answer => !answer.resolution);
// ANSWERS notes only count answers that are still unresolved on Manifold.
function liveVerdicts(market) {
  const note = market.note;
  if (!note) return [];
  if (note.recommendation !== 'ANSWERS') return [note.recommendation];
  if (!market.answers) return Object.values(note.answers).map(answer => answer.verdict);
  return openAnswers(market).map(answer => note.answers[answer.id]?.verdict || 'NONE');
}
function group(market) {
  if (market.errors.length) return 0;
  const state = status(market);
  if (state === 'resolved') return 6;
  if (!market.note) return 4;
  if (state === 'open') return 5;
  const verdicts = liveVerdicts(market);
  if (!verdicts.length || verdicts.some(actionable)) return 1;
  if (verdicts.some(verdict => verdict === 'YOUR_CALL' || verdict === 'NONE')) return 2;
  return 3;
}
const confidenceRank = {high:0, medium:1, low:2};
function ordered(markets) {
  return [...markets].sort((a, b) => group(a) - group(b)
    || (confidenceRank[a.note?.confidence] ?? 3) - (confidenceRank[b.note?.confidence] ?? 3)
    || (b.uniqueBettorCount || 0) - (a.uniqueBettorCount || 0)
    || (a.closeTime || 0) - (b.closeTime || 0));
}
function visible(market, view) {
  if (market.errors.length || view === 'all') return true;
  return view === 'resolved' ? status(market) === 'resolved' : status(market) === 'closed';
}

//-------TOTALS-------
function renderTotals(markets) {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const market of markets) counts[group(market)]++;
  const closed = markets.filter(market => status(market) === 'closed').length;
  const items = [[closed, 'closed, unresolved'], [counts[1], 'ready to resolve'], [counts[2], 'your call'],
    [counts[3], 'wait'], [counts[4], 'pending research'], [counts[6], 'resolved']];
  if (counts[0]) items.push([counts[0], 'with errors', 'total-errors']);
  $('totals').replaceChildren(...items.map(([value, label, extra]) => {
    const node = element('span', undefined, 'total' + (extra ? ' ' + extra : ''));
    node.append(element('span', String(value), 'total-value'), element('span', label, 'total-label'));
    return node;
  }));
}

//-------TABLE-------
function rowVerdict(market) {
  if (market.errors.length) return badge('ERROR');
  if (status(market) === 'resolved') {
    const result = market.resolution;
    return badge(['YES', 'NO', 'CANCEL'].includes(result) ? result : 'CANCEL',
      'Resolved ' + (result === 'CANCEL' ? 'N/A' : result === 'MKT' ? percent(market.resolutionProbability) : ['YES', 'NO'].includes(result) ? result : 'answer'));
  }
  if (!market.note) return badge('PENDING');
  if (market.note.recommendation !== 'ANSWERS') return badge(market.note.recommendation);
  const counts = new Map();
  for (const verdict of liveVerdicts(market)) {
    const key = isPercent(verdict) ? 'PERCENT' : verdict;
    counts.set(key, [...(counts.get(key) || []), verdict]);
  }
  const wrap = element('span', undefined, 'verdict-group');
  if (!counts.size) wrap.append(badge('ANSWERS', 'All answered'));
  for (const key of ORDER.filter(key => counts.has(key))) {
    const verdicts = counts.get(key);
    wrap.append(badge(verdicts[0], `${verdicts.length} ${key === 'PERCENT' ? 'partial' : verdictLabel(key)}`));
  }
  wrap.title = 'Recommendations for answers still open on Manifold';
  return wrap;
}
function marketValue(market) {
  if (market.outcomeType === 'MULTIPLE_CHOICE') {
    if (!market.answers) return element('span', '—');
    const node = element('span', `${openAnswers(market).length}/${market.answers.length} open`);
    node.title = 'Answers not yet resolved on Manifold';
    return node;
  }
  if (market.outcomeType !== 'BINARY' || status(market) === 'resolved') return element('span', '—');
  const node = element('span', percent(market.probability), 'chance-yes');
  node.title = 'Chance of YES when betting closed';
  return node;
}
function renderRows() {
  const view = document.querySelector('input[name="view"]:checked').value;
  const markets = ordered(board.markets.filter(market => visible(market, view)));
  const now = Date.now();
  const rows = markets.map(market => {
    const row = element('tr');
    row.dataset.id = market.id;
    row.tabIndex = 0;
    if (market.id === selectedId) row.classList.add('selected');
    const verdict = element('td'); verdict.append(rowVerdict(market));
    const confidence = element('td', market.note ? market.note.confidence[0].toUpperCase() + market.note.confidence.slice(1) : '—',
      market.note ? 'confidence confidence-' + market.note.confidence : 'confidence');
    const question = element('td', market.question, 'question-cell'); question.title = market.question;
    const reason = market.errors.length ? market.errors[0] : market.note ? market.note.summary : 'Research not written yet';
    const why = element('td', reason, 'why-cell'); why.title = reason;
    const chance = element('td', undefined, 'numeric'); chance.append(marketValue(market));
    const bettors = element('td', market.uniqueBettorCount == null ? '—' : String(market.uniqueBettorCount), 'numeric');
    const closed = element('td', market.closeTime && market.closeTime <= now ? span(now - market.closeTime) : 'Open', 'numeric');
    closed.title = market.closeTime ? 'Betting closed ' + new Date(market.closeTime).toLocaleString() : 'No close time';
    const open = element('td'); open.append(externalLink('Open', market.url, 'open-link'));
    row.append(verdict, confidence, question, why, chance, bettors, closed, open);
    row.addEventListener('mousedown', event => { if (event.button === 0 && !event.target.closest('a')) run(() => select(market.id)); });
    row.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); run(() => select(market.id)); } });
    return row;
  });
  if (!rows.length) {
    const row = element('tr', undefined, 'empty-row'), cell = element('td', view === 'resolved' ? 'No resolved markets with research notes yet.' : 'No markets in this view.');
    cell.colSpan = 8; row.append(cell); rows.push(row);
  }
  $('rows').replaceChildren(...rows);
}

//-------DETAIL-------
function fact(label, value) {
  const node = element('span', undefined, 'fact');
  node.append(element('span', label, 'fact-label'), element('span', value, 'fact-value'));
  return node;
}
function renderBlocks(container, blocks) {
  let list = null;
  for (const block of blocks) {
    if (block.kind === 'bullet' || block.kind === 'step') {
      const tag = block.kind === 'step' ? 'OL' : 'UL';
      if (list?.tagName !== tag) { list = element(tag.toLowerCase(), undefined, 'note-list'); container.append(list); }
      const item = element('li'); item.append(inline(block.text)); list.append(item);
      continue;
    }
    list = null;
    if (block.kind === 'paragraph') { const p = element('p'); p.append(inline(block.text)); container.append(p); }
    else {
      const table = element('table', undefined, 'note-table');
      for (const cells of block.rows) {
        const row = element('tr');
        for (const cell of cells) { const td = element('td'); td.append(inline(cell)); row.append(td); }
        table.append(row);
      }
      container.append(table);
    }
  }
}
function renderAnswers(detail, market) {
  const note = market.note;
  detail.append(element('h3', 'Answers still open'));
  const open = openAnswers(market);
  if (!market.answers) detail.append(element('p', 'Answers could not be loaded from Manifold; see the error above.'));
  else if (!open.length) detail.append(element('p', 'Every answer is resolved on Manifold.'));
  for (const answer of open) {
    const recommendation = note?.answers?.[answer.id];
    const heading = element('div', undefined, 'answer-heading');
    const chance = element('span', percent(answer.probability), 'answer-now');
    chance.title = 'Current market chance for this answer';
    heading.append(badge(recommendation ? recommendation.verdict : note ? 'NONE' : 'PENDING'),
      element('span', recommendation ? recommendation.confidence : '—', 'answer-confidence confidence confidence-' + (recommendation?.confidence || 'low')),
      chance, element('span', answer.text, 'answer-text'));
    detail.append(heading);
    if (recommendation) { const reason = element('p', undefined, 'answer-reason'); reason.append(inline(recommendation.reason)); detail.append(reason); }
  }
  const resolved = (market.answers || []).filter(answer => answer.resolution);
  if (resolved.length) {
    detail.append(element('h3', 'Already resolved on Manifold'));
    const table = element('table', undefined, 'resolved-answers');
    for (const answer of resolved) {
      const row = element('tr'), text = element('td', answer.text), result = element('td');
      const recommended = note?.answers?.[answer.id]?.verdict;
      result.append(badge(['YES', 'NO', 'CANCEL'].includes(answer.resolution) ? answer.resolution : 'CANCEL', answer.resolution === 'CANCEL' ? 'N/A' : answer.resolution));
      if (recommended && recommended !== answer.resolution) text.append(` · research said ${verdictLabel(recommended)}`);
      row.append(text, result); table.append(row);
    }
    detail.append(table);
  }
}
function renderCriteria(detail, market) {
  const box = element('details', undefined, 'criteria');
  box.open = sessionStorage.getItem('criteria-open') === '1';
  box.addEventListener('toggle', () => sessionStorage.setItem('criteria-open', box.open ? '1' : '0'));
  const cached = criteria.get(market.id);
  box.append(element('summary', 'Resolution criteria on Manifold'));
  if (!cached) box.append(element('p', 'Loading current criteria from Manifold…'));
  else if (cached.error) box.append(element('p', 'Could not load criteria: ' + cached.error));
  else {
    box.append(element('div', cached.text || 'No description supplied.', 'criteria-text'), element('p', 'Fetched ' + clock(cached.fetched), 'note-file'));
  }
  detail.append(box);
}
function renderDetail(market) {
  const detail = $('detail');
  const scroll = detail.scrollTop;
  detail.replaceChildren(element('h2', market.question));
  const actions = element('div', undefined, 'detail-actions');
  actions.append(externalLink('Open on Manifold to resolve', market.url, 'manifold-button'),
    pressButton('Refresh from Manifold', () => refreshMarket(market.id)));
  if (market.note) actions.append(pressButton('Copy resolution note', () => copyNote(market)));
  detail.append(actions);

  const now = Date.now(), state = status(market, now);
  const facts = element('div', undefined, 'facts');
  facts.append(fact('status', state === 'resolved' ? 'Resolved ' + (market.resolution === 'CANCEL' ? 'N/A' : market.resolution) : state === 'closed' ? 'Closed' : 'Open'));
  if (market.closeTime) facts.append(fact(market.closeTime <= now ? 'closed' : 'closes', `${isoDate(market.closeTime)} · ${span(Math.abs(now - market.closeTime))}${market.closeTime <= now ? ' ago' : ''}`));
  facts.append(fact('bettors', market.uniqueBettorCount == null ? '—' : String(market.uniqueBettorCount)));
  if (market.outcomeType === 'BINARY' && state !== 'resolved') facts.append(fact('chance at close', percent(market.probability)));
  if (market.outcomeType === 'MULTIPLE_CHOICE' && market.answers) facts.append(fact('answers open', `${openAnswers(market).length} of ${market.answers.length}`));
  if (market.note) facts.append(fact('researched', market.note.checked));
  detail.append(facts);

  if (market.errors.length) {
    const box = element('div', undefined, 'note-errors');
    box.append(element('h3', 'Problems'), ...market.errors.map(error => element('p', error)));
    detail.append(box);
  }
  const note = market.note;
  if (!note) {
    detail.append(element('p', 'No research note yet. Notes appear here automatically when their file is written to resolutions/.'));
  } else {
    const block = element('div', undefined, 'recommendation');
    block.append(badge(note.recommendation), element('span', note.confidence + ' confidence', 'confidence confidence-' + note.confidence));
    const summary = element('span', undefined, 'recommendation-summary'); summary.append(inline(note.summary));
    block.append(summary);
    detail.append(block);
    const before = note.sections.find(section => section.title === 'Before resolving');
    if (before) {
      const box = element('div', undefined, 'before-resolving');
      box.append(element('h3', 'Before resolving'));
      renderBlocks(box, before.blocks);
      detail.append(box);
    }
  }
  if (market.outcomeType === 'MULTIPLE_CHOICE') renderAnswers(detail, market);
  for (const section of note?.sections || []) {
    if (section.title === 'Before resolving') continue;
    detail.append(element('h3', section.title));
    renderBlocks(detail, section.blocks);
  }
  renderCriteria(detail, market);
  if (note) detail.append(element('p', `Research note: ${note.file} · saved ${new Date(note.modified).toLocaleString()}`, 'note-file'));
  detail.scrollTop = scroll;
}
function detailKey(market) { return JSON.stringify(market) + JSON.stringify(criteria.get(market.id) || null); }
function refreshDetail(force = false) {
  const market = board?.markets.find(item => item.id === selectedId);
  if (!market) return;
  const key = detailKey(market);
  if (force || key !== renderedKey) { renderedKey = key; renderDetail(market); }
}

//-------ACTIONS-------
function remember(market) {
  criteria.set(market.id, {text: market.textDescription || '', fetched: Date.now()});
}
async function loadCriteria(id) {
  if (criteria.has(id)) return;
  try { remember(await api('/api/market/' + encodeURIComponent(id))); }
  catch (error) { criteria.set(id, {error: error.message, fetched: Date.now()}); }
  refreshDetail();
}
async function select(id) {
  selectedId = id;
  history.replaceState(null, '', '#market=' + encodeURIComponent(id));
  for (const row of document.querySelectorAll('#rows tr')) row.classList.toggle('selected', row.dataset.id === id);
  refreshDetail(true);
  if (window.matchMedia('(max-width: 1350px)').matches) $('detail').scrollIntoView({block:'start'});
  await loadCriteria(id);
}
async function refreshMarket(id) {
  remember(await api('/api/market/' + encodeURIComponent(id)));
  await load();
  notice('');
}
// A Manifold comment: the verdict, the finding, and a few source links, short enough to read in the feed.
async function copyNote(market) {
  const note = market.note, lines = [];
  const trimmed = plain(note.summary).replace(/^(YES|NO|CANCEL|WAIT|YOUR_CALL|ANSWERS)\b[:,]?\s*/, '');
  const summary = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  if (note.recommendation === 'ANSWERS') {
    lines.push('Resolution notes per answer:');
    for (const answer of openAnswers(market).length ? openAnswers(market) : market.answers || []) {
      const recommendation = note.answers[answer.id];
      if (recommendation) lines.push(`- ${answer.text}: ${verdictLabel(recommendation.verdict)}. ${plain(recommendation.reason)}`);
    }
  } else lines.push(`${actionable(note.recommendation) ? 'Resolution' : 'Research recommendation'}: ${verdictLabel(note.recommendation)}. ${summary}`);
  const finding = note.sections.find(section => section.title === 'Finding');
  if (finding) lines.push('', ...finding.blocks.filter(block => block.text).map(block => plain(block.text)));
  const links = (note.sections.find(section => section.title === 'Evidence')?.blocks || [])
    .map(block => block.text?.match(/\[([^\]]+)\]\((https?:\/\/[^)\s]+(?:\([^)\s]*\))?[^)\s]*)\)/))
    .filter(Boolean).slice(0, 6).map(match => `- ${match[1]}: ${match[2]}`);
  if (links.length) lines.push('', 'Sources:', ...links);
  await navigator.clipboard.writeText(lines.join('\n'));
  notice('Resolution note copied. Paste it as a comment on Manifold when you resolve.');
}

//-------LOADING-------
async function load() {
  if (loading) return;
  loading = true;
  try {
    board = await api('/api/review');
    lastGood = board.generated;
    $('profile-link').href = 'https://manifold.markets/' + encodeURIComponent(board.username);
    renderTotals(board.markets);
    renderRows();
    const errors = $('file-errors');
    errors.hidden = !board.errors.length;
    errors.replaceChildren(element('h2', 'Research files with problems'), ...board.errors.map(item => element('p', `${item.file}: ${item.error}`)));
    $('updated').textContent = `Updated ${clock(board.generated)} · new research appears automatically every ${REFRESH_MS / 1000} s`;
    if (!selectedId) {
      const hashed = new URLSearchParams(location.hash.slice(1)).get('market');
      if (hashed && board.markets.some(market => market.id === hashed)) await select(hashed);
    } else refreshDetail();
  } catch (error) {
    notice(`Refresh failed at ${clock(Date.now())}: ${error.message}${lastGood ? ` · the table shows data from ${clock(lastGood)}` : ''}`);
  } finally { loading = false; }
}
function step(offset) {
  const rows = [...document.querySelectorAll('#rows tr[data-id]')];
  const index = rows.findIndex(row => row.dataset.id === selectedId);
  const next = rows[Math.min(rows.length - 1, Math.max(0, index + offset))];
  if (next) { next.focus(); run(() => select(next.dataset.id)); }
}
onPress($('refresh'), async () => { notice(''); await load(); });
for (const input of document.querySelectorAll('input[name="view"]')) input.addEventListener('change', () => renderRows());
document.addEventListener('keydown', event => {
  if (event.target.closest('input, textarea, select') || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.key === 'ArrowDown') { event.preventDefault(); step(1); }
  if (event.key === 'ArrowUp') { event.preventDefault(); step(-1); }
});
window.addEventListener('hashchange', () => {
  const id = new URLSearchParams(location.hash.slice(1)).get('market');
  if (id && id !== selectedId && board?.markets.some(market => market.id === id)) run(() => select(id));
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) run(load); });
setInterval(() => { if (!document.hidden) run(load); }, REFRESH_MS);
run(load);
