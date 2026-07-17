/* Field Mirror for Salesforce — popup logic */
"use strict";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OBJECTS = [
  { api: "Lead",        label: "Lead",        color: "#f88962", letter: "L" },
  { api: "Contact",     label: "Contact",     color: "#a094ed", letter: "C" },
  { api: "Opportunity", label: "Opportunity", color: "#fcb95b", letter: "O" },
  { api: "Case",        label: "Case",        color: "#f2cf5b", letter: "Cs" },
  { api: "Account",     label: "Account",     color: "#7f8de1", letter: "A" },
];

const FIELD_TYPES = [
  { type: "Text",                name: "Text",                  desc: "Any combination of letters and numbers, up to 255 characters" },
  { type: "Picklist",            name: "Picklist",              desc: "A list of values to choose one from" },
  { type: "MultiselectPicklist", name: "Picklist (Multi-Select)", desc: "A list of values to choose several from" },
  { type: "Checkbox",            name: "Checkbox",              desc: "A checked (true) or unchecked (false) value" },
  { type: "Number",              name: "Number",                desc: "A real number, with optional decimal places" },
  { type: "Currency",            name: "Currency",              desc: "A currency amount in the org's currency format" },
  { type: "Percent",             name: "Percent",               desc: "A percentage, entered as a number" },
  { type: "Date",                name: "Date",                  desc: "A calendar date" },
  { type: "DateTime",            name: "Date/Time",             desc: "A calendar date and time of day" },
  { type: "Email",               name: "Email",                 desc: "An email address, validated on entry" },
  { type: "Phone",               name: "Phone",                 desc: "A phone number, formatted on entry" },
  { type: "Url",                 name: "URL",                   desc: "A web address, shown as a clickable link" },
  { type: "TextArea",            name: "Text Area",             desc: "Up to 255 characters on separate lines" },
  { type: "LongTextArea",        name: "Text Area (Long)",      desc: "Up to 131,072 characters on separate lines" },
];

// Types that Salesforce does not allow to be universally required
const NO_REQUIRED_TYPES = new Set(["Checkbox", "LongTextArea"]);
const FALLBACK_API_VERSION = "61.0";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const state = {
  apiHost: null,        // e.g. mydomain.my.salesforce.com
  lightningHost: null,  // host of the tab we launched from
  sid: null,
  apiVersion: FALLBACK_API_VERSION,
  step: 0,
  fieldType: null,
  nameEdited: false,    // user manually edited Field Name
  profiles: [],         // [{ id, name }]
  profilesLoaded: false,
  fls: new Map(),       // profileId -> { visible, readOnly }
  createStarted: false,
  createResults: [],    // [{ object, ok, id?, error? }]
};

const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------------------
// Salesforce connection (Salesforce Inspector-style session reuse)
// ---------------------------------------------------------------------------

function apiHostFromTabHost(host) {
  // Map any Salesforce UI host to the *.my.salesforce.com API host.
  if (/\.my\.salesforce\.com$/.test(host)) return host;
  if (/\.my\.salesforce-setup\.com$/.test(host)) {
    return host.replace(/\.my\.salesforce-setup\.com$/, ".my.salesforce.com");
  }
  if (/\.lightning\.force\.com$/.test(host)) {
    return host.replace(/\.lightning\.force\.com$/, ".my.salesforce.com");
  }
  if (/\.salesforce\.com$/.test(host)) return host; // classic instance domains
  return null;
}

async function connect() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let host = null;
  try {
    host = new URL(tab.url).hostname;
  } catch {
    /* e.g. chrome:// pages */
  }
  const apiHost = host && apiHostFromTabHost(host);
  if (!apiHost) {
    showDisconnected(
      "Not a Salesforce tab",
      "Switch to a tab where you're logged in to Salesforce, then open Field Mirror again."
    );
    return false;
  }

  const cookie = await chrome.cookies.get({ url: `https://${apiHost}`, name: "sid" });
  if (!cookie || !cookie.value) {
    showDisconnected(
      "No Salesforce session found",
      `Log in to Salesforce in this tab (${host}), then open Field Mirror again.`
    );
    return false;
  }

  state.apiHost = apiHost;
  state.lightningHost = host;
  state.sid = cookie.value;

  // Pick the newest API version the org supports (endpoint needs no auth).
  try {
    const res = await fetch(`https://${apiHost}/services/data/`);
    const versions = await res.json();
    if (Array.isArray(versions) && versions.length) {
      state.apiVersion = versions[versions.length - 1].version;
    }
  } catch {
    /* keep fallback */
  }

  // Verify the session actually works.
  try {
    await sfFetch(`/services/data/v${state.apiVersion}/limits/`);
  } catch (e) {
    showDisconnected(
      "Session expired or insufficient access",
      "Your Salesforce session could not be used for API calls. Log in again, and make sure your user has the “API Enabled” and “Customize Application” permissions."
    );
    return false;
  }

  const orgLabel = apiHost.replace(/\.my\.salesforce\.com$/, "");
  const badge = $("orgBadge");
  badge.textContent = orgLabel;
  badge.title = apiHost;
  badge.hidden = false;
  return true;
}

async function sfFetch(path, options = {}) {
  const res = await fetch(`https://${state.apiHost}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${state.sid}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let body = null;
  if (text) {
    try { body = JSON.parse(text); } catch { body = text; }
  }
  if (!res.ok) {
    throw new SfError(body, res.status);
  }
  return body;
}

class SfError extends Error {
  constructor(body, status) {
    super(SfError.describe(body, status));
    this.body = body;
    this.status = status;
  }
  static describe(body, status) {
    if (Array.isArray(body) && body.length) {
      return body.map((e) => e.message || e.errorCode).join("; ");
    }
    if (body && typeof body === "object" && body.message) return body.message;
    return `HTTP ${status}`;
  }
}

function showDisconnected(title, msg) {
  $("screen-loading").hidden = true;
  $("screen-wizard").hidden = true;
  $("disconnectedTitle").textContent = title;
  $("disconnectedMsg").textContent = msg;
  $("screen-disconnected").hidden = false;
}

// ---------------------------------------------------------------------------
// Step 1 — field type
// ---------------------------------------------------------------------------

function renderTypeList() {
  const list = $("typeList");
  list.innerHTML = "";
  for (const t of FIELD_TYPES) {
    const label = document.createElement("label");
    label.className = "type-option";
    label.innerHTML = `
      <input type="radio" name="fieldType" value="${t.type}">
      <span><span class="t-name">${t.name}</span><span class="t-desc">${t.desc}</span></span>`;
    const input = label.querySelector("input");
    input.checked = state.fieldType === t.type;
    if (input.checked) label.classList.add("selected");
    input.addEventListener("change", () => {
      state.fieldType = t.type;
      list.querySelectorAll(".type-option").forEach((el) => el.classList.remove("selected"));
      label.classList.add("selected");
      updateNextButton();
    });
    list.appendChild(label);
  }
}

// ---------------------------------------------------------------------------
// Step 2 — details
// ---------------------------------------------------------------------------

function labelToApiName(label) {
  let name = label
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (/^[0-9]/.test(name)) name = "X" + name;
  return name.slice(0, 40).replace(/_+$/, "");
}

const API_NAME_RE = /^[A-Za-z][A-Za-z0-9]*(_[A-Za-z0-9]+)*$/;

function renderTypeOptions() {
  const wrap = $("typeOptions");
  wrap.innerHTML = "";
  const t = state.fieldType;

  const add = (html) => {
    const div = document.createElement("div");
    div.className = "form-el" + (html.full ? " form-el-full" : "");
    div.innerHTML = html.body;
    wrap.appendChild(div);
    return div;
  };

  if (t === "Text") {
    add({ body: `<label for="optLength">Length <abbr class="req">*</abbr></label>
      <input type="number" id="optLength" min="1" max="255" value="255">` });
  } else if (t === "LongTextArea") {
    add({ body: `<label for="optLength">Length <abbr class="req">*</abbr></label>
      <input type="number" id="optLength" min="256" max="131072" value="32768">` });
    add({ body: `<label for="optVisibleLines"># Visible Lines <abbr class="req">*</abbr></label>
      <input type="number" id="optVisibleLines" min="2" max="50" value="3">` });
  } else if (t === "Picklist" || t === "MultiselectPicklist") {
    add({ full: true, body: `<label for="optPicklistValues">Picklist Values <abbr class="req">*</abbr> (one per line)</label>
      <textarea id="optPicklistValues" rows="5" spellcheck="false" placeholder="Value 1&#10;Value 2&#10;Value 3"></textarea>` });
    add({ body: `<label class="checkbox"><input type="checkbox" id="optSorted"><span>Display values alphabetically</span></label>` });
    add({ body: `<label class="checkbox"><input type="checkbox" id="optFirstDefault"><span>Use first value as default value</span></label>` });
    if (t === "MultiselectPicklist") {
      add({ body: `<label for="optVisibleLines"># Visible Lines <abbr class="req">*</abbr></label>
        <input type="number" id="optVisibleLines" min="3" max="10" value="4">` });
    }
  } else if (t === "Checkbox") {
    add({ full: true, body: `<label>Default Value</label>
      <div class="radio-row">
        <label><input type="radio" name="optCheckboxDefault" value="false" checked> Unchecked</label>
        <label><input type="radio" name="optCheckboxDefault" value="true"> Checked</label>
      </div>` });
  } else if (t === "Number" || t === "Currency" || t === "Percent") {
    const len = t === "Number" ? 18 : 16;
    const dec = t === "Number" ? 0 : 2;
    add({ body: `<label for="optDigits">Length (digits left of decimal) <abbr class="req">*</abbr></label>
      <input type="number" id="optDigits" min="1" max="18" value="${len}">` });
    add({ body: `<label for="optDecimals">Decimal Places <abbr class="req">*</abbr></label>
      <input type="number" id="optDecimals" min="0" max="18" value="${dec}">` });
  }
  // Date, DateTime, Email, Phone, Url, TextArea: no extra options

  $("requiredWrap").hidden = NO_REQUIRED_TYPES.has(t);
  if (NO_REQUIRED_TYPES.has(t)) $("fieldRequired").checked = false;
}

function validateDetails(showErrors) {
  const label = $("fieldLabel").value.trim();
  const name = $("fieldName").value.trim();
  const hint = $("fieldNameHint");
  let ok = true;

  if (!label) ok = false;
  if (!name || !API_NAME_RE.test(name)) {
    ok = false;
    if (showErrors && name) {
      hint.textContent = "Must start with a letter, use only letters, numbers, and single underscores, and not end with an underscore.";
      hint.classList.add("err");
      $("fieldName").classList.add("invalid");
    }
  } else {
    hint.textContent = `API name: ${name}__c`;
    hint.classList.remove("err");
    $("fieldName").classList.remove("invalid");
  }

  const t = state.fieldType;
  if (t === "Picklist" || t === "MultiselectPicklist") {
    if (getPicklistValues().length === 0) ok = false;
  }
  if (["Text", "LongTextArea"].includes(t)) {
    const len = parseInt($("optLength")?.value, 10);
    if (!len || len < 1) ok = false;
  }
  if (["Number", "Currency", "Percent"].includes(t)) {
    const digits = parseInt($("optDigits")?.value, 10);
    const decimals = parseInt($("optDecimals")?.value, 10);
    if (isNaN(digits) || isNaN(decimals) || digits < 1 || decimals < 0 || digits + decimals > 18) {
      ok = false;
      if (showErrors && digits + decimals > 18) {
        $("optDigits").classList.add("invalid");
        $("optDecimals").classList.add("invalid");
      }
    } else {
      $("optDigits")?.classList.remove("invalid");
      $("optDecimals")?.classList.remove("invalid");
    }
  }
  return ok;
}

function getPicklistValues() {
  const raw = $("optPicklistValues")?.value || "";
  const seen = new Set();
  const values = [];
  for (const line of raw.split("\n")) {
    const v = line.trim();
    if (v && !seen.has(v.toLowerCase())) {
      seen.add(v.toLowerCase());
      values.push(v);
    }
  }
  return values;
}

// ---------------------------------------------------------------------------
// Step 3 — objects
// ---------------------------------------------------------------------------

function renderObjectList() {
  const list = $("objectList");
  list.innerHTML = "";
  for (const obj of OBJECTS) {
    const label = document.createElement("label");
    label.className = "object-option";
    label.innerHTML = `
      <input type="checkbox" value="${obj.api}">
      <span class="obj-icon" style="background:${obj.color}">${obj.letter}</span>
      <span class="o-name">${obj.label}</span>`;
    const input = label.querySelector("input");
    input.addEventListener("change", () => {
      label.classList.toggle("selected", input.checked);
      updateNextButton();
    });
    list.appendChild(label);
  }
}

function selectedObjects() {
  return [...document.querySelectorAll("#objectList input:checked")].map((i) => i.value);
}

// ---------------------------------------------------------------------------
// Step 4 — field-level security
// ---------------------------------------------------------------------------

async function loadProfiles() {
  if (state.profilesLoaded) return;
  const q = encodeURIComponent(
    "SELECT Id, Profile.Name FROM PermissionSet WHERE IsOwnedByProfile = true ORDER BY Profile.Name"
  );
  const body = await sfFetch(`/services/data/v${state.apiVersion}/query/?q=${q}`);
  state.profiles = (body.records || []).map((r) => ({ id: r.Id, name: r.Profile.Name }));
  state.profilesLoaded = true;
  for (const p of state.profiles) {
    if (!state.fls.has(p.id)) state.fls.set(p.id, { visible: false, readOnly: false });
  }
}

function renderFlsStep() {
  const required = $("fieldRequired").checked;
  $("flsRequiredNote").hidden = !required;
  $("flsTableWrap").hidden = required;
  $("flsDesc").hidden = required;
  if (required) return;

  const tbody = $("flsTableBody");
  tbody.innerHTML = "";
  for (const p of state.profiles) {
    const sel = state.fls.get(p.id);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(p.name)}</td>
      <td class="col-check"><input type="checkbox" class="fls-visible" data-id="${p.id}"></td>
      <td class="col-check"><input type="checkbox" class="fls-readonly" data-id="${p.id}"></td>`;
    const vis = tr.querySelector(".fls-visible");
    const ro = tr.querySelector(".fls-readonly");
    vis.checked = sel.visible;
    ro.checked = sel.readOnly;
    vis.addEventListener("change", () => {
      sel.visible = vis.checked;
      if (!vis.checked) { sel.readOnly = false; ro.checked = false; }
      syncFlsHeaderChecks();
    });
    ro.addEventListener("change", () => {
      sel.readOnly = ro.checked;
      if (ro.checked) { sel.visible = true; vis.checked = true; }
      syncFlsHeaderChecks();
    });
    tbody.appendChild(tr);
  }
  syncFlsHeaderChecks();
}

function syncFlsHeaderChecks() {
  const all = [...state.fls.values()];
  $("flsAllVisible").checked = all.length > 0 && all.every((s) => s.visible);
  $("flsAllReadOnly").checked = all.length > 0 && all.every((s) => s.readOnly);
}

function bindFlsToolbar() {
  $("flsAllVisible").addEventListener("change", (e) => {
    const on = e.target.checked;
    for (const sel of state.fls.values()) {
      sel.visible = on;
      if (!on) sel.readOnly = false;
    }
    renderFlsStep();
  });
  $("flsAllReadOnly").addEventListener("change", (e) => {
    const on = e.target.checked;
    for (const sel of state.fls.values()) {
      sel.readOnly = on;
      if (on) sel.visible = true;
    }
    renderFlsStep();
  });
}

// ---------------------------------------------------------------------------
// Step 5 — review, create, results
// ---------------------------------------------------------------------------

function buildFieldMetadata() {
  const t = state.fieldType;
  const md = {
    label: $("fieldLabel").value.trim(),
    type: t,
    description: $("fieldDescription").value.trim() || undefined,
    inlineHelpText: $("fieldHelpText").value.trim() || undefined,
  };
  if (!NO_REQUIRED_TYPES.has(t) && $("fieldRequired").checked) md.required = true;

  if (t === "Text") {
    md.length = parseInt($("optLength").value, 10);
  } else if (t === "LongTextArea") {
    md.length = parseInt($("optLength").value, 10);
    md.visibleLines = parseInt($("optVisibleLines").value, 10);
  } else if (t === "Picklist" || t === "MultiselectPicklist") {
    const values = getPicklistValues();
    const firstDefault = $("optFirstDefault").checked;
    md.valueSet = {
      valueSetDefinition: {
        sorted: $("optSorted").checked,
        value: values.map((v, i) => ({
          fullName: v,
          label: v,
          default: firstDefault && i === 0,
        })),
      },
    };
    if (t === "MultiselectPicklist") md.visibleLines = parseInt($("optVisibleLines").value, 10);
  } else if (t === "Checkbox") {
    md.defaultValue = document.querySelector('input[name="optCheckboxDefault"]:checked').value === "true";
  } else if (t === "Number" || t === "Currency" || t === "Percent") {
    const digits = parseInt($("optDigits").value, 10);
    const decimals = parseInt($("optDecimals").value, 10);
    md.precision = digits + decimals;
    md.scale = decimals;
  }
  // Remove undefined keys
  Object.keys(md).forEach((k) => md[k] === undefined && delete md[k]);
  return md;
}

function renderReview() {
  const t = FIELD_TYPES.find((f) => f.type === state.fieldType);
  const name = $("fieldName").value.trim();
  const objs = selectedObjects();
  const required = $("fieldRequired").checked && !NO_REQUIRED_TYPES.has(state.fieldType);

  const flsSummary = required
    ? "Visible to all profiles (field is required)"
    : summarizeFls();

  const rows = [
    ["Field Label", escapeHtml($("fieldLabel").value.trim())],
    ["API Name", `<code class="api-name">${escapeHtml(name)}__c</code>`],
    ["Type", escapeHtml(t.name) + detailSummary()],
    ["Objects", objs.map((o) => `<span class="pill">${o}</span>`).join("")],
    ["Required", required ? "Yes" : "No"],
    ["Field-Level Security", flsSummary],
  ];
  const desc = $("fieldDescription").value.trim();
  if (desc) rows.splice(3, 0, ["Description", escapeHtml(desc)]);

  $("reviewCard").innerHTML = rows
    .map(([k, v]) => `<dl class="review-row"><dt>${k}</dt><dd>${v}</dd></dl>`)
    .join("");
}

function detailSummary() {
  const t = state.fieldType;
  if (t === "Text") return ` (length ${$("optLength").value})`;
  if (t === "LongTextArea") return ` (length ${$("optLength").value})`;
  if (t === "Picklist" || t === "MultiselectPicklist") {
    const v = getPicklistValues();
    return ` &mdash; ${v.length} value${v.length === 1 ? "" : "s"}: ${escapeHtml(v.slice(0, 6).join(", "))}${v.length > 6 ? "…" : ""}`;
  }
  if (["Number", "Currency", "Percent"].includes(t)) {
    return ` (${$("optDigits").value}, ${$("optDecimals").value})`;
  }
  return "";
}

function summarizeFls() {
  let visible = 0, readOnly = 0;
  for (const sel of state.fls.values()) {
    if (sel.visible) visible++;
    if (sel.readOnly) readOnly++;
  }
  if (visible === 0) return "Hidden from all profiles (set manually later)";
  return `Visible to ${visible} profile${visible === 1 ? "" : "s"}` +
    (readOnly ? ` (${readOnly} read-only)` : "");
}

async function runCreate() {
  state.createStarted = true;
  $("reviewPane").hidden = true;
  $("resultsPane").hidden = false;
  $("btnBack").hidden = true;
  const btn = $("btnNext");
  btn.disabled = true;
  btn.textContent = "Creating…";

  const name = $("fieldName").value.trim() + "__c";
  const metadata = buildFieldMetadata();
  const objs = selectedObjects();
  const list = $("resultsList");
  list.innerHTML = "";

  const items = new Map();
  for (const obj of objs) {
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="r-status pending">&#8943;</span>
      <span class="r-body"><span class="r-obj">${obj}.${escapeHtml(name)}</span>
      <div class="r-msg">Waiting…</div></span>`;
    list.appendChild(li);
    items.set(obj, li);
  }

  state.createResults = [];
  for (const obj of objs) {
    const li = items.get(obj);
    li.querySelector(".r-msg").textContent = "Creating field…";
    try {
      const res = await sfFetch(
        `/services/data/v${state.apiVersion}/tooling/sobjects/CustomField/`,
        {
          method: "POST",
          body: JSON.stringify({ FullName: `${obj}.${name}`, Metadata: metadata }),
        }
      );
      state.createResults.push({ object: obj, ok: true, id: res.id });
      li.querySelector(".r-status").textContent = "✓";
      li.querySelector(".r-status").className = "r-status ok";
      const setupUrl = `https://${state.lightningHost}/lightning/setup/ObjectManager/${obj}/FieldsAndRelationships/${res.id.slice(0, 15)}/view`;
      li.querySelector(".r-msg").innerHTML =
        `Created &middot; <a class="r-link" href="${setupUrl}" target="_blank" rel="noopener">View in Setup</a>`;
    } catch (e) {
      state.createResults.push({ object: obj, ok: false, error: e.message });
      li.querySelector(".r-status").textContent = "✕";
      li.querySelector(".r-status").className = "r-status fail";
      const msg = li.querySelector(".r-msg");
      msg.textContent = e.message;
      msg.classList.add("err");
    }
  }

  const created = state.createResults.filter((r) => r.ok);
  const failed = state.createResults.length - created.length;

  // Field-level security
  const required = $("fieldRequired").checked && !NO_REQUIRED_TYPES.has(state.fieldType);
  const flsTargets = [...state.fls.entries()].filter(([, s]) => s.visible);
  let flsNote = "FLS skipped";
  if (created.length && !required && flsTargets.length) {
    const fls = await applyFls(created, name, flsTargets);
    flsNote = fls.failed
      ? `FLS: ${fls.applied} applied, ${fls.failed} failed`
      : `FLS: ${fls.applied} applied`;
  } else if (required) {
    flsNote = "FLS: visible to all (required field)";
  }

  await saveJob({
    ts: Date.now(),
    org: state.apiHost,
    label: $("fieldLabel").value.trim(),
    apiName: name,
    type: state.fieldType,
    objects: state.createResults.map((r) => ({ name: r.object, ok: r.ok, error: r.error || null })),
    flsNote,
  });

  $("resultsTitle").textContent =
    failed === 0
      ? `Done — field created on ${created.length} object${created.length === 1 ? "" : "s"}`
      : `Finished with errors — ${created.length} created, ${failed} failed`;
  btn.disabled = false;
  btn.textContent = "Close";
}

async function applyFls(created, fieldName, flsTargets) {
  const box = $("flsResult");
  box.hidden = false;
  box.className = "fls-result";
  box.textContent = "Applying field-level security…";

  const profileNames = new Map(state.profiles.map((p) => [p.id, p.name]));
  const records = [];
  const meta = []; // parallel to records: which profile/object each row targets
  for (const { object } of created) {
    for (const [profileId, sel] of flsTargets) {
      records.push({
        attributes: { type: "FieldPermissions" },
        ParentId: profileId,
        SobjectType: object,
        Field: `${object}.${fieldName}`,
        PermissionsRead: true,
        PermissionsEdit: !sel.readOnly,
      });
      meta.push({ profile: profileNames.get(profileId) || profileId, object });
    }
  }

  let okCount = 0;
  const failures = []; // [{ profile, object, message }]
  try {
    for (let i = 0; i < records.length; i += 200) {
      const chunk = records.slice(i, i + 200);
      const res = await sfFetch(
        `/services/data/v${state.apiVersion}/composite/sobjects/`,
        {
          method: "POST",
          body: JSON.stringify({ allOrNone: false, records: chunk }),
        }
      );
      res.forEach((r, j) => {
        if (r.success) {
          okCount++;
        } else {
          const message = (r.errors || []).map((e) => e.message).join("; ") || "Unknown error";
          failures.push({ ...meta[i + j], message });
        }
      });
    }
  } catch (e) {
    for (let i = okCount + failures.length; i < records.length; i++) {
      failures.push({ ...meta[i], message: e.message });
    }
  }

  const failCount = records.length - okCount;
  if (failCount === 0) {
    box.classList.add("ok");
    box.textContent = `Field-level security applied: ${okCount} profile assignment${okCount === 1 ? "" : "s"} across ${created.length} object${created.length === 1 ? "" : "s"}.`;
  } else {
    box.classList.add("fail");
    // Group failures by error message so 12 identical errors read as one line
    const byMessage = new Map();
    for (const f of failures) {
      if (!byMessage.has(f.message)) byMessage.set(f.message, []);
      byMessage.get(f.message).push(f);
    }
    let html = `<strong>Field-level security: ${okCount} applied, ${failCount} failed.</strong>`;
    for (const [message, rows] of byMessage) {
      const who = rows.slice(0, 4).map((r) => `${escapeHtml(r.profile)} (${r.object})`).join(", ");
      const more = rows.length > 4 ? ` and ${rows.length - 4} more` : "";
      html += `<div class="fls-fail-line">&bull; ${who}${more}: ${escapeHtml(message)}</div>`;
    }
    html += `<div class="fls-fail-note">Profiles whose user license has no access to an object (e.g. Chatter or platform profiles) can't be granted field permissions — those failures are safe to ignore.</div>`;
    box.innerHTML = html;
  }
  return { applied: okCount, failed: failCount, failures };
}

// ---------------------------------------------------------------------------
// Job history (last 10, chrome.storage.local)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "fieldMirrorJobs";
const HISTORY_MAX = 10;

async function saveJob(job) {
  try {
    const data = await chrome.storage.local.get(HISTORY_KEY);
    const jobs = Array.isArray(data[HISTORY_KEY]) ? data[HISTORY_KEY] : [];
    jobs.unshift(job);
    await chrome.storage.local.set({ [HISTORY_KEY]: jobs.slice(0, HISTORY_MAX) });
  } catch {
    /* history is best-effort */
  }
}

async function renderHistory() {
  const list = $("historyList");
  const data = await chrome.storage.local.get(HISTORY_KEY);
  const jobs = Array.isArray(data[HISTORY_KEY]) ? data[HISTORY_KEY] : [];
  if (!jobs.length) {
    list.innerHTML = `<div class="empty-state"><p>No jobs yet. Fields you create will show up here.</p></div>`;
    return;
  }
  list.innerHTML = jobs
    .map((j) => {
      const when = new Date(j.ts).toLocaleString(undefined, {
        month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
      });
      const typeName = (FIELD_TYPES.find((t) => t.type === j.type) || {}).name || j.type;
      const objects = j.objects
        .map((o) =>
          `<span class="pill ${o.ok ? "pill-ok" : "pill-fail"}" title="${o.ok ? "Created" : escapeHtml(o.error || "Failed")}">${o.name}</span>`
        )
        .join("");
      return `
        <div class="job-card">
          <div class="job-top">
            <span class="job-field"><code class="api-name">${escapeHtml(j.apiName)}</code> <span class="job-type">${escapeHtml(typeName)}</span></span>
            <span class="job-when">${when}</span>
          </div>
          <div class="job-objects">${objects}</div>
          <div class="job-meta">${escapeHtml(j.org)} &middot; ${escapeHtml(j.flsNote)}</div>
        </div>`;
    })
    .join("");
}

let historyReturnScreen = null;

function showHistory() {
  historyReturnScreen = [...document.querySelectorAll(".screen")].find((s) => !s.hidden);
  document.querySelectorAll(".screen").forEach((s) => (s.hidden = true));
  $("screen-history").hidden = false;
  renderHistory();
}

function hideHistory() {
  $("screen-history").hidden = true;
  if (historyReturnScreen) historyReturnScreen.hidden = false;
}

// ---------------------------------------------------------------------------
// Wizard navigation
// ---------------------------------------------------------------------------

const STEP_COUNT = 5;

function goToStep(n) {
  state.step = n;
  document.querySelectorAll(".step").forEach((el) => {
    el.hidden = Number(el.dataset.step) !== n;
  });
  document.querySelectorAll(".progress-step").forEach((el) => {
    const s = Number(el.dataset.step);
    el.classList.toggle("active", s === n);
    el.classList.toggle("done", s < n);
  });
  $("btnBack").hidden = n === 0 || state.createStarted;
  $("btnNext").textContent = n === STEP_COUNT - 1 ? "Create Fields" : "Next";
  updateNextButton();
  $("screen-wizard").querySelector(".wizard-body").scrollTop = 0;
}

function updateNextButton() {
  const btn = $("btnNext");
  if (state.createStarted) return;
  let ok = true;
  if (state.step === 0) ok = !!state.fieldType;
  else if (state.step === 1) ok = validateDetails(false);
  else if (state.step === 2) ok = selectedObjects().length > 0;
  btn.disabled = !ok;
}

async function next() {
  if (state.createStarted) {
    window.close();
    return;
  }
  if (state.step === 0) {
    renderTypeOptions();
    goToStep(1);
    $("fieldLabel").focus();
  } else if (state.step === 1) {
    if (!validateDetails(true)) return;
    goToStep(2);
  } else if (state.step === 2) {
    goToStep(3);
    if (!$("fieldRequired").checked || NO_REQUIRED_TYPES.has(state.fieldType)) {
      try {
        $("flsTableBody").innerHTML =
          `<tr><td colspan="3" style="text-align:center;color:var(--text-weaker);padding:16px">Loading profiles…</td></tr>`;
        await loadProfiles();
      } catch (e) {
        $("flsTableBody").innerHTML =
          `<tr><td colspan="3" style="color:var(--error);padding:12px">Couldn't load profiles: ${escapeHtml(e.message)}</td></tr>`;
        return;
      }
    }
    renderFlsStep();
  } else if (state.step === 3) {
    renderReview();
    goToStep(4);
  } else if (state.step === 4) {
    await runCreate();
  }
}

function back() {
  if (state.step > 0 && !state.createStarted) goToStep(state.step - 1);
}

// ---------------------------------------------------------------------------
// Utilities & init
// ---------------------------------------------------------------------------

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

function bindDetailsEvents() {
  $("fieldLabel").addEventListener("input", () => {
    if (!state.nameEdited) $("fieldName").value = labelToApiName($("fieldLabel").value);
    validateDetails(false);
    updateNextButton();
  });
  $("fieldName").addEventListener("input", () => {
    state.nameEdited = $("fieldName").value.length > 0;
    validateDetails(true);
    updateNextButton();
  });
  // Delegate for dynamically-rendered type options
  $("typeOptions").addEventListener("input", updateNextButton);
}

async function init() {
  renderTypeList();
  renderObjectList();
  bindDetailsEvents();
  bindFlsToolbar();
  $("btnNext").addEventListener("click", next);
  $("btnBack").addEventListener("click", back);
  $("btnHistory").addEventListener("click", () => {
    $("screen-history").hidden ? showHistory() : hideHistory();
  });
  $("btnHistoryBack").addEventListener("click", hideHistory);

  const ok = await connect();
  if (!ok) return;
  $("screen-loading").hidden = true;
  if ($("screen-history").hidden) {
    $("screen-wizard").hidden = false;
  } else {
    historyReturnScreen = $("screen-wizard");
  }
  goToStep(0);
}

init();
