import test from 'node:test';
import assert from 'node:assert/strict';
import { SCENARIOS, createInitialState, currentStep, makeCustomRoutine, transition, executeCommand, restoreState, parseCommand } from '../dist/engine.mjs';

test('a paused routine resumes the exact unfinished step with its note, last completion, and elapsed time', () => {
  let state = transition(createInitialState(), { type: 'start', routine: 'study' }, 100).state;
  state = transition(state, { type: 'done' }, 200).state;
  state = transition(state, { type: 'pause', note: 'Doorbell; notes open to page 12.' }, 300).state;
  assert.equal(state.stepIndex, 1);
  assert.equal(state.completed.length, 1);
  assert.equal(state.status, 'paused');
  const resumed = transition(state, { type: 'resume' }, 90300);
  assert.equal(resumed.state.status, 'active');
  assert.equal(resumed.state.stepIndex, 1);
  assert.equal(resumed.state.lastPauseMs, 90000);
  assert.equal(resumed.state.pauseNote, 'Doorbell; notes open to page 12.');
  assert.match(resumed.message, /Set up your space/);
  assert.match(resumed.message, /Choose one small goal/);
});

test('pause never completes or silently skips a step; done is blocked while paused', () => {
  const active = transition(createInitialState(), { type: 'start', routine: 'pack' }, 10).state;
  const paused = transition(active, { type: 'pause' }, 20).state;
  const done = transition(paused, { type: 'done' }, 30);
  assert.equal(done.error, true);
  assert.strictEqual(done.state, paused);
  assert.equal(done.state.stepIndex, 0);
  assert.equal(done.state.completed.length, 0);
});

test('each parent step requires completion; complete only follows the final explicit done', () => {
  let state = transition(createInitialState(), { type: 'start', routine: 'tidy' }, 1).state;
  for (let i = 0; i < 4; i++) {
    state = transition(state, { type: 'done' }, 2 + i).state;
    assert.equal(state.status, 'active');
  }
  state = transition(state, { type: 'done' }, 6).state;
  assert.equal(state.status, 'complete');
  assert.equal(state.completed.length, 5);
  assert.equal(currentStep(state), null);
  assert.equal(transition(state, { type: 'done' }, 7).error, true);
});

test('smaller steps retain substep progress across a pause, do not auto-complete the parent, and reset for the next parent', () => {
  let state = transition(createInitialState(), { type: 'start', routine: 'study' }, 1).state;
  state = transition(state, { type: 'smaller' }, 2).state;
  state = transition(state, { type: 'done' }, 3).state;
  assert.equal(state.stepIndex, 0);
  assert.equal(state.substepIndex, 1);
  assert.equal(state.completed.length, 0);
  state = transition(state, { type: 'pause', note: 'Getting water.' }, 4).state;
  state = transition(state, { type: 'resume' }, 5).state;
  assert.equal(state.substepIndex, 1);
  state = transition(state, { type: 'done' }, 6).state;
  assert.equal(state.stepIndex, 0);
  state = transition(state, { type: 'done' }, 7).state;
  assert.equal(state.stepIndex, 1);
  assert.equal(state.substepIndex, null);
  assert.equal(state.completed.length, 1);
});

test('restore preserves paused and active re-entry; rejects inconsistent progress', () => {
  let state = transition(createInitialState(), { type: 'start', routine: 'study' }, 1).state;
  state = transition(state, { type: 'done' }, 2).state;
  const active = restoreState(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(active, state);
  state = transition(state, { type: 'pause', note: 'Back after lunch.' }, 3).state;
  const restored = restoreState(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(restored, state);
  assert.equal(transition(restored, { type: 'resume' }, 60003).state.lastPauseMs, 60000);
  assert.equal(restoreState({ ...state, stepIndex: 3 }), null);
  assert.equal(restoreState({ ...state, substepIndex: -1 }), null);
  assert.equal(restoreState({ ...state, pausedAt: null }), null);
  assert.equal(restoreState({ ...state, version: 99 }), null);
});

test('invalid commands and repeat resume do not change or erase progress', () => {
  const state = transition(createInitialState(), { type: 'start', routine: 'pack' }, 1).state;
  for (const command of ['skip', 'delete everything', 'start', '<img src=x onerror=alert(1)>']) {
    const result = executeCommand(state, command, 2);
    assert.equal(result.error, true);
    assert.strictEqual(result.state, state);
  }
  assert.strictEqual(executeCommand(state, 'resume', 2).state, state);
  assert.strictEqual(executeCommand(state, 'status', 2).state, state);
  assert.equal(executeCommand(state, 'start tidy', 2).error, true);
});

test('commands are explicit and case insensitive; pause text is kept literally', () => {
  assert.deepEqual(parseCommand('  START STUDY  '), { type: 'start', routine: 'study' });
  assert.deepEqual(parseCommand('pause <script>alert(1)</script>'), { type: 'pause', note: '<script>alert(1)</script>' });
  assert.deepEqual(parseCommand('paused'), { type: 'unknown' });
  assert.deepEqual(parseCommand('start unknown'), { type: 'unknown' });
});

test('custom text stays literal and custom smaller steps must be supplied manually', () => {
  const routine = makeCustomRoutine('<b>My routine</b>', '<img src=x onerror=alert(1)>\nLeave a note');
  assert.equal(routine.title, '<b>My routine</b>');
  assert.equal(routine.steps[0].title, '<img src=x onerror=alert(1)>');
  let state = transition(createInitialState(), { type: 'start', routine }, 1).state;
  const smaller = transition(state, { type: 'smaller' }, 2);
  assert.equal(smaller.needsSubsteps, true);
  assert.equal(smaller.changed, false);
  state = transition(state, { type: 'substeps', lines: 'First tiny thing\nSecond tiny thing' }, 3).state;
  assert.equal(state.substepIndex, 0);
  assert.deepEqual(currentStep(state).microsteps, ['First tiny thing', 'Second tiny thing']);
  assert.equal(transition(state, { type: 'substeps', lines: 'Overwrite\nAgain' }, 4).error, true);
  assert.throws(() => makeCustomRoutine('', 'One step'));
  assert.throws(() => makeCustomRoutine('Too many', Array.from({ length: 13 }, () => 'Step')));
  assert.throws(() => makeCustomRoutine('Too long', 'x'.repeat(181)));
});

test('engine transitions never mutate scenarios or their previous state', () => {
  const baseline = JSON.stringify(SCENARIOS);
  const initial = createInitialState();
  const started = transition(initial, { type: 'start', routine: 'study' }, 1).state;
  const before = JSON.stringify(started);
  transition(started, { type: 'smaller' }, 2);
  transition(started, { type: 'done' }, 3);
  assert.equal(JSON.stringify(started), before);
  assert.equal(JSON.stringify(SCENARIOS), baseline);
  assert.equal(initial.status, 'idle');
});
