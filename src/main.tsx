
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

type League = {
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
  const [week, setWeek] = useState(0);

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

  function weeklyLeaderboard(short: boolean) {
    const entries = divisions
      .filter(d => isShortDivision(d.name) === short)
      .flatMap(d =>
        d.players.map(p => ({
          name: p.name,
          division: d.name.split(' ')[0],
          score: p.scores?.[week],
          pdga: p.pdga
        }))
      )
      .filter(
        p =>
          p.score !== undefined &&
          p.score !== null &&
          String(p.score).trim() !== '' &&
          Number.isFinite(Number(p.score))
      )
      .sort(
        (a, b) =>
          Number(a.score) - Number(b.score) ||
          a.name.localeCompare(b.name)
      );

    return (
      <div
        key={short ? 'short' : 'long'}
        style={{ marginTop: 22 }}
      >
        <h3>
          {short
            ? 'Shorts · RAG / RAF / RAE'
            : 'Longs · RAD / RAH / RPA'}
        </h3>

        <p>
          <b>
            {short
              ? weeklyLayouts[week].short
              : weeklyLayouts[week].long}
          </b>
          {!short && weeklyLayouts[week].hazards
            ? ' · Sidewalk hazards in effect'
            : ''}
        </p>

        {entries.length ? (
          <div className="overflow">
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Player</th>
                  <th>Division</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(p => (
                  <tr key={`${p.division}-${p.name}`}>
                    <td>
                      #
                      {entries.findIndex(
                        x =>
                          Number(x.score) === Number(p.score)
                      ) + 1}
                    </td>
                    <td>{p.name}</td>
                    <td>{p.division}</td>
                    <td>
                      <b>{p.score}</b>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">
            No scores recorded for this layout yet.
          </p>
        )}
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
              <small>Ace pot</small>
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
          <>
            <div className="sectionTitle">
              <h2>Division Overview</h2>
              <span>
                {data?.updatedAt
                  ? `Exported ${new Date(
                      data.updatedAt
                    ).toLocaleString()}`
                  : 'Awaiting export'}
              </span>
            </div>

            <div className="cards">
              {divisions.map(d => {
                const top = d.players.reduce<Player | null>(
                  (best, p) =>
                    !best ||
                    Number(p.highest) > Number(best.highest)
                      ? p
                      : best,
                  null
                );

                return (
                  <button
                    className="card divisionCard"
                    key={d.name}
                    onClick={() => {
                      setDivision(d.name.split(' ')[0]);
                      setTab('Standings');
                    }}
                  >
                    <div className="between">
                      <h3>{d.name}</h3>
                      <span className="chip">
                        {d.players.length} players
                      </span>
                    </div>

                    <div className="between">
                      <span>Division pot</span>
                      <b>{d.pot}</b>
                    </div>

                    <div className="between">
                      <span>Projected paid spots</span>
                      <b>{d.paidSpots}</b>
                    </div>

                    <div className="between">
                      <span>Payout qualified</span>
                      <b>
                        {d.players.filter(
                          p =>
                            p.qualified.toUpperCase() ===
                            'YES'
                        ).length}
                      </b>
                    </div>

                    <div className="between">
                      <span>Highest rated round</span>
                      <b>
                        {top && Number(top.highest) > 0
                          ? `${top.highest} · ${top.name}`
                          : '—'}
                      </b>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
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

            <div className="roster">
              {players.map((p, i) => (
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

                    <span className="playerName">
                      <b>{p.name}</b>
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
                      <p>
                        PDGA #: {p.pdga || 'None'}
                      </p>

                      <p>
                        Weekly scores:{' '}
                        {p.scores
                          .map((s, i) =>
                            s ? `W${i + 1}: ${s}` : null
                          )
                          .filter(Boolean)
                          .join(' · ') ||
                          'No scores recorded'}
                      </p>

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
              ))}
            </div>
          </>
        )}

        {tab === 'Rounds' && (
          <>
            <div className="sectionTitle">
              <h2>Weekly Rounds</h2>
              <span>
                Independent layout leaderboards
              </span>
            </div>

            <div className="pills">
              {weeklyLayouts.map((w, i) => (
                <button
                  key={i}
                  className={week === i ? 'active' : ''}
                  onClick={() => setWeek(i)}
                >
                  W{i + 1}
                </button>
              ))}
            </div>

            <section className="card">
              <h2>
                Week {week + 1} · {weeklyLayouts[week].date}
              </h2>

              <p className="muted">
                Scores from the live standings.
                Players are ranked by lowest score
                within their layout; tied scores
                share a rank. Official payout winners
                may differ after playoffs.
              </p>

              {weeklyLeaderboard(true)}
              {weeklyLeaderboard(false)}
            </section>
          </>
        )}

        {tab === 'Finances' && (
          <>
            <h2>League Finances</h2>

            <div className="cards">
              <div className="card">
                <small>Ace pot</small>
                <h2>
                  {money(data?.finance.acePot || 0)}
                </h2>
              </div>

              <div className="card">
                <small>Weekly layout payout total</small>
                <h2>
                  {money(
                    data?.finance.weeklyLayoutTotal || 0
                  )}
                </h2>
              </div>

              <div className="card">
                <small>Long layout contributions</small>
                <h2>
                  {money(data?.finance.longTotal || 0)}
                </h2>
              </div>

              <div className="card">
                <small>Short layout contributions</small>
                <h2>
                  {money(data?.finance.shortTotal || 0)}
                </h2>
              </div>

              <div className="card">
                <small>Division payout pots</small>
                <h2>
                  {money(data?.finance.divisionTotal || 0)}
                </h2>
              </div>
            </div>

            <h3>Weekly Contributions</h3>

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

            <h3>Division Payout Pots</h3>

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

            <p className="muted">
              Weekly hottest-round winners and amounts
              will be added after their exact sheet
              locations are verified.
            </p>
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
