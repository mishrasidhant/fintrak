# 1. Fintrak
- [1. Fintrak](#1-fintrak)
- [2. Project plan](#2-project-plan)
- [3. Notes](#3-notes)

# 2. Project plan
1. Prototype a single site module
   - [x] Implement and test automation for one site
   - [x] Validate login/2FA input -> BLOCKED
     - [x] Workaround -> Revisit this post MVP
   - [x] Site specific navigation and interaction logic
   - [x] Statement Download
     - [x] Single account type
     - [x] All Account Types
     - [x] All Statements
     - [ ] Date Range -> Not currently supported
2. Build the parser
   - [ ] Create PDF parsing logic against sample PDF from target site
   - [ ] Validate that extraction of transactions is reliable (add testing?)
   - [ ] Save CSV to disk
   - [ ] Validate CSV import in GnuCash
3. Integrate site module with parser
   - [ ] Create CLI interface and scripts for end to end flow
   - [ ] Add tests at this point
4. Document and extend
   - [ ] Document the architecture
   - [ ] Iterate steps 1-3 to add support for next site
   - [ ] Modularize and extend (if appropriate) -> Delay till app supports all sites

# 3. Notes
> Simplii doesn't allow login via puppeteer -> workaround implemented - manual process
- Login via puppeteer gets blocked for Simplii - login manually and have puppeter connect to the browser instance instead
  - Launch a chromium instance (using linux, chrome for other OS **should** work)
  - `chromium --remote-debugging-port=9222 --user-data-dir=/tmp/chromium_profile`
  - Get the websocket enddpoint
    - `curl http://127.0.0.1:9222/json/version` via CLI
    - `http://127.0.0.1:9222/json/version` via browser
  - Login to site on a browser tab
  - Pass webssocket endpoint to a puppeteer script to connect to it
  - puppeteer extra with plugin stealth didn't work
  - switching to firefox didn't work
> CSV import feature on GnuCash is stable
- Duplicate transactions are identified by importer
- Target account needs to be bound correctly at import time -> USER ERROR POSSIBLE
- Imports don't seem to be idempotent -> explore more
  - Second import reconciles
  - Third import sets state back to first import (reverts reconcile?)
- PDF and XML fetch example site to use for blog post https://github.com/subwaymatch/cdp-modify-response-example