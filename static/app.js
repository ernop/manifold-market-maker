const $ = id => document.getElementById(id);
let offset = 0, total = 0, selected = null, searchSequence = 0, detailSequence = 0, previewToken = null;
const number = value => Number(value || 0).toLocaleString(undefined, {maximumFractionDigits: 0});
const probability = value => value == null ? '—' : (100 * value).toFixed(1) + '%';
const date = value => {
  if (!value) return '—';
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
const choice = name => document.querySelector(`input[name="${name}"]:checked`).value;
function volume(value) {
  if (value == null) return '—';
  for (const [scale, suffix] of [[1e9,'b'],[1e6,'m'],[1e3,'k']]) {
    if (Math.abs(value) >= scale) return (value / scale).toFixed(1).replace(/\.0$/, '') + suffix;
  }
  return number(value);
}
function closeIndicator(market, now = Date.now()) {
  const node = element('span', undefined, 'close-indicator');
  if (market.isResolved) { node.textContent = 'Resolved'; node.classList.add('time-ended'); return node; }
  if (!market.closeTime) { node.textContent = 'No deadline'; node.classList.add('time-ended'); return node; }
  const remaining = market.closeTime - now;
  const minute = 60000, hour = 60 * minute, day = 24 * hour;
  if (remaining <= 0) { node.textContent = 'Closed'; node.classList.add('time-ended'); return node; }
  let text;
  if (remaining < minute) text = '<1m';
  else if (remaining < hour) text = Math.floor(remaining / minute) + 'm';
  else if (remaining < day) text = Math.floor(remaining / hour) + 'h ' + Math.floor(remaining % hour / minute) + 'm';
  else if (remaining < 7 * day) text = Math.floor(remaining / day) + 'd ' + Math.floor(remaining % day / hour) + 'h';
  else if (remaining < 365 * day) text = Math.floor(remaining / day) + 'd';
  else text = (remaining / (365.25 * day)).toFixed(1).replace(/\.0$/, '') + 'y';
  node.textContent = 'in ' + text;
  node.classList.add(remaining <= day ? 'time-imminent' : remaining <= 7 * day ? 'time-soon' : remaining <= 30 * day ? 'time-month' : 'time-later');
  node.title = 'Betting closes ' + new Date(market.closeTime).toLocaleString();
  return node;
}
function volumeIndicator(value) {
  const node = element('span', undefined, 'volume-indicator');
  const label = element('span', volume(value), value >= 1000 ? 'volume-large' : 'volume-small');
  const scale = element('span', undefined, 'volume-scale');
  scale.setAttribute('aria-hidden', 'true');
  // Fixed decades preserve meaning when the search or sorting changes.
  for (let exponent = 0; exponent < 8; exponent++) {
    scale.append(element('i', undefined, value >= 10 ** exponent ? 'volume-step filled' : 'volume-step'));
  }
  node.append(label, scale);
  node.title = value == null ? 'Volume unavailable' : Number(value).toLocaleString(undefined, {maximumFractionDigits:2}) + ' total volume. Scale marks: 1, 10, 100, 1k, 10k, 100k, 1m, 10m.';
  return node;
}
function resultBadge(value) {
  const node = element('span', undefined, 'result-badge');
  if (typeof value === 'string' && /^\d+(?:\.\d+)?%$/.test(value)) {
    node.classList.add('probability-yes');
    node.append(document.createTextNode(value), element('span', 'Y', 'yes-marker'));
    node.setAttribute('aria-label', value + ' chance of YES');
    node.title = 'Probability of YES; this market is not resolved.';
  } else node.textContent = value;
  if (value === 'YES' || value === 'NO') node.classList.add('result-' + value.toLowerCase());
  return node;
}
function notice(message) { $('notice').textContent = message; $('notice').hidden = !message; }
async function api(path, body) {
  const response = await fetch(path, body === undefined ? {} : {method: 'POST', headers: {'Content-Type': 'application/json', 'X-Requested-With': 'mm-local'}, body: JSON.stringify(body)});
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function button(text, action) { const node = element('button', text); node.addEventListener('click', () => run(action)); return node; }
async function run(action) { try { notice(''); await action(); } catch (error) { notice(error.message); } }
function marketLink(market) {
  const link = element('a', 'Open on Manifold');
  link.href = 'https://manifold.markets/' + encodeURIComponent(market.creatorUsername) + '/' + encodeURIComponent(market.slug || market.id);
  link.target = '_blank'; link.rel = 'noreferrer'; return link;
}
function marketState(market) {
  if (market.isResolved) {
    if (['YES','NO','CANCEL','MKT'].includes(market.resolution)) return market.resolution;
    return market.answers?.find(answer => answer.id === market.resolution)?.text || 'Resolved · see answers';
  }
  if (market.outcomeType === 'BINARY') return probability(market.probability);
  return ({MULTIPLE_CHOICE:'Multiple answers', DATE:'Date thresholds', POLL:'Poll', NUMERIC:'Numeric', PSEUDO_NUMERIC:'Numeric'})[market.outcomeType] || market.outcomeType;
}
async function search() {
  const sequence = ++searchSequence;
  const query = new URLSearchParams({q: $('query').value, state: choice('state'), type: choice('type'), resolution: $('resolution').value, sort: $('sort').value, creator: $('creator').value, offset});
  const data = await api('/api/search?' + query);
  if (sequence !== searchSequence) return;
  total = data.total;
  $('results').replaceChildren();
  for (const market of data.markets) {
    const row = element('tr');
    if (selected?.id === market.id) row.classList.add('selected');
    const title = element('td');
    const open = button(market.question, () => showMarket(market.id)); open.className = 'market-title';
    title.append(open, element('span', `${market.creatorUsername} · ${market.isResolved ? 'closed · resolved' : market.closeTime && market.closeTime <= Date.now() ? 'closed · unresolved' : 'open'} · ${market.outcomeType === 'BINARY' ? 'binary' : 'other'}`, 'byline'));
    const chance = element('td', undefined, 'numeric chance'); chance.append(resultBadge(marketState(market)));
    const bettors = element('td', market.uniqueBettorCount == null ? '—' : number(market.uniqueBettorCount), 'numeric');
    bettors.title = market.uniqueBettorCount == null ? 'Bettor count unavailable' : number(market.uniqueBettorCount) + ' unique bettors';
    const traded = element('td', undefined, 'numeric'); traded.append(volumeIndicator(market.volume));
    const closes = element('td', undefined, 'numeric date'); closes.append(closeIndicator(market), element('span', date(market.closeTime), 'close-date')); closes.title = market.closeTime ? new Date(market.closeTime).toLocaleString() : 'No close date';
    row.append(title, chance, bettors, traded, closes);
    $('results').append(row);
  }
  if (!data.markets.length) {
    const row = element('tr'), cell = element('td', 'No matching markets. Try fewer words or include closed markets.');
    cell.colSpan = 5; row.append(cell); $('results').append(row);
  }
  $('results-status').textContent = `${number(total)} matches · ${data.milliseconds} ms${data.complete ? '' : ' · catalog still downloading'}`;
  $('page').textContent = `${total ? offset + 1 : 0}–${Math.min(offset + 100, total)} of ${number(total)}`;
  $('previous').disabled = offset === 0; $('next').disabled = offset + 100 >= total;
}
function richText(node) {
  if (!node) return '';
  if (node.text) return node.text;
  return (node.content || []).map(richText).join(node.type === 'doc' ? '\n\n' : '') + (node.type === 'hardBreak' ? '\n' : '');
}
async function showMarket(id) {
  const sequence = ++detailSequence;
  $('detail').replaceChildren(element('p', 'Loading current market…'));
  const market = await api('/api/market/' + encodeURIComponent(id));
  if (sequence !== detailSequence) return;
  selected = market;
  history.replaceState(null, '', '#market=' + encodeURIComponent(id));
  const detail = $('detail');
  detail.replaceChildren(element('h2', market.question));
  const summary = element('p', `${market.creatorUsername} · `); summary.append(resultBadge(marketState(market)), document.createTextNode(` · closes ${date(market.closeTime)}`));
  detail.append(closeIndicator(market));
  detail.append(summary, element('p', `${market.uniqueBettorCount == null ? 'Bettor count unavailable' : number(market.uniqueBettorCount) + ' unique bettors'} · ${volume(market.volume)} volume`, 'detail-numbers'));
  detail.append(marketLink(market), element('p', 'Fetched from Manifold ' + new Date().toLocaleTimeString(), 'byline'));
  if (market.answers?.length) {
    detail.append(element('h3', 'Answers'));
    for (const answer of market.answers) {
      const row = element('div', undefined, 'answer');
      row.append(element('span', answer.text), resultBadge(answer.resolution || probability(answer.probability))); detail.append(row);
    }
  }
  detail.append(element('h3', 'Resolution criteria'), element('div', market.textDescription || richText(market.description) || 'No description supplied.', 'criteria'));
  const actions = element('div', undefined, 'detail-actions');
  actions.append(button('Find related', async () => {
    const stop = new Set(['will','the','and','before','after','this','that','what','when','which','with','have','from','does','would','could','should','into','than']);
    $('query').value = market.question.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').split(' ').filter(word => word.length > 3 && !stop.has(word)).slice(0, 2).join(' ');
    $('creator').value = ''; offset = 0; await search();
  }), button('Refresh market', () => showMarket(id)));
  detail.append(actions);
  if (market.outcomeType === 'BINARY' && !market.isResolved && (!market.closeTime || market.closeTime > Date.now())) {
    detail.append(element('h3', 'Bet with mana'));
    const form = element('div', undefined, 'bet-form');
    const amountLabel = element('label', 'Amount'), amount = element('input');
    amount.type = 'number'; amount.min = '1'; amount.placeholder = 'Mana'; amountLabel.append(amount);
    const sideLabel = element('label', 'Outcome'), side = element('select');
    for (const value of ['YES','NO']) { const option = element('option', value); option.value = value; side.append(option); }
    sideLabel.append(side);
    form.append(amountLabel, sideLabel, button('Preview bet', () => prepare({kind:'bet', marketId:id, amount:amount.value, outcome:side.value}))); detail.append(form);
  }
  if (market.creatorUsername.toLowerCase() === 'ernie' && market.outcomeType === 'BINARY' && !market.isResolved) {
    detail.append(element('h3', 'Judge this market'));
    const label = element('label', 'Evidence and application of the criteria'), evidence = element('textarea'); evidence.rows = 4; label.append(evidence); detail.append(label);
    const actions = element('div', undefined, 'detail-actions');
    for (const outcome of ['YES','NO','CANCEL']) actions.append(button('Review ' + outcome, () => prepare({kind:'resolve', marketId:id, outcome, evidence:evidence.value})));
    detail.append(actions);
  }
  await search();
}
async function status() {
  const data = await api('/api/status');
  $('sync-status').textContent = `${number(data.count)} cached · ${data.phase} · ${data.last_sync ? 'updated ' + new Date(data.last_sync).toLocaleTimeString() : 'first download'}${data.error ? ' · ' + data.error : ''}`;
  if (data.error) $('sync-status').title = data.error;
}
function draftData() { return {question:$('draft-question').value, description:$('draft-description').value}; }
async function loadDraft() {
  const draft = await api('/api/draft?name=' + encodeURIComponent($('draft-name').value));
  const lines = draft.markdown.split('\n');
  $('draft-question').value = (lines.shift() || '').replace(/^#\s*/, '');
  $('draft-description').value = lines.join('\n').trim();
}
async function prepare(data) {
  const preview = await api('/api/prepare', data);
  previewToken = preview.token;
  $('review-title').textContent = 'Review ' + preview.kind;
  $('review-account').textContent = 'Manifold account: ' + preview.account;
  $('review-body').textContent = JSON.stringify(preview.summary, null, 2);
  $('execute-action').disabled = false; $('review').showModal();
}
$('execute-action').addEventListener('click', () => run(async () => {
  $('execute-action').disabled = true;
  const token = previewToken; previewToken = null;
  try {
    const result = await api('/api/execute', {token});
    $('review').close(); notice('Submitted to Manifold. Result: ' + JSON.stringify(result));
    if (selected) await showMarket(selected.id); await status();
  } catch (error) { $('review').close(); throw error; }
}));
$('cancel-action').addEventListener('click', () => $('review').close());
let searchTimer;
for (const id of ['query','creator']) $(id).addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { offset=0; run(search); }, 100); });
for (const id of ['state','type','resolution','sort']) $(id).addEventListener('change', () => { offset=0; run(search); });
$('previous').addEventListener('click', () => { offset=Math.max(0,offset-100); run(search); });
$('next').addEventListener('click', () => { offset+=100; run(search); });
$('mine').addEventListener('click', () => { $('creator').value='Ernie'; $('query').value=''; offset=0; run(search); });
$('sync').addEventListener('click', () => run(async () => { await api('/api/sync', {}); await status(); notice('Market update requested.'); }));
$('account-toggle').addEventListener('click', () => { $('account-panel').hidden=!$('account-panel').hidden; });
$('connect-form').addEventListener('submit', event => { event.preventDefault(); run(async () => {
  const key = $('api-key').value; $('api-key').value='';
  const account = await api('/api/connect', {apiKey:key});
  $('account-info').textContent = `${account.username} · ${number(account.balance)} mana`; await status();
}); });
$('load-draft').addEventListener('click', () => run(loadDraft));
$('save-draft').addEventListener('click', () => run(async () => {
  await api('/api/draft', {name:$('draft-name').value, markdown:'# '+$('draft-question').value+'\n\n'+$('draft-description').value+'\n'});
  notice('Saved drafts/' + $('draft-name').value + '.md');
}));
$('evaluate').addEventListener('click', () => run(async () => {
  const result = await api('/api/evaluate', draftData());
  $('evaluation').replaceChildren(...result.checks.map(check => element('div', (check.present ? 'Present: ' : 'Review: ') + check.label)), element('p', result.note));
}));
$('prepare-create').addEventListener('click', () => run(() => prepare({...draftData(), kind:'create', closeTime:new Date($('close-time').value).getTime(), initialProb:$('initial-prob').value})));
run(async () => { await Promise.all([search(), status(), loadDraft()]);
  const id = new URLSearchParams(location.hash.slice(1)).get('market');
  if (id) await showMarket(id);
});
// Refresh the visible result list from the local cache without touching draft inputs.
setInterval(() => { if (!document.hidden && !$('review').open) run(() => Promise.all([status(), search()])); }, 30000);
