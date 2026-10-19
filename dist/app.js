import { SCENARIOS, createInitialState, currentStep, makeCustomRoutine, transition, executeCommand, restoreState } from './engine.mjs';

const $ = (id) => document.getElementById(id);
const icons = {
  grid: '<rect x="3" y="3" width="6" height="6" rx="1.3"/><rect x="15" y="3" width="6" height="6" rx="1.3"/><rect x="3" y="15" width="6" height="6" rx="1.3"/><rect x="15" y="15" width="6" height="6" rx="1.3"/>',
  list: '<path d="M8 5h12M8 12h12M8 19h12M3 5h.01M3 12h.01M3 19h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
  'arrow-up-right': '<path d="M6 18 18 6M6 6h12v12"/>',
  'arrow-up': '<path d="m5 11 7-7 7 7M12 4v16"/>',
  'arrow-right': '<path d="m14 5 7 7-7 7M21 12H3"/>',
  plus: '<path d="M12 4v16M4 12h16"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  book: '<path d="M12 5v15M12 5C8 2 4 3 2 4v15c3-2 7-2 10 1 3-3 7-3 10-1V4c-2-1-6-2-10 1Z"/>',
  bag: '<rect x="5" y="7" width="14" height="14" rx="3"/><path d="M9 7V5a3 3 0 0 1 6 0v2M9 13h6M9 16h6"/>',
  sparkles: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3ZM20 2v4m-2-2h4"/>',
  leaf: '<path d="M20 3C9 2 3 7 4 14c1 7 9 8 13 2 3-4 3-9 3-13ZM4 21 15 10"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v5l3 1M9 2h6m-3 0v3m6 2 2-2"/>',
  play: '<path d="m9 5 10 7-10 7V5Z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  small: '<path d="m8 3 5 5-5 5M13 8H3m13 3 5 5-5 5m5-5H11"/>',
  return: '<path d="m8 4-5 5 5 5M3 9h12a6 6 0 0 1 0 12h-3"/>',
};
function icon(name) {
  const span = document.createElement('span');
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = `<svg viewBox="0 0 24 24">${icons[name] || icons.list}</svg>`;
  return span;
}
function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}
function button(text, cls, onClick, iconName, id) {
  const node = el('button', cls);
  node.type = 'button';
  if (iconName) node.append(icon(iconName));
  node.append(document.createTextNode(text));
  if (id) node.id = id;
  node.addEventListener('click', onClick);
  return node;
}
document.querySelectorAll('[data-icon]').forEach(node => node.replaceWith(icon(node.dataset.icon)));

const STORAGE_KEY = 'nextcue.saved-routine.v1';
let state = createInitialState();
let remembering = false;
let readAloud = false;
let confirmCallback = null;
let storageIssue = '';
let timer = { seconds: 600, duration: 600, running: false, deadline: null, resumeWithRoutine: false };
try {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    const restored = restoreState(JSON.parse(saved).state);
    if (restored) { state = restored; remembering = true; }
    else storageIssue = 'The saved routine could not be restored. You can start a new one.';
  }
} catch { storageIssue = 'Device storage is unavailable here. Your routine will stay in this page only.'; }

function persist() {
  if (!remembering) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, savedAt: Date.now() }));
  } catch {
    remembering = false;
    $('remember').checked = false;
    $('preference-status').textContent = 'Saving is unavailable. Your current routine is still here, but may be lost when this page closes.';
    renderPreferences();
  }
}
function removeSaved() {
  try { localStorage.removeItem(STORAGE_KEY); return true; }
  catch { $('preference-status').textContent = 'Saved data could not be removed. Please clear site data in your browser settings.'; return false; }
}
function formatElapsed(ms) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) return seconds < 2 ? 'just a moment' : `${seconds} seconds`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'}${minutes % 60 ? `, ${minutes % 60} min` : ''}`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? 'day' : 'days'}${hours % 24 ? `, ${hours % 24} hr` : ''}`;
}
function speak(text) {
  if (!readAloud || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = .93;
  window.speechSynthesis.speak(utterance);
}
function addMessage(text, role = 'assistant', isError = false) {
  const node = el('div', `message ${role}${isError ? ' error' : ''} fade-in`);
  const label = el('div', 'message-label', role === 'user' ? 'YOU' : 'NEXTCUE');
  node.append(label, el('div', 'message-body', text));
  $('conversation-log').append(node);
  while ($('conversation-log').children.length > 40) $('conversation-log').firstElementChild.remove();
  $('conversation-log').scrollTop = $('conversation-log').scrollHeight;
  if (role === 'assistant') speak(text);
}
function openDialog(id) {
  $(id).showModal();
  const firstInput = $(id).querySelector('input, textarea');
  if (firstInput) firstInput.focus();
}
function confirmAction(title, body, accept, cancel, callback) {
  $('confirm-title').textContent = title;
  $('confirm-body').textContent = body;
  $('confirm-accept').textContent = accept;
  $('confirm-cancel').textContent = cancel;
  confirmCallback = callback;
  openDialog('confirm-dialog');
}
function startRoutine(routine) {
  const perform = () => dispatch({ type: 'start', routine, replace: true }, true);
  if (['active', 'paused'].includes(state.status)) {
    confirmAction('Start a different routine?', 'This will replace your current routine and its progress. Your saved routine will also be replaced if remembering is on.', 'Start new routine', 'Keep this routine', perform);
  } else perform();
}
function applyResult(result, focusNext = false) {
  if (result.changed) {
    const previousStatus = state.status;
    state = result.state;
    if (state.status === 'paused') {
      timer.resumeWithRoutine = timer.running;
      pauseTimer();
    } else if (previousStatus === 'paused' && state.status === 'active' && timer.resumeWithRoutine) {
      timer.resumeWithRoutine = false;
      startTimer();
    } else if (state.status === 'complete' || state.status === 'idle') {
      pauseTimer(); timer.resumeWithRoutine = false;
    }
    persist();
    render();
  }
  addMessage(result.message, 'assistant', result.error);
  if (result.needsSubsteps) { $('substeps-error').textContent = ''; $('substeps-input').value = ''; openDialog('substeps-dialog'); }
  if (focusNext && !result.needsSubsteps) {
    const target = $('done-button') || $('resume-button') || $('new-routine-button') || $('start-study');
    target?.focus({ preventScroll: true });
  }
}
function dispatch(action, focusNext = false) { applyResult(transition(state, action), focusNext); }
function command(text) {
  if (!text.trim()) return;
  addMessage(text, 'user');
  applyResult(executeCommand(state, text));
}

function renderScenarios() {
  const grid = $('scenario-grid');
  grid.replaceChildren();
  for (const routine of Object.values(SCENARIOS)) {
    const active = state.routine?.id === routine.id && state.status !== 'idle';
    const node = button('', `scenario${active ? ' active' : ''}`, () => startRoutine(routine.id));
    node.setAttribute('aria-label', `${active ? 'Restart' : 'Start'} ${routine.title}, ${routine.steps.length} steps`);
    const badge = el('span', 'scenario-icon'); badge.append(icon(routine.icon));
    node.append(badge, el('strong', '', routine.title), el('small', '', routine.estimate));
    if (active) { const tick = el('span', 'scenario-check'); tick.append(icon('check')); node.append(tick); }
    grid.append(node);
  }
}
function cardTop(eyebrow, pill, iconName) {
  const top = el('div', 'current-card-top');
  const label = el('span', 'card-eyebrow');
  label.append(icon(iconName), document.createTextNode(eyebrow));
  top.append(label, el('span', 'step-pill', pill));
  return top;
}
function cardHeading(text) { const h2 = el('h2', '', text); h2.id = 'current-heading'; return h2; }
function renderCurrent() {
  const card = $('current-card');
  card.replaceChildren();
  card.className = `current-card ${state.status}`;
  if (state.status === 'idle') {
    card.append(cardTop('ONE THING. THEN THE NEXT.', 'NO RUSH', 'sparkles'), cardHeading('Let’s begin with one small thing.'), el('p', 'step-description', 'Choose a routine above. We’ll keep the next step clear, and hold your place when life interrupts.'));
    const actions = el('div', 'card-actions');
    actions.append(button('Start a study session', 'button primary', () => startRoutine('study'), 'arrow-right', 'start-study'), button('Make my own', 'button secondary', () => openDialog('custom-dialog'), 'plus'));
    card.append(actions);
    return;
  }
  const total = state.routine.steps.length;
  if (state.status === 'complete') {
    card.append(cardTop('LOOK WHAT YOU DID', 'ALL STEPS COMPLETE', 'sparkles'));
    const completeIcon = el('div', 'completion-icon'); completeIcon.append(icon('check'));
    card.append(completeIcon, cardHeading('One small step became a whole routine.'), el('p', 'step-description', `You finished ${state.routine.title.toLowerCase()}. All ${total} steps, at your own pace. Take a breath. This is a good place to pause.`));
    const actions = el('div', 'card-actions');
    actions.append(button('Choose another routine', 'button primary', chooseAnother, 'arrow-right', 'new-routine-button'));
    card.append(actions);
    return;
  }
  const step = currentStep(state);
  const small = state.substepIndex !== null;
  if (state.status === 'paused') {
    card.append(cardTop('YOUR PLACE IS RIGHT HERE', `STEP ${state.stepIndex + 1} OF ${total}`, 'pause'), cardHeading('Take your time. We’ll hold the thread.'), el('p', 'step-description', `When you’re ready, come back to: ${small ? step.microsteps[state.substepIndex] : step.title}.`));
    if (state.pauseNote) {
      const note = el('div', 'pause-note');
      note.append(el('small', '', 'YOUR NOTE FOR LATER'), el('span', '', state.pauseNote));
      card.append(note);
    }
    const actions = el('div', 'card-actions');
    actions.append(button('I’m back. Let’s pick up.', 'button primary', () => dispatch({ type: 'resume' }, true), 'return', 'resume-button'));
    card.append(actions);
    const caption = el('p', 'pause-caption'); caption.id = 'pause-caption';
    caption.textContent = `Paused for ${formatElapsed(Date.now() - state.pausedAt)}. No steps have been skipped.`;
    card.append(caption);
    return;
  }
  card.append(cardTop(small ? 'MAKE ROOM FOR ONE SMALL THING' : 'JUST THIS, FOR NOW', `STEP ${state.stepIndex + 1} OF ${total}`, 'leaf'));
  if (small) {
    const micro = el('div', 'small-step-tag', `SMALL STEP ${state.substepIndex + 1} OF ${step.microsteps.length}`);
    const dots = el('span', 'small-step-dots');
    step.microsteps.forEach((_, i) => dots.append(el('i', i < state.substepIndex ? 'done' : '')));
    micro.append(dots); card.append(micro, cardHeading(step.microsteps[state.substepIndex]), el('p', 'parent-title', `Part of: ${step.title}`));
  } else card.append(cardHeading(step.title));
  if (state.lastPauseMs > 0 || state.pauseNote) {
    const context = el('div', 'resume-context');
    context.append(el('strong', '', `Welcome back. You were away for ${formatElapsed(state.lastPauseMs)}.`));
    const last = state.completed.at(-1);
    context.append(el('div', '', last ? `Last finished: ${last.title}.` : 'Your first step is still here, just as you left it.'));
    if (state.pauseNote) context.append(el('div', '', `Your note: ${state.pauseNote}`));
    card.append(context);
  }
  card.append(el('p', 'step-description', small ? 'Just this small action. Mark it done when you are ready for the next.' : step.detail));
  const actions = el('div', 'card-actions');
  actions.append(button(small ? 'Small step done' : 'That’s done', 'button primary', () => dispatch({ type: 'done' }, true), 'check', 'done-button'), button('Pause for a moment', 'button secondary', () => { $('pause-note').value = ''; openDialog('pause-dialog'); }, 'pause'));
  card.append(actions);
  if (!small) card.append(button('Make this step smaller', 'smaller-button', () => dispatch({ type: 'smaller' }, true), 'small'));
}
function renderSteps() {
  const visible = !!state.routine;
  $('steps-card').hidden = !visible;
  if (!visible) return;
  const total = state.routine.steps.length;
  $('progress-label').textContent = `${state.completed.length} of ${total} complete`;
  const progress = Math.round(state.completed.length / total * 100);
  $('progress-fill').style.width = `${progress}%`;
  $('progress-track').setAttribute('aria-valuenow', String(progress));
  $('progress-track').setAttribute('aria-valuetext', `${state.completed.length} of ${total} steps complete`);
  $('step-list').replaceChildren();
  state.routine.steps.forEach((step, i) => {
    const done = i < state.stepIndex;
    const current = i === state.stepIndex;
    const row = el('li', `step-row${done ? ' done' : ''}${current ? ' current' : ''}${state.status === 'paused' ? ' paused' : ''}`);
    const number = el('span', 'step-number');
    number.setAttribute('aria-label', done ? 'Completed' : `Step ${i + 1}`);
    if (done) number.append(icon('check')); else number.textContent = String(i + 1);
    row.append(number, el('span', 'step-row-title', step.title));
    if (current) {
      row.setAttribute('aria-current', 'step');
      row.append(el('span', 'step-current-label', state.status === 'paused' ? 'SAVED HERE' : 'YOU ARE HERE'));
    }
    $('step-list').append(row);
  });
}
function renderChips() {
  const commands = state.status === 'idle' ? [['Start study', 'start study'], ['Pack a bag', 'start pack'], ['Tidy desk', 'start tidy']] : state.status === 'paused' ? [['I’m back', 'resume'], ['Where was I?', 'status']] : state.status === 'complete' ? [['Start study', 'start study'], ['Pack a bag', 'start pack'], ['Tidy desk', 'start tidy']] : [['Done', 'done'], ['Make it smaller', 'smaller'], ['Where am I?', 'status']];
  $('command-chips').replaceChildren(...commands.map(([label, cmd]) => button(label, 'command-chip', () => command(cmd))));
  $('command-input').placeholder = state.status === 'idle' ? 'Try “start study”…' : state.status === 'paused' ? 'Try “resume”…' : 'Try “pause doorbell rang”…';
}
function renderPreferences() {
  $('remember').checked = remembering;
  $('memory-description').textContent = remembering ? 'On · saved in this browser only' : 'Off · clears when this page closes';
  $('clear-data').hidden = !remembering;
}
function render() { renderScenarios(); renderCurrent(); renderSteps(); renderChips(); renderPreferences(); renderTimer(); }

function chooseAnother() {
  if (['active', 'paused'].includes(state.status)) {
    confirmAction('Leave this routine?', 'This will clear your current progress so you can choose another routine. Your saved routine is also cleared if remembering is on.', 'Choose another', 'Keep this routine', () => { dispatch({ type: 'reset' }); $('scenario-grid').querySelector('button').focus(); });
  } else { dispatch({ type: 'reset' }); $('scenario-grid').querySelector('button').focus(); }
}
$('routines-nav').addEventListener('click', () => {
  $('routine-chooser').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
  $('scenario-grid').querySelector('button').focus({ preventScroll: true });
});
for (const id of ['how-nav', 'simulation-info', 'privacy-button', 'commands-help']) $(id).addEventListener('click', () => openDialog('help-dialog'));
$('custom-button').addEventListener('click', () => { $('custom-error').textContent = ''; openDialog('custom-dialog'); });
document.querySelectorAll('[data-close]').forEach(node => node.addEventListener('click', () => $(node.dataset.close).close()));
$('confirm-cancel').addEventListener('click', () => { confirmCallback = null; $('confirm-dialog').close(); });
$('confirm-accept').addEventListener('click', () => { const action = confirmCallback; confirmCallback = null; $('confirm-dialog').close(); action?.(); });
$('confirm-dialog').addEventListener('cancel', () => { confirmCallback = null; });
$('command-form').addEventListener('submit', event => { event.preventDefault(); const value = $('command-input').value; $('command-input').value = ''; command(value); $('command-input').focus(); });
$('custom-form').addEventListener('submit', event => {
  event.preventDefault();
  try {
    const routine = makeCustomRoutine($('routine-name').value, $('routine-steps').value);
    $('custom-error').textContent = '';
    $('custom-dialog').close();
    startRoutine(routine);
  } catch (error) { $('custom-error').textContent = error.message; }
});
$('pause-form').addEventListener('submit', event => { event.preventDefault(); const note = $('pause-note').value; $('pause-dialog').close(); dispatch({ type: 'pause', note }, true); });
$('substeps-form').addEventListener('submit', event => {
  event.preventDefault();
  const result = transition(state, { type: 'substeps', lines: $('substeps-input').value });
  if (result.error) { $('substeps-error').textContent = result.message; return; }
  $('substeps-dialog').close(); applyResult(result, true);
});
$('remember').addEventListener('change', () => {
  $('preference-status').textContent = '';
  if ($('remember').checked) { remembering = true; persist(); }
  else { if (removeSaved()) remembering = false; }
  renderPreferences();
});
$('clear-data').addEventListener('click', () => confirmAction('Clear your saved routine?', 'This removes the routine and pause note saved in this browser, resets your current routine, and clears this session’s conversation. You cannot undo this.', 'Clear my data', 'Keep my routine', () => {
  if (!removeSaved()) return;
  remembering = false;
  state = createInitialState();
  $('conversation-log').replaceChildren();
  pauseTimer(); timer.seconds = timer.duration; timer.resumeWithRoutine = false;
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  render();
  addMessage('Your saved routine and this session’s conversation have been cleared. Ready when you are.');
  $('start-study').focus();
}));
$('read-aloud').addEventListener('change', () => {
  readAloud = $('read-aloud').checked;
  if (!readAloud && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  if (readAloud) speak('Read aloud is on. I’ll read your next cues.');
});
if (!('speechSynthesis' in window)) { $('read-aloud').disabled = true; $('read-aloud').closest('label').querySelector('small').textContent = 'Speech is not available in this browser.'; }

function updateRemaining() {
  if (timer.running) timer.seconds = Math.max(0, Math.ceil((timer.deadline - Date.now()) / 1000));
}
function pauseTimer() { updateRemaining(); timer.running = false; timer.deadline = null; renderTimer(); }
function startTimer() {
  if (state.status === 'paused') return;
  if (timer.seconds === 0) timer.seconds = timer.duration;
  timer.running = true; timer.deadline = Date.now() + timer.seconds * 1000; renderTimer();
}
function renderTimer() {
  $('timer-time').textContent = `${String(Math.floor(timer.seconds / 60)).padStart(2, '0')}:${String(timer.seconds % 60).padStart(2, '0')}`;
  $('timer-toggle').replaceChildren(icon(timer.running ? 'pause' : 'play'));
  $('timer-toggle').setAttribute('aria-label', `${timer.running ? 'Pause' : 'Start'} focus timer`);
  $('timer-toggle').disabled = state.status === 'paused';
  $('timer-duration').disabled = timer.running || timer.seconds !== timer.duration;
  $('timer-note').textContent = state.status === 'paused' ? 'Your focus time is paused, too.' : timer.seconds === 0 ? 'Time for a breath. No rush.' : timer.running ? 'One thing at a time. You’re doing it.' : timer.seconds !== timer.duration ? 'Your time is here when you are.' : 'One small window, just for you.';
}
$('timer-toggle').addEventListener('click', () => { timer.resumeWithRoutine = false; if (timer.running) pauseTimer(); else startTimer(); });
$('timer-reset').addEventListener('click', () => { pauseTimer(); timer.seconds = timer.duration; timer.resumeWithRoutine = false; renderTimer(); });
$('timer-duration').addEventListener('change', () => { timer.duration = Number($('timer-duration').value); timer.seconds = timer.duration; renderTimer(); });
setInterval(() => {
  if (timer.running) {
    updateRemaining();
    if (timer.seconds === 0) {
      timer.running = false; timer.deadline = null;
      addMessage('Your focus time is finished. Take a breath. Your routine stays on the same step until you mark it done.');
    }
    renderTimer();
  }
  if (state.status === 'paused' && $('pause-caption')) $('pause-caption').textContent = `Paused for ${formatElapsed(Date.now() - state.pausedAt)}. No steps have been skipped.`;
}, 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { updateRemaining(); renderTimer(); } });

render();
$('preference-status').textContent = storageIssue;
if (remembering && state.routine) {
  addMessage(state.status === 'complete' ? `Welcome back. Your completed ${state.routine.title} routine is still here.` : `Welcome back. Your saved ${state.routine.title} routine is here, at step ${state.stepIndex + 1}.${state.status === 'paused' ? ' Choose “resume” to pick up where you left off.' : ' Your next action is ready when you are.'}`);
} else addMessage('Hi, I’m your next small cue. Pick something you’d like to do, and we’ll take it one step at a time. If life interrupts, your place stays right here.');
