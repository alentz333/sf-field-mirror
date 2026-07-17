# Field Mirror for Salesforce

A Chrome extension that lets you create a custom field **once** and mirror it across multiple standard objects — Lead, Contact, Opportunity, Case, and Account — instead of walking through Salesforce's New Field wizard separately for each one.

## How it works

- Reuses your **existing Salesforce session** (the same approach Salesforce Inspector uses) — no Connected App or OAuth setup needed. Open the popup from any tab where you're logged in to Salesforce.
- Creates fields via the **Tooling API** (`CustomField`), one per selected object.
- Applies **field-level security** by inserting `FieldPermissions` records for the profiles you select (skipped automatically when the field is marked Required, since required fields are visible to everyone).
- The UI mirrors the native New Custom Field wizard: **Type → Details → Objects → Security → Save**.

## Installation

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and select this folder (`sf-field-mirror`).
4. Pin the extension for easy access.

## Usage

1. Log in to Salesforce (Lightning or Classic) and stay on that tab.
2. Click the Field Mirror icon in the toolbar.
3. Walk through the wizard:
   1. **Type** — pick from 14 common field types (Text, Picklist, Multi-Select Picklist, Checkbox, Number, Currency, Percent, Date, Date/Time, Email, Phone, URL, Text Area, Long Text Area).
   2. **Details** — label, API name (auto-generated from the label), type-specific options (length, picklist values, decimals…), description, help text, required flag.
   3. **Objects** — check any of Lead, Contact, Opportunity, Case, Account.
   4. **Security** — set Visible / Read-Only per profile, applied identically on every object.
   5. **Save** — review, then create. Each object shows a per-field result with a direct **View in Setup** link.

The clock button in the header shows the **last 10 jobs** (field, type, per-object result, FLS outcome), stored locally via `chrome.storage.local`.

Note on field-level security: profiles whose user license has no access to an object (Chatter, platform, guest profiles — common in Developer Edition orgs) can't be granted field permissions. Those rows fail with a permission error and are safe to ignore; the results screen now lists exactly which profile/object combinations failed and why.

## Requirements

- Your Salesforce user needs **API Enabled** and **Customize Application** permissions (standard for admins).
- Works with My Domain orgs (`*.my.salesforce.com` / `*.lightning.force.com`), including sandboxes.

## Not in v1 (by design)

- Formula, Lookup, Master-Detail, and Roll-Up Summary fields (their configuration differs per object).
- Automatic page-layout placement — after creation, add the field to layouts / Lightning record pages as usual. Fields **are** immediately available in reports, API, and flows.
- Permission sets in the security step (profiles only for now).

## Project layout

```
manifest.json   MV3 manifest (cookies + salesforce.com/force.com host permissions)
popup.html      Wizard markup (5 steps + connection/error screens)
popup.css       SLDS-inspired styling
popup.js        Session detection, wizard state machine, Tooling API calls
icons/          Generated toolbar icons
```
