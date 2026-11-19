import React, { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  alreadyAdvanced, confirmResult, demoState, drawGroups, groups,
  initialState, labels, maxPlayers, minPlayers, recordCupDraw, seedLabels, selectedCups, semifinals, stage,
} from './tournament.js'
import { client, demoStorageKey, readDemo, readTournament, saveTournament } from './store.js'
import './style.css'

const rules = 'https://docs.google.com/document/d/12PbA6bu3oa4H0kUH86ZQFcb03VPzRWBef4nQqY5Nks0/edit?tab=t.0'
const stages = ['Registration', 'Qualifying', 'Semifinals', 'Final', 'Complete']

function Icon({ name, size = 20 }) {
  const paths = {
    flag: <><path d="M4 22V3m0 1c5-4 9 4 16 0v11c-7 4-11-4-16 0"/><path d="M9 3v11m6-9v11M4 9c5-3 10 4 16 0"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/></>,
    pin: <><path d="M20 10c0 6-8 11-8 11s-8-5-8-11a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
    trophy: <><path d="M8 3h8v7a4 4 0 0 1-8 0V3Zm0 2H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 2v6m-5 1h10"/></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3"/></>,
    people: <><circle cx="9" cy="7" r="3"/><path d="M2 20v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2m2-16a3 3 0 0 1 0 6m4 10v-2a5 5 0 0 0-3-4"/></>,
    bracket: <path d="M3 4h5v16H3m5-8h8m5-8h-5v16h5"/>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

function MatchCard({ code, round, names }) {
  const complete = Boolean(round?.order.length)
  const ids = complete ? round.order : round?.ids
  const count = code === 'F' ? 1 : 2
  const slots = seedLabels[code] ?? Array.from({ length: 4 }, (_, i) => `Player ${i + 1}`)
  return <article className={`match-card ${code === 'F' ? 'final-card' : ''}`}>
    <header><h3>{labels[code]}</h3><span className={`match-status ${complete ? 'confirmed' : ''}`}>{complete ? 'Confirmed' : round ? 'Awaiting placements' : 'Pending'}</span></header>
    <ol>{slots.slice(0, ids?.length ?? slots.length).map((slot, i) => {
      const id = ids?.[i]
      return <li key={slot} className={complete && i < count ? 'advanced' : ''}>
        <span className="rank">{complete ? i + 1 : '—'}</span><span className={!id ? 'placeholder' : ''}>{id ? names[id] : slot}</span>
      </li>
    })}</ol>
  </article>
}

function PlacementEditor({ code, round, names, state, run, busy }) {
  const [order, setOrder] = useState(() => round.ids.map((_, index) => round.order[index] ?? ''))
  const [confirmEdit, setConfirmEdit] = useState(false)

  function submit(event) {
    event.preventDefault()
    if (alreadyAdvanced(state, code) && !confirmEdit) {
      setConfirmEdit(true)
      return
    }
    run(() => confirmResult(state, code, order))
  }

  return <form className="editor" onSubmit={submit}>
    {order.map((id, index) => <label className="placement-input" key={index}>Place {index + 1}
      <select required value={id} onChange={(event) => {
        setOrder(order.map((player, place) => place === index ? event.target.value : player))
        setConfirmEdit(false)
      }}>
        <option value="">Choose player</option>
        {round.ids.filter((player) => player === id || !order.includes(player)).map((player) =>
          <option key={player} value={player}>{names[player]}</option>)}
      </select>
    </label>)}
    {confirmEdit && <p className="notice" role="alert">{code === 'F' ? 'These results already settled the championship. Confirm the correction to update the standings.' : 'This match has already advanced. Confirm the correction. Later results will be cleared for any match whose lineup changes.'}</p>}
    <div className="actions"><button className="primary" disabled={busy || order.some((id) => !id)}>{confirmEdit ? 'Confirm correction' : 'Confirm placements'}</button>
      {confirmEdit && <button type="button" onClick={() => setConfirmEdit(false)}>Cancel</button>}</div>
  </form>
}

const wheelColors = ['#ff786f', '#f9cc73', '#90acd9', '#e8a5bd']

function CupWheel({ state, run, busy }) {
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const timer = useRef()
  useEffect(() => () => clearTimeout(timer.current), [])
  const { cups } = state
  const slice = 360 / Math.max(1, cups.length)
  const history = selectedCups(state)

  function spin() {
    const index = Math.floor(Math.random() * cups.length)
    const target = (360 - (index + 0.5) * slice) % 360
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setRotation((previous) => previous + (reducedMotion ? 0 : 1440) + (target - previous % 360 + 360) % 360)
    if (!reducedMotion) {
      setSpinning(true)
      timer.current = setTimeout(() => setSpinning(false), 1600)
    }
    run(() => recordCupDraw(state, cups[index]))
  }

  return <section className="panel">
    <h2>Cup wheel</h2>
    <p>Spin to pick a cup. Every cup stays on the wheel.</p>
    {cups.length > 0 && <div className="wheel-frame" aria-hidden="true">
      <div className="wheel-pointer" />
      <div className="wheel" style={{
        transform: `rotate(${rotation}deg)`,
        background: `conic-gradient(${cups.map((_, i) => `${wheelColors[i % wheelColors.length]} ${i * slice}deg ${(i + 1) * slice}deg`).join(', ')})`,
      }}>
        {cups.map((cup, i) => <div className="wheel-spoke" key={cup} style={{ transform: `rotate(${(i + 0.5) * slice}deg)` }}>
          <span>{cup}</span>
        </div>)}
        <div className="wheel-hub" />
      </div>
    </div>}
    <div className="cup-output" aria-live="polite">{spinning ? 'Spinning…' : history.at(-1) ?? 'No cup selected yet'}</div>
    <button className="gold-button" disabled={busy || spinning || !cups.length} onClick={spin}>Spin the wheel</button>
    <h3 className="cup-history-heading">Previously selected cups</h3>
    {history.length ? <ol className="cup-history" reversed>
      {[...history].reverse().map((cup, i) => <li key={history.length - i}>{cup}</li>)}
    </ol> : <p>No spins yet.</p>}
    <form key={cups.join('\n')} onSubmit={(event) => {
      event.preventDefault()
      const lines = new FormData(event.currentTarget).get('cups').split('\n').map((cup) => cup.trim()).filter(Boolean)
      const updated = [...new Map(lines.map((cup) => [cup.toLowerCase(), cup])).values()]
      run(() => ({ ...state, cups: updated }))
      setRotation(0)
    }}><label>Cup list · one per line<textarea name="cups" rows="8" defaultValue={cups.join('\n')} /></label><button disabled={busy || spinning}>Save cup list</button></form>
  </section>
}

function Admin({ row, names, run, busy }) {
  const { state } = row
  const [selected, setSelected] = useState('')
  const active = stage(state)
  const playable = [...groups, ...semifinals, 'F'].filter((code) => state.matches[code])
  const current = playable.find((code) => !state.matches[code].order.length) ?? playable.at(-1)
  const code = playable.includes(selected) ? selected : current
  function savePlayer(event, id) {
    event.preventDefault()
    const name = new FormData(event.currentTarget).get('name').trim()
    if (!name) return
    if (!id) event.currentTarget.reset()
    run(() => ({
      ...state, players: id
        ? state.players.map((player) => player.id === id ? { ...player, name } : player)
        : [...state.players, { id: crypto.randomUUID(), name }],
    }))
  }
  return <div className="admin-grid">
    {!client && <section className="panel wide"><h2>Demo controls</h2><p>Changes stay in this browser. Start with an empty roster to try drawing groups, or reload the sample bracket.</p>
      <div className="actions"><button disabled={busy} onClick={() => run(initialState)}>Start empty demo</button><button disabled={busy} onClick={() => run(demoState)}>Load sample bracket</button></div></section>}
    {active === -1 ? <section className="panel"><h2>Player roster</h2><p>{state.players.length} registered. Draw groups with {minPlayers}–{maxPlayers} players to lock the roster.</p>
      {state.players.map(({ id, name }) => <form className="roster-form" key={id} onSubmit={(event) => savePlayer(event, id)}>
        <input name="name" aria-label={`Name for ${name}`} defaultValue={name} required maxLength={60} />
        <button disabled={busy}>Rename</button><button type="button" aria-label={`Remove ${name}`} disabled={busy} onClick={() => run(() => ({ ...state, players: state.players.filter((player) => player.id !== id) }))}>Remove</button>
      </form>)}
      {state.players.length < maxPlayers && <form className="roster-form" onSubmit={(event) => savePlayer(event)}>
        <input name="name" aria-label="New player name" placeholder="Player name" required maxLength={60} /><button disabled={busy}>Add player</button>
      </form>}
      <button className="primary" disabled={busy || state.players.length < minPlayers} onClick={() => {
        if (window.confirm('Draw groups and lock the roster?')) run(() => drawGroups(state))
      }}>Randomly draw groups</button>
    </section> : <section className="panel"><h2>Finishing places</h2><label>Match<select value={code} onChange={(event) => setSelected(event.target.value)}>{playable.map((key) => <option key={key} value={key}>{labels[key]}{state.matches[key].order.length ? ' · confirmed' : ''}</option>)}</select></label>
      <PlacementEditor key={`${code}-${JSON.stringify(state.matches[code])}`} code={code} round={state.matches[code]} names={names} state={state} run={run} busy={busy} />
    </section>}
    <CupWheel state={state} run={run} busy={busy} />
  </div>
}

function App() {
  const [row, setRow] = useState(() => client ? null : readDemo())
  const [view, setView] = useState('bracket')
  const [session, setSession] = useState(null)
  const [adminId, setAdminId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [message, setMessage] = useState('')
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!client) {
      const sync = (event) => { if (event.key === demoStorageKey) setRow(readDemo()) }
      window.addEventListener('storage', sync)
      return () => window.removeEventListener('storage', sync)
    }
    let alive = true
    const refresh = async () => {
      try {
        const data = await readTournament()
        if (alive) {
          setRow((previous) => !previous || data.revision >= previous.revision ? data : previous)
          setLoadError('')
        }
      } catch (error) {
        if (alive) setLoadError(error.message)
      }
    }
    refresh()
    const channel = client.channel('tournament-updates').on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'tournament', filter: 'id=eq.1',
    }, refresh).subscribe((status) => {
      if (alive) setConnected(status === 'SUBSCRIBED')
      if (status === 'SUBSCRIBED') refresh()
    })
    const timer = setInterval(() => { if (!document.hidden) refresh() }, 30000)
    window.addEventListener('focus', refresh)
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => {
      alive = false
      clearInterval(timer)
      window.removeEventListener('focus', refresh)
      subscription.unsubscribe()
      client.removeChannel(channel)
    }
  }, [])

  const userId = session?.user.id
  const authorized = Boolean(userId && userId === adminId)
  useEffect(() => {
    setAdminId(null)
    if (!userId) return
    let alive = true
    client.rpc('is_tournament_admin').then(({ data, error }) => {
      if (!alive) return
      setAdminId(data === true ? userId : null)
      if (error) setMessage(error.message)
    })
    return () => { alive = false }
  }, [userId])

  async function run(change) {
    if (busy) return
    setBusy(true)
    setMessage('')
    try {
      const updated = await saveTournament(change(), row.revision)
      setRow((previous) => updated.revision >= previous.revision ? updated : previous)
      setMessage('Saved.')
    } catch (error) {
      setMessage(error.message)
      try {
        const fresh = client ? await readTournament() : readDemo()
        setRow((previous) => fresh.revision >= previous.revision ? fresh : previous)
      } catch {
        // Preserve the last confirmed view while disconnected.
      }
    } finally {
      setBusy(false)
    }
  }

  async function login(event) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    const data = new FormData(event.currentTarget)
    try {
      const { error } = await client.auth.signInWithPassword({ email: data.get('email'), password: data.get('password') })
      if (error) throw error
    } catch (error) {
      setMessage(error.message)
    } finally {
      setBusy(false)
    }
  }

  const state = row?.state
  const names = Object.fromEntries((state?.players ?? []).map(({ id, name }) => [id, name]))
  const active = state ? stage(state) : -1
  const champion = names[state?.matches.F?.order[0]]
  const qualifyingGroups = active === -1 ? groups : groups.filter((key) => state.matches[key])
  const groupCount = qualifyingGroups.filter((key) => state?.matches[key]?.order.length).length
  return <>
    <header className="topbar"><div className="shell top-inner">
      <button className="brand" onClick={() => { setView('bracket'); setMessage('') }}><span className="brand-mark"><Icon name="flag" size={22} /></span>Epsilon Tau Pi</button>
      <div className="top-actions"><a className="rules" href={rules} target="_blank" rel="noreferrer">Official rules</a>
        <button className={view === 'admin' ? 'selected' : ''} onClick={() => { setView(view === 'admin' ? 'bracket' : 'admin'); setMessage('') }}><Icon name="lock" size={16} />{view === 'admin' ? 'Public view' : 'Admin'}</button></div>
    </div></header>
    <main className="shell">
      <section className="hero">
        <div className="checker" aria-hidden="true" />
        <div className="hero-content"><div className="live-label"><span />{!client ? 'Demo mode' : connected && !loadError ? 'Live tournament' : 'Tournament standings'}</div>
          <h1>Mario Kart<br /><em>Championship</em></h1>
          <div className="event-meta"><span><Icon name="calendar" /> November 19, 2026 · 6–8 PM</span><span><Icon name="pin" /> Reitz Game Room</span></div>
          {!client && <p className="demo-note">Sample tournament · edits are saved in this browser</p>}
        </div>
      </section>
      {loadError && <p role="alert" className="notice">Couldn’t refresh standings. {loadError}</p>}
      {!state && !loadError && <p role="status">Loading tournament…</p>}
      {state && <div className="overview">
        <div><span><Icon name="bracket" size={17} />Current round</span><strong>{stages[active + 1]}</strong></div>
        <div><span><Icon name="people" size={17} />Players</span><strong>{state.players.length} <small>/ {maxPlayers}</small></strong></div>
        <div><span><Icon name="trophy" size={17} />Champion</span><strong className={champion ? 'gold' : ''}>{champion ?? 'To be crowned'}</strong></div>
      </div>}
      {view === 'admin' ? <section className="content">
        <div className="section-heading"><h2>Tournament admin</h2>{session && <button onClick={async () => {
          const { error } = await client.auth.signOut()
          setMessage(error?.message ?? '')
        }}>Sign out</button>}</div>
        {message && <p role="status" className="notice">{message}</p>}
        {client && !session && <form className="panel login" onSubmit={login}>
          <label>Email<input type="email" name="email" autoComplete="username" required /></label>
          <label>Password<input type="password" name="password" autoComplete="current-password" required /></label>
          <button className="primary" disabled={busy}>Sign in</button>
        </form>}
        {client && session && !authorized && <p>Admin editing requires the designated tournament account.</p>}
        {row && (!client || (session && authorized)) && <Admin row={row} names={names} run={run} busy={busy} />}
      </section> : state && <section className="content">
        <nav className="tabs" aria-label="Tournament views">
          <button aria-pressed={view === 'bracket'} onClick={() => setView('bracket')}><Icon name="bracket" size={18} />Bracket</button>
          <button aria-pressed={view === 'players'} onClick={() => setView('players')}><Icon name="people" size={18} />Players</button>
        </nav>
        {view === 'players' ? <><div className="section-heading"><h2>Player roster</h2><span>{state.players.length} registered</span></div>
          {state.players.length ? <ul className="players">{state.players.map(({ id, name }) => {
            const group = groups.find((key) => state.matches[key]?.ids.includes(id))
            return <li key={id}>{name}<span>{labels[group] ?? 'Registered'}</span></li>
          })}</ul> : <p>No players registered yet.</p>}
        </> : <>
          {selectedCups(state).length > 0 && <section className="panel public-cups">
            <h2>Previously selected cups</h2>
            <ol className="cup-history" reversed>
              {selectedCups(state).reverse().map((cup, i) => <li key={i}>{cup}</li>)}
            </ol>
          </section>}
          <div className="section-heading"><div><h2>Qualifying groups</h2><p>Up to two from each group advance to the semifinals.</p></div><span>{groupCount} / {qualifyingGroups.length} confirmed</span></div>
          <div className="qualifiers">{qualifyingGroups.map((code) => <MatchCard key={code} code={code} round={state.matches[code]} names={names} />)}</div>
          <div className="section-heading later"><div><h2>Knockout bracket</h2><p>Up to two from each semifinal advance. First place in the final wins.</p></div></div>
          <div className="knockouts">{[...semifinals, 'F'].map((code) => <MatchCard key={code} code={code} round={state.matches[code]} names={names} />)}</div>
        </>}
      </section>}
    </main>
    <footer className="shell footer"><span>Epsilon Tau Pi · Mario Kart Championship</span><a href={rules} target="_blank" rel="noreferrer">Official rules</a></footer>
  </>
}

createRoot(document.getElementById('root')).render(<App />)
