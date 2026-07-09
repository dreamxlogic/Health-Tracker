(function () {
  const params = new URLSearchParams(window.location.search);
  const enabled = params.has("annotate") || localStorage.getItem("hccAnnotatorEnabled") === "1";
  if (!enabled) return;

  const STORAGE_KEY = "hccAnnotationNotes";
  const SKIP = "hcc-annotator-skip";
  const state = {
    armed: true,
    collapsed: false,
    position: loadPosition(),
    drag: null,
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

  function loadPosition() {
    try {
      const raw = localStorage.getItem("hccAnnotatorPosition");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveNotes() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.notes));
    } catch (err) {
      setStatus("Could not save locally.");
    }
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
      body.hcc-ann-review-layout{--hcc-ann-panel-open:min(40vw,520px);--hcc-ann-panel-closed:168px}
      .hcc-ann-shell{position:fixed;inset:max(14px,env(safe-area-inset-top,0px)) 14px auto auto;z-index:2147483600;width:min(380px,calc(100vw - 28px));max-height:calc(100dvh - 28px - env(safe-area-inset-top,0px));display:flex;flex-direction:column;background:#fff;color:#23262f;border:1px solid #dedcea;border-radius:14px;box-shadow:0 18px 60px rgba(35,38,47,.24);font:13px/1.35 Figtree,system-ui,sans-serif;overflow:hidden;touch-action:none}
      .hcc-ann-shell.is-collapsed{width:auto;max-width:calc(100vw - 28px)}
      .hcc-ann-shell.is-collapsed .hcc-ann-body{display:none}
      .hcc-ann-head{display:flex;align-items:center;gap:8px;padding:11px 12px;border-bottom:1px solid #eceaf3;background:#faf9fe;cursor:grab;user-select:none}
      .hcc-ann-shell.is-dragging .hcc-ann-head{cursor:grabbing}
      .hcc-ann-shell.is-collapsed .hcc-ann-head{border-bottom:0}
      .hcc-ann-title{font-weight:850;flex:1}
      .hcc-ann-btn{appearance:none;border:0;border-radius:999px;background:#eeeafc;color:#5b44d6;font-weight:800;font:inherit;padding:8px 11px;cursor:pointer}
      .hcc-ann-btn.primary{background:#6a57c9;color:#fff}
      .hcc-ann-btn.danger{background:#fde9e6;color:#b3502e}
      .hcc-ann-btn.is-off{background:#f3f3f7;color:#565b6e}
      .hcc-ann-body{padding:12px;display:flex;flex-direction:column;gap:10px;overflow:auto;min-height:0}
      .hcc-ann-muted{color:#6f7486;font-size:12px}
      .hcc-ann-status{min-height:17px;color:#2e8b5b;font-size:12px;font-weight:750}
      .hcc-ann-field{display:flex;flex-direction:column;gap:5px}
      .hcc-ann-field label{font-size:11px;font-weight:850;color:#6f7486;text-transform:uppercase;letter-spacing:.04em}
      .hcc-ann-field textarea,.hcc-ann-field select,.hcc-ann-field input{width:100%;border:1px solid #dedcea;border-radius:10px;background:#fff;font:inherit;padding:9px;color:#23262f}
      .hcc-ann-field textarea{min-height:84px;resize:vertical}
      .hcc-ann-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      .hcc-ann-target{border:1px solid #eeeafc;border-radius:10px;padding:9px;background:#faf9fe}
      .hcc-ann-list{display:flex;flex-direction:column;gap:8px;max-height:min(34dvh,260px);overflow:auto;padding-right:2px}
      .hcc-ann-item{border:1px solid #eceaf3;border-radius:10px;padding:9px;background:#fff}
      .hcc-ann-item-title{font-weight:800;margin-bottom:3px}
      .hcc-ann-actions{display:flex;gap:7px;flex-wrap:wrap}
      .hcc-ann-highlight{position:fixed;z-index:2147483598;pointer-events:none;border:2px solid #6a57c9;border-radius:10px;box-shadow:0 0 0 9999px rgba(35,38,47,.16);transition:all .08s ease}
      .hcc-ann-pin{position:fixed;z-index:2147483599;width:24px;height:24px;border-radius:50%;background:#6a57c9;color:#fff;display:flex;align-items:center;justify-content:center;font:800 12px/1 Figtree,system-ui,sans-serif;box-shadow:0 6px 18px rgba(106,87,201,.35);pointer-events:none}
      body.hcc-ann-armed *{cursor:crosshair !important}
      @media (min-width:760px){
        body.hcc-ann-review-layout{overflow:hidden !important;background:#f5f3fb !important}
        body.hcc-ann-review-layout .hcc-app-root{left:0 !important;top:0 !important;bottom:0 !important;right:var(--hcc-ann-panel-open) !important;width:auto !important;height:100dvh !important;min-height:100dvh !important;display:flex !important;align-items:center !important;justify-content:center !important;padding:18px !important;background:#f5f3fb !important}
        body.hcc-ann-review-layout.hcc-ann-panel-collapsed .hcc-app-root{right:var(--hcc-ann-panel-closed) !important}
        body.hcc-ann-review-layout #hcc-phone-sizer{width:min(430px,calc(100vw - var(--hcc-ann-panel-open) - 44px)) !important;height:min(932px,calc(100dvh - 36px)) !important;max-width:100% !important;max-height:100% !important;flex:none !important;border-radius:30px;overflow:hidden;box-shadow:0 24px 70px rgba(35,38,47,.18),0 0 0 1px rgba(255,255,255,.8)}
        body.hcc-ann-review-layout.hcc-ann-panel-collapsed #hcc-phone-sizer{width:min(430px,calc(100vw - var(--hcc-ann-panel-closed) - 44px)) !important}
        body.hcc-ann-review-layout #hcc-phone{width:100% !important;height:100% !important}
        body.hcc-ann-review-layout .hcc-ann-shell{left:auto !important;right:0 !important;top:0 !important;bottom:0 !important;width:var(--hcc-ann-panel-open) !important;max-width:40vw !important;height:100dvh !important;max-height:none !important;border-radius:0 !important;border-width:0 0 0 1px !important;box-shadow:-18px 0 50px rgba(35,38,47,.12) !important;touch-action:auto}
        body.hcc-ann-review-layout .hcc-ann-shell.is-collapsed{width:var(--hcc-ann-panel-closed) !important;max-width:var(--hcc-ann-panel-closed) !important}
        body.hcc-ann-review-layout .hcc-ann-head{cursor:default}
        body.hcc-ann-review-layout .hcc-ann-body{flex:1}
        body.hcc-ann-review-layout .hcc-ann-list{flex:1;max-height:none;min-height:120px}
      }
      @media (max-width:520px){
        .hcc-ann-shell{left:10px;right:10px;width:auto}
        .hcc-ann-head{gap:6px;padding:9px 10px}
        .hcc-ann-title{font-size:12px}
        .hcc-ann-btn{padding:7px 9px;font-size:12px}
      }
    `;
    document.head.appendChild(style);
  }

  function createPanel() {
    const panel = make("aside", { className: `hcc-ann-shell ${SKIP}` });
    panel.innerHTML = `
      <div class="hcc-ann-head">
        <div class="hcc-ann-title">Review notes</div>
        <button class="hcc-ann-btn" data-act="toggle">Annotate on</button>
        <button class="hcc-ann-btn" data-act="collapse">Collapse</button>
        <button class="hcc-ann-btn primary" data-act="export">Export</button>
      </div>
      <div class="hcc-ann-body">
        <div class="hcc-ann-muted">Turn annotation on to select elements. Turn it off to click around the app normally.</div>
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
        <div class="hcc-ann-status" data-status></div>
        <div class="hcc-ann-list" data-list></div>
      </div>
    `;
    document.body.appendChild(panel);
    panel.addEventListener("click", onPanelClick);
    panel.querySelector(".hcc-ann-head").addEventListener("pointerdown", onDragStart);
    panel.querySelector("[data-type]").addEventListener("change", (e) => state.selected && (state.selected.type = e.target.value));
    panel.querySelector("[data-priority]").addEventListener("change", (e) => state.selected && (state.selected.priority = e.target.value));
    panel.querySelector("[data-note]").addEventListener("input", (e) => state.selected && (state.selected.note = e.target.value));
    renderMode();
    applySavedPosition();
    renderList();
    renderSelected();
  }

  async function onPanelClick(event) {
    const act = event.target.closest("[data-act]")?.getAttribute("data-act");
    if (!act) return;
    event.preventDefault();
    event.stopPropagation();
    if (act === "toggle") {
      setArmed(!state.armed);
      setStatus(state.armed ? "Annotation mode is on. Tap an app element." : "Annotation mode is off. The app is clickable.");
    }
    if (act === "collapse") setCollapsed(!state.collapsed);
    if (act === "save") saveSelected();
    if (act === "export") download("health-tracker-annotations.json", JSON.stringify(state.notes, null, 2), "Exported JSON.");
    if (act === "copy") await copyText(JSON.stringify(state.notes, null, 2));
    if (act === "markdown") download("health-tracker-annotations.md", exportMarkdown(), "Downloaded markdown.");
    if (act === "issue") submitIssue();
    if (act === "clear" && confirm("Clear all saved review notes?")) {
      state.notes = [];
      state.selected = null;
      saveNotes();
      renderSelected();
      clearHighlight();
      drawPins();
      setStatus("Cleared all notes.");
    }
  }

  function setArmed(value) {
    state.armed = !!value;
    localStorage.setItem("hccAnnotatorArmed", state.armed ? "1" : "0");
    document.body.classList.toggle("hcc-ann-armed", state.armed);
    if (!state.armed) clearHighlight();
    renderMode();
  }

  function setCollapsed(value) {
    state.collapsed = !!value;
    localStorage.setItem("hccAnnotatorCollapsed", state.collapsed ? "1" : "0");
    renderMode();
  }

  function renderMode() {
    const panel = document.querySelector(".hcc-ann-shell");
    if (!panel) return;
    panel.classList.toggle("is-collapsed", state.collapsed);
    document.body.classList.toggle("hcc-ann-panel-collapsed", state.collapsed);
    const toggle = panel.querySelector("[data-act='toggle']");
    const collapse = panel.querySelector("[data-act='collapse']");
    if (toggle) {
      toggle.textContent = state.armed ? "Annotate on" : "Annotate off";
      toggle.classList.toggle("is-off", !state.armed);
      toggle.setAttribute("aria-pressed", state.armed ? "true" : "false");
    }
    if (collapse) collapse.textContent = state.collapsed ? "Show panel" : "Collapse";
  }

  function clampPosition(x, y, panel) {
    const pad = 10;
    const w = panel.offsetWidth || 320;
    const h = panel.offsetHeight || 80;
    return {
      x: Math.max(pad, Math.min(window.innerWidth - w - pad, x)),
      y: Math.max(pad, Math.min(window.innerHeight - h - pad, y)),
    };
  }

  function applyPosition(x, y) {
    const panel = document.querySelector(".hcc-ann-shell");
    if (!panel) return;
    const p = clampPosition(x, y, panel);
    panel.style.left = `${p.x}px`;
    panel.style.top = `${p.y}px`;
    panel.style.right = "auto";
    panel.style.bottom = "auto";
    state.position = p;
  }

  function applySavedPosition() {
    const panel = document.querySelector(".hcc-ann-shell");
    if (!panel || !state.position) return;
    if (isReviewLayout()) return;
    requestAnimationFrame(() => applyPosition(state.position.x, state.position.y));
  }

  function onDragStart(event) {
    if (isReviewLayout()) return;
    if (event.target.closest("button,select,input,textarea")) return;
    const panel = document.querySelector(".hcc-ann-shell");
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    state.drag = {
      dx: event.clientX - rect.left,
      dy: event.clientY - rect.top,
      pointerId: event.pointerId,
    };
    panel.classList.add("is-dragging");
    panel.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  function onDragMove(event) {
    if (isReviewLayout()) return;
    if (!state.drag) return;
    applyPosition(event.clientX - state.drag.dx, event.clientY - state.drag.dy);
  }

  function onDragEnd(event) {
    if (!state.drag) return;
    const panel = document.querySelector(".hcc-ann-shell");
    if (panel) {
      panel.classList.remove("is-dragging");
      panel.releasePointerCapture?.(state.drag.pointerId);
    }
    if (state.position) localStorage.setItem("hccAnnotatorPosition", JSON.stringify(state.position));
    state.drag = null;
  }

  function isReviewLayout() {
    return window.matchMedia && window.matchMedia("(min-width: 760px)").matches;
  }

  function setStatus(message) {
    const el = document.querySelector("[data-status]");
    if (!el) return;
    el.textContent = message || "";
    clearTimeout(setStatus._timer);
    if (message) setStatus._timer = setTimeout(() => { el.textContent = ""; }, 2600);
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
      setStatus("Click an app element first.");
      alert("Click an app element first.");
      return;
    }
    if (!state.selected.note.trim()) {
      setStatus("Add the requested change first.");
      alert("Add the requested change first.");
      return;
    }
    state.notes.push({ ...state.selected });
    state.selected = null;
    saveNotes();
    renderSelected();
    drawPins();
    setStatus("Saved note.");
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

  function clearHighlight() {
    const box = document.querySelector(".hcc-ann-highlight");
    if (box) box.remove();
    state.hover = null;
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
      setStatus("Save at least one note before submitting.");
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
    setStatus("Opening GitHub issue draft.");
    window.open(url.toString(), "_blank", "noopener,noreferrer");
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.cssText = "position:fixed;left:-9999px;top:0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }
      setStatus("Copied JSON.");
    } catch (err) {
      setStatus("Copy failed. Use Export instead.");
    }
  }

  function download(name, content, statusMessage) {
    const jsonName = name.endsWith(".json");
    const blob = new Blob([content], { type: jsonName ? "application/json" : "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.className = SKIP;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 500);
    setStatus(statusMessage || "Download started.");
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  }

  function eventTarget(event) {
    const path = event.composedPath ? event.composedPath() : [];
    if (path.some((el) => el && el.nodeType === 1 && (el.classList?.contains(SKIP) || el.closest?.("." + SKIP)))) return null;
    return path.find((el) => el && el.nodeType === 1 && el !== document && el !== window);
  }

  function init() {
    state.armed = localStorage.getItem("hccAnnotatorArmed") !== "0";
    state.collapsed = localStorage.getItem("hccAnnotatorCollapsed") === "1";
    document.body.classList.add("hcc-ann-review-layout");
    installStyles();
    createPanel();
    setArmed(state.armed);
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
      setStatus("Element selected. Add a note, then save.");
    }, true);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && state.armed) {
        setArmed(false);
        setStatus("Annotation mode is off. The app is clickable.");
      }
    }, true);
    window.addEventListener("scroll", drawPins, true);
    window.addEventListener("resize", () => {
      drawPins();
      if (state.position) applyPosition(state.position.x, state.position.y);
    });
    document.addEventListener("pointermove", onDragMove, true);
    document.addEventListener("pointerup", onDragEnd, true);
    document.addEventListener("pointercancel", onDragEnd, true);
    drawPins();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
