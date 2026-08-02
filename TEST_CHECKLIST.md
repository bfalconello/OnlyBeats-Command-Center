# v0.3.0 Test Checklist

## Launch
- [ ] `RUN_DESKTOP.bat` launches the app.
- [ ] Version 0.3.0 appears in Developer Tools.
- [ ] The Saturday Wall opens without an error.

## Saturday Wall
- [ ] Live scores load.
- [ ] All, Live, Upcoming, and Final filters work.
- [ ] Top 25 filter works when ranked games are available.
- [ ] Favorites filter works.
- [ ] Team search filters cards while typing.
- [ ] Favorite matchups appear before non-favorite games.
- [ ] Clicking a card opens the right-side details drawer.
- [ ] Escape and the close button dismiss the drawer.

## Persistence
- [ ] Favorites remain after restarting.
- [ ] Wall filters/search remain after restarting.
- [ ] Theme and compact mode remain after restarting.

## Refresh and stability
- [ ] Manual Refresh works.
- [ ] Automatic refresh works at the selected interval.
- [ ] Turning auto-refresh Off stops scheduled refreshes.
- [ ] Provider failures show a non-crashing error message.
- [ ] Developer Tools displays the latest sync and cached game count.

## Regression
- [ ] Dashboard opens.
- [ ] Command palette opens with Ctrl+K.
- [ ] Settings export works.
- [ ] GitHub Actions Windows Build completes successfully.
