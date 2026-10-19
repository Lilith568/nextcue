export const SCENARIOS = {
  study: {
    id: 'study', title: 'Study session', subtitle: 'Make a little room for learning.', icon: 'book', estimate: '5 steps',
    steps: [
      { title: 'Set up your space', detail: 'Put one thing you want to study in front of you. You only need what helps you begin.', microsteps: ['Choose one topic for this session.', 'Open the book, document, or notes you need.', 'Move one distraction out of reach.'] },
      { title: 'Choose one small goal', detail: 'Pick something you can finish in this session, like reading two pages or solving one question.', microsteps: ['Look at the material in front of you.', 'Choose one question, section, or short task.', 'Write your goal in a single sentence.'] },
      { title: 'Give it ten minutes', detail: 'Work on your one goal. The optional focus timer can hold the time for you.', microsteps: ['Read the first paragraph or question.', 'Make one note or try the first part.', 'Continue until your small goal is done, or take a break.'] },
      { title: 'Save the useful part', detail: 'Write down one thing you learned, or the question you want to come back to.', microsteps: ['Find one idea worth keeping.', 'Write it in your own words.', 'Note anything you would like to revisit.'] },
      { title: 'Leave a cue for next time', detail: 'Mark where to begin next time. You have made progress; it is okay to stop here.', microsteps: ['Choose your next starting point.', 'Mark the page or add a short note.', 'Close your materials when you are ready.'] }
    ]
  },
  pack: {
    id: 'pack', title: 'Pack a bag', subtitle: 'Head out with a little less rush.', icon: 'bag', estimate: '5 steps',
    steps: [
      { title: 'Put your bag somewhere easy', detail: 'Place your bag on a clear surface and open it.', microsteps: ['Find the bag you want to use.', 'Put it on a chair, bed, or table.', 'Open the main compartment.'] },
      { title: 'Gather your everyday essentials', detail: 'Put the essentials you need nearby: keys, wallet, phone, and anything else you use.', microsteps: ['Find your keys.', 'Find your wallet or travel card.', 'Check that you have your phone.'] },
      { title: 'Add what today needs', detail: 'Think about where you are going. Add the work, study, or personal items you need today.', microsteps: ['Think of your next destination.', 'Pick the items you need there.', 'Put those items in your bag.'] },
      { title: 'Check your comfort items', detail: 'Consider a water bottle, a snack, a charger, or a layer for the weather.', microsteps: ['Decide whether you need water or a snack.', 'Check whether you need a charger.', 'Choose a layer if you need one.'] },
      { title: 'Do one final check', detail: 'Make sure your essentials are packed, close your bag, and put it near the door.', microsteps: ['Check your everyday essentials.', 'Close the pockets and main compartment.', 'Put your bag where you will see it on the way out.'] }
    ]
  },
  tidy: {
    id: 'tidy', title: 'Tidy your desk', subtitle: 'Clear a little space. Clear a little noise.', icon: 'sparkles', estimate: '5 steps',
    steps: [
      { title: 'Pick one small patch', detail: 'Choose a small area of your desk. The whole room can wait.', microsteps: ['Look at your desktop.', 'Choose a patch about the size of a notebook.', 'Move just the objects in that patch to one side.'] },
      { title: 'Let the rubbish go', detail: 'Collect obvious rubbish from your chosen area and put it in the appropriate bin.', microsteps: ['Find a bin or a small bag.', 'Pick up obvious rubbish from your chosen patch.', 'Put it in the appropriate bin.'] },
      { title: 'Give loose things a home', detail: 'Put pens, papers, and other small objects back where you can find them.', microsteps: ['Gather similar items together.', 'Choose a place for the things you use.', 'Set aside anything that belongs in another room.'] },
      { title: 'Wipe your clear space', detail: 'If you have a suitable cloth, give your cleared area a quick wipe. Keep electronics dry.', microsteps: ['Find a suitable cloth.', 'Keep electronics and cables out of the way.', 'Wipe the cleared surface.'] },
      { title: 'Set up for your next thing', detail: 'Put back just what you want to use next. Take a moment to notice the space you made.', microsteps: ['Choose what you want to do next.', 'Put the things you need within reach.', 'Notice your finished space.'] }
    ]
  }
};

export function createInitialState() {
  return { version: 1, routine: null, status: 'idle', stepIndex: 0, substepIndex: null, completed: [], pauseNote: '', pausedAt: null, lastPauseMs: 0, startedAt: null, completedAt: null };
}

export function makeCustomRoutine(title, lines) {
  const cleanTitle = String(title || '').trim();
  const steps = (Array.isArray(lines) ? lines : String(lines || '').split(/\r?\n/)).map(s => String(s).trim()).filter(Boolean);
  if (!cleanTitle || cleanTitle.length > 60) throw new Error('Give your routine a name of 1–60 characters.');
  if (steps.length < 1 || steps.length > 12) throw new Error('Add 1–12 steps, with one step on each line.');
  if (steps.some(s => s.length > 180)) throw new Error('Keep each step under 181 characters.');
  return { id: 'custom', title: cleanTitle, subtitle: 'Your routine, at your pace.', icon: 'list', estimate: `${steps.length} steps`, steps: steps.map(title => ({ title, detail: 'Take this one step at your own pace.', microsteps: [] })) };
}

export function currentStep(state) {
  return state.routine?.steps[state.stepIndex] || null;
}

export function statusText(state) {
  if (!state.routine) return 'No routine is open. Choose a routine, or type “start study”, “start pack”, or “start tidy”.';
  if (state.status === 'complete') return `You finished ${state.routine.title}. All ${state.routine.steps.length} steps are complete.`;
  const step = currentStep(state);
  const small = state.substepIndex !== null ? ` Small step ${state.substepIndex + 1} of ${step.microsteps.length}: ${step.microsteps[state.substepIndex]}` : '';
  return `${state.status === 'paused' ? 'Paused' : 'In progress'}: ${state.routine.title}. Step ${state.stepIndex + 1} of ${state.routine.steps.length}: ${step.title}.${small}`;
}

function result(state, message, extra = {}) { return { state, message, changed: false, ...extra }; }
function clone(state) { return JSON.parse(JSON.stringify(state)); }

export function transition(state, action, now = Date.now()) {
  if (action.type === 'status') return result(state, statusText(state));
  if (action.type === 'start') {
    const routine = typeof action.routine === 'string' ? SCENARIOS[action.routine] : action.routine;
    if (!routine || !Array.isArray(routine.steps) || !routine.steps.length) return result(state, 'Choose Study session, Pack a bag, or Tidy your desk.', { error: true });
    if ((state.status === 'active' || state.status === 'paused') && !action.replace) return result(state, 'You already have a routine open. Choose a routine from the cards to switch, or continue this one.', { error: true });
    const next = { ...createInitialState(), routine: clone(routine), status: 'active', startedAt: now };
    return result(next, `Let’s begin ${routine.title}. First: ${routine.steps[0].title}.`, { changed: true });
  }
  if (action.type === 'reset') return result(createInitialState(), 'Ready for a fresh start. Choose a routine when you are ready.', { changed: true });
  if (!state.routine) return result(state, 'Choose a routine before using that command.', { error: true });
  if (state.status === 'complete') return result(state, 'This routine is complete. Choose another routine whenever you are ready.', { error: true });
  const next = clone(state);
  const step = currentStep(next);
  if (action.type === 'pause') {
    if (state.status === 'paused') return result(state, 'You are already paused. Your place is saved. Use “resume” when you are ready.', { error: true });
    next.status = 'paused';
    next.pauseNote = String(action.note || '').trim().slice(0, 500);
    next.pausedAt = now;
    return result(next, `Paused. I’ve kept your place at “${step.title}”.${next.pauseNote ? ` Your note: ${next.pauseNote}` : ''} Come back when you are ready.`, { changed: true });
  }
  if (action.type === 'resume') {
    if (state.status !== 'paused') return result(state, `You are already on step ${state.stepIndex + 1}: ${step.title}.`, { error: true });
    next.status = 'active';
    next.lastPauseMs = Math.max(0, now - state.pausedAt);
    next.pausedAt = null;
    const last = next.completed.at(-1);
    const small = next.substepIndex !== null ? ` Your next small step: ${step.microsteps[next.substepIndex]}` : '';
    return result(next, `Welcome back.${last ? ` You finished “${last.title}”.` : ' You are still on your first step.'} Pick up at “${step.title}”.${small}${next.pauseNote ? ` Your note: ${next.pauseNote}` : ''}`, { changed: true });
  }
  if (state.status === 'paused') return result(state, 'Your routine is paused. Resume it first; your current step will still be here.', { error: true });
  if (action.type === 'smaller') {
    if (next.substepIndex !== null) return result(state, `Already taking it smaller: ${step.microsteps[next.substepIndex]}`);
    if (!step.microsteps?.length) return result(state, 'This is your custom step. Add your own smaller steps to break it down.', { needsSubsteps: true });
    next.substepIndex = 0;
    return result(next, `One small thing: ${step.microsteps[0]}`, { changed: true });
  }
  if (action.type === 'substeps') {
    if (next.substepIndex !== null) return result(state, 'Finish the current small steps before adding more.', { error: true });
    const microsteps = String(action.lines || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    if (microsteps.length < 2 || microsteps.length > 8 || microsteps.some(s => s.length > 180)) return result(state, 'Add 2–8 smaller steps, up to 180 characters each.', { error: true });
    step.microsteps = microsteps;
    next.substepIndex = 0;
    return result(next, `Your smaller steps are ready. First: ${microsteps[0]}`, { changed: true });
  }
  if (action.type === 'done') {
    if (next.substepIndex !== null && next.substepIndex < step.microsteps.length - 1) {
      next.substepIndex += 1;
      return result(next, `That small step is done. Next: ${step.microsteps[next.substepIndex]}`, { changed: true });
    }
    next.completed.push({ title: step.title, at: now });
    next.stepIndex += 1;
    next.substepIndex = null;
    next.pauseNote = '';
    next.lastPauseMs = 0;
    if (next.stepIndex === next.routine.steps.length) {
      next.status = 'complete';
      next.completedAt = now;
      return result(next, `You did it. ${next.routine.title} is complete. All ${next.routine.steps.length} steps, one at a time.`, { changed: true });
    }
    return result(next, `Done: ${step.title}. Next: ${currentStep(next).title}.`, { changed: true });
  }
  return result(state, 'That command is not available. Try “done”, “pause”, “resume”, “smaller”, or “status”.', { error: true });
}

export function parseCommand(input) {
  const raw = String(input || '').trim();
  const text = raw.toLowerCase();
  if (/^start (study|study session)$/.test(text)) return { type: 'start', routine: 'study' };
  if (/^start (pack|pack a bag)$/.test(text)) return { type: 'start', routine: 'pack' };
  if (/^start (tidy|tidy desk|tidy your desk)$/.test(text)) return { type: 'start', routine: 'tidy' };
  if (['done', 'resume', 'smaller', 'status', 'help'].includes(text)) return { type: text };
  if (/^pause(?:\s|$)/i.test(raw)) return { type: 'pause', note: raw.slice(5).trim() };
  return { type: 'unknown' };
}

export function executeCommand(state, input, now = Date.now()) {
  const action = parseCommand(input);
  if (action.type === 'help') return result(state, 'Available commands: start study · start pack · start tidy · done · pause [your note] · resume · smaller · status. These are fixed commands for this simulation.');
  if (action.type === 'unknown') return result(state, 'I did not recognise that command. Try “done”, “pause your note”, “resume”, “smaller”, or “status”. Type “help” to see all commands.', { error: true });
  return transition(state, action, now);
}

export function restoreState(value) {
  try {
    if (!value || value.version !== 1 || !['idle', 'active', 'paused', 'complete'].includes(value.status)) return null;
    if (value.status === 'idle') return createInitialState();
    const r = value.routine;
    if (!r || typeof r.title !== 'string' || r.title.length > 60 || !Array.isArray(r.steps) || r.steps.length < 1 || r.steps.length > 12) return null;
    if (!r.steps.every(s => typeof s.title === 'string' && s.title.length <= 180 && typeof s.detail === 'string' && Array.isArray(s.microsteps) && s.microsteps.length <= 8 && s.microsteps.every(m => typeof m === 'string' && m.length <= 180))) return null;
    if (!Number.isInteger(value.stepIndex) || value.stepIndex < 0 || value.stepIndex > r.steps.length) return null;
    if (!Array.isArray(value.completed) || value.completed.length !== value.stepIndex || !value.completed.every(s => typeof s.title === 'string' && Number.isFinite(s.at))) return null;
    if (value.status === 'complete' ? value.stepIndex !== r.steps.length : value.stepIndex >= r.steps.length) return null;
    if (value.substepIndex !== null && (value.status === 'complete' || !Number.isInteger(value.substepIndex) || value.substepIndex < 0 || value.substepIndex >= r.steps[value.stepIndex]?.microsteps.length)) return null;
    if (!Number.isFinite(value.lastPauseMs) || value.lastPauseMs < 0) return null;
    if (typeof value.pauseNote !== 'string' || value.pauseNote.length > 500) return null;
    if (value.status === 'paused' && !Number.isFinite(value.pausedAt)) return null;
    if (!Number.isFinite(value.startedAt)) return null;
    return clone(value);
  } catch { return null; }
}
