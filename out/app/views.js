// The four pages, each a function from API data to HTML. Views never fetch:
// main.js loads the data, these only shape it. All API text goes through esc()
// or md(), so nothing the API returns can break out of the page.

import { date, entriesOpen, esc, md, money, num, timeLeft, winRate } from './format.js';

/** The reward as it stands now: the prize plus entry fees paid into it. */
export function potOf(bounty) {
  return money(bounty.potUsd ?? bounty.rewardAmount);
}

/** 'Open' / 'Closing soon' / 'Entries closed', by deadline, never status alone. */
export function statusPill(bounty) {
  if (!entriesOpen(bounty)) return '<span class="pill pill-closed">Entries closed</span>';
  const ms = new Date(bounty.deadline).getTime() - Date.now();
  if (ms < 48 * 3600000) return '<span class="pill pill-soon">Closing soon</span>';
  return '<span class="pill pill-open">Open</span>';
}

function bountyCard(bounty) {
  const open = entriesOpen(bounty);
  const ms = new Date(bounty.deadline).getTime() - Date.now();
  const urgent = open && ms < 6 * 3600000;
  return `
    <li class="bounty-card">
      <h2><a href="#/bounty/${encodeURIComponent(bounty.slug)}">${esc(bounty.title)}</a></h2>
      <div class="stats">
        <span class="pot"><small>Live pot</small>${potOf(bounty)}</span>
        <span class="fee-line">${bounty.entryFeeUsd ? `<b>${money(bounty.entryFeeUsd)}</b> entry fee` : 'Free to enter'}</span>
        <span class="time-line${urgent ? ' urgent' : ''}" data-countdown="${esc(bounty.deadline)}"><b>${timeLeft(bounty.deadline)}</b></span>
        <span class="entries-line">${num(bounty.submissionCount)} ${bounty.submissionCount === 1 ? 'entry' : 'entries'}</span>
      </div>
      <p class="meta">${statusPill(bounty)} ${esc(bounty.category ?? '')} · ends ${date(bounty.deadline)}</p>
      <p class="meta sponsor-line">by ${esc(bounty.sponsor?.name ?? 'make.fun')}${bounty.skills?.length ? ` · ${bounty.skills.slice(0, 4).map(esc).join(', ')}` : ''}</p>
    </li>`;
}

/**
 * The board. `state` carries the toolbar: filter ('open' | 'closing' | 'all'),
 * sort ('deadline' | 'pot' | 'entries' | 'title') and the search query.
 */
export function boardView(data, state) {
  let items = (data.items ?? []).slice();
  const query = (state.query ?? '').trim().toLowerCase();
  if (query) {
    items = items.filter(
      (b) =>
        b.title.toLowerCase().includes(query) ||
        (b.slug ?? '').toLowerCase().includes(query) ||
        (b.category ?? '').toLowerCase().includes(query),
    );
  }
  if (state.filter === 'open') items = items.filter(entriesOpen);
  if (state.filter === 'closing') {
    items = items.filter(
      (b) => entriesOpen(b) && new Date(b.deadline).getTime() - Date.now() < 48 * 3600000,
    );
  }
  const sorts = {
    deadline: (a, b) => new Date(a.deadline) - new Date(b.deadline),
    pot: (a, b) => Number(b.potUsd ?? b.rewardAmount) - Number(a.potUsd ?? a.rewardAmount),
    entries: (a, b) => (b.submissionCount ?? 0) - (a.submissionCount ?? 0),
    title: (a, b) => a.title.localeCompare(b.title),
  };
  items.sort(sorts[state.sort] ?? sorts.deadline);

  const openCount = (data.items ?? []).filter(entriesOpen).length;
  const potTotal = (data.items ?? []).reduce(
    (sum, b) => sum + Number(b.potUsd ?? b.rewardAmount ?? 0),
    0,
  );
  const cards = items.map(bountyCard).join('');
  return `
    <h1>Open bounties</h1>
    <p class="lede">${num(openCount)} taking entries right now · ${money(potTotal)} in live pots across the board. Pots grow as entry fees land; a bounty past its deadline stops taking entries even while it still reads open.</p>
    <div class="toolbar" role="group" aria-label="Board filters">
      <button class="chip" data-filter="open" aria-pressed="${state.filter === 'open'}">Taking entries</button>
      <button class="chip" data-filter="closing" aria-pressed="${state.filter === 'closing'}">Closing in 48h</button>
      <button class="chip" data-filter="all" aria-pressed="${state.filter === 'all'}">All</button>
      <span class="spacer"></span>
      <label class="visually-hidden" for="sort">Sort bounties</label>
      <select id="sort" data-sort>
        <option value="deadline"${state.sort === 'deadline' ? ' selected' : ''}>Soonest deadline</option>
        <option value="pot"${state.sort === 'pot' ? ' selected' : ''}>Biggest pot</option>
        <option value="entries"${state.sort === 'entries' ? ' selected' : ''}>Most entries</option>
        <option value="title"${state.sort === 'title' ? ' selected' : ''}>Title A–Z</option>
      </select>
    </div>
    ${cards ? `<ul class="board">${cards}</ul>` : '<p class="empty">Nothing matches. Clear the search or pick another filter.</p>'}
    <p class="muted small">${num(items.length)} shown · ${num(data.items?.length ?? 0)} on the board</p>`;
}

/** One bounty's page: summary, facts, rewards table, description and rules. */
export function bountyView(bounty) {
  const rewards = bounty.rewardsNow ?? [];
  const rows = rewards
    .map(
      (r) => `
      <tr${r.place <= 3 ? ' class="top"' : ''}>
        <td>${r.place === 1 ? '🥇 1st' : r.place === 2 ? '🥈 2nd' : r.place === 3 ? '🥉 3rd' : `${num(r.place)}th`}</td>
        <td>${money(r.baseUsd)}</td>
        <td>${money(r.feeShareUsd)}</td>
        <td>${money(r.amountUsd)}</td>
      </tr>`,
    )
    .join('');
  return `
    <p class="crumbs"><a href="#/">All bounties</a> · ${esc(bounty.category ?? '')}</p>
    <h1>${esc(bounty.title)}</h1>
    <p>${statusPill(bounty)} <span class="muted">by ${esc(bounty.sponsor?.name ?? 'make.fun')}</span></p>
    <p class="lede">${esc(bounty.summary ?? '')}</p>
    <div class="facts">
      <div class="fact"><small>Live pot</small><b>${potOf(bounty)}</b><span>$${num(bounty.rewardAmount)} prize + $${num(bounty.entryFeesUsd ?? 0)} in fees</span></div>
      <div class="fact"><small>Entry fee</small><b>${bounty.entryFeeUsd ? money(bounty.entryFeeUsd) : 'Free'}</b><span>${bounty.entryFeePayers ? `${num(bounty.entryFeePayers)} paid` : 'no fee charged'}</span></div>
      <div class="fact"><small>Entries</small><b>${num(bounty.submissionCount)}</b><span>submitted so far</span></div>
      <div class="fact"><small>Deadline</small><b data-countdown="${esc(bounty.deadline)}">${timeLeft(bounty.deadline)}</b><span>${date(bounty.deadline)}</span></div>
    </div>
    <div class="actions">
      <a class="btn" href="#/bounty/${encodeURIComponent(bounty.slug)}/leaderboard">View leaderboard</a>
      <a class="btn btn-ghost" href="https://make.fun/bounty/${encodeURIComponent(bounty.slug)}">Open on make.fun ↗</a>
    </div>
    ${rows ? `<h2>Rewards</h2><table class="rewards"><thead><tr><th>Place</th><th>Prize</th><th>Fee share</th><th>Total now</th></tr></thead><tbody>${rows}</tbody></table>` : ''}
    ${bounty.skills?.length ? `<h2>Skills</h2><p>${bounty.skills.map((s) => `<span class="chip">${esc(s)}</span>`).join('')}</p>` : ''}
    <h2>About this bounty</h2>
    <div class="prose">${md(bounty.description ?? '')}</div>
    ${bounty.rules ? `<h2>Rules</h2><div class="prose">${md(bounty.rules)}</div>` : ''}`;
}

/** A bounty's leaderboard: ranked entries with judge win rates. */
export function leaderboardView(data, slug, view) {
  const entries = data.entries ?? [];
  const columns = data.columns ?? [];
  const rateKey = data.rank_key ?? 'judge';
  const rows = entries
    .map((row) => {
      const rate = row.values?.[rateKey];
      const low = row.values?.[`${rateKey}_low`];
      const handle = row.handle
        ? `<a href="#/u/${encodeURIComponent(row.handle)}">@${esc(row.handle)}</a>`
        : '<span class="muted">house</span>';
      return `
      <tr>
        <td class="num"><b>${num(row.rank)}</b></td>
        <td class="handle">${handle}</td>
        <td>${esc(row.title ?? '—')}</td>
        <td class="num nowrap"><span class="ratebar"><i style="width:${Math.max(0, Math.min(100, (Number(rate) ?? 0) / 10000))}%"></i></span>${winRate(rate)}</td>
        <td class="num">${low == null ? '—' : winRate(low)}</td>
        <td>${row.house ? 'house' : row.status ?? ''}</td>
      </tr>`;
    })
    .join('');
  return `
    <p class="crumbs"><a href="#/">All bounties</a> · <a href="#/bounty/${encodeURIComponent(slug)}">${esc(data.competition?.title ?? slug)}</a></p>
    <h1>${esc(data.competition?.title ?? slug)} — leaderboard</h1>
    <p class="lede">${esc(data.title ?? 'Results')} · ranked by ${esc(columns.find((c) => c.key === rateKey)?.title ?? rateKey)}. Rates are the judge's win rate with a 90% interval; ${num(entries.length)} entries ranked.</p>
    <div class="tabs" role="tablist" aria-label="Leaderboard view">
      ${['performance', 'overall']
        .filter((v) => (data.views ?? []).includes(v))
        .map(
          (v) =>
            `<button class="tab" role="tab" data-view="${v}" aria-selected="${view === v}">${v === 'performance' ? 'Performance' : 'Overall'}</button>`,
        )
        .join('')}
    </div>
    ${rows ? `<table class="lb"><thead><tr><th class="num">#</th><th>Entrant</th><th>Entry</th><th class="num">Win rate</th><th class="num">Low</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>` : '<p class="empty">No entries ranked yet — check back after the first grades land.</p>'}`;
}

/** An account's public profile: avatar, bio, record and entries. */
export function profileView(profile) {
  const record = profile.record ?? {};
  const avatar = profile.avatar?.url ?? profile.image;
  const solutions = (profile.solutions ?? [])
    .map((s) => {
      const comp = s.competition ?? {};
      const place = s.placement ? `${num(s.placement)}${s.placement === 1 ? 'st' : s.placement === 2 ? 'nd' : s.placement === 3 ? 'rd' : 'th'} place` : 'Entered';
      return `
      <li class="solution">
        <span><a class="title" href="#/bounty/${encodeURIComponent(comp.slug)}">${esc(s.title ?? comp.title ?? '—')}</a>
        <span class="sub">${esc(comp.title ?? '')} · ${esc(comp.category ?? '')} · ${date(s.entered_at)}</span></span>
        <span class="place">${place}<span>${s.prize_usd ? `${money(s.prize_usd)} won` : s.score?.display && s.score.display !== 'n/a' ? esc(s.score.display) : 'awaiting result'}</span></span>
      </li>`;
    })
    .join('');
  return `
    <div class="profile-head">
      ${avatar ? `<img class="avatar" src="https://make.fun${esc(avatar)}" alt="Avatar of ${esc(profile.display_name ?? profile.handle)}" crossorigin="anonymous">` : ''}
      <div>
        <h1>${esc(profile.display_name ?? profile.handle)}</h1>
        <p class="handle">@${esc(profile.handle)} · joined ${date(profile.joined_at)}</p>
        ${profile.bio ? `<p class="bio">${esc(profile.bio)}</p>` : ''}
        <p class="small muted">${profile.github_login ? `GitHub: ${esc(profile.github_login)} · ` : ''}${profile.discord ? `<a href="${esc(profile.discord.url)}">Discord</a> · ` : ''}<a href="https://make.fun/u/${encodeURIComponent(profile.handle)}">Open on make.fun ↗</a></p>
      </div>
    </div>
    <div class="record">
      <div class="fact"><small>Entered</small><b>${num(record.competitions_entered)}</b><span>bounties</span></div>
      <div class="fact"><small>Placed</small><b>${num(record.competitions_placed)}</b><span>placements</span></div>
      <div class="fact"><small>Wins</small><b>${num(record.competitions_won)}</b><span>1st places</span></div>
      <div class="fact"><small>Podiums</small><b>${num(record.podium_finishes)}</b><span>top 3</span></div>
      <div class="fact"><small>Prizes</small><b>${money(record.prize_usd)}</b><span>won so far</span></div>
    </div>
    <h2>Entries</h2>
    ${solutions ? `<ul class="solutions">${solutions}</ul>` : '<p class="empty">No entries yet.</p>'}`;
}
