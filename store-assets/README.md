# Chrome Web Store submission checklist

Things still needed before submitting, and how to produce them.

## 1. Package the extension

No build step — zip the runtime files only:

```
cd ~/Projects/sf-field-mirror
zip -r store-assets/field-mirror.zip manifest.json popup.html popup.css popup.js icons/
```

Do **not** include `.git/`, `README.md`, `store-assets/`, `.gitignore`, `LICENSE`, or `PRIVACY.md` — the store only wants what the extension actually loads.

## 2. Screenshots (required — at least 1)

- Size: 1280×800 or 640×400 PNG/JPEG.
- Must show the extension actually in use (not just a static mockup).
- Suggested shots: the field-type picker (step 1) and the review/results screen (step 5) against a real Salesforce org.
- Drop finished files in this folder as `screenshot-1.png`, `screenshot-2.png`, etc.

## 3. Promo tile (required for a public listing)

- Size: 440×280 PNG/JPEG, no alpha transparency.
- Simple is fine — extension name/icon + a one-line tagline. Any image tool (Figma, Canva, Preview.app) works.
- Save as `promo-tile.png` in this folder.

## 4. Privacy policy URL

- `PRIVACY.md` is already in the repo root.
- Enable GitHub Pages: repo Settings → Pages → deploy from `main` (root).
- Confirm the published URL loads with no auth in a plain browser tab, then paste it into the Developer Dashboard's privacy policy field.

## 5. Listing copy

- Use `listing.md` in this folder for the short description, full description, category, and permission-justification text.

## 6. Submit

- [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) — one-time $5 registration fee if this is your first submission.
- Upload `field-mirror.zip`, fill in listing fields from `listing.md`, add screenshots + promo tile, paste the privacy policy URL, submit for review.
- Chrome may prompt for extra justification given the `cookies` + broad host permissions — use the permission-justification text in `listing.md` as a starting point.
