// Small helpers for showing API values. Everything the API hands us is
// treated as untrusted text and escaped before it reaches innerHTML.

/** Text made safe to put inside HTML. */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** A dollar amount ('1000.00', 250 or '0.50') as '$1,000' or '$0.50'. */
export function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

/** A count as '1,234'. */
export function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString('en-US') : '—';
}

/** A deadline as a date in UTC. */
export function date(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })} UTC`;
}

/** Milliseconds until a deadline, split for the countdown ticker. */
export function timeParts(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return null;
  return {
    days: Math.floor(ms / 86400000),
    hours: Math.floor((ms % 86400000) / 3600000),
    minutes: Math.floor((ms % 3600000) / 60000),
    seconds: Math.floor((ms % 60000) / 1000),
  };
}

/** The time until a deadline: '2d 4h left', '35m left', or 'ended'. */
export function timeLeft(iso) {
  const p = timeParts(iso);
  if (!p) return 'ended';
  if (p.days > 0) return `${p.days}d ${p.hours}h left`;
  if (p.hours > 0) return `${p.hours}h ${p.minutes}m left`;
  if (p.minutes > 0) return `${p.minutes}m left`;
  return `${p.seconds}s left`;
}

/** True when a bounty still takes entries: by its deadline, never its status alone. */
export function entriesOpen(bounty) {
  return new Date(bounty.deadline).getTime() > Date.now();
}

/** A win rate stored as micro units (500000 = 50%) as '50.0%'. */
export function winRate(micro) {
  const n = Number(micro);
  if (!Number.isFinite(n)) return '—';
  return `${(n / 10000).toFixed(1)}%`;
}

/**
 * A tiny safe Markdown renderer for bounty descriptions and rules: escape
 * first, then headings, bold, italic, inline code, links, lists and
 * paragraphs. Code fences pass through as <pre>. No raw HTML survives.
 */
export function md(source) {
  const lines = String(source ?? '').replace(/\r\n/g, '\n').split('\n');
  let html = '';
  let list = null;
  let fence = false;

  const inline = (text) => {
    let out = esc(text);
    out = out.replace(/`([^`]+)`/g, (_, code) => `<code>${code}</code>`);
    out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" rel="noopener">$1</a>');
    return out;
  };
  const closeList = () => {
    if (list) {
      html += `</${list}>`;
      list = null;
    }
  };

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      if (fence) {
        html += '</code></pre>';
        fence = false;
      } else {
        closeList();
        html += '<pre><code>';
        fence = true;
      }
      continue;
    }
    if (fence) {
      html += `${esc(line)}\n`;
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    const quote = line.match(/^>\s?(.*)$/);
    if (heading) {
      closeList();
      const level = heading[1].length + 1;
      html += `<h${level}>${inline(heading[2])}</h${level}>`;
    } else if (bullet || ordered) {
      const tag = bullet ? 'ul' : 'ol';
      if (list !== tag) {
        closeList();
        html += `<${tag}>`;
        list = tag;
      }
      html += `<li>${inline((bullet ?? ordered)[1])}</li>`;
    } else if (quote) {
      closeList();
      html += `<blockquote>${inline(quote[1])}</blockquote>`;
    } else if (line.trim() === '') {
      closeList();
    } else {
      closeList();
      html += `<p>${inline(line)}</p>`;
    }
  }
  closeList();
  if (fence) html += '</code></pre>';
  return html;
}
