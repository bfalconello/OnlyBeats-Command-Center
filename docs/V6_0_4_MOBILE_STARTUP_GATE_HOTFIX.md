# OnlyBeats v6.0.4 — Mobile Startup Gate Hotfix

## Fixed

- Hosted iPhone/Android PWA stopped at startup because the Electron desktop
  runtime was incorrectly treated as a required service.
- Desktop runtime now remains required for the Windows desktop environment but
  is treated as not applicable for HTTPS-hosted mobile use.
- Service-worker cache version was bumped so phones retrieve the corrected
  startup scripts.

## Deploy mobile update

After applying the package:

`firebase deploy --only hosting`

Then fully close the OnlyBeats PWA on the phone and reopen it. If the old screen
appears once, remove the app from the app switcher and reopen it again.
