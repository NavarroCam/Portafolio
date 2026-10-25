// ---------- Configuración ----------
const STORAGE_KEY = "job-applications";
const THEME_KEY = "application-theme";
const NO_REPLY_DAYS = 14; // días sin respuesta para sugerir un seguimiento
const DAY = 86400000;

const STATUSES = [
  { value: "Enviado", key: "sent" },
  { value: "En proceso", key: "process" },
  { value: "Rechazado", key: "reject" },
  { value: "Oferta", key: "offer" },
];
const STATUS_VALUES = STATUSES.map((s) => s.value);

// ---------- Utilidades de fecha ----------
function toDateString(date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date - offset).toISOString().slice(0, 10);
}

function todayString() {
  return toDateString(new Date());
}

function shiftDays(days) {
  return toDateString(new Date(Date.now() + days * DAY));
}

function parseDate(dateString) {
  return new Date(dateString + "T12:00:00");
}

// Días enteros entre hoy y la fecha (positivo = ya pasó).
function daysSince(dateString) {
  if (!dateString) return 0;
  return Math.round((parseDate(todayString()) - parseDate(dateString)) / DAY);
}

function formatDate(dateString) {
  if (!dateString) return "Sin fecha";
  const date = parseDate(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function formatShort(dateString) {
  const date = parseDate(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" }).format(date).replace(".", "");
}

function ago(dateString) {
  const days = daysSince(dateString);
  if (days <= 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 7) return `hace ${days} días`;
  const weeks = Math.floor(days / 7);
  if (days < 60) return `hace ${weeks} ${weeks === 1 ? "semana" : "semanas"}`;
  const months = Math.floor(days / 30);
  return `hace ${months} meses`;
}

// ---------- Ejemplos (fechas relativas a hoy para que la demo siempre tenga sentido) ----------
function sampleApplications() {
  let n = 0;
  const base = Date.now();
  const entry = (daysAgo, type, text, status) => ({
    id: base + 100 + ++n,
    date: shiftDays(-daysAgo),
    type,
    text,
    ...(status ? { status } : {}),
  });

  return [
    {
      id: base + 1,
      demo: true,
      company: "Northwind Studio",
      role: "Frontend Developer Jr.",
      date: shiftDays(-12),
      status: "En proceso",
      link: "",
      cv: "CV-Frontend.pdf",
      reminder: shiftDays(2),
      history: [
        entry(4, "note", "Entrevista técnica el viernes a las 10. Repasar el portfolio y el proyecto de la app de cine."),
        entry(5, "status", "Pasó a En proceso", "En proceso"),
        entry(12, "note", "Apliqué por LinkedIn."),
      ],
    },
    {
      id: base + 2,
      demo: true,
      company: "Andes Labs",
      role: "Pasante de desarrollo",
      date: shiftDays(-26),
      status: "Oferta",
      link: "",
      cv: "",
      reminder: shiftDays(0),
      history: [
        entry(1, "note", "Llegó la propuesta por mail. Responder hoy."),
        entry(1, "status", "Pasó a Oferta", "Oferta"),
        entry(15, "status", "Pasó a En proceso", "En proceso"),
      ],
    },
    {
      id: base + 3,
      demo: true,
      company: "BluePeak",
      role: "Analista funcional trainee",
      date: shiftDays(-20),
      status: "Enviado",
      link: "",
      cv: "",
      reminder: shiftDays(-3),
      history: [entry(20, "note", "CV enviado desde la web de la empresa.")],
    },
    {
      id: base + 4,
      demo: true,
      company: "Lumen Data",
      role: "Soporte IT",
      date: shiftDays(-17),
      status: "Enviado",
      link: "",
      cv: "",
      reminder: "",
      history: [],
    },
    {
      id: base + 5,
      demo: true,
      company: "Verde Systems",
      role: "QA Analyst",
      date: shiftDays(-34),
      status: "Rechazado",
      link: "",
      cv: "",
      reminder: "",
      history: [
        entry(22, "note", "Pedí feedback: buscaban más experiencia en testing automatizado."),
        entry(24, "status", "Pasó a Rechazado", "Rechazado"),
      ],
    },
  ];
}

// ---------- Estado ----------
let applications = loadApplications();
let searchTerm = "";
let statusFilter = "all";
let sortOrder = "recent";
let editingId = null;
let noteOpenId = null;
const expanded = new Set();
let lastDeleted = null;

// ---------- Elementos ----------
const $ = (selector) => document.querySelector(selector);
const form = $("#applicationForm");
const list = $("#applicationsList");
const statusTiles = $("#statusTiles");
const pipelineBar = $("#pipelineBar");
const responseRate = $("#responseRate");
const todoPanel = $("#todoPanel");
const todoList = $("#todoList");
const countText = $("#countText");
const searchInput = $("#searchInput");
const sortSelect = $("#sortSelect");
const filterNote = $("#filterNote");
const filterText = $("#filterText");
const emptyState = $("#emptyState");
const emptyAction = $("#emptyAction");
const sampleAction = $("#sampleAction");
const demoNote = $("#demoNote");
const demoMenu = $('[data-menu="demo"]');
const themeToggle = $("#themeToggle");
const importInput = $("#importInput");
const toast = $("#toast");
const toastText = $("#toastText");
const toastAction = $("#toastAction");

// ---------- Datos ----------
function newId() {
  return Date.now() + Math.floor(Math.random() * 1000);
}

function normalize(item) {
  // Acepta datos de versiones anteriores: "notes" pasa a ser la primera nota del historial.
  const history = Array.isArray(item.history)
    ? item.history
        .filter((h) => h && h.text)
        .map((h) => ({
          id: Number(h.id) || newId(),
          date: String(h.date || item.date || todayString()),
          type: h.type === "status" ? "status" : "note",
          text: String(h.text),
          ...(STATUS_VALUES.includes(h.status) ? { status: h.status } : {}),
        }))
    : [];

  if (!history.length && item.notes) {
    history.push({ id: newId(), date: String(item.date || todayString()), type: "note", text: String(item.notes) });
  }

  return {
    id: Number(item.id) || newId(),
    company: String(item.company || "").trim(),
    role: String(item.role || "").trim(),
    date: String(item.date || ""),
    status: STATUS_VALUES.includes(item.status) ? item.status : "Enviado",
    link: String(item.link || ""),
    cv: String(item.cv || item.attachment || ""),
    demo: Boolean(item.demo),
    reminder: String(item.reminder || ""),
    history,
  };
}

function loadApplications() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return []; // la app empieza en blanco
    const saved = JSON.parse(raw);
    if (Array.isArray(saved)) return saved.map(normalize);
  } catch (error) {
    console.warn("No se pudieron leer las postulaciones guardadas.", error);
  }
  return [];
}

function saveApplications() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(applications));
  } catch (error) {
    console.warn("No se pudieron guardar las postulaciones.", error);
    showToast("No se pudo guardar. Revisá el espacio del navegador.");
  }
}

function findApplication(id) {
  return applications.find((app) => app.id === Number(id));
}

function sortedHistory(item) {
  return [...item.history].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
}

// ---------- Utilidades ----------
function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safeUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

function statusKey(value) {
  return STATUSES.find((s) => s.value === value)?.key || "sent";
}

function plural(count, one, many) {
  return `${count} ${count === 1 ? one : many}`;
}

let toastTimer;
function showToast(message, action) {
  toastText.textContent = message;
  toastAction.hidden = !action;
  toastAction.onclick = null;
  if (action) {
    toastAction.textContent = action.label;
    toastAction.onclick = () => {
      action.run();
      hideToast();
    };
  }
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, action ? 6000 : 2600);
}

function hideToast() {
  toast.classList.remove("visible");
}

const ICONS = {
  calendar:
    '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
  bell:
    '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15Z"/><path d="M10 20.5a2 2 0 0 0 4 0"/></svg>',
  link:
    '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
  file:
    '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5"/></svg>',
};

// ---------- Resumen ----------
function renderSummary() {
  const counts = Object.fromEntries(STATUS_VALUES.map((v) => [v, 0]));
  applications.forEach((item) => counts[item.status]++);
  const total = applications.length;

  statusTiles.innerHTML = STATUSES.map(
    (s) => `
      <button class="tile" type="button" data-filter="${s.value}" data-status="${s.key}"
        aria-pressed="${statusFilter === s.value}">
        <span class="tile-label">${s.value}</span>
        <span class="tile-count">${counts[s.value]}</span>
      </button>`
  ).join("");

  pipelineBar.innerHTML = STATUSES.filter((s) => counts[s.value] > 0)
    .map((s) => `<span class="pipeline-segment" data-status="${s.key}" style="flex-grow:${counts[s.value]}"></span>`)
    .join("");

  const answered = total - counts["Enviado"];
  responseRate.innerHTML = total
    ? `Respondieron <strong>${answered} de ${total}</strong> (${Math.round((answered / total) * 100)}%)`
    : "Sin postulaciones todavía";
}

// ---------- Para hacer ----------
function daysText(n) {
  return n === 1 ? "1 día" : `${n} días`;
}

function getTodos() {
  const todos = [];
  const today = todayString();

  applications.forEach((item) => {
    if (item.status === "Rechazado") return;

    if (item.reminder) {
      const diff = daysSince(item.reminder); // >0 vencido, 0 hoy, <0 futuro
      if (diff >= -7) {
        todos.push({
          id: item.id,
          company: item.company,
          role: item.role,
          when:
            diff > 0
              ? `Vencido hace ${daysText(diff)}`
              : diff === 0
              ? "Te toca hoy"
              : diff === -1
              ? "Mañana"
              : `En ${daysText(-diff)}`,
          urgency: diff > 0 ? "late" : diff === 0 ? "today" : "soon",
          order: -diff,
        });
      }
      return;
    }

    const waiting = daysSince(item.date);
    if (item.status === "Enviado" && waiting >= NO_REPLY_DAYS && item.date <= today) {
      todos.push({
        id: item.id,
        company: item.company,
        role: item.role,
        when: `Sin respuesta hace ${daysText(waiting)}`,
        urgency: "idle",
        order: 1,
      });
    }
  });

  const rank = { late: 0, today: 1, idle: 2, soon: 3 };
  return todos.sort((a, b) => rank[a.urgency] - rank[b.urgency] || a.order - b.order);
}

function renderTodos() {
  const todos = getTodos();
  // El panel aparece si hay postulaciones; si no hay seguimientos, explica cómo agendarlos.
  todoPanel.hidden = applications.length === 0;
  $("#todoEmpty").hidden = todos.length > 0;
  todoList.innerHTML = todos
    .map(
      (t) => `
      <li class="todo-item" data-urgency="${t.urgency}">
        <button class="todo-main" type="button" data-goto="${t.id}" aria-label="Ir a ${escapeHtml(t.company)}">
          <span class="todo-company">${escapeHtml(t.company)}</span>
          <span class="todo-role">${escapeHtml(t.role)}</span>
          <span class="todo-when">${t.when}</span>
        </button>
        <button class="todo-done" type="button" data-done="${t.id}" aria-label="Marcar como hecho el seguimiento a ${escapeHtml(t.company)}">Listo</button>
      </li>`
    )
    .join("");
}

// ---------- Lista ----------
function getVisibleApplications() {
  const filtered = applications.filter((item) => {
    const text = `${item.company} ${item.role}`.toLowerCase();
    return (!searchTerm || text.includes(searchTerm)) && (statusFilter === "all" || item.status === statusFilter);
  });

  const byDate = (a, b) => (b.date || "").localeCompare(a.date || "") || b.id - a.id;
  const sorters = {
    recent: byDate,
    oldest: (a, b) => -byDate(a, b),
    company: (a, b) => a.company.localeCompare(b.company, "es", { sensitivity: "base" }),
    followup: (a, b) => (a.reminder || "9999").localeCompare(b.reminder || "9999") || byDate(a, b),
  };
  return filtered.sort(sorters[sortOrder] || byDate);
}

function renderTimeline(item) {
  const history = sortedHistory(item);
  if (!history.length) return "";

  const isOpen = expanded.has(item.id);
  const shown = isOpen ? history : history.slice(0, 1);

  const rows = shown
    .map(
      (h) => `
      <li class="timeline-item" ${h.type === "status" ? `data-status="${statusKey(h.status)}"` : ""}>
        <span class="timeline-date">${formatShort(h.date)}</span>
        <span class="timeline-text">${escapeHtml(h.text)}</span>
      </li>`
    )
    .join("");

  const toggle =
    history.length > 1
      ? `<button class="btn-text timeline-toggle" type="button" data-action="toggle-history" data-id="${item.id}"
           aria-expanded="${isOpen}">${isOpen ? "Ver menos" : `Ver historial (${history.length})`}</button>`
      : "";

  return `<ol class="timeline" aria-label="Historial">${rows}</ol>${toggle}`;
}

function renderCard(item) {
  const key = statusKey(item.status);
  if (item.id === editingId) return renderEditCard(item, key);

  const url = safeUrl(item.link);
  const reminderDiff = item.reminder ? daysSince(item.reminder) : null;
  const isDue = reminderDiff !== null && reminderDiff >= 0 && item.status !== "Rechazado";

  const meta = [
    `<li>${ICONS.calendar}<span>Aplicaste <span class="age">${ago(item.date)}</span> (${formatShort(item.date)})</span></li>`,
  ];
  if (item.reminder) {
    meta.push(
      `<li class="${isDue ? "is-due" : ""}">${ICONS.bell}<span>${
        !isDue
          ? `Seguimiento el ${formatShort(item.reminder)}`
          : reminderDiff === 0
          ? "Seguimiento hoy"
          : `Seguimiento pendiente desde el ${formatShort(item.reminder)}`
      }</span></li>`
    );
  }
  if (url) {
    meta.push(`<li>${ICONS.link}<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Ver vacante</a></li>`);
  }
  if (item.cv) meta.push(`<li>${ICONS.file}<span>${escapeHtml(item.cv)}</span></li>`);

  const noteForm =
    noteOpenId === item.id
      ? `<form class="note-form" data-id="${item.id}">
           <label class="visually-hidden" for="note-${item.id}">Nueva nota para ${escapeHtml(item.company)}</label>
           <textarea id="note-${item.id}" name="note" rows="1" placeholder="Ej: Me escribió RR. HH. para coordinar."></textarea>
           <button class="btn btn-primary" type="submit">Guardar</button>
         </form>`
      : "";

  return `
    <article class="app" id="app-${item.id}" data-status="${key}" data-id="${item.id}">
      <div class="app-head">
        <div class="app-title">
          <h3 class="app-company">${escapeHtml(item.company)}</h3>
          <p class="app-role">${escapeHtml(item.role)}</p>
        </div>
        <select class="status-select" data-id="${item.id}" aria-label="Estado de la postulación a ${escapeHtml(item.company)}">
          ${STATUS_VALUES.map((v) => `<option value="${v}" ${v === item.status ? "selected" : ""}>${v}</option>`).join("")}
        </select>
      </div>
      <ul class="app-meta">${meta.join("")}</ul>
      ${renderTimeline(item)}
      ${noteForm}
      <div class="app-actions">
        <button class="btn-text" type="button" data-action="note" data-id="${item.id}" aria-expanded="${noteOpenId === item.id}">
          ${noteOpenId === item.id ? "Cancelar nota" : "+ Agregar nota"}
        </button>
        <button class="btn-text" type="button" data-action="edit" data-id="${item.id}">Editar</button>
        <button class="btn-text danger" type="button" data-action="delete" data-id="${item.id}">Eliminar</button>
      </div>
    </article>`;
}

function renderEditCard(item, key) {
  const id = item.id;
  return `
    <article class="app" id="app-${id}" data-status="${key}" data-id="${id}">
      <form class="app-edit" data-id="${id}" novalidate>
        <h3 class="edit-heading">Editar postulación</h3>
        <div class="field">
          <label for="edit-company-${id}">Empresa</label>
          <input id="edit-company-${id}" name="company" type="text" value="${escapeHtml(item.company)}" required />
        </div>
        <div class="field">
          <label for="edit-role-${id}">Rol</label>
          <input id="edit-role-${id}" name="role" type="text" value="${escapeHtml(item.role)}" required />
        </div>
        <div class="field-row">
          <div class="field">
            <label for="edit-date-${id}">Fecha</label>
            <input id="edit-date-${id}" name="date" type="date" value="${escapeHtml(item.date)}" required />
          </div>
          <div class="field">
            <label for="edit-reminder-${id}">Seguimiento</label>
            <input id="edit-reminder-${id}" name="reminder" type="date" value="${escapeHtml(item.reminder)}" />
          </div>
        </div>
        <div class="field">
          <label for="edit-link-${id}">Link de la vacante <span class="optional">(opcional)</span></label>
          <input id="edit-link-${id}" name="link" type="url" inputmode="url"
            placeholder="https://www.linkedin.com/jobs/view/…" value="${escapeHtml(item.link)}" />
        </div>
        <div class="field">
          <label for="edit-cv-${id}">CV enviado <span class="optional">(se guarda solo el nombre)</span></label>
          ${
            item.cv
              ? `<div class="cv-current"><span>${escapeHtml(item.cv)}</span>
                   <button class="btn-text danger" type="button" data-action="remove-cv" data-id="${id}">Quitar</button>
                 </div>`
              : ""
          }
          <input id="edit-cv-${id}" name="cv" type="file" accept=".pdf,.doc,.docx" />
        </div>
        <div class="edit-actions">
          <button class="btn btn-primary" type="submit">Guardar cambios</button>
          <button class="btn btn-quiet" type="button" data-action="cancel-edit">Cancelar</button>
        </div>
      </form>
    </article>`;
}

function renderList() {
  const visible = getVisibleApplications();
  list.innerHTML = visible.map(renderCard).join("");

  const total = applications.length;
  countText.textContent =
    visible.length === total ? plural(total, "postulación", "postulaciones") : `${visible.length} de ${total}`;

  // Aviso de filtro activo, con el color del estado
  if (statusFilter !== "all") {
    filterNote.hidden = false;
    filterNote.dataset.status = statusKey(statusFilter);
    filterText.textContent = `Mostrando: ${statusFilter}`;
  } else {
    filterNote.hidden = true;
    delete filterNote.dataset.status;
  }

  // Aviso de postulaciones ficticias
  const demoCount = applications.filter((a) => a.demo).length;
  demoNote.hidden = demoCount === 0;
  $("#demoText").textContent = `Estás probando con ${plural(demoCount, "postulación ficticia", "postulaciones ficticias")}.`;
  demoMenu.textContent = demoCount ? "Quitar postulaciones ficticias" : "Probar con postulaciones ficticias";

  if (total === 0) {
    showEmpty(
      "Todavía no cargaste postulaciones",
      "Agregá la primera con el formulario, o probá la app con postulaciones ficticias.",
      "Agregar la primera",
      "focus-form",
      true
    );
  } else if (visible.length === 0) {
    showEmpty("Ninguna postulación coincide", "Probá con otra búsqueda o mostrá todas las postulaciones.", "Ver todas", "clear-filters", false);
  } else {
    emptyState.hidden = true;
  }
}

function showEmpty(title, text, actionLabel, action, withSamples) {
  $("#emptyTitle").textContent = title;
  $("#emptyText").textContent = text;
  emptyAction.textContent = actionLabel;
  emptyAction.dataset.action = action;
  sampleAction.hidden = !withSamples;
  emptyState.hidden = false;
}

function render() {
  renderSummary();
  renderTodos();
  renderList();
}

function clearFilters() {
  statusFilter = "all";
  searchTerm = "";
  searchInput.value = "";
  render();
}

function goTo(id) {
  if (statusFilter !== "all" || searchTerm) clearFilters();
  const card = document.querySelector(`#app-${id}`);
  if (!card) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  card.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  card.classList.remove("is-flash");
  void card.offsetWidth;
  card.classList.add("is-flash");
}

// ---------- Formulario principal ----------
function setFieldError(input, errorEl, hasError) {
  input.setAttribute("aria-invalid", hasError ? "true" : "false");
  if (errorEl) errorEl.hidden = !hasError;
  if (hasError) input.setAttribute("aria-describedby", errorEl.id);
  else input.removeAttribute("aria-describedby");
}

function resetForm() {
  form.reset();
  form.elements.date.value = todayString();
  form.elements.status.value = "Enviado";
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const f = form.elements;
  const company = f.company.value.trim();
  const role = f.role.value.trim();
  const date = f.date.value;

  setFieldError(f.company, $("#companyError"), !company);
  setFieldError(f.role, $("#roleError"), !role);
  setFieldError(f.date, $("#dateError"), !date);

  if (!company || !role || !date) {
    form.querySelector('[aria-invalid="true"]')?.focus();
    return;
  }

  const status = STATUS_VALUES.includes(f.status.value) ? f.status.value : "Enviado";
  const note = f.notes.value.trim();
  const history = note ? [{ id: newId(), date, type: "note", text: note }] : [];

  applications.push({ id: newId(), company, role, date, status, link: "", cv: "", reminder: "", history });

  saveApplications();
  resetForm();
  render();
  if (status === "Oferta") celebrateOffer(applications[applications.length - 1]);
  else showToast(`Postulación a ${company} agregada`);
});

form.addEventListener("input", (event) => {
  const input = event.target;
  if (input.getAttribute("aria-invalid") === "true" && input.value.trim()) {
    setFieldError(input, $(`#${input.id}Error`), false);
  }
});

// ---------- Lista: acciones ----------
list.addEventListener("change", (event) => {
  const select = event.target.closest(".status-select");
  if (!select) return;

  const item = findApplication(select.dataset.id);
  if (!item || item.status === select.value) return;

  item.status = select.value;
  item.history.push({ id: newId(), date: todayString(), type: "status", text: `Pasó a ${item.status}`, status: item.status });
  saveApplications();
  render();
  if (item.status === "Oferta") celebrateOffer(item);
  else showToast(`${item.company}: ${item.status}`);
});

list.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const action = button.dataset.action;
  const item = findApplication(button.dataset.id);

  if (action === "note" && item) {
    noteOpenId = noteOpenId === item.id ? null : item.id;
    renderList();
    if (noteOpenId) $(`#note-${item.id}`)?.focus();
  }

  if (action === "toggle-history" && item) {
    expanded.has(item.id) ? expanded.delete(item.id) : expanded.add(item.id);
    renderList();
    document.querySelector(`#app-${item.id} [data-action="toggle-history"]`)?.focus();
  }

  if (action === "edit" && item) {
    editingId = item.id;
    noteOpenId = null;
    renderList();
    $(`#edit-company-${item.id}`)?.focus();
  }

  if (action === "cancel-edit") {
    const id = editingId;
    editingId = null;
    renderList();
    document.querySelector(`#app-${id} [data-action="edit"]`)?.focus();
  }

  if (action === "remove-cv" && item) {
    button.closest(".cv-current").remove();
    list.querySelector(`.app-edit[data-id="${item.id}"]`).dataset.removeCv = "true";
  }

  if (action === "delete" && item) {
    const index = applications.indexOf(item);
    applications.splice(index, 1);
    lastDeleted = { item, index };
    saveApplications();
    render();
    showToast(`Postulación a ${item.company} eliminada`, {
      label: "Deshacer",
      run: () => {
        if (!lastDeleted) return;
        applications.splice(lastDeleted.index, 0, lastDeleted.item);
        lastDeleted = null;
        saveApplications();
        render();
      },
    });
  }
});

// Enter guarda la nota; Shift+Enter hace salto de línea.
list.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey && event.target.matches(".note-form textarea")) {
    event.preventDefault();
    event.target.form.requestSubmit();
  }
  if (event.key === "Escape" && event.target.matches(".note-form textarea")) {
    const id = noteOpenId;
    noteOpenId = null;
    renderList();
    document.querySelector(`#app-${id} [data-action="note"]`)?.focus();
  }
});

list.addEventListener("submit", (event) => {
  event.preventDefault();

  // Nota rápida
  const noteForm = event.target.closest(".note-form");
  if (noteForm) {
    const item = findApplication(noteForm.dataset.id);
    const text = noteForm.elements.note.value.trim();
    if (!item || !text) {
      noteForm.elements.note.focus();
      return;
    }
    item.history.push({ id: newId(), date: todayString(), type: "note", text });
    noteOpenId = null;
    saveApplications();
    render();
    document.querySelector(`#app-${item.id} [data-action="note"]`)?.focus();
    showToast("Nota guardada");
    return;
  }

  // Edición completa
  const editForm = event.target.closest(".app-edit");
  if (!editForm) return;
  const item = findApplication(editForm.dataset.id);
  if (!item) return;

  const f = editForm.elements;
  const company = f.company.value.trim();
  const role = f.role.value.trim();
  const date = f.date.value;

  [f.company, f.role, f.date].forEach((input) => input.setAttribute("aria-invalid", input.value.trim() ? "false" : "true"));
  if (!company || !role || !date) {
    editForm.querySelector('[aria-invalid="true"]')?.focus();
    return;
  }

  const file = f.cv.files[0];
  Object.assign(item, { company, role, date, reminder: f.reminder.value, link: f.link.value.trim() });
  if (file) item.cv = file.name;
  else if (editForm.dataset.removeCv === "true") item.cv = "";

  editingId = null;
  saveApplications();
  render();
  document.querySelector(`#app-${item.id} [data-action="edit"]`)?.focus();
  showToast("Cambios guardados");
});

// ---------- Resumen, filtros, orden y búsqueda ----------
statusTiles.addEventListener("click", (event) => {
  const tile = event.target.closest("[data-filter]");
  if (!tile) return;
  statusFilter = statusFilter === tile.dataset.filter ? "all" : tile.dataset.filter;
  render();
});

$("#clearFilter").addEventListener("click", clearFilters);

todoList.addEventListener("click", (event) => {
  const done = event.target.closest("[data-done]");
  if (done) {
    markFollowUpDone(done.dataset.done);
    return;
  }
  const item = event.target.closest("[data-goto]");
  if (item) goTo(item.dataset.goto);
});

// Marca el seguimiento como hecho: queda en el historial y, si todavía no respondieron,
// se agenda otro recordatorio en 7 días para no perderle el rastro.
function markFollowUpDone(id) {
  const item = findApplication(id);
  if (!item) return;
  const previous = item.reminder;
  item.history.push({ id: newId(), date: todayString(), type: "note", text: "Hice el seguimiento." });
  item.reminder = item.status === "Enviado" ? shiftDays(7) : "";
  saveApplications();
  render();
  showToast(
    item.reminder ? `Listo. Te lo recuerdo de nuevo en 7 días.` : `Seguimiento a ${item.company} hecho`,
    {
      label: "Deshacer",
      run: () => {
        item.history.pop();
        item.reminder = previous;
        saveApplications();
        render();
      },
    }
  );
}

sortSelect.addEventListener("change", () => {
  sortOrder = sortSelect.value;
  renderList();
});

searchInput.addEventListener("input", (event) => {
  searchTerm = event.target.value.trim().toLowerCase();
  renderList();
});

emptyAction.addEventListener("click", () => {
  if (emptyAction.dataset.action === "clear-filters") clearFilters();
  else form.elements.company.focus();
});

function addDemo() {
  const alreadyThere = applications.some((a) => a.demo);
  if (alreadyThere) return;
  applications = [...applications, ...sampleApplications()];
  clearFilters();
  saveApplications();
  render();
  showToast("Se agregaron 5 postulaciones ficticias");
}

function removeDemo() {
  const removed = applications.filter((a) => a.demo);
  if (!removed.length) return;
  applications = applications.filter((a) => !a.demo);
  saveApplications();
  render();
  showToast(`Se quitaron ${plural(removed.length, "postulación ficticia", "postulaciones ficticias")}`, {
    label: "Deshacer",
    run: () => {
      applications = [...applications, ...removed];
      saveApplications();
      render();
    },
  });
}

sampleAction.addEventListener("click", addDemo);
$("#removeDemo").addEventListener("click", removeDemo);

// ---------- Exportar e importar ----------
function download(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function exportCsv() {
  // Separador ";" para que Excel en español lo abra en columnas.
  const header = ["Empresa", "Rol", "Fecha", "Estado", "Seguimiento", "Link", "CV", "Notas"];
  const rows = applications.map((a) => [
    a.company,
    a.role,
    a.date,
    a.status,
    a.reminder,
    a.link,
    a.cv,
    sortedHistory(a)
      .filter((h) => h.type === "note")
      .map((h) => `${h.date}: ${h.text}`)
      .join(" | "),
  ]);
  const csv = "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n");
  download(`postulaciones-${todayString()}.csv`, csv, "text/csv;charset=utf-8");
}

document.querySelector(".menu-list").addEventListener("click", (event) => {
  const option = event.target.closest("[data-menu]");
  if (!option) return;
  option.closest("details").open = false;

  if (option.dataset.menu === "export-json") {
    download(`postulaciones-${todayString()}.json`, JSON.stringify(applications, null, 2), "application/json");
    showToast("Copia descargada");
  }
  if (option.dataset.menu === "export-csv") {
    exportCsv();
    showToast("Archivo para Excel descargado");
  }
  if (option.dataset.menu === "import") importInput.click();
  if (option.dataset.menu === "demo") {
    applications.some((a) => a.demo) ? removeDemo() : addDemo();
  }
});

importInput.addEventListener("change", async () => {
  const file = importInput.files[0];
  importInput.value = "";
  if (!file) return;

  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data)) throw new Error("formato");
    const imported = data.map(normalize).filter((a) => a.company && a.role);
    if (!imported.length) throw new Error("vacío");

    const ok = window.confirm(
      `Vas a reemplazar tus ${plural(applications.length, "postulación", "postulaciones")} por las ${imported.length} del archivo. ¿Continuar?`
    );
    if (!ok) return;

    applications = imported;
    clearFilters();
    saveApplications();
    showToast(`Se importaron ${plural(imported.length, "postulación", "postulaciones")}`);
  } catch {
    showToast("El archivo no es una copia válida del rastreador.");
  }
});

// Cerrar el menú al tocar afuera
document.addEventListener("click", (event) => {
  const menu = document.querySelector(".menu");
  if (menu.open && !menu.contains(event.target)) menu.open = false;
});

// ---------- Tema ----------
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeToggle.setAttribute("aria-label", theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro");
}

themeToggle.addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(next);
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    /* sin almacenamiento: el tema dura hasta recargar */
  }
});

// ---------- Sincronización entre pestañas ----------
window.addEventListener("storage", (event) => {
  if (event.key !== STORAGE_KEY) return;
  try {
    const next = JSON.parse(event.newValue || "[]");
    if (Array.isArray(next)) {
      applications = next.map(normalize);
      editingId = null;
      noteOpenId = null;
      render();
    }
  } catch (error) {
    console.warn("No se pudo sincronizar con otra pestaña.", error);
  }
});

// ---------- Encabezado: "Mis postulaciones - Nombre" (solo el nombre es editable) ----------
const OWNER_KEY = "application-owner";
const titleView = $("#titleView");
const titleForm = $("#titleForm");
const titleInput = $("#titleInput");
const titleError = $("#titleError");

function readStorage(key) {
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function writeStorage(key, value) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    /* sin almacenamiento: dura hasta recargar */
  }
}

let owner = readStorage(OWNER_KEY);
writeStorage("application-title", ""); // limpia el título libre de la versión anterior

function cleanName(value) {
  return value.trim().replace(/\s+/g, " ");
}

function applyOwner() {
  $("#ownerName").textContent = owner;
  document.title = `Mis postulaciones - ${owner}`;
}

function setTitleError(show) {
  titleError.hidden = !show;
  titleInput.setAttribute("aria-invalid", show ? "true" : "false");
  if (show) titleInput.setAttribute("aria-describedby", "titleError");
  else titleInput.removeAttribute("aria-describedby");
}

function closeTitleEditor() {
  setTitleError(false);
  titleForm.hidden = true;
  titleView.hidden = false;
  $("#editTitle").focus();
}

$("#editTitle").addEventListener("click", () => {
  titleInput.value = owner;
  titleView.hidden = true;
  titleForm.hidden = false;
  titleInput.focus();
  titleInput.select();
});

titleForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = cleanName(titleInput.value);
  if (!name) {
    setTitleError(true);
    titleInput.focus();
    return;
  }
  owner = name;
  writeStorage(OWNER_KEY, owner);
  applyOwner();
  closeTitleEditor();
  showToast("Nombre actualizado");
});

titleInput.addEventListener("input", () => {
  if (titleInput.value.trim()) setTitleError(false);
});

$("#cancelTitle").addEventListener("click", closeTitleEditor);
titleInput.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    closeTitleEditor();
  }
});

// ---------- Festejo de oferta ----------
const offerDialog = $("#offerDialog");
let offerItemId = null;

function celebrateOffer(item) {
  offerItemId = item.id;
  hideToast();
  $("#offerTitle").textContent = owner ? `¡Felicitaciones, ${owner}!` : "¡Felicitaciones!";
  $("#offerText").innerHTML = `<strong>${escapeHtml(item.company)}</strong> te ofreció el puesto de <strong>${escapeHtml(item.role)}</strong>`;
  if (typeof offerDialog.showModal === "function") offerDialog.showModal();
  else showToast(`¡Felicitaciones! Oferta de ${item.company}`);
  launchConfetti();
}

$("#offerClose").addEventListener("click", () => offerDialog.close());
$("#offerNote").addEventListener("click", () => {
  offerDialog.close();
  if (statusFilter !== "all" || searchTerm) clearFilters();
  noteOpenId = offerItemId;
  renderList();
  goTo(offerItemId);
  $(`#note-${offerItemId}`)?.focus({ preventScroll: true });
});
offerDialog.addEventListener("click", (event) => {
  if (event.target === offerDialog) offerDialog.close(); // clic fuera de la tarjeta
});

// Confeti con canvas, sin librerías externas.
const confettiCanvas = $("#confetti");
let confettiFrame = null;

function launchConfetti() {
  // Con "reducir animaciones" activado (por ejemplo, Windows con los efectos de animación apagados)
  // se muestra una versión suave: menos papelitos, que caen despacio y sin girar.
  const gentle = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const ctx = confettiCanvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const width = window.innerWidth;
  const height = window.innerHeight;
  confettiCanvas.width = width * dpr;
  confettiCanvas.height = height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const styles = getComputedStyle(document.documentElement);
  const colors = ["--offer", "--sent", "--process", "--accent", "--reject"].map((v) => styles.getPropertyValue(v).trim());

  const count = gentle ? Math.min(60, Math.round(width / 16)) : Math.min(180, Math.round(width / 5));
  const pieces = Array.from({ length: count }, (_, i) => {
    if (gentle) {
      return {
        x: Math.random() * width,
        y: -20 - Math.random() * height * 0.5,
        vx: 0,
        vy: 1.6 + Math.random() * 1.4,
        w: 6 + Math.random() * 5,
        h: 8 + Math.random() * 6,
        rot: Math.random() * Math.PI,
        spin: 0,
        tilt: 0,
        gentle: true,
        color: colors[i % colors.length],
      };
    }
    const fromLeft = i % 2 === 0;
    const angle = (fromLeft ? -60 : -120) + (Math.random() * 40 - 20);
    const speed = 9 + Math.random() * 9;
    return {
      x: fromLeft ? -10 : width + 10,
      y: height * 0.75,
      vx: Math.cos((angle * Math.PI) / 180) * speed,
      vy: Math.sin((angle * Math.PI) / 180) * speed * 1.4,
      w: 6 + Math.random() * 6,
      h: 8 + Math.random() * 8,
      rot: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.3,
      tilt: Math.random() * Math.PI,
      color: colors[i % colors.length],
    };
  });

  cancelAnimationFrame(confettiFrame);
  confettiCanvas.classList.add("active");
  const start = performance.now();
  const duration = 3200;

  function frame(now) {
    const elapsed = now - start;
    ctx.clearRect(0, 0, width, height);
    ctx.globalAlpha = elapsed > duration - 700 ? Math.max(0, (duration - elapsed) / 700) : 1;

    pieces.forEach((p) => {
      if (p.gentle) {
        p.y += p.vy; // caída lenta y constante
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
        return;
      }
      p.vy += 0.32; // gravedad
      p.vx *= 0.985; // resistencia del aire
      p.vy *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.spin;
      p.tilt += 0.12;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(1, Math.cos(p.tilt)); // efecto de giro del papel
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });

    if (elapsed < duration) {
      confettiFrame = requestAnimationFrame(frame);
    } else {
      ctx.clearRect(0, 0, width, height);
      confettiCanvas.classList.remove("active");
    }
  }

  confettiFrame = requestAnimationFrame(frame);
}

// ---------- Bienvenida: pide el nombre antes de empezar ----------
const welcomeForm = $("#welcomeForm");
const ownerInput = $("#ownerInput");

function showApp() {
  document.documentElement.dataset.welcome = "false";
  $("#welcome").hidden = true;
  applyOwner();
}

welcomeForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = cleanName(ownerInput.value);
  const error = $("#ownerError");
  ownerInput.setAttribute("aria-invalid", name ? "false" : "true");
  error.hidden = Boolean(name);
  if (!name) {
    ownerInput.focus();
    return;
  }
  owner = name;
  writeStorage(OWNER_KEY, owner);
  showApp();
  form.elements.company.focus();
  showToast(`¡Hola, ${owner}! Agregá tu primera postulación.`);
});

ownerInput.addEventListener("input", () => {
  if (ownerInput.value.trim()) {
    ownerInput.setAttribute("aria-invalid", "false");
    $("#ownerError").hidden = true;
  }
});

// ---------- Inicio ----------
applyTheme(document.documentElement.dataset.theme || "light");
if (owner) {
  showApp();
} else {
  document.documentElement.dataset.welcome = "true";
  $("#welcome").hidden = false;
  ownerInput.focus();
}
resetForm();
render();
