@AGENTS.md

## Documentation upkeep

After every major change or bug-fix (new/moved routes, renamed UI labels, changed architecture, fixed bugs), update the affected docs in the same change — `README.md`, files under `docs/`, and doc comments that reference the changed paths or behavior. Stale docs are part of the change that's incomplete, not a follow-up task.

## Testing after a feature/fix

Don't launch the dev server or drive the browser to test a change yourself by default. After finishing a feature or bug-fix, ask the user whether they want it tested (e.g. via the `run` skill) before doing so — they generally prefer to test it themselves.
