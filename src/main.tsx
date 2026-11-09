
import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Trophy, Wallet, Home, CalendarDays, ExternalLink, ClipboardCheck, RefreshCw
} from 'lucide-react';
import './style.css';

type Player = {
  place: string;
  points: string;
  name: string;
  pdga: string;
  rounds: string;
  qualified: string;
  payout: string;
  highest: string;
  rating: string;
  scores: string[];
  roundRatings?: (string | number)[];
  photoUrl?: string;
  playerRating?: string;
};

type Division = {
  name: string;
  pot: string;
  paidSpots: string;
  players: Player[];
};

type Finance = {
  acePot: number;
  weeklyLayoutTotal: number;
  longTotal: number;
  shortTotal: number;
  divisionTotal: number;
  weekly: {
    week: string;
    long: number;
    short: number;
    ace: number;
  }[];
  divisionPots: {
    division: string;
    amount: number;
  }[];
};

type WeeklyPayout = { week: number; layout: string; place: number; player: string; score: string; payout: number; tieSituation: string; status?: string; };

type SignIn = { name: string; pdga: string; division: string; timestamp?: string };
type RollCallData = { week: number; signIns: SignIn[] };
type CardAssignment = { hole: number; players: SignIn[] };

type League = {
  rollCall?: RollCallData;
  weeklyPayouts?: WeeklyPayout[];
  eventId: string;
  leagueName: string;
  updatedAt: string | null;
  divisions: Division[];
  finance: Finance;
};

type Layout = {
  date: string;
  short: string;
  long: string;
  hazards?: boolean;
};

const weeklyLayouts: Layout[] = [
  {
    date: 'Sep 6',
    short: 'Short tees → White pins',
    long: 'Long tees → White pins'
  },
  {
    date: 'Sep 13',
    short: 'Short tees → Yellow pins',
    long: 'Long tees → Yellow pins'
  },
  {
    date: 'Sep 20',
    short: 'Short tees → White pins',
    long: 'Short tees → Yellow pins'
  },
  {
    date: 'Sep 27',
    short: 'Long tees → White pins',
    long: 'Long tees → White pins',
    hazards: true
  },
  {
    date: 'Oct 18',
    short: 'Short tees → White pins',
    long: 'Long tees → Yellow pins'
  },
  {
    date: 'Oct 25',
    short: 'Short tees → Yellow pins',
    long: 'Long tees → White pins'
  },
  {
    date: 'Nov 1',
    short: 'Short tees → White pins',
    long: 'Long tees → Yellow pins'
  },
  {
    date: 'Nov 8',
    short: 'Long tees → White pins',
    long: 'Long tees → White pins',
    hazards: true
  },
  {
    date: 'Nov 15',
    short: 'Short tees → Yellow pins',
    long: 'Short tees → Yellow pins',
    hazards: true
  },
  {
    date: 'Nov 22',
    short: 'Short tees → White pins',
    long: 'Long tees → Yellow pins'
  }
];

const isShortDivision = (name: string) =>
  /^(RAG|RAF|RAE)\b/.test(name);

const formatScore = (value: string | number) => {
  const raw = String(value ?? '').trim();
  if (!/^\d+$/.test(raw)) return raw || '—';
  const diff = Number(raw) - 54;
  return `${raw} (${diff === 0 ? 'E' : diff > 0 ? `+${diff}` : diff})`;
};

function RatingMark({ value }: { value: string | number }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
    <span aria-label="PDGA rating" title="PDGA rating" style={{
      display: 'inline-grid', placeItems: 'center', width: 17, height: 17,
      border: '1.5px solid currentColor', borderRadius: 3,
      transform: 'rotate(45deg)', fontSize: 11, fontWeight: 800
    }}><span style={{ transform: 'rotate(-45deg)' }}>R</span></span>
    {value}
  </span>;
}

const money = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(n);


const holes = [1, 3, 6, 8, 15, 17];
const divisionCode = (value: string) => (value.match(/^(RPA|RAH|RAD|RAE|RAF|RAG)/i)?.[1] || value).toUpperCase();
const playerKey = (p: SignIn) => p.pdga && p.pdga !== '0' ? 'pdga:' + p.pdga : 'name:' + p.name.trim().toLowerCase();
const layoutGroup = (p: SignIn) => ['RPA','RAH','RAD'].includes(divisionCode(p.division)) ? 'Longs' : 'Shorts';

function buildCards(people: SignIn[]): { cards: CardAssignment[]; error: string } {
  const n = people.length;
  if (!n) return { cards: [], error: 'Confirm attendance to generate cards.' };
  if (n < 3 || n > 30) return { cards: [], error: `Cannot assign ${n} players to six holes with 3–5 per card (requires 3–30 players).` };
  const ordered = [...people].sort((a,b) => layoutGroup(a).localeCompare(layoutGroup(b)) || divisionCode(a.division).localeCompare(divisionCode(b.division)) || a.name.localeCompare(b.name));
  const maxCards = Math.min(6, Math.floor(n / 3));
  // Prefer more three-player cards; use four/five only when required.
  let sizes: number[] = [];
  for (let count = maxCards; count >= Math.ceil(n / 5); count--) {
    const extra = n - 3 * count;
    if (extra >= 0 && extra <= 2 * count) {
      sizes = Array(count).fill(3);
      for (let i = count - 1, left = extra; i >= 0 && left > 0; i--) {
        const add = Math.min(2, left);
        sizes[i] += add;
        left -= add;
      }
      break;
    }
  }
  if (!sizes.length) return { cards: [], error: 'No valid 3–5 player card arrangement.' };
  // Dynamic programming: minimize mixed layouts first, then mixed divisions.
  const cost = (group: SignIn[]) => {
    const layouts = new Set(group.map(layoutGroup)).size;
    const divisions = new Set(group.map(p => divisionCode(p.division))).size;
    return (layouts - 1) * 10000 + (divisions - 1) * 100;
  };
  const memo = new Map<string, { cost: number; groups: SignIn[][] }>();
  const solve = (remaining: SignIn[], index: number): { cost: number; groups: SignIn[][] } | null => {
    if (index === sizes.length) return remaining.length ? null : { cost: 0, groups: [] };
    const key = index + ':' + remaining.map(playerKey).join('|');
    if (memo.has(key)) return memo.get(key)!;
    const size = sizes[index];
    let best: { cost: number; groups: SignIn[][] } | null = null;
    // Keep search practical: contiguous sorted blocks, with boundary choices from both ends.
    for (const fromEnd of [false, true]) {
      const group = fromEnd ? remaining.slice(-size) : remaining.slice(0,size);
      const rest = fromEnd ? remaining.slice(0,-size) : remaining.slice(size);
      const next = solve(rest,index+1);
      if (!next) continue;
      const candidate = { cost: cost(group) + next.cost, groups: [group,...next.groups] };
      if (!best || candidate.cost < best.cost) best = candidate;
    }
    if (best) memo.set(key,best);
    return best;
  };
  const solution = solve(ordered,0);
  return { cards: (solution?.groups || []).map((players,i) => ({ hole: holes[i], players })), error: solution ? '' : 'Unable to generate valid cards.' };
}


// League weeks advance Sundays at 6:00 PM America/Chicago.
// Dates match the published schedule, including the October break.
const cutoffDates = ['2026-09-06','2026-09-13','2026-09-20','2026-09-27','2026-10-18','2026-10-25','2026-11-01','2026-11-08','2026-11-15','2026-11-22'];
function scheduledRollWeek(now: Date): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago', year:'numeric', month:'2-digit', day:'2-digit',
    hour:'2-digit', minute:'2-digit', hourCycle:'h23'
  }).formatToParts(now);
  const get = (name:string) => parts.find(p => p.type === name)?.value || '';
  const date = `${get('year')}-${get('month')}-${get('day')}`;
  const time = Number(get('hour')) * 60 + Number(get('minute'));
  for (let i=0; i<cutoffDates.length; i++) {
    if (date < cutoffDates[i] || (date === cutoffDates[i] && time < 18*60)) return i+1;
  }
  return 0; // Season complete.
}

function App() {
  const [data, setData] = useState<League | null>(null);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const id = window.setInterval(() => setNow(new Date()), 30000); return () => clearInterval(id); }, []);
  const scheduledWeek = scheduledRollWeek(now);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('Home');
  const [division, setDivision] = useState('All');
  const [selected, setSelected] = useState<string | null>(null);
  const [week, setWeek] = useState<number | 'All'>('All');
  const [present, setPresent] = useState<string[]>([]);
  const [cards, setCards] = useState<CardAssignment[]>([]);
  const [cardError, setCardError] = useState('');
  const [moveTarget, setMoveTarget] = useState('');
  const [liveRoll, setLiveRoll] = useState<RollCallData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState('');
  const liveUrl = 'https://script.google.com/macros/s/AKfycbzDs9yaiJNRqcofHtUlSi20WlgXC2CusQ3WKtRF-6Tg8XKFaux4sBchn3KQI8mS29N1rg/exec';

  useEffect(() => {
    fetch(
      `${import.meta.env.BASE_URL}data/league.json?ts=${Date.now()}`
    )
      .then(r => {
        if (!r.ok) throw Error('Data unavailable');
        return r.json();
      })
      .then(setData)
      .catch(e => setError(String(e)));
  }, []);

  const sourceRoll = liveRoll || data?.rollCall;
  const rollCall: RollCallData | null = scheduledWeek ? {week:scheduledWeek,signIns:sourceRoll?.week === scheduledWeek ? sourceRoll.signIns : []} : null;
  const refreshRollCall = () => {
    if (!liveUrl.trim() || !/^https:\/\/script\.google\.com\/macros\/s\//.test(liveUrl.trim())) {
      setRefreshMessage('Enter the deployed Apps Script web app URL to enable live refresh.');
      return;
    }
    setRefreshing(true);
    setRefreshMessage('Checking latest form responses…');
    const callback = '__ocdgcRollCall_' + Date.now();
    const script = document.createElement('script');
    let finished = false;
    const global = window as unknown as Record<string, unknown>;
    const cleanup = () => { if (finished) return; finished = true; clearTimeout(timer); script.remove(); delete global[callback]; setRefreshing(false); };
    const timer = window.setTimeout(() => { cleanup(); setRefreshMessage('Refresh timed out. Check the Apps Script deployment and access settings.'); }, 15000);
    global[callback] = (payload: RollCallData) => {
      if (!payload || !Number.isInteger(payload.week) || !Array.isArray(payload.signIns)) {
        cleanup(); setRefreshMessage('The live endpoint did not return a valid roll call.'); return;
      }
      const oldKeys = new Set(rollCall?.signIns.map(playerKey) || []);
      const newPlayers = payload.signIns.filter(p => !oldKeys.has(playerKey(p))).length;
      if (payload.week === scheduledWeek && newPlayers) { setCards([]); }
      setLiveRoll(payload);
      cleanup();
      setRefreshMessage(payload.week !== scheduledWeek ? `Week ${scheduledWeek || 'season complete'} is active, but the live export still returns Week ${payload.week}. Create the Week ${scheduledWeek} response tab in Google Sheets to begin collecting the new week's sign-ins.` : `Updated Week ${payload.week}: ${payload.signIns.length} sign-ins${newPlayers ? ` · ${newPlayers} new · regenerate cards after confirming attendance` : ' · no new players'}.`);
    };
    script.onerror = () => { cleanup(); setRefreshMessage('Live refresh failed. Verify the Apps Script URL and deployment permissions.'); };
    const url = new URL(liveUrl.trim());
    url.searchParams.set('view', 'rollcall');
    url.searchParams.set('callback', callback);
    url.searchParams.set('_', String(Date.now()));
    script.src = url.toString();
    document.head.appendChild(script);
  };
  const signIns = useMemo(() => {
    const found = new Map<string,SignIn>();
    for (const p of rollCall?.signIns || []) found.set(playerKey(p),p);
    return [...found.values()].sort((a,b) => divisionCode(a.division).localeCompare(divisionCode(b.division)) || a.name.localeCompare(b.name));
  },[rollCall]);
  const confirmed = signIns.filter(p => present.includes(playerKey(p)));
  useEffect(() => { setPresent([]); setCards([]); setCardError(''); setRefreshMessage(''); }, [scheduledWeek]);
  const generate = () => { const result = buildCards(confirmed); setCards(result.cards); setCardError(result.error); };
  const movePlayer = (key: string, destination: number) => {
    const source = cards.find(c => c.players.some(p => playerKey(p) === key));
    const target = cards.find(c => c.hole === destination);
    if (!source || !target || source === target) return;
    if (source.players.length <= 3 || target.players.length >= 5) {
      setCardError('Move blocked: each active card must contain 3–5 players.');
      return;
    }
    const player = source.players.find(p => playerKey(p) === key)!;
    setCards(cards.map(c => c.hole === source.hole ? {...c,players:c.players.filter(p => playerKey(p) !== key)} : c.hole === destination ? {...c,players:[...c.players,player]} : c));
    setCardError('');
  };
  const divisions = data?.divisions || [];

  const active = useMemo(
    () =>
      division === 'All'
        ? divisions
        : divisions.filter(d => d.name.startsWith(division)),
    [divisions, division]
  );

  const players = active.flatMap(d =>
    d.players.map(p => ({
      ...p,
      division: d.name
    }))
  );

  const totalPlayers = divisions.reduce(
    (n, d) => n + d.players.length,
    0
  );

  function weeklyLeaderboard(short: boolean, weekIndex: number) {
    const layout = short ? 'Shorts' : 'Longs';
    const records = (data?.weeklyPayouts || [])
      .filter(p => Number(p.week) === weekIndex + 1 && p.layout === layout)
      .sort((a, b) => Number(a.place) - Number(b.place));
    const contribution = data?.finance.weekly?.[weekIndex];
    const total = contribution ? (short ? contribution.short : contribution.long) : 0;
    return (
      <div key={layout} style={{ marginTop: 22 }}>
        <div className="between">
          <h3>{layout} · {short ? 'RAG / RAF / RAE' : 'RAD / RAH / RPA'}</h3>
          <b>Layout pool: {money(total)}</b>
        </div>
        <p><b>{short ? weeklyLayouts[weekIndex].short : weeklyLayouts[weekIndex].long}</b>
          {!short && weeklyLayouts[weekIndex].hazards ? ' · Sidewalk hazards in effect' : ''}
        </p>
        {!Array.isArray(data?.weeklyPayouts) ? (
          <p className="muted">Awaiting payout history export.</p>
        ) : records.length ? (
          <div className="overflow">
            <table>
              <thead><tr><th>Cash place</th><th>Player</th><th>Score</th><th>Cash</th></tr></thead>
              <tbody>{records.map(p => (
                <tr key={p.place}>
                  <td><b>{p.place === 1 ? '1st cash' : '2nd cash'}</b></td>
                  <td>{p.player || (p.tieSituation?.toLowerCase().includes('playoff') ? 'Awaiting playoff result' : 'Pending')}</td>
                  <td>{p.player ? formatScore(p.score) : '—'}</td>
                  <td><b>{p.player ? money(Number(p.payout) || 0) : 'Pending'}</b></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <p className="muted">No payout results recorded yet.</p>}
      </div>
    );
  }

  return (
    <>
      <header>
        <div className="wrap header">
          <div className="brand">
            <div className="logo">
  <img
    src={`${import.meta.env.BASE_URL}ocdgc-logo.png`}
    alt="Okaloosa County Disc Golf Club logo"
  />
</div>
            <div>
              <strong>OCDGC</strong>
              <small>League Hub</small>
            </div>
          </div>

          <a
            className="pdga"
            href={`https://www.pdga.com/tour/event/${
              data?.eventId || '107753'
            }`}
            target="_blank"
            rel="noreferrer"
          >
            PDGA Event <ExternalLink size={14} />
          </a>
        </div>
      </header>

      <main className="wrap">
        {tab === 'Home' && (
  <section className="hero">
          <span className="eyebrow">
            OKALOOSA COUNTY DISC GOLF CLUB
          </span>

          <h1>
            {data?.leagueName || 'Ferry Sunday Singles II'}
          </h1>

          <p>
            Standings, player ratings, weekly rounds,
            and league finances.
          </p>

          <div className="metrics">
            <div>
              <b>{totalPlayers || '—'}</b>
              <small>Players</small>
            </div>
            <div>
              <b>{data ? money((data.finance.divisionTotal || 0) + (data.finance.weeklyLayoutTotal || 0)) : '—'}</b>
              <small>Total Projected Payouts</small>
            </div>
            <div>
              <b>
                {data
                  ? money(data.finance.acePot)
                  : '—'}
              </b>
              <small>Ace Pot</small>
            </div>
          </div>
        </section>
        )}

        {error && <p className="notice">{error}</p>}

        {!data?.divisions.length && (
          <p className="notice">
            Website ready! League data will appear
            after the first successful Google Sheets export.
          </p>
        )}

        {tab === 'Home' && (
          <section className="card">
            <h2>League Information</h2>

            <p>
              OCDGC Ferry Sunday Singles II ·
              Ferry Park Disc Golf Course ·
              Fort Walton Beach, Florida
            </p>

            <p>
              <b>
                Sundays, September 6 – November 22, 2026
              </b>
            </p>

            <p>
              Check-in: 11:15–11:30 AM ·
              Tee time: 11:30 AM
            </p>

            <p>
              PDGA membership not required.
              All skill levels welcome.
            </p>

            <p>
              <a
                href="https://forms.gle/xToUSkTCjQaai8Uc9"
                target="_blank"
                rel="noreferrer"
              >
                <b>Weekly League Sign-In ↗</b>
              </a>
            </p>

            <h3>Course & Basket Updates</h3>

            <p>
              <b>Hole 8:</b> A temporary basket
              is in use, with its location changing
              from week to week. Confirm its
              placement before playing.
            </p>

            <p>
              <b>Hole 17:</b> The original white
              basket is repaired and back in play
              at its original location.
            </p>

            <div className="notice" style={{ marginTop: 22, marginBottom: 20 }}>
              <p><b>WAIT TO LOG-IN TO YOUR SCORECARD UNTIL EVENT DIRECTOR GIVES THE GREEN LIGHT!</b></p>
              <p>
                <b>PDGA Login Code: FERRY</b> ·{' '}
                <a href="https://www.pdga.com/apps/tournament/score/login" target="_blank" rel="noreferrer">
                  PDGA Live Scoring Login ↗
                </a>
              </p>
            </div>

            <h3>10-Week Layout Schedule</h3>

            <p className="muted">
              Shorts divisions: RAG, RAF, RAE.
              Longs divisions: RAD, RAH, RPA.
              In Weeks 4, 8, and 9, both groups
              use the same tees and pins, but
              the Longs divisions play with
              additional sidewalk hazards.
            </p>

            <div className="overflow">
              <table>
                <thead>
                  <tr>
                    <th>Week</th>
                    <th>Shorts</th>
                    <th>Longs</th>
                  </tr>
                </thead>

                <tbody>
                  {weeklyLayouts.map((w, i) => (
                    <tr key={i}>
                      <td>
                        <b>{i + 1}</b>
                        <small> · {w.date}</small>
                      </td>

                      <td>{w.short}</td>

                      <td>
                        {w.long}
                        {w.hazards && (
                          <div>
                            <b>+ Sidewalk hazards</b>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>


          </section>
        )}

        {tab === 'Division Standings' && (
          <>
            <div className="sectionTitle">
              <h2>Division Standings</h2>
              <span>Tap a player for weekly scores</span>
            </div>

            <div className="pills">
              {[
                'All', 'RPA', 'RAH', 'RAD',
                'RAE', 'RAF', 'RAG'
              ].map(d => (
                <button
                  key={d}
                  className={division === d ? 'active' : ''}
                  onClick={() => setDivision(d)}
                >
                  {d}
                </button>
              ))}
            </div>

            {active.map(d => (
              <section key={d.name} style={{ marginTop: 18, marginBottom: 26 }}>
                <div style={{ width: '100%' }}>
              {[d].map(d => {
                const top = d.players.reduce<Player | null>(
                  (best, p) =>
                    !best || Number(p.highest) > Number(best.highest)
                      ? p : best,
                  null
                );
                return (
                  <div className="card divisionCard" key={d.name}>
                    <div className="between">
                      <h3>{d.name}</h3>
                      <span className="chip">{d.players.length} players</span>
                    </div>
                    <div className="between"><span>Division pot</span><b>{d.pot}</b></div>
                    <div className="between"><span>Projected paid spots</span><b>{d.paidSpots}</b></div>
                    <div className="between">
                      <span>Payout qualified</span>
                      <b>{d.players.filter(p => p.qualified.toUpperCase() === 'YES').length}</b>
                    </div>
                    <div className="between">
                      <span>Highest rated round</span>
                      <b>{top && Number(top.highest) > 0
                        ? `${top.highest} · ${top.name}` : '—'}</b>
                    </div>
                  </div>
                );
              })}

                </div>
                <div className="roster" style={{ marginTop: 12 }}>
              {d.players.map((player, i) => {
                const p = { ...player, division: d.name };
                return (
                <div
                  className="player"
                  key={`${p.division}-${p.name}-${i}`}
                >
                  <button
                    className="playerButton"
                    onClick={() =>
                      setSelected(
                        selected === `${p.division}-${i}`
                          ? null
                          : `${p.division}-${i}`
                      )
                    }
                  >
                    <span className="place">
                      #{p.place}
                    </span>

                    {p.photoUrl && (
                      <img
                        src={p.photoUrl.startsWith("http") ? p.photoUrl : `${import.meta.env.BASE_URL}${p.photoUrl.replace(/^\//, "")}`}
                        alt={`${p.name} profile`}
                        loading="lazy"
                        style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }}
                        onError={e => { e.currentTarget.style.display = 'none'; }}
                      />
                    )}

                    <span className="playerName">
                      <b style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}><span>{p.name}</span>{p.pdga && <span style={{ fontSize: 12, fontWeight: 500, color: '#637c7b' }}>#{p.pdga}</span>}{p.playerRating && <RatingMark value={p.playerRating} />}</b>
                      <small>
                        {p.division} · {p.rounds} rounds ·{' '}
                        {p.qualified === 'YES'
                          ? 'Qualified'
                          : 'Not qualified'}
                      </small>
                    </span>

                    <span className="points">
                      <b>{p.points}</b>
                      <small>points</small>
                    </span>
                  </button>

                  <div className="playerStats">
                    <span>
                      Projected <b>{p.payout || '—'}</b>
                    </span>
                    <span>
                      Top rated <b>{p.highest || '—'}</b>
                    </span>
                    <span>
                      Event rating <b>{p.rating || '—'}</b>
                    </span>
                  </div>

                  {selected === `${p.division}-${i}` && (
                    <div className="details">
                      <div style={{ margin: '12px 0' }}>
                        <b>Weekly Scores:</b>
                        {p.scores.some(s => String(s || '').trim()) ? (
                          <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                            {p.scores.map((score, i) => {
                              if (!String(score || '').trim()) return null;
                              const rating = p.roundRatings?.[i];
                              return (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                                  <span>W{i + 1}: {formatScore(score)} - {((isShortDivision(d.name) ? weeklyLayouts[i]?.short : weeklyLayouts[i]?.long) || 'Layout unavailable').replace(' tees → ', 's to ').replace(' pins', 's')}</span>
                                  <span>{rating ? <RatingMark value={rating} /> : 'Rating pending'}</span>
                                </div>
                              );
                            })}
                          </div>
                        ) : <p>No scores recorded</p>}
                      </div>

                      {p.pdga && (
                        <a
                          href={`https://www.pdga.com/player/${p.pdga}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View PDGA profile ↗
                        </a>
                      )}
                    </div>
                  )}
                </div>
                );
              })}
                </div>
              </section>
            ))}
          </>
        )}

        {tab === 'Weekly Payouts' && (
          <>
            <div className="sectionTitle">
              <h2>Weekly Payouts</h2>
              <span>Official weekly layout cash winners</span>
            </div>
            <div className="pills">
              <button className={week === 'All' ? 'active' : ''} onClick={() => setWeek('All')}>All</button>
              {weeklyLayouts.map((w, i) => (
                <button key={i} className={week === i ? 'active' : ''} onClick={() => setWeek(i)}>W{i + 1}</button>
              ))}
            </div>
            {(week === 'All' ? weeklyLayouts.map((_, i) => i) : [week]).map(i => (
              <section className="card" key={i} style={{ marginTop: 16 }}>
                <h2>Week {i + 1} · {weeklyLayouts[i].date}</h2>
                {weeklyLeaderboard(true, i)}
                {weeklyLeaderboard(false, i)}
              </section>
            ))}
            <p className="muted">Official cash places reflect finalized playoff results from the league payout history. Unresolved playoff positions remain pending.</p>
          </>
        )}


        {tab === 'Roll Call' && (
          <>
            <div className="sectionTitle"><h2>Roll Call & Card Builder</h2><span>{scheduledWeek ? `Week ${scheduledWeek} · ${weeklyLayouts[scheduledWeek-1]?.date} · TD worksheet` : 'Season complete'}</span></div>
            <div className="notice">Public, device-local worksheet: attendance and cards are not shared with other visitors or saved to Google Sheets. Live refresh preserves confirmations for existing players. Newly signed-in players require confirmation, and card assignments must be regenerated.</div>
            <div className="card" style={{marginBottom:14}}><div className="rollActions"><button className="rollPrimary" disabled={refreshing} onClick={refreshRollCall}><RefreshCw size={16} style={{verticalAlign:'middle'}} /> {refreshing ? 'Refreshing…' : 'Refresh sign-ins now'}</button></div>{refreshMessage && <p role="status" className="muted">{refreshMessage}</p>}</div>
            {!scheduledWeek ? <p className="notice">The 10-week season is complete. No further league sign-ins are scheduled.</p> : (
              <>
                <div className="card">
                  <div className="between"><b>Week {rollCall!.week} sign-ins</b><b>{confirmed.length} confirmed / {signIns.length} signed in</b></div>
                  <div className="rollActions">
                    <button onClick={() => { setPresent(signIns.map(playerKey)); setCards([]); }}>Mark all present</button>
                    <button onClick={() => { setPresent([]); setCards([]); }}>Clear attendance</button>
                  </div>
                  {!signIns.length && <p className="muted">No sign-ins yet for Week {rollCall!.week}. {sourceRoll?.week !== scheduledWeek ? `The export currently provides Week ${sourceRoll?.week || '—'}; ensure the Week ${scheduledWeek} response tab exists.` : ''}</p>}
                  {['RPA','RAH','RAD','RAE','RAF','RAG'].map(code => {
                    const group = signIns.filter(p => divisionCode(p.division) === code);
                    return group.length ? <section key={code} className="rollDivision">
                      <h3>{code} · {group.filter(p => present.includes(playerKey(p))).length}/{group.length} present · {['RPA','RAH','RAD'].includes(code) ? 'Longs' : 'Shorts'}</h3>
                      {group.map(p => <label className="rollPlayer" key={playerKey(p)}>
                        <input type="checkbox" checked={present.includes(playerKey(p))} onChange={e => { setPresent(current => e.target.checked ? [...current,playerKey(p)] : current.filter(k => k !== playerKey(p))); setCards([]); }} />
                        <span><b>{p.name}</b> {p.pdga && p.pdga !== '0' ? <small>#{p.pdga}</small> : null}</span>
                      </label>)}
                    </section> : null;
                  })}
                </div>
                <section className="card" style={{marginTop:18}}>
                  <h2>Starting Cards</h2>
                  <p className="muted">Holes 1, 3, 6, 8, 15, 17 · one card per hole · 3–5 players per card, three preferred. Layout separation takes priority over division grouping.</p>
                  <button className="rollPrimary" onClick={generate}>Generate cards from {confirmed.length} confirmed players</button>
                  {cardError && <p className="notice">{cardError}</p>}
                  {cards.length > 0 && <>
                    <p className="muted">Assignments are local to this browser. Changing attendance clears the cards.</p>
                    <div className="cards">
                      {cards.map(card => <div className="card" key={card.hole}>
                        <h3>Hole {card.hole} · {card.players.length} players</h3>
                        <p className="muted">{[...new Set(card.players.map(layoutGroup))].join(' / ')}</p>
                        {card.players.map(p => <div className="rollCardPlayer" key={playerKey(p)}>
                          <span><b>{p.name}</b><small>{divisionCode(p.division)} · {layoutGroup(p)}</small></span>
                          <select aria-label={`Move ${p.name} to another hole`} value={moveTarget === playerKey(p) ? '' : String(card.hole)} onChange={e => { setMoveTarget(playerKey(p)); movePlayer(playerKey(p),Number(e.target.value)); }}>
                            {cards.map(c => <option key={c.hole} value={c.hole}>Hole {c.hole}</option>)}
                          </select>
                        </div>)}
                      </div>)}
                    </div>
                    <button style={{marginTop:12}} onClick={() => window.print()}>Print assignments</button>
                  </>}
                </section>
              </>
            )}
          </>
        )}

        {tab === 'Finances' && (
          <>
            <h2>League Finances</h2>

            <div className="cards">
              <div className="card">
                <small>Ace Pot</small>
                <h2>
                  {money(data?.finance.acePot || 0)}
                </h2>
              </div>

              <div className="card">
                <small>Weekly Layout Payouts Total</small>
                <h2>
                  {money(
                    data?.finance.weeklyLayoutTotal || 0
                  )}
                </h2>
              </div>

              <div className="card">
                <small>Long Layout Contributions</small>
                <h2>
                  {money(data?.finance.longTotal || 0)}
                </h2>
              </div>

              <div className="card">
                <small>Short Layout Contributions</small>
                <h2>
                  {money(data?.finance.shortTotal || 0)}
                </h2>
              </div>

              <div className="card">
                <small>Division Payouts</small>
                <h2>
                  {money(data?.finance.divisionTotal || 0)}
                </h2>
              </div>
            </div>

            <h3>Division Payouts</h3>

            <div className="card">
              {data?.finance.divisionPots.map(d => (
                <div
                  className="between line"
                  key={d.division}
                >
                  <span>{d.division}</span>
                  <b>{money(d.amount)}</b>
                </div>
              ))}
            </div>

            <h3>Weekly Layout Payouts</h3>

            <div className="card overflow">
              <table>
                <thead>
                  <tr>
                    <th>Week</th>
                    <th>Long</th>
                    <th>Short</th>
                    <th>Ace</th>
                  </tr>
                </thead>

                <tbody>
                  {data?.finance.weekly.map(w => (
                    <tr key={w.week}>
                      <td>{w.week}</td>
                      <td>{money(w.long)}</td>
                      <td>{money(w.short)}</td>
                      <td>{money(w.ace)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>


          </>
        )}

      </main>

      <nav className="bottomNav">
        {[
          { name: 'Home', icon: Home },
          { name: 'Division Standings', icon: Trophy },
          { name: 'Weekly Payouts', icon: CalendarDays },
          { name: 'Roll Call', icon: ClipboardCheck },
          { name: 'Finances', icon: Wallet }
        ].map(({ name, icon: Icon }) => (
          <button
            key={name}
            className={tab === name ? 'active' : ''}
            onClick={() => {
              setTab(name);
              window.scrollTo({
                top: 0,
                behavior: 'smooth'
              });
            }}
          >
            <Icon size={20} />
            <small>{name}</small>
          </button>
        ))}
      </nav>
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
