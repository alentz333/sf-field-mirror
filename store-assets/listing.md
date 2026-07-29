# Chrome Web Store listing copy

Source text for the Developer Dashboard fields. Not read by Chrome — paste into the dashboard by hand.

## Short description (≤132 characters)

```
Create a custom Salesforce field once and mirror it across Lead, Contact, Opportunity, Case, and Account.
```
(108 characters)

## Full description

```
Field Mirror for Salesforce lets you create a custom field once and mirror it across multiple standard objects — Lead, Contact, Opportunity, Case, and Account — instead of walking through Salesforce's New Field wizard separately for each one.

HOW IT WORKS
• Reuses your existing Salesforce session (the same approach Salesforce Inspector uses) — no Connected App or OAuth setup needed. Just open the popup from any tab where you're logged in to Salesforce.
• Creates fields via the Tooling API (CustomField), one per selected object.
• Applies field-level security by inserting FieldPermissions records for the profiles you select (skipped automatically when the field is marked Required, since required fields are visible to everyone).
• The UI mirrors the native New Custom Field wizard: Type → Details → Objects → Security → Save.

USAGE
1. Log in to Salesforce (Lightning or Classic) and stay on that tab.
2. Click the Field Mirror icon in the toolbar.
3. Walk through the wizard — pick a field type, enter details, select objects, set field-level security, and save. Each object shows a per-field result with a direct "View in Setup" link.

The clock icon in the header shows your last 10 jobs (field, type, per-object result, FLS outcome), stored locally on your machine.

REQUIREMENTS
• Your Salesforce user needs API Enabled and Customize Application permissions (standard for admins).
• Works with My Domain orgs (*.my.salesforce.com / *.lightning.force.com), including sandboxes.

NOT SUPPORTED (BY DESIGN)
• Formula, Lookup, Master-Detail, and Roll-Up Summary fields (their configuration differs per object).
• Automatic page-layout placement — after creation, add the field to layouts / Lightning record pages as usual. Fields are immediately available in reports, API, and flows.
• Permission sets in the security step (profiles only for now).

PRIVACY
Field Mirror does not collect, transmit, or sell any data. It talks only to your own Salesforce org's API, using your existing session. See the full privacy policy link on this listing for details.
```

## Category

Productivity (alternative: Developer Tools)

## Permission justification (for the CWS review "sensitive permissions" prompt)

Use as a starting point — Chrome's submission form may want this paraphrased into its own text box(es).

**`cookies` permission:**
```
This extension reads the active tab's Salesforce session cookie to authenticate calls to the Salesforce Tooling API on behalf of the signed-in user — the same session-reuse approach used by tools like Salesforce Inspector. This avoids requiring a separate OAuth/Connected App setup. The cookie value is used only to make direct API calls to the user's own Salesforce org; it is never transmitted anywhere else or stored beyond the current session.
```

**Host permissions (`*.salesforce.com`, `*.lightning.force.com`, `*.salesforce-setup.com`):**
```
The extension needs to detect which Salesforce org the user is on and call that org's REST/Tooling API endpoints directly (e.g. https://ORG.my.salesforce.com/services/data/...). Access is limited to Salesforce's own domains and is required for the extension's core function — creating and securing custom fields via the Tooling API.
```

## Privacy policy URL

Fill in once GitHub Pages is enabled on this repo, e.g.:
```
https://alentz333.github.io/sf-field-mirror/PRIVACY.md
```
(or the equivalent path if Pages is configured to serve from a different branch/folder — check the actual published URL in repo Settings → Pages before submitting.)
