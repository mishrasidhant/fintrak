# Instructions - tbd

## Notes
- Login via puppeteer gets blocked for Simplii - login manually and have puppeter connect to the browser instsance instead
  - Launch a chromium instance (using linux, chrome for other OS **should** work)
  - `chromium --remote-debugging-port=9222 --user-data-dir=/tmp/chromium_profile`
  - Get the websocket enddpoint
    - `curl http://127.0.0.1:9222/json/version` via CLI
    - `http://127.0.0.1:9222/json/version` via browser
  - Login to site on a browser tab
  - Pass webssocket endpoint to a puppeteer script to connect to it
  - puppeteer extra with plugin stealth didn't work
  - switching to firefox didn't work