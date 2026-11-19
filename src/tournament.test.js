import test from 'node:test'
import assert from 'node:assert/strict'
import {
  alreadyAdvanced, availableCups, confirmResult, drawGroups, groups,
  initialState, result, stage,
} from './tournament.js'

const roster = Array.from({ length: 16 }, (_, i) => ({ id: String(i + 1), name: `Player ${i + 1}` }))
const registered = { ...initialState(), players: roster }
const drawn = () => drawGroups(registered, () => 0.99)
const scores = (ids, points) => Object.fromEntries(ids.map((id, i) => [id, points[i]]))
const save = (state, key, points = [60, 48, 36, 24], choices) => {
  const ids = state.matches[key].ids
  return confirmResult(state, key, result(ids, scores(ids, points), key, choices))
}
const qualified = () => groups.reduce((state, group) => save(state, group), drawn())

test('draw requires exactly 16 people and assigns each person once', () => {
  assert.throws(() => drawGroups(initialState()))
  const state = drawGroups(registered, () => 0.5)
  const lineups = groups.map((group) => state.matches[group].ids)
  assert(lineups.every((ids) => ids.length === 4))
  assert.deepEqual(new Set(lineups.flat()), new Set(roster.map(({ id }) => id)))
  assert.throws(() => drawGroups(state))
})

test('qualifiers seed the specified semifinals and each round starts with empty scores', () => {
  let state = qualified()
  assert.equal(stage(state), 1)
  assert.deepEqual(state.matches.S1.ids, ['1', '6', '9', '14'])
  assert.deepEqual(state.matches.S2.ids, ['2', '5', '10', '13'])
  assert.deepEqual(state.matches.S1.scores, {})
  state = save(state, 'S1')
  assert.equal(state.matches.F, undefined)
  state = save(state, 'S2', [25, 30, 45, 60])
  assert.equal(stage(state), 2)
  assert.deepEqual(state.matches.F.ids, ['1', '6', '13', '10'])
  assert.deepEqual(state.matches.F.scores, {})
  state = save(state, 'F', [25, 24, 60, 32])
  assert.equal(stage(state), 3)
  assert.equal(state.matches.F.order[0], '13')
})

test('tiebreakers resolve qualification seeds, semifinal cutoffs and the champion', () => {
  const ids = ['a', 'b', 'c', 'd']
  const tied = scores(ids, [60, 60, 60, 30])
  assert.throws(() => confirmResult(drawn(), 'A', result(ids, tied, 'A')), /tiebreaker/)
  assert.equal(result(ids, tied, 'A', { 60: ['c', 'c'] }).ties[0].resolved, false)
  assert.deepEqual(result(ids, tied, 'A', { 60: ['c', 'a'] }).order, ['c', 'a', 'b', 'd'])
  assert.equal(result(ids, scores(ids, [40, 40, 30, 20]), 'S1').ties.length, 0)
  assert.equal(result(ids, scores(ids, [60, 40, 40, 20]), 'S1').ties[0].count, 1)
  assert.equal(result(ids, tied, 'F', { 60: ['b'] }).order[0], 'b')
  assert.equal(result(ids, scores(ids, [60, 40, 40, 40]), 'F').ties.length, 0)
  assert.throws(() => result(ids, scores(ids, [60, '', 20, 0]), 'A'))
  assert.equal(result(ids, scores(ids, [60, 40, 20, 0]), 'A').scores.d, 0)
})

test('corrections preserve valid downstream scores and clear matches with a changed lineup', () => {
  let state = qualified()
  for (const key of ['S1', 'S2', 'F']) state = save(state, key)
  assert(alreadyAdvanced(state, 'A'))
  assert(alreadyAdvanced(state, 'S1'))
  assert(alreadyAdvanced(state, 'F'))
  const finished = state.matches.F
  state = save(state, 'A', [61, 45, 36, 25])
  assert.deepEqual(state.matches.F, finished)
  state = save(state, 'A', [61, 24, 45, 25])
  assert.equal(state.matches.S1.order.length, 4)
  assert.deepEqual(state.matches.S2.scores, {})
  assert.equal(state.matches.F, undefined)
  assert.equal(stage(state), 1)
})

test('excluded cups stay excluded if renamed by case or removed and re-added', () => {
  const state = { ...initialState(), cups: ['flower cup', 'Leaf Cup'], picked: ['Flower Cup'] }
  assert.deepEqual(availableCups(state), ['Leaf Cup'])
})
