export const groups = ['A', 'B', 'C', 'D']
export const minPlayers = 2
export const maxPlayers = 16
export const semifinals = ['S1', 'S2']
export const labels = {
  A: 'Group A', B: 'Group B', C: 'Group C', D: 'Group D',
  S1: 'Semifinal 1', S2: 'Semifinal 2', F: 'Final',
}
export const seedLabels = {
  S1: ['A1', 'B2', 'C1', 'D2'],
  S2: ['A2', 'B1', 'C2', 'D1'],
  F: ['SF1 · 1st', 'SF1 · 2nd', 'SF2 · 1st', 'SF2 · 2nd'],
}

export const initialState = () => ({
  players: [], matches: {}, cups: [
    'Mushroom Cup', 'Flower Cup', 'Star Cup', 'Special Cup',
    'Shell Cup', 'Banana Cup', 'Leaf Cup', 'Lightning Cup',
  ], picked: [],
})

const match = (ids) => ({ ids, scores: {}, order: [], ties: [] })
const winners = (round) => round?.order.slice(0, 2) ?? []
const ready = (matches, keys) => keys.every((key) => matches[key] && matches[key].order.length === matches[key].ids.length)

export function shuffle(items, random = Math.random) {
  const shuffled = [...items]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    const player = shuffled[i]
    shuffled[i] = shuffled[j]
    shuffled[j] = player
  }
  return shuffled
}

export function drawGroups(state, random) {
  const { length } = state.players
  if (Object.keys(state.matches).length || length < minPlayers || length > maxPlayers) {
    throw new Error(`Add ${minPlayers}–${maxPlayers} players before drawing groups.`)
  }
  const ids = shuffle(state.players.map(({ id }) => id), random)
  const baseSize = Math.floor(length / groups.length)
  let offset = 0
  const matches = {}
  for (const [index, key] of groups.entries()) {
    const size = baseSize + Number(index < length % groups.length)
    if (!size) break
    matches[key] = match(ids.slice(offset, offset + size))
    offset += size
  }
  return { ...state, matches }
}

export function stage(state) {
  if (state.matches.F?.order.length) return 3
  if (state.matches.F) return 2
  if (state.matches.S1) return 1
  return Object.keys(state.matches).length ? 0 : -1
}

export function result(ids, values, key, choices = {}) {
  const scores = {}
  for (const id of ids) {
    const value = String(values[id] ?? '').trim()
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) {
      throw new Error('Enter a whole, nonnegative Grand Prix total for each player.')
    }
    scores[id] = Number(value)
  }
  const sorted = [...ids].sort((a, b) => scores[b] - scores[a])
  const order = []
  const ties = []
  for (const points of new Set(sorted.map((id) => scores[id]))) {
    const tied = sorted.filter((id) => scores[id] === points)
    const first = order.length
    const cutoff = key === 'F' ? 1 : 2
    // Qualifier seed order matters even when both tied players advance.
    const affectsResult = first < cutoff && (groups.includes(key) || first + tied.length > cutoff)
    if (tied.length > 1 && affectsResult) {
      const count = key === 'F' ? 1 : Math.min(2 - first, tied.length)
      const selected = Array.from({ length: count }, (_, i) => choices[points]?.[i])
      const valid = selected.every((id) => tied.includes(id)) && new Set(selected).size === count
      ties.push({ points, ids: tied, first, count, resolved: valid })
      order.push(...(valid ? [...selected, ...tied.filter((id) => !selected.includes(id))] : tied))
    } else {
      order.push(...tied)
    }
  }
  return { ids, scores, order, ties }
}

export function alreadyAdvanced(state, key) {
  if (groups.includes(key)) return Boolean(state.matches.S1)
  if (semifinals.includes(key)) return Boolean(state.matches.F)
  return Boolean(state.matches.F?.order.length)
}

export function confirmResult(state, key, submitted) {
  if (submitted.ties.some((tie) => !tie.resolved)) throw new Error('Resolve the tiebreaker before confirming.')
  const matches = { ...state.matches, [key]: submitted }
  function setLineup(id, ids) {
    const prior = matches[id]
    if (prior && prior.ids.length === ids.length && ids.every((player) => prior.ids.includes(player))) {
      matches[id] = { ...prior, ids }
    } else {
      matches[id] = match(ids)
    }
  }
  if (ready(matches, groups.filter((group) => matches[group]))) {
    const [[a1, a2], [b1, b2], [c1, c2], [d1, d2]] = groups.map((group) => winners(matches[group]))
    setLineup('S1', [a1, b2, c1, d2].filter(Boolean))
    setLineup('S2', [a2, b1, c2, d1].filter(Boolean))
  }
  if (ready(matches, semifinals)) {
    setLineup('F', semifinals.flatMap((semi) => winners(matches[semi])))
  } else {
    delete matches.F
  }
  return { ...state, matches }
}

export function cupForMatch(state, key) {
  return state.cupDraws?.findLast((draw) => draw.match === key)?.cup
}

export function recordCupDraw(state, key, cup) {
  const round = state.matches[key]
  if (!round || round.order.length || !state.cups.includes(cup)) {
    throw new Error('Choose an unconfirmed match and a cup from the wheel.')
  }
  return { ...state, cupDraws: [...(state.cupDraws ?? []), { match: key, cup }] }
}

export function demoState() {
  const names = ['Alex Morgan', 'Jordan Ellis', 'Tyler Brooks', 'Sam Rivera', 'Cameron Lee', 'Dylan Price', 'Evan Patel', 'Noah James', 'Ryan Carter', 'Logan Reed', 'Owen Clark', 'Liam Stone', 'Mason Hall', 'Luke Bennett', 'Jack Davis', 'Ben Foster']
  const state = drawGroups({
    ...initialState(),
    players: names.map((name, i) => ({ id: String(i + 1), name })),
  }, () => 0.999)
  const ids = state.matches.A.ids
  return confirmResult(state, 'A', result(ids, Object.fromEntries(ids.map((id, i) => [id, [54, 46, 38, 29][i]])), 'A'))
}
