const $ = id => document.getElementById(id);
let offset = 0, total = 0, selected = null, searchSequence = 0, detailSequence = 0, previewToken = null;
let sortColumns = [{key:'bettors', direction:'desc'}];
const sortLabels = {chance:'Chance', bettors:'Bettors', volume:'Volume', closing:'Closes'};
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
  // Keeping the decimal makes 2.0k no shorter than 1.1k.
  for (const [scale, suffix] of [[1e9,'b'],[1e6,'m'],[1e3,'k']]) {
    if (value >= scale * .99995) return (value / scale).toFixed(1) + suffix;
  }
  return number(value);
}
function closeIndicator(market, now = Date.now()) {
  const node = element('span', undefined, 'close-indicator');
  if (market.isResolved) { node.textContent = 'Resolved'; node.classList.add('time-ended'); return node; }
  if (!market.closeTime) { node.textContent = '—'; node.title = 'No deadline'; node.classList.add('time-ended'); return node; }
  const remaining = market.closeTime - now;
  const minute = 60000, hour = 60 * minute, day = 24 * hour;
  if (remaining <= 0) { node.textContent = 'Closed'; node.classList.add('time-ended'); return node; }
  const [duration, unit, tone] = remaining >= 365.25 * day ? [365.25 * day, 'y', 'years']
    : remaining >= 30.4375 * day ? [30.4375 * day, 'mo', 'months']
    : remaining >= day ? [day, 'd', 'days']
    : remaining >= hour ? [hour, 'h', 'hours'] : [minute, 'min', 'minutes'];
  const value = remaining / duration;
  node.textContent = (value < 1 ? '<1' : value.toFixed(1)) + unit;
  node.classList.add('time-' + tone);
  node.title = 'Betting closes ' + new Date(market.closeTime).toLocaleString() + '. Remaining time is approximate.';
  return node;
}
function volumeIndicator(value) {
  const node = element('span', undefined, 'volume-indicator');
  const label = element('span', volume(value), 'volume-label');
  const scale = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  scale.setAttribute('viewBox', '0 0 100 24');
  scale.setAttribute('preserveAspectRatio', 'none');
  scale.setAttribute('class', 'volume-scale');
  scale.setAttribute('aria-hidden', 'true');
  const fill = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  // A fixed continuous log scale grows even within one abbreviation tier.
  const width = value > 0 ? Math.min(100, 100 * Math.log10(1 + value) / 9) : 0;
  fill.setAttribute('x', String(100 - width));
  fill.setAttribute('width', String(width));
  fill.setAttribute('height', '24');
  fill.setAttribute('rx', '2');
  scale.append(fill); node.append(scale, label);
  node.title = value == null ? 'Volume unavailable' : Number(value).toLocaleString(undefined, {maximumFractionDigits:2}) + ' total volume. Fixed logarithmic bar, from 0 to 1 billion.';
  return node;
}
function updateSortHeaders() {
  for (const button of document.querySelectorAll('.sort-header')) {
    const index = sortColumns.findIndex(item => item.key === button.dataset.sort);
    const direction = index < 0 ? null : sortColumns[index].direction;
    button.querySelector('.sort-indicator').textContent = direction ? ` ${direction === 'asc' ? '↑' : '↓'}${index+1}` : ' ↕';
    button.classList.toggle('sort-active', index >= 0);
    const next = index > 0 ? `primary sorting (${direction})` : direction === null ? 'primary sorting (ascending)' : direction === 'asc' ? 'descending' : 'off';
    button.setAttribute('aria-label', `${sortLabels[button.dataset.sort]}: ${direction || 'not sorted'}${index >= 0 ? ', priority ' + (index+1) : ''}. Click for ${next}.`);
    button.title = button.getAttribute('aria-label');
    button.closest('th').setAttribute('aria-sort', index === 0 ? direction === 'asc' ? 'ascending' : 'descending' : index > 0 ? 'other' : 'none');
  }
  $('sort-summary').textContent = sortColumns.length ? sortColumns.map((item, i) => `${i+1}. ${sortLabels[item.key]} ${item.direction === 'asc' ? '↑' : '↓'}`).join(' · ') : 'No column sorting · newest first';
  $('clear-sorts').disabled = sortColumns.length === 0;
}
function cycleSort(key) {
  const index = sortColumns.findIndex(item => item.key === key);
  if (index < 0) sortColumns.unshift({key, direction:'asc'});
  else if (index > 0) sortColumns.unshift(sortColumns.splice(index, 1)[0]);
  else if (sortColumns[index].direction === 'asc') sortColumns[index].direction = 'desc';
  else sortColumns.splice(index, 1);
  offset = 0; updateSortHeaders(); run(search);
}
function resultBadge(value) {
  const node = element('span', undefined, 'result-badge');
  if (typeof value === 'string' && /^\d+(?:\.\d+)?%$/.test(value)) {
    node.classList.add('probability-yes');
    node.append(element('span', value.slice(0,-1), 'chance-number'), element('span', '%', 'chance-percent'), element('span', 'Y', 'yes-marker'));
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
  renderSearchChips();
  const sequence = ++searchSequence;
  const query = new URLSearchParams({q: $('query').value, state: choice('state'), type: choice('type'), resolution: $('resolution').value, sorts: sortColumns.map(item => item.key + ':' + item.direction).join(','), creator: $('creator').value, offset});
  const data = await api('/api/search?' + query);
  if (sequence !== searchSequence) return;
  total = data.total;
  $('results').replaceChildren();
  for (const market of data.markets) {
    const row = element('tr');
    if (selected?.id === market.id) row.classList.add('selected');
    const title = element('td');
    const open = button(market.question, () => showMarket(market.id)); open.className = 'market-title';
    title.append(open);
    const creator = element('td', undefined, 'creator-cell'); creator.title = market.creatorUsername;
    const creatorButton = button(market.creatorUsername, () => filterCreator(market.creatorUsername));
    creatorButton.className = 'creator-link'; creator.append(creatorButton);
    const status = element('td', market.isResolved ? 'Resolved' : market.closeTime && market.closeTime <= Date.now() ? 'Closed' : 'Open', 'state-cell');
    const type = element('td', ({BINARY:'Binary', MULTIPLE_CHOICE:'Multi', DATE:'Date', POLL:'Poll', NUMERIC:'Numeric', PSEUDO_NUMERIC:'Numeric'})[market.outcomeType] || 'Other', 'type-cell'); type.title = market.outcomeType;
    const chance = element('td', undefined, 'numeric chance'); chance.append(resultBadge(market.outcomeType === 'BINARY' ? marketState(market) : market.isResolved ? 'Resolved' : '—'));
    if (market.outcomeType !== 'BINARY') chance.title = 'Select the market to inspect individual answers.';
    const bettors = element('td', market.uniqueBettorCount == null ? '—' : number(market.uniqueBettorCount), 'numeric');
    bettors.title = market.uniqueBettorCount == null ? 'Bettor count unavailable' : number(market.uniqueBettorCount) + ' unique bettors';
    const traded = element('td', undefined, 'numeric'); traded.append(volumeIndicator(market.volume));
    const closes = element('td', undefined, 'numeric date'); closes.append(closeIndicator(market)); closes.title = market.closeTime ? new Date(market.closeTime).toLocaleString() : 'No close date';
    const historyCell = element('td', market.outcomeType === 'BINARY' ? 'Loading…' : 'Select an answer', 'history-cell');
    if (market.outcomeType === 'BINARY') historyCell.dataset.market = market.id;
    row.append(title, creator, status, type, chance, bettors, traded, closes, historyCell);
    $('results').append(row);
  }
  if (!data.markets.length) {
    const row = element('tr'), cell = element('td', 'No matching markets. Try fewer words or include closed markets.');
    cell.colSpan = 9; row.append(cell); $('results').append(row);
  }
  $('results-status').textContent = `${number(total)} matches · ${data.milliseconds} ms${data.complete ? '' : ' · catalog still downloading'}`;
  $('page').textContent = `${total ? offset + 1 : 0}–${Math.min(offset + 100, total)} of ${number(total)}`;
  $('previous').disabled = offset === 0; $('next').disabled = offset + 100 >= total;
  loadHistories();
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
  const summary = element('p', `${market.creatorUsername} · `); summary.append(resultBadge(marketState(market)), document.createTextNode(''));
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
for (const id of ['query','creator']) $(id).addEventListener('input', () => { renderSearchChips(); clearTimeout(searchTimer); searchTimer = setTimeout(() => { offset=0; run(search); }, 100); });
for (const id of ['state','type','resolution']) $(id).addEventListener('change', () => { offset=0; run(search); });
for (const button of document.querySelectorAll('.sort-header')) button.addEventListener('click', () => cycleSort(button.dataset.sort));
$('clear-sorts').addEventListener('click', () => { sortColumns = []; offset = 0; updateSortHeaders(); run(search); });
updateSortHeaders();
$('previous').addEventListener('click', () => { offset=Math.max(0,offset-100); run(search); });
$('next').addEventListener('click', () => { offset+=100; run(search); });
$('mine').addEventListener('click', () => { run(() => filterCreator('Ernie')); });
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

const historyCache = new Map();
let historyLoading = false;
function historyChart(data) {
  const wrap = element('span', undefined, 'history-inline');
  if (!data.points.length) return element('span', 'No price history', 'history-muted');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 120 32');
  svg.setAttribute('class', 'history-chart');
  svg.setAttribute('role', 'img');
  const add = (tag, attrs) => { const n=document.createElementNS(svg.namespaceURI,tag); for(const [k,v] of Object.entries(attrs)) n.setAttribute(k,v); svg.append(n); };
  for (const y of [2,16,30]) add('line',{x1:0,x2:120,y1:y,y2:y,class:'history-grid'});
  data.activity.forEach((v,i)=>{if(v>0) { const h=Math.min(28,Math.log10(1+v)/6*28); add('rect',{x:i*2.5,y:30-h,width:2,height:h,class:'history-volume'}); }});
  // Preserve min/max excursions at each pixel, not a smoothing average.
  const buckets = new Map();
  for(const [t,p] of data.points) { const x=Math.max(0,Math.min(120,Math.round((t-data.start)/(data.end-data.start)*120))); if(!buckets.has(x)) buckets.set(x,[]); buckets.get(x).push(p); }
  const points=[];
  for(const [x,ps] of buckets) { for(const p of [ps[0],Math.min(...ps),Math.max(...ps),ps[ps.length-1]]) points.push(`${x},${30-p*28}`); }
  add('polyline',{points:points.join(' '),class:'history-price'});
  const change = Math.round(data.change*10)/10;
  const delta = `${change>=0?'+':''}${change.toFixed(1)}pp`;
  const summary = `${data.complete?'':'Partial · '}Δ ${delta} · ${data.low.toFixed(1)}–${data.high.toFixed(1)}% · ${volume(data.volume)} M gross · ${data.trades} ${data.trades===1?'trade':'trades'}`;
  svg.setAttribute('aria-label', 'Last 24 hours: '+summary);
  wrap.append(svg, element('span',summary));
  return wrap;
}
async function loadHistories() {
  if(historyLoading) return;
  historyLoading=true;
  try {
    while(true) {
      const cells=[...document.querySelectorAll('[data-market]')];
      let pending=null;
      for(const cell of cells) {
        const cached=historyCache.get(cell.dataset.market);
        if(cached && Date.now()-cached.at<120000) {
          if(!cell.dataset.loaded) { cell.replaceChildren(cached.error?element('span','History unavailable'):historyChart(cached.data)); cell.dataset.loaded='1'; }
        } else if(!pending) pending=cell.dataset.market;
      }
      if(!pending) break;
      try { historyCache.set(pending,{at:Date.now(),data:await api('/api/history/'+encodeURIComponent(pending))}); }
      catch { historyCache.set(pending,{at:Date.now(),error:true}); }
      if(historyCache.size>300) historyCache.delete(historyCache.keys().next().value);
    }
  } finally {historyLoading=false;}
}

function searchTerms() {
  return $('query').value.match(/(?:[^\s"]+|"[^"]*")+|"[^"]*$/g) || [];
}
function renderSearchChips() {
  $('search-chips').replaceChildren(...searchTerms().map((term,index) => {
    const chip = button(term+' ×', async () => {
      const terms=searchTerms(); terms.splice(index,1);
      $('query').value=terms.join(' '); offset=0; await search();
    });
    chip.className='search-chip'; chip.setAttribute('aria-label','Remove '+term);
    return chip;
  }));
}
async function filterCreator(name) {
  const terms=searchTerms().filter(term=>! /^(name|from):/i.test(term));
  terms.push('name:'+name);
  $('query').value=terms.join(' '); $('creator').value=''; offset=0;
  await search();
}
