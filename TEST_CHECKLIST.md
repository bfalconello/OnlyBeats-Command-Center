# OnlyBeats Command Center 0.2.2 Test Checklist

## Repository checks
- [ ] `.github/workflows/windows-build.yml` is present
- [ ] Issue templates appear under GitHub **New issue**
- [ ] README documentation links open correctly
- [ ] Project Bible and roadmap render correctly on GitHub

## Native regression
- [ ] `RUN_DESKTOP.bat` builds and launches
- [ ] Version displays as 0.2.2
- [ ] Dashboard opens
- [ ] Live Games opens
- [ ] Refresh now completes without a crash
- [ ] Search filters displayed games
- [ ] A team can be added to favorites
- [ ] Favorite remains after restart
- [ ] Developer Tools displays provider status and last sync
- [ ] Settings persist after restart

## GitHub Actions
- [ ] Windows Build workflow starts after push
- [ ] JavaScript syntax step passes
- [ ] Rust check passes
- [ ] Tauri build passes
- [ ] MSI and/or NSIS artifact is available to download

## Documentation
- [ ] Release notes match actual changes
- [ ] No API keys, tokens, personal paths, `node_modules`, or `src-tauri/target` are committed
