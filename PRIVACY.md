# Privacy Policy — Field Mirror for Salesforce

_Last updated: 2026-07-28_

Field Mirror for Salesforce is a browser extension that creates a custom field once and mirrors it across multiple Salesforce objects (Lead, Contact, Opportunity, Case, Account). This document explains what data the extension accesses and how it's used.

## What the extension accesses

- **Your existing Salesforce session cookie.** The extension uses Chrome's `cookies` permission to read the session ID cookie for the Salesforce tab you're currently on, the same way tools like Salesforce Inspector work. This lets the extension call the Salesforce Tooling API as you, without a separate login, Connected App, or OAuth flow.
- **The Salesforce domains you visit.** The extension's `host_permissions` (`*.salesforce.com`, `*.lightning.force.com`, `*.salesforce-setup.com`) allow it to detect your org and call the Tooling API. It does not access any other websites.

## What the extension does with that access

- Creates `CustomField` records and, where applicable, `FieldPermissions` records directly against your Salesforce org via the Tooling API — the same actions you'd otherwise perform by hand in Setup.
- Nothing is sent to any server other than your own Salesforce org's API endpoints. There is no backend, analytics service, or third party involved.

## What's stored locally

- `chrome.storage.local` is used only to keep a short local history (the last 10 field-creation jobs), entirely on your own machine.
- This data is never transmitted anywhere. Uninstalling the extension removes it.

## What the extension does not do

- It does not collect, transmit, or sell personal data, browsing history, or credentials.
- It does not use analytics, tracking, or advertising of any kind.
- It does not share data with any third party.

## Changes

If the extension's data handling changes in a future version, this policy will be updated accordingly.

## Contact

Questions about this policy can be sent to alexlentz0@gmail.com.
