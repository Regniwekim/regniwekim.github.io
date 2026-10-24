import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { validateDailyDate, utcDailyDate } from '../src/daily/date.js';
import { DAILY_FORMAT, DAILY_CONFIGURATION, defineDailyChallenge, createDailySession, restartDailySession } from '../src/daily/challenge.js';
import { createDailyMode } from '../src/ui/daily-mode.js';
import { createTargetSession } from '../src/analysis/target-session.js';
import { createBag } from '../src/core/bag.js';
import { exchangeTiles, endSession, commitSessionWord } from '../src/core/session.js';
import { createFarmSession } from '../src/core/farm-fixture.js';
import { ENCLOSURE_MOVES } from '../src/core/session-fixture.js';
import { demoDictionary } from '../src/core/demo-vocabulary.js';
import { getSessionResults, formatResultsShare } from '../src/core/results.js';
import { VOCABULARY } from '../src/vocabulary/manifest.js';

test('daily dates strictly validate Gregorian dates, leap centuries and canonical spelling', () => {
  for (const date of ['0001-01-01', '0099-12-31', '2000-02-29', '2024-02-29', '2026-12-31', '9999-12-31']) {
    assert.equal(validateDailyDate(date), date);
  }
  for (const date of ['', '2024-2-29', ' 2024-02-29', '2024-02-29\n', '2024-02-29T00:00:00Z',
    '0000-01-01', '1900-02-29', '2100-02-29', '2023-02-29', '2024-04-31', '2024-00-01',
    '2024-13-01', '2024-01-00', '2024-01-32', null, 20240229, new Date()]) {
    assert.throws(() => defineDailyChallenge(date));
  }
});

test('UTC midnight changes exactly at month, year and leap boundaries in every timezone', () => {
  const boundaries = [
    [Date.UTC(2024, 0, 1), '2023-12-31', '2024-01-01'],
    [Date.UTC(2024, 1, 29), '2024-02-28', '2024-02-29'],
    [Date.UTC(2024, 2, 1), '2024-02-29', '2024-03-01'],
  ];
  for (const [instant, before, after] of boundaries) {
    assert.equal(utcDailyDate(instant - 1), before);
    assert.equal(utcDailyDate(instant), after);
  }
  for (const value of [undefined, null, '2024-01-01', NaN, Infinity, new Date()]) assert.throws(() => utcDailyDate(value));
  for (const value of [1e20, Date.UTC(0, 0, 1) - 1e14]) assert.throws(() => utcDailyDate(value));
  const code = `import { utcDailyDate } from './src/daily/date.js'; console.log(utcDailyDate(${Date.UTC(2024, 2, 1)}));`;
  for (const TZ of ['UTC', 'America/Los_Angeles', 'Pacific/Kiritimati']) {
    assert.equal(execFileSync(process.execPath, ['--input-type=module', '-e', code],
      { cwd: new URL('..', import.meta.url), env: { ...process.env, TZ }, encoding: 'utf8' }).trim(), '2024-03-01');
  }
});

test('daily v1 pins canonical settings, separate seeds and all compatibility identities', () => {
  const definition = defineDailyChallenge('2026-10-23');
  assert.equal(definition.formatVersion, 'wordstead-daily-v1');
  assert.equal(definition.letterSeed, 'wordstead-daily-v1:letters:2026-10-23');
  assert.equal(definition.farmSeed, 'wordstead-daily-v1:farm:2026-10-23');
  assert.deepEqual(defineDailyChallenge(definition.date), definition);
  const next = defineDailyChallenge('2026-10-24');
  assert.notEqual(next.letterSeed, definition.letterSeed);
  assert.notEqual(next.farmSeed, definition.farmSeed);
  assert.equal(definition.rows, 15); assert.equal(definition.columns, 15);
  assert.equal(definition.farmDensity, 0.08);
  assert.deepEqual(definition.farmWeights, { crop: 4, livestock: 2, building: 2, fertile: 3 });
  assert.equal(definition.vocabularyId, VOCABULARY.id);
  assert.equal(definition.rules.vocabularySha256, VOCABULARY.sha256);
  assert.equal(definition.methodVersion, 'auto-target-v1');
  assert.equal(definition.rules.startingRack, 7);
  assert.equal(definition.rules.bag, 'wordstead-standard-100-v1');
  assert.throws(() => { definition.farmWeights.crop = 999; }, TypeError);
});

test('daily initialization is deterministic and restart restores the original date, target, tiles and farm', () => {
  const before = structuredClone(DAILY_CONFIGURATION);
  const original = createDailySession('2026-10-23');
  assert.equal(original.available, true);
  const state = original.session, frozen = structuredClone(state);
  assert.equal(state.rack.length, 7); assert.equal(state.bag.length, 93);
  assert.deepEqual([...state.rack, ...state.bag], createBag(original.definition.letterSeed).bag);
  assert.equal(state.target, original.definition.resolvedTarget);
  assert.ok(state.target > 0 && state.target <= original.estimate.board.theoreticalUpperBound);
  const exchanged = exchangeTiles(state, [state.rack[0].id]).state;
  const ended = endSession(exchanged).state;
  assert.equal(ended.daily, state.daily);
  assert.deepEqual(createDailySession('2026-10-23'), original);
  assert.deepEqual(restartDailySession(ended), frozen);
  assert.deepEqual(state, frozen);
  assert.deepEqual(DAILY_CONFIGURATION, before);
  assert.throws(() => restartDailySession(createTargetSession().session), TypeError);
});

test('incompatible/unavailable automatic estimates never fabricate a daily target or session', () => {
  const result = createDailySession('2026-10-23', { model: null });
  assert.equal(result.available, false);
  assert.equal(result.session, null);
  assert.equal(result.definition.resolvedTarget, null);
  assert.equal(result.estimate.target, null);
  assert.equal(result.reason, 'INCOMPATIBLE_ANALYSIS');
  assert.ok(result.message);
});

test('clock checks preserve active sessions; only an explicit action starts a newer date', () => {
  let timestamp = Date.UTC(2024, 1, 29, 23, 59, 59, 999), calls = 0;
  const mode = createDailyMode({ now: () => timestamp, create(date) { calls += 1; return createDailySession(date); } });
  const initial = mode.startToday();
  assert.equal(initial.definition.date, '2024-02-29');
  assert.equal(mode.startToday(), initial);
  timestamp += 1;
  assert.equal(mode.today(), '2024-03-01');
  assert.equal(mode.current, initial);
  assert.equal(calls, 1);
  assert.equal(restartDailySession(endSession(initial.session).state).daily.date, '2024-02-29');
  const newest = mode.startToday();
  assert.equal(newest.definition.date, '2024-03-01');
  assert.equal(mode.current, newest);
  assert.equal(calls, 2);
});

test('an unavailable new daily preserves the previous challenge without substituting a target', () => {
  let timestamp = Date.UTC(2026, 9, 23);
  const mode = createDailyMode({ now: () => timestamp, create: (date) => createDailySession(date,
    date === '2026-10-24' ? { model: null } : undefined) });
  const original = mode.startToday();
  timestamp += 86400000;
  assert.equal(mode.startToday().available, false);
  assert.equal(mode.current, original);
});

test('daily results reuse actual score/exchange summaries and add only spoiler-free date/revision identity', () => {
  const daily = createDailySession('2026-10-23').session.daily;
  // Existing scripted farm is a results fixture, not a purported solution to this daily.
  let state = { ...createFarmSession('building'), daily };
  for (const move of ENCLOSURE_MOVES) state = commitSessionWord(state, move, demoDictionary).state;
  state = exchangeTiles(state, [state.rack[0].id]).state;
  state = exchangeTiles(state, [state.rack[0].id]).state;
  const summary = getSessionResults(endSession(state).state);
  assert.equal(summary.totalPoints, 1); assert.equal(summary.target, 20);
  assert.equal(summary.wordCount, 4); assert.equal(summary.exchangeCount, 2);
  assert.equal(summary.freeExchangesUsed, 1); assert.equal(summary.chargedExchanges, 1);
  assert.deepEqual(summary.daily, { date: '2026-10-23', formatVersion: DAILY_FORMAT });
  const share = formatResultsShare(summary);
  assert.match(share, /Daily Puzzle · 2026-10-23 · v1\nFarm Unfinished/);
  assert.match(share, /4 words · 2 exchanges/);
  assert.doesNotMatch(share, /CAR|CAB|RAT|BAT|seed|tile|row|column|bag|solution/i);
  for (const type of ['crop', 'fertile']) {
    const won = ENCLOSURE_MOVES.reduce((s, move) => commitSessionWord(s, move, demoDictionary).state,
      { ...createFarmSession(type), daily });
    assert.equal(won.status, 'won');
    assert.match(formatResultsShare(getSessionResults(won)), /v1\nHarvest Complete!/);
  }
  assert.equal(getSessionResults(createDailySession('2026-10-23').session), null);
  const free = getSessionResults(endSession(createTargetSession().session).state);
  assert.equal(Object.hasOwn(free, 'daily'), false);
  assert.equal(formatResultsShare(free), 'WORDSTEAD\nFarm Unfinished\n\n0/12 farm points\n0 words · 0 exchanges\n0 territory + 0 farm bonus points\n\nBuild a farm, one word at a time.\nhttps://games.regniwekim.com/wordstead/');
});

test('released daily calendar fixtures pin full initialization as well as readable signatures', () => {
  const fixtures = JSON.parse(readFileSync(new URL('./fixtures/daily-v1.json', import.meta.url), 'utf8'));
  for (const expected of fixtures) {
    const result = createDailySession(expected.date), { session, definition } = result;
    assert.equal(result.available, true);
    const actual = { date: definition.date, formatVersion: definition.formatVersion,
      letterSeed: definition.letterSeed, farmSeed: definition.farmSeed,
      initialTileIds: session.rack.map((tile) => tile.id),
      farmSignature: session.puzzle.board.cells.flatMap((cell, index) => cell ? [`${index}:${cell.type}`] : []).join(','),
      target: session.target, initializationSha256: createHash('sha256').update(JSON.stringify(session)).digest('hex') };
    assert.deepEqual(actual, expected, expected.date);
  }
});
