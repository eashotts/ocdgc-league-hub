
import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Trophy, Wallet, Home, Users, CalendarDays, ExternalLink
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

type League = {
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

function App() {
  const [data, setData] = useState<League | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('Home');
  const [division, setDivision] = useState('All');
  const [selected, setSelected] = useState<string | null>(null);
  const [week, setWeek] = useState<number | 'All'>('All');

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
              <b>{divisions.length || '—'}</b>
              <small>Divisions</small>
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

        {tab === 'Standings' && (
          <>
            <div className="sectionTitle">
              <h2>Standings</h2>
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

        {tab === 'Rounds' && (
          <>
            <div className="sectionTitle">
              <h2>Weekly Rounds</h2>
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

        {tab === 'League' && (
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

            <p>
              <a
                href={`https://www.pdga.com/tour/event/${
                  data?.eventId || '107753'
                }`}
                target="_blank"
                rel="noreferrer"
              >
                Official PDGA event details ↗
              </a>
            </p>
          </section>
        )}
      </main>

      <nav className="bottomNav">
        {[
          { name: 'Home', icon: Home },
          { name: 'Standings', icon: Trophy },
          { name: 'Rounds', icon: CalendarDays },
          { name: 'Finances', icon: Wallet },
          { name: 'League', icon: Users }
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
