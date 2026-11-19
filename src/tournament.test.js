import test from 'node:test'
import assert from 'node:assert/strict'
import {
  alreadyAdvanced, confirmResult, drawGroups, groups,
  initialState, recordCupDraw, selectedCups, stage,
} from './tournament.js'

const roster = Array.from({ length: 16 }, (_, i) => ({ id: String(i + 1), name: `Player ${i + 1}` }))
const registered = { ...initialState(), players: roster }
const drawn = () => drawGroups(registered, () => 0.99)
const save = (state, key, finishingOrder) => {
  const ids = state.matches[key].ids
  return confirmResult(state, key, finishingOrder?.map((index) => ids[index]) ?? ids)
}
const qualified = () => groups.reduce((state, group) => save(state, group), drawn())

test('a full draw assigns each person once', () => {
  assert.throws(() => drawGroups(initialState()))
  const state = drawGroups(registered, () => 0.5)
  const lineups = groups.map((group) => state.matches[group].ids)
  assert(lineups.every((ids) => ids.length === 4))
  assert.deepEqual(new Set(lineups.flat()), new Set(roster.map(({ id }) => id)))
  assert.throws(() => drawGroups(state))
})

test('qualifiers seed the specified semifinals and each round starts with empty placements', () => {
  let state = qualified()
  assert.equal(stage(state), 1)
  assert.deepEqual(state.matches.S1.ids, ['1', '6', '9', '14'])
  assert.deepEqual(state.matches.S2.ids, ['2', '5', '10', '13'])
  assert.deepEqual(state.matches.S1.order, [])
  state = save(state, 'S1')
  assert.equal(state.matches.F, undefined)
  state = save(state, 'S2', [3, 2, 1, 0])
  assert.equal(stage(state), 2)
  assert.deepEqual(state.matches.F.ids, ['1', '6', '13', '10'])
  assert.deepEqual(state.matches.F.order, [])
  state = save(state, 'F', [2, 3, 0, 1])
  assert.equal(stage(state), 3)
  assert.equal(state.matches.F.order[0], '13')
})

test('placements must include every entrant exactly once and can replace a legacy result', () => {
  const state = drawn()
  const ids = state.matches.A.ids
  state.matches.A = { ...state.matches.A, order: ids, scores: { [ids[0]]: 60 }, ties: [] }
  assert.throws(() => confirmResult(state, 'A', ids.slice(0, 3)), /finishing place/)
  assert.throws(() => confirmResult(state, 'A', [ids[0], ids[0], ids[2], ids[3]]), /finishing place/)
  assert.throws(() => confirmResult(state, 'A', ['outsider', ...ids.slice(1)]), /finishing place/)
  const corrected = save(state, 'A', [1, 0, 2, 3])
  assert.deepEqual(corrected.matches.A, { ids, order: [ids[1], ids[0], ids[2], ids[3]] })
})

test('corrections preserve valid downstream placements and clear matches with a changed lineup', () => {
  let state = qualified()
  for (const key of ['S1', 'S2', 'F']) state = save(state, key)
  assert(alreadyAdvanced(state, 'A'))
  assert(alreadyAdvanced(state, 'S1'))
  assert(alreadyAdvanced(state, 'F'))
  const finished = state.matches.F
  state = save(state, 'A', [0, 1, 3, 2])
  assert.deepEqual(state.matches.F, finished)
  state = save(state, 'A', [0, 2, 3, 1])
  assert.equal(state.matches.S1.order.length, 4)
  assert.deepEqual(state.matches.S2.order, [])
  assert.equal(state.matches.F, undefined)
  assert.equal(stage(state), 1)
})

test('wheel picks retain earlier history, allow repeats, and need no match', () => {
  let state = { ...initialState(), picked: ['Banana Cup'], cupDraws: [{ match: 'A', cup: 'Leaf Cup' }] }
  state = recordCupDraw(state, 'Flower Cup')
  state = recordCupDraw(state, 'Flower Cup')
  assert.deepEqual(selectedCups(state), ['Banana Cup', 'Leaf Cup', 'Flower Cup', 'Flower Cup'])
  assert.deepEqual(state.cupDraws.at(-1), { cup: 'Flower Cup' })
  assert.deepEqual(state.cups, initialState().cups)
  assert.throws(() => recordCupDraw(state, 'Missing Cup'))
})

test('every roster size from 2 to 15 advances through both semifinals and the final', () => {
  assert.throws(() => drawGroups({ ...registered, players: roster.slice(0, 1) }))
  for (let count = 2; count < 16; count++) {
    let state = drawGroups({ ...registered, players: roster.slice(0, count) }, () => 0.5)
    const activeGroups = groups.filter((key) => state.matches[key])
    const lineups = activeGroups.map((key) => state.matches[key].ids)
    assert.equal(activeGroups.length, Math.min(count, 4))
    assert.equal(lineups.flat().length, count)
    assert.equal(new Set(lineups.flat()).size, count)
    const sizes = lineups.map((ids) => ids.length)
    assert(Math.max(...sizes) - Math.min(...sizes) <= 1)
    for (const key of activeGroups) state = save(state, key)
    assert.equal(stage(state), 1)
    for (const key of ['S1', 'S2']) {
      assert(state.matches[key].ids.length > 0)
      assert.deepEqual(state.matches[key].order, [])
      state = save(state, key)
    }
    assert.equal(stage(state), 2)
    assert.equal(state.matches.F.ids.length, Math.min(count, 4))
    assert.deepEqual(state.matches.F.order, [])
    state = save(state, 'F')
    assert.equal(stage(state), 3)
    assert.equal(state.matches.F.order[0], state.matches.F.ids[0])
  }
})
