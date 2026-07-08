(function () {
  const params = new URLSearchParams(window.location.search);
  const enabled = params.has("annotate") || localStorage.getItem("hccAnnotatorEnabled") === "1";
  if (!enabled) return;

  const STORAGE_KEY = "hccAnnotationNotes";
  const SKIP = "hcc-annotator-skip";
  const state = {
    armed: true,
    selected: null,
    notes: loadNotes(),
    hover: null,
  };

  function loadNotes() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveNotes() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.notes));
    renderList();
  }

  function cssPath(el) {
    if (!el || el === document.body) return "body";
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && node !== document.body && parts.length < 6) {
      let part = node.tagName.toLowerCase();
      if (node.id) {
        part += "#" + CSS.escape(node.id);
        parts.unshift(part);
        break;
      }
      const cls = Array.from(node.classList || []).filter(Boolean).slice(0, 2);
      if (cls.length) part += "." + cls.map((x) => CSS.escape(x)).join(".");
      const parent = node.parentElement;
      if (parent) {
        const same = Array.from(parent.children).filter((x) => x.tagName === node.tagName);
        if (same.length > 1) part += `:nth-of-type(${same.indexOf(node) + 1})`;
      }
      parts.unshift(part);
      node = parent;
    }
    return parts.join(" > ");
  }

  function elementLabel(el) {
    const text = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
    const aria = el.getAttribute("aria-label");
    const id = el.id ? `#${el.id}` : "";
    return (aria || text || el.getAttribute("placeholder") || el.getAttribute("title") || `${el.tagName.toLowerCase()}${id}`).slice(0, 90);
  }

  function screenLabel(el) {
    const labeled = el.closest("[data-screen-label]");
    if (labeled) return labeled.getAttribute("data-screen-label");
    const visibleHeadings = Array.from(document.querySelectorAll("h1,h2,h3,[style*='font-size:24px'],[style*='font-size:21px']"))
      .filter((node) => {
        const r = node.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
      })
      .map((node) => (node.innerText || node.textContent || "").replace(/\s+/g, " ").trim())
      .filter(Boolean);
    return visibleHeadings[0] || document.title || "Current screen";
  }

  function snapshot(el, event) {
    const rect = el.getBoundingClientRect();
    const styles = getComputedStyle(el);
    return {
      id: `ann-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
      url: location.href,
      path: location.pathname,
      hash: location.hash,
      screen: screenLabel(el),
      selector: cssPath(el),
      label: elementLabel(el),
      tag: el.tagName.toLowerCase(),
      text: (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 300),
      rect: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
      click: {
        x: Math.round(event.clientX),
        y: Math.round(event.clientY),
      },
      style: {
        color: styles.color,
        background: styles.backgroundColor,
        fontSize: styles.fontSize,
        fontWeight: styles.fontWeight,
        borderRadius: styles.borderRadius,
      },
      priority: "medium",
      type: "design",
      status: "open",
      note: "",
    };
  }

  function make(tag, attrs, children) {
    const el = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([key, value]) => {
      if (key === "className") el.className = value;
      else if (key === "text") el.textContent = value;
      else if (key.startsWith("on")) el.addEventListener(key.slice(2).toLowerCase(), value);
      else el.setAttribute(key, value);
    });
    (children || []).forEach((child) => el.appendChild(typeof child === "string" ? document.createTextNode(child) : child));
    return el;
  }

  function installStyles() {
    const style = document.createElement("style");
    style.textContent = `
      .hcc-ann-shell{position:fixed;inset:auto 14px 14px auto;z-index:2147483600;width:min(360px,calc(100vw - 28px));max-height:calc(100dvh - 28px);display:flex;flex-direction:column;background:#fff;color:#23262f;border:1px solid #dedcea;border-radius:14px;box-shadow:0 18px 60px rgba(35,38,47,.24);font:13px/1.35 Figtree,system-ui,sans-serif;overflow:hidden}
      .hcc-ann-head{display:flex;align-items:center;gap:8px;padding:11px 12px;border-bottom:1px solid #eceaf3;background:#faf9fe}
      .hcc-ann-title{font-weight:850;flex:1}
      .hcc-ann-btn{appearance:none;border:0;border-radius:999px;background:#eeeafc;color:#5b44d6;font-weight:800;font:inherit;padding:8px 11px;cursor:pointer}
      .hcc-ann-btn.primary{background:#6a57c9;color:#fff}
      .hcc-ann-btn.danger{background:#fde9e6;color:#b3502e}
      .hcc-ann-body{padding:12px;display:flex;flex-direction:column;gap:10px;overflow:auto}
      .hcc-ann-muted{color:#6f7486;font-size:12px}
      .hcc-ann-field{display:flex;flex-direction:column;gap:5px}
      .hcc-ann-field label{font-size:11px;font-weight:850;color:#6f7486;text-transform:uppercase;letter-spacing:.04em}
      .hcc-ann-field textarea,.hcc-ann-field select,.hcc-ann-field input{width:100%;border:1px solid #dedcea;border-radius:10px;background:#fff;font:inherit;padding:9px;color:#23262f}
      .hcc-ann-field textarea{min-height:84px;resize:vertical}
      .hcc-ann-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      .hcc-ann-target{border:1px solid #eeeafc;border-radius:10px;padding:9px;background:#faf9fe}
      .hcc-ann-list{display:flex;flex-direction:column;gap:8px}
      .hcc-ann-item{border:1px solid #eceaf3;border-radius:10px;padding:9px;background:#fff}
      .hcc-ann-item-title{font-weight:800;margin-bottom:3px}
      .hcc-ann-actions{display:flex;gap:7px;flex-wrap:wrap}
      .hcc-ann-highlight{position:fixed;z-index:2147483598;pointer-events:none;border:2px solid #6a57c9;border-radius:10px;box-shadow:0 0 0 9999px rgba(35,38,47,.16);transition:all .08s ease}
      .hcc-ann-pin{position:fixed;z-index:2147483599;width:24px;height:24px;border-radius:50%;background:#6a57c9;color:#fff;display:flex;align-items:center;justify-content:center;font:800 12px/1 Figtree,system-ui,sans-serif;box-shadow:0 6px 18px rgba(106,87,201,.35);pointer-events:none}
      body.hcc-ann-armed *{cursor:crosshair !important}
    `;
    document.head.appendChild(style);
  }

  function createPanel() {
    const panel = make("aside", { className: `hcc-ann-shell ${SKIP}` });
    panel.innerHTML = `
      <div class="hcc-ann-head">
        <div class="hcc-ann-title">Review notes</div>
        <button class="hcc-ann-btn" data-act="toggle">Annotate on</button>
        <button class="hcc-ann-btn primary" data-act="export">Export</button>
      </div>
      <div class="hcc-ann-body">
        <div class="hcc-ann-muted">Click any real app element, write the change, then export the notes for fixes.</div>
        <div class="hcc-ann-target" data-target>Click an element to select it.</div>
        <div class="hcc-ann-row">
          <div class="hcc-ann-field"><label>Type</label><select data-type><option>design</option><option>bug</option><option>copy</option><option>flow</option><option>question</option></select></div>
          <div class="hcc-ann-field"><label>Priority</label><select data-priority><option>medium</option><option>high</option><option>low</option></select></div>
        </div>
        <div class="hcc-ann-field"><label>What should change?</label><textarea data-note placeholder="Example: make this button smaller and align it with the card edge."></textarea></div>
        <div class="hcc-ann-actions">
          <button class="hcc-ann-btn primary" data-act="save">Save note</button>
          <button class="hcc-ann-btn primary" data-act="issue">Submit issue</button>
          <button class="hcc-ann-btn" data-act="copy">Copy JSON</button>
          <button class="hcc-ann-btn" data-act="markdown">Download MD</button>
          <button class="hcc-ann-btn danger" data-act="clear">Clear all</button>
        </div>
        <div class="hcc-ann-list" data-list></div>
      </div>
    `;
    document.body.appendChild(panel);
    panel.addEventListener("click", onPanelClick);
    panel.querySelector("[data-type]").addEventListener("change", (e) => state.selected && (state.selected.type = e.target.value));
    panel.querySelector("[data-priority]").addEventListener("change", (e) => state.selected && (state.selected.priority = e.target.value));
    panel.querySelector("[data-note]").addEventListener("input", (e) => state.selected && (state.selected.note = e.target.value));
    renderList();
    renderSelected();
  }

  function onPanelClick(event) {
    const act = event.target.closest("[data-act]")?.getAttribute("data-act");
    if (!act) return;
    if (act === "toggle") {
      state.armed = !state.armed;
      document.body.classList.toggle("hcc-ann-armed", state.armed);
      event.target.textContent = state.armed ? "Annotate on" : "Annotate off";
    }
    if (act === "save") saveSelected();
    if (act === "export") download("health-tracker-annotations.json", JSON.stringify(state.notes, null, 2));
    if (act === "copy") navigator.clipboard?.writeText(JSON.stringify(state.notes, null, 2));
    if (act === "markdown") download("health-tracker-annotations.md", exportMarkdown());
    if (act === "issue") submitIssue();
    if (act === "clear" && confirm("Clear all saved review notes?")) {
      state.notes = [];
      saveNotes();
      drawPins();
    }
  }

  function renderSelected() {
    const panel = document.querySelector(".hcc-ann-shell");
    if (!panel) return;
    const target = panel.querySelector("[data-target]");
    const type = panel.querySelector("[data-type]");
    const priority = panel.querySelector("[data-priority]");
    const note = panel.querySelector("[data-note]");
    if (!state.selected) {
      target.textContent = "Click an element to select it.";
      note.value = "";
      return;
    }
    target.innerHTML = `<strong>${escapeHtml(state.selected.label)}</strong><br><span class="hcc-ann-muted">${escapeHtml(state.selected.screen)} · ${escapeHtml(state.selected.selector)}</span>`;
    type.value = state.selected.type;
    priority.value = state.selected.priority;
    note.value = state.selected.note;
  }

  function renderList() {
    const list = document.querySelector("[data-list]");
    if (!list) return;
    if (!state.notes.length) {
      list.innerHTML = `<div class="hcc-ann-muted">No saved notes yet.</div>`;
      return;
    }
    list.innerHTML = state.notes.map((n, i) => `
      <div class="hcc-ann-item">
        <div class="hcc-ann-item-title">${i + 1}. ${escapeHtml(n.label)}</div>
        <div class="hcc-ann-muted">${escapeHtml(n.screen)} · ${escapeHtml(n.type)} · ${escapeHtml(n.priority)}</div>
        <div>${escapeHtml(n.note || "(no note)")}</div>
      </div>
    `).join("");
  }

  function saveSelected() {
    if (!state.selected) {
      alert("Click an app element first.");
      return;
    }
    if (!state.selected.note.trim()) {
      alert("Add the requested change first.");
      return;
    }
    state.notes.push({ ...state.selected });
    state.selected = null;
    saveNotes();
    renderSelected();
    drawPins();
  }

  function updateHighlight(el) {
    let box = document.querySelector(".hcc-ann-highlight");
    if (!box) {
      box = make("div", { className: `hcc-ann-highlight ${SKIP}` });
      document.body.appendChild(box);
    }
    const r = el.getBoundingClientRect();
    box.style.left = `${r.left}px`;
    box.style.top = `${r.top}px`;
    box.style.width = `${r.width}px`;
    box.style.height = `${r.height}px`;
  }

  function drawPins() {
    document.querySelectorAll(".hcc-ann-pin").forEach((x) => x.remove());
    state.notes.forEach((note, i) => {
      const pin = make("div", { className: `hcc-ann-pin ${SKIP}`, text: String(i + 1) });
      pin.style.left = `${note.click.x - 12}px`;
      pin.style.top = `${note.click.y - 12}px`;
      document.body.appendChild(pin);
    });
  }

  function exportMarkdown() {
    return state.notes.map((n, i) => [
      `## ${i + 1}. ${n.label}`,
      `- Screen: ${n.screen}`,
      `- Type: ${n.type}`,
      `- Priority: ${n.priority}`,
      `- Selector: \`${n.selector}\``,
      `- Rect: ${n.rect.x}, ${n.rect.y}, ${n.rect.width}x${n.rect.height}`,
      "",
      n.note,
      "",
    ].join("\n")).join("\n");
  }

  function submitIssue() {
    if (!state.notes.length) {
      alert("Save at least one note before submitting.");
      return;
    }
    const body = [
      "Review notes exported from Health Tracker annotation mode.",
      "",
      exportMarkdown(),
      "",
      "<details><summary>Raw annotation JSON</summary>",
      "",
      "```json",
      JSON.stringify(state.notes, null, 2),
      "```",
      "",
      "</details>",
    ].join("\n");
    const url = new URL("https://github.com/dreamxlogic/Health-Tracker/issues/new");
    url.searchParams.set("title", `UI review notes - ${new Date().toISOString().slice(0, 10)}`);
    url.searchParams.set("body", body);
    window.open(url.toString(), "_blank", "noopener,noreferrer");
  }

  function download(name, content) {
    const jsonName = name.endsWith(".json");
    const blob = new Blob([content], { type: jsonName ? "application/json" : "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 500);
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  }

  function eventTarget(event) {
    const path = event.composedPath ? event.composedPath() : [];
    return path.find((el) => el && el.nodeType === 1 && !el.classList?.contains(SKIP) && !el.closest?.("." + SKIP));
  }

  function init() {
    installStyles();
    createPanel();
    document.body.classList.add("hcc-ann-armed");
    document.addEventListener("mousemove", (event) => {
      if (!state.armed) return;
      const target = eventTarget(event);
      if (!target || target === state.hover) return;
      state.hover = target;
      updateHighlight(target);
    }, true);
    document.addEventListener("click", (event) => {
      if (!state.armed) return;
      const target = eventTarget(event);
      if (!target) return;
      event.preventDefault();
      event.stopPropagation();
      state.selected = snapshot(target, event);
      renderSelected();
      updateHighlight(target);
    }, true);
    window.addEventListener("scroll", drawPins, true);
    window.addEventListener("resize", drawPins);
    drawPins();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
