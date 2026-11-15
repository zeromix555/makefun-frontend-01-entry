// A make.fun frontend: the board, a bounty's page, its leaderboard and an
// account's public profile, on hash routes — every surface reachable by a
// link and by its own URL, with no sign-in and no writes.
//
//   #/                              the bounty board
//   #/bounty/<slug>                one bounty's page
//   #/bounty/<slug>/leaderboard    that bounty's leaderboard
//   #/u/<handle>                   an account's public profile
//
// window.__shotReady is false while a route loads and true once its data is
// on screen, so a screenshot script knows when to capture. A one-second
// ticker refreshes the countdowns in place instead of rebuilding the page.

import { apiStats, clearCache, getBounties, getBounty, getLeaderboard, getProfile } from './api.js';
import { boardView, bountyView, leaderboardView, profileView } from './views.js';
import { timeLeft } from './format.js';

const app = document.getElementById('app');
const searchInput = document.getElementById('q');

/** Board toolbar state: filter, sort and search, kept across re-renders. */
const boardState = { filter: 'open', sort: 'deadline', query: '' };

/** A cached board payload, so the toolbar never refetches. */
let boardData = null;

function skeleton() {
  return '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';
}

function errorView(message, retry) {
  return `
    <div class="error">
      <h1>Couldn’t load this page</h1>
      <p>${message}. The make.fun API may be briefly unreachable — your data is safe, nothing was sent anywhere.</p>
      <button type="button" data-retry="${retry}">Try again</button>
    </div>`;
}

function setNav(route) {
  for (const link of document.querySelectorAll('[data-nav]')) {
    link.setAttribute('aria-current', link.dataset.nav === route ? 'page' : 'false');
    if (link.dataset.nav !== route) link.removeAttribute('aria-current');
  }
}

/** Parse the hash into a route: { name, slug, handle, view }. */
export function parseRoute(hash) {
  const path = (hash || '#/').replace(/^#/, '') || '/';
  let match = path.match(/^\/bounty\/([^/]+)\/leaderboard$/);
  if (match) return { name: 'leaderboard', slug: decodeURIComponent(match[1]), view: 'performance' };
  match = path.match(/^\/bounty\/([^/]+)$/);
  if (match) return { name: 'bounty', slug: decodeURIComponent(match[1]) };
  match = path.match(/^\/u\/([^/]+)$/);
  if (match) return { name: 'profile', handle: decodeURIComponent(match[1]) };
  return { name: 'board' };
}

async function renderBoard() {
  setNav('board');
  document.title = 'Bounties | make.fun client';
  if (!boardData) {
    app.innerHTML = skeleton();
    try {
      boardData = await getBounties();
    } catch (error) {
      app.innerHTML = errorView('The bounty board did not load', 'board');
      window.__shotReady = true;
      return;
    }
  }
  app.innerHTML = boardView(boardData, boardState);
  window.__shotReady = true;
}

async function renderBounty(slug) {
  setNav('featured');
  app.innerHTML = skeleton();
  try {
    const bounty = await getBounty(slug);
    document.title = `${bounty.title} | make.fun client`;
    app.innerHTML = bountyView(bounty);
  } catch (error) {
    document.title = 'Bounty not found | make.fun client';
    app.innerHTML = errorView(
      error.status === 404 ? `No bounty named “${slug}” exists` : 'This bounty did not load',
      'bounty',
    );
  }
  window.__shotReady = true;
}

async function renderLeaderboard(slug, view) {
  setNav('featured');
  app.innerHTML = skeleton();
  try {
    const data = await getLeaderboard(slug, view);
    document.title = `${data.competition?.title ?? slug} leaderboard | make.fun client`;
    app.innerHTML = leaderboardView(data, slug, view);
  } catch (error) {
    document.title = 'Leaderboard not found | make.fun client';
    app.innerHTML = errorView('This leaderboard did not load', 'leaderboard');
  }
  window.__shotReady = true;
}

async function renderProfile(handle) {
  setNav('board');
  app.innerHTML = skeleton();
  try {
    const profile = await getProfile(handle);
    document.title = `@${profile.handle} | make.fun client`;
    app.innerHTML = profileView(profile);
  } catch (error) {
    document.title = 'Profile not found | make.fun client';
    app.innerHTML = errorView(
      error.status === 404 ? `No account named “@${handle}” exists` : 'This profile did not load',
      'profile',
    );
  }
  window.__shotReady = true;
}

async function render() {
  window.__shotReady = false;
  window.scrollTo(0, 0);
  const route = parseRoute(location.hash);
  if (route.name === 'bounty') await renderBounty(route.slug);
  else if (route.name === 'leaderboard') await renderLeaderboard(route.slug, route.view);
  else if (route.name === 'profile') await renderProfile(route.handle);
  else await renderBoard();
}

/** Refresh every countdown on screen, in place, once a second. */
function tick() {
  for (const el of document.querySelectorAll('[data-countdown]')) {
    const text = timeLeft(el.dataset.countdown);
    const bold = el.querySelector('b');
    if (bold) bold.textContent = text;
    else el.textContent = text;
  }
}

/** Toolbar clicks and the sort menu re-render the board without refetching. */
app.addEventListener('click', (event) => {
  const filterButton = event.target.closest('[data-filter]');
  if (filterButton) {
    boardState.filter = filterButton.dataset.filter;
    app.innerHTML = boardView(boardData, boardState);
    return;
  }
  const viewButton = event.target.closest('[data-view]');
  if (viewButton) {
    const route = parseRoute(location.hash);
    renderLeaderboard(route.slug, viewButton.dataset.view);
    return;
  }
  const retryButton = event.target.closest('[data-retry]');
  if (retryButton) {
    if (retryButton.dataset.retry === 'board') {
      boardData = null;
      clearCache();
    }
    render();
  }
});

app.addEventListener('change', (event) => {
  if (event.target.matches('[data-sort]')) {
    boardState.sort = event.target.value;
    app.innerHTML = boardView(boardData, boardState);
  }
});

/** Top search: a bare handle goes to the profile, anything else searches the board. */
document.getElementById('topsearch').addEventListener('submit', (event) => {
  event.preventDefault();
  const query = searchInput.value.trim();
  if (query.startsWith('@')) {
    location.hash = `#/u/${encodeURIComponent(query.slice(1))}`;
    return;
  }
  boardState.query = query;
  boardState.filter = 'all';
  if (parseRoute(location.hash).name !== 'board') location.hash = '#/';
  else app.innerHTML = boardView(boardData, boardState);
  searchInput.focus();
});

searchInput.addEventListener('input', () => {
  if (parseRoute(location.hash).name !== 'board') return;
  boardState.query = searchInput.value;
  app.innerHTML = boardView(boardData, boardState);
});

window.addEventListener('hashchange', render);
window.__mfStats = apiStats;
window.__shotReady = false;
setInterval(tick, 1000);
render();
