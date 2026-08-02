# Troubleshooting 0.2.1

## The first build takes a long time
0.2.1 adds the Rust HTTP client and its dependencies. Let the first compile finish. Later launches are faster.

## Score provider unavailable
1. Confirm the PC has internet access.
2. Open **Developer Tools** and select **Run provider test**.
3. Temporarily check whether a firewall or VPN is blocking the app.
4. Close and rerun `RUN_DESKTOP.bat`.
5. Copy the complete red error text if it still fails.

## Browser preview does not show scores
Use `RUN_DESKTOP.bat`. Some browsers block cross-origin score requests, while the desktop backend performs the request natively.

## Rust compiler error
Copy the complete error beginning at the first red `error[...]` line. Do not send only the final “could not compile” line.

## Blank screen
Press Ctrl+Shift+I, open Console, and capture the first error. Also confirm `app/index.html`, `app/app.js`, and `app/styles.css` are in the extracted folder.
