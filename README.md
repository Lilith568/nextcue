# NextCue

**Pick up where you left off.** NextCue is a working browser app for returning to an everyday routine after an interruption.

Choose a routine, complete one small action, pause with a context note, and resume at the exact unfinished step. The app shows your progress, last completed action and saved note together.

> **Prototype scope:** This is a deterministic Alexa+ experience simulation. It is not connected to Alexa or Amazon, and it does not call a language model. Its commands and built-in smaller steps follow explicit local rules. It is not a medical product.

## Run locally

No dependencies, build step, account, API keys or Amazon hardware are required. With Python 3 installed, run this command from the repository root:

```sh
python3 -m http.server 8000 --directory dist
```

On Windows, the equivalent is:

```powershell
py -m http.server 8000 --directory dist
```

Open **http://localhost:8000** in a current browser. Serve the app over HTTP rather than opening `index.html` directly, because it uses JavaScript modules.

## Try it

1. Start **Study session** and mark the first action done.
2. Select **Pause for a moment** and add `Phone call; notebook open on the desk.`
3. Resume. The next unfinished action, your note and previous progress remain intact.
4. Select **Make this step smaller** to use authored microsteps. A small step does not skip the rest of its parent action.
5. Type `status`, `pause your note`, `resume`, `done` or `smaller` in the cue panel. Unknown commands return help without changing your progress.
6. Create a custom routine with one action per line. Custom smaller steps are also supplied by you.
7. Optionally try the focus timer, browser read-aloud and **Remember on this device** setting.

## Run the tests

Use a current Node.js version with its built-in test runner. No package installation is necessary:

```sh
node --test tests/engine.test.mjs
```

The nine existing tests cover interruption/resume state, explicit completion, smaller-step progress, restoration of saved state, invalid commands, literal custom text and immutable transitions. They verify the state engine; they do not replace browser usability or accessibility testing.

## Project layout

| Path | Purpose |
| --- | --- |
| `dist/index.html` | Application interface and accessible form labels |
| `dist/styles.css` | Responsive styling |
| `dist/engine.mjs` | Routine definitions, state transitions and command parsing |
| `dist/app.js` | Browser interface, optional storage, timer and read-aloud |
| `tests/engine.test.mjs` | Automated state-engine tests |
| `LICENSE` | MIT license |

The `dist` directory contains the application source itself. There is no compiled build or required bundler. Any static web server can serve this directory.

## Data and limitations

- Routine state is temporary in page memory by default.
- **Remember on this device** optionally stores the routine and pause note in this browser's `localStorage`. It is not encrypted or synchronized across devices. Conversation history and timer state are not saved.
- Turning remembering off removes the saved routine. **Clear saved routine** also resets the current routine and session conversation.
- Read-aloud uses optional browser speech synthesis. Voice availability and processing depend on the browser or device. NextCue does not request microphone access.
- The app has no backend, analytics, account system, cloud backup, external application API calls or runtime AI model. A hosting provider still receives normal page requests.
- Built-in microsteps are authored. Custom routines require user-supplied steps. NextCue cannot infer whether a physical action was actually completed.
- No clinical benefit, productivity result, user study, live Alexa integration or cross-device handoff is claimed.

## Development and next steps

Created as an interaction prototype for the Build, Ship, Shape: Amazon Developer Hackathon 2026. OpenAI ChatGPT/Codex assisted design, implementation and testing. Future work could evaluate the interruption-and-return experience with users, followed by a separately implemented Alexa integration and explicitly scoped cross-device storage.

## License

MIT; see [LICENSE](LICENSE). No Amazon logos, third-party image assets, music or video footage are bundled.
