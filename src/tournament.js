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

const match = (ids) => ({ ids, order: [] })
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

export function alreadyAdvanced(state, key) {
  if (groups.includes(key)) return Boolean(state.matches.S1)
  if (semifinals.includes(key)) return Boolean(state.matches.F)
  return Boolean(state.matches.F?.order.length)
}

export function confirmResult(state, key, order) {
  const round = state.matches[key]
  if (!round || order.length !== round.ids.length || new Set(order).size !== round.ids.length ||
      order.some((id) => !round.ids.includes(id))) {
    throw new Error('Assign every player to one finishing place.')
  }
  const matches = { ...state.matches, [key]: { ids: round.ids, order: [...order] } }
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

export function selectedCups(state) {
  return [...(state.picked ?? []), ...(state.cupDraws ?? []).map(({ cup }) => cup)]
}

export function recordCupDraw(state, cup) {
  if (!state.cups.includes(cup)) throw new Error('Choose a cup from the wheel.')
  return { ...state, cupDraws: [...(state.cupDraws ?? []), { cup }] }
}

export function demoState() {
  const names = ['Alex Morgan', 'Jordan Ellis', 'Tyler Brooks', 'Sam Rivera', 'Cameron Lee', 'Dylan Price', 'Evan Patel', 'Noah James', 'Ryan Carter', 'Logan Reed', 'Owen Clark', 'Liam Stone', 'Mason Hall', 'Luke Bennett', 'Jack Davis', 'Ben Foster']
  const state = drawGroups({
    ...initialState(),
    players: names.map((name, i) => ({ id: String(i + 1), name })),
  }, () => 0.999)
  const ids = state.matches.A.ids
  return confirmResult(state, 'A', ids)
}
