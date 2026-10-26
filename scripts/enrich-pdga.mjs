import fs from 'node:fs';
import * as cheerio from 'cheerio';

const file = 'public/data/league.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const eventId = String(data.eventId || '107753');
const base = 'https://www.pdga.com';
const headers = { 'User-Agent': 'Mozilla/5.0 (compatible; OCDGCLeagueHub/1.0)', Accept: 'text/html' };
const clean = s => String(s || '').replace(/\s+/g, ' ').trim();
const digits = s => /^\d+$/.test(clean(s));
const safeUrl = url => {
  try {
    const u = new URL(url, base);
    return u.protocol === 'https:' && /(^|\.)pdga\.com$/.test(u.hostname) ? u.href : '';
  } catch { return ''; }
};
async function html(url) {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(18000) });
  if (!response.ok) throw new Error(`PDGA HTTP ${response.status} for ${url}`);
  return cheerio.load(await response.text());
}
const players = (data.divisions || []).flatMap(d => d.players || []);
const byPdga = new Map(players.filter(p => digits(p.pdga) && Number(p.pdga) > 0).map(p => [clean(p.pdga), p]));
const byName = new Map(players.map(p => [clean(p.name).toLowerCase(), p]));
let ratingsFound = 0;
try {
  const $ = await html(`${base}/tour/event/${encodeURIComponent(eventId)}`);
  $('table').each((_, table) => {
    const headerRows = $(table).find('thead tr').toArray();
    const headers = headerRows.length
      ? $(headerRows[headerRows.length - 1]).children('th,td').toArray().map(el => clean($(el).text()))
      : $(table).find('tr').first().children('th,td').toArray().map(el => clean($(el).text()));
    const nameCol = headers.findIndex(h => /^name$/i.test(h));
    const pdgaCol = headers.findIndex(h => /^pdga#?$/i.test(h));
    const playerRatingCol = headers.findIndex(h => /^rating$/i.test(h));
    const roundCols = headers.map((h, i) => /^rd\s*(\d+)$/i.test(h) ? [i, Number(h.match(/\d+/)[0])] : null).filter(Boolean);
    if (nameCol < 0 || !roundCols.length) return;
    $(table).find('tbody tr').each((_, tr) => {
      const cells = $(tr).children('td').toArray().map(td => clean($(td).text()));
      const anchor = $(tr).find('a[href*="/player/"]').first();
      const id = (anchor.attr('href') || '').match(/\/player\/(\d+)/)?.[1] || (pdgaCol >= 0 ? cells[pdgaCol] : '');
      const name = cells[nameCol]?.toLowerCase();
      const player = byPdga.get(String(id)) || byName.get(name);
      if (!player) return;
      if (playerRatingCol >= 0 && /^\d{3,4}$/.test(cells[playerRatingCol] || '')) {
        player.playerRating = cells[playerRatingCol];
      }
      const ratings = Array.isArray(player.roundRatings) ? [...player.roundRatings] : Array(10).fill('');
      for (const [col, week] of roundCols) {
        if (week < 1 || week > 10) continue;
        const score = cells[col];
        const rating = cells[col + 1];
        if (/^\d+$/.test(score || '') && /^\d{3,4}$/.test(rating || '') &&
            Number(score) === Number(player.scores?.[week - 1])) {
          ratings[week - 1] = rating;
          ratingsFound++;
        }
      }
      if (ratings.some(Boolean)) player.roundRatings = ratings;
    });
  });
  console.log(`PDGA event ratings matched: ${ratingsFound}`);
} catch (e) {
  console.warn('PDGA event ratings unavailable:', e.message);
}
// Download profile photos into the deployed site rather than hotlinking PDGA.
// Some PDGA image URLs are HTTP, lazy-loaded, or served from an image CDN.
const imageSources = ($, el) => {
  const node = $(el);
  return [node.attr('data-src'), node.attr('data-original'), node.attr('src'),
    ...String(node.attr('srcset') || '').split(',').map(v => v.trim().split(/\s+/)[0])]
    .filter(Boolean).filter(v => !v.startsWith('data:'));
};
const imageUrl = raw => {
  try {
    const url = new URL(raw, base);
    if (url.protocol === 'http:') url.protocol = 'https:';
    return url.protocol === 'https:' ? url.href : '';
  } catch { return ''; }
};
const placeholder = url => /default|placeholder|anonymous|silhouette|no[-_]photo|blank|logo/i.test(url);
let photosFound = 0;
fs.mkdirSync('public/player-photos', { recursive: true });
for (const [id, player] of byPdga) {
  try {
    const $ = await html(`${base}/player/${id}`);
    const images = $('img').toArray().map(el => {
      const node = $(el);
      const alt = clean(node.attr('alt')).toLowerCase();
      const classes = [node.attr('class'), node.parent().attr('class'), node.closest('.field').attr('class')].join(' ').toLowerCase();
      const name = clean(player.name).toLowerCase();
      const rank = (alt.includes(name) && alt.includes('picture') ? 100 : 0) +
        (alt.includes('picture') && alt.includes(id) ? 90 : 0) +
        (/user.picture|profile.picture|field--name-user-picture|field-name-field-player-photo/.test(classes) ? 70 : 0);
      return { rank, sources: imageSources($, el) };
    }).filter(i => i.rank > 0).sort((a, b) => b.rank - a.rank);
    for (const candidate of images) {
      for (const source of candidate.sources) {
        const url = imageUrl(source);
        if (!url || placeholder(url)) continue;
        try {
          const response = await fetch(url, { headers, signal: AbortSignal.timeout(12000) });
          if (!response.ok) continue;
          const mime = (response.headers.get('content-type') || '').split(';')[0].toLowerCase();
          const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }[mime];
          if (!extension) continue;
          const bytes = Buffer.from(await response.arrayBuffer());
          if (bytes.length < 500 || bytes.length > 5_000_000) continue;
          const filename = `${id}.${extension}`;
          fs.writeFileSync(`public/player-photos/${filename}`, bytes);
          player.photoUrl = `player-photos/${filename}`;
          photosFound++;
          break;
        } catch (error) {
          console.warn(`Image fetch failed for ${id}: ${error.message}`);
        }
      }
      if (player.photoUrl) break;
    }
  } catch (error) {
    console.warn(`PDGA profile ${id} unavailable: ${error.message}`);
  }
}
fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
console.log(`PDGA profile photos matched: ${photosFound}`);
