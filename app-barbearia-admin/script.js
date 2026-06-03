const API_URL = window.BARBEARIA_API_URL || localStorage.getItem("barbearia_api_url") || "http://localhost:3000/api/v1";
const state = {
  token: localStorage.getItem("barbearia_admin_token"),
  user: null,
  services: [],
  barbers: [],
  bookings: [],
  settings: null
};

const weekdayLabels = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const el = {
  loginView: document.querySelector("#loginView"),
  appView: document.querySelector("#appView"),
  loginForm: document.querySelector("#loginForm"),
  loginMessage: document.querySelector("#loginMessage"),
  sectionTitle: document.querySelector("#sectionTitle"),
  sectionEyebrow: document.querySelector("#sectionEyebrow"),
  statusDot: document.querySelector("#statusDot"),
  apiStatusText: document.querySelector("#apiStatusText")
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (state.token) headers.Authorization = `Bearer ${state.token}`;

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body?.error?.message || "Erro ao consultar API");
  }

  return body;
}

function setApiStatus(ok, text) {
  el.statusDot.classList.toggle("off", !ok);
  el.apiStatusText.textContent = text;
}

function showMessage(target, message, isError = false) {
  target.textContent = message;
  target.classList.toggle("error", isError);
}

function setView(viewId) {
  document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
  document.querySelector(`#${viewId}`).classList.add("active");
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === viewId));

  const labels = {
    dashboard: ["Operação", "Dashboard"],
    agenda: ["Reservas", "Agenda geral"],
    servicos: ["Catálogo", "Serviços"],
    barbeiros: ["Equipe", "Barbeiros"],
    horarios: ["Disponibilidade", "Horários"],
    configuracoes: ["Sistema", "Configurações"]
  };

  el.sectionEyebrow.textContent = labels[viewId][0];
  el.sectionTitle.textContent = labels[viewId][1];
}

function ensureLoggedIn() {
  if (state.token) {
    el.loginView.classList.add("hidden");
    el.appView.classList.remove("hidden");
    initializeApp();
  } else {
    el.loginView.classList.remove("hidden");
    el.appView.classList.add("hidden");
  }
}

async function initializeApp() {
  document.querySelector("#dashboardDate").value = today();
  document.querySelector("#agendaDate").value = today();
  document.querySelector("#blockDate").value = today();
  renderBusinessHours([]);
  await loadAll();
}

async function loadAll() {
  try {
    setApiStatus(true, "API conectada");
    await Promise.all([loadServices(), loadBarbers(), loadSettings(), loadBusinessHours()]);
    await loadAgenda(today(), "");
    renderMetrics();
  } catch (error) {
    setApiStatus(false, "API com erro");
    console.error(error);
  }
}

async function loadServices() {
  const response = await api("/services?includeInactive=true");
  state.services = response.data || [];
  renderServices();
}

function renderServices() {
  document.querySelector("#servicesTable").innerHTML = renderTable({
    columns: ["Nome", "Preço", "Duração", "Status", "Ações"],
    rows: state.services.map((service) => [
      service.name,
      money(service.price),
      `${service.durationMinutes} min`,
      activeBadge(service.isActive),
      `<button class="table-action" data-edit-service="${service.id}">Editar</button>`
    ])
  });
  document.querySelector("#metricServices").textContent = state.services.length;
}

async function loadBarbers() {
  const response = await api("/barbers?includeInactive=true");
  state.barbers = response.data || [];
  renderBarbers();
  fillBarberSelects();
}

function renderBarbers() {
  document.querySelector("#barbersTable").innerHTML = renderTable({
    columns: ["Nome", "Especialidade", "Status"],
    rows: state.barbers.map((barber) => [
      barber.publicName,
      barber.specialty || "-",
      activeBadge(barber.isActive)
    ])
  });
  document.querySelector("#metricBarbers").textContent = state.barbers.length;
}

function fillBarberSelects() {
  const options = [
    `<option value="">Todos</option>`,
    ...state.barbers.map((barber) => `<option value="${barber.id}">${barber.publicName}</option>`)
  ].join("");

  document.querySelector("#agendaBarber").innerHTML = options;
  document.querySelector("#blockBarber").innerHTML = [
    `<option value="">Bloqueio geral</option>`,
    ...state.barbers.map((barber) => `<option value="${barber.id}">${barber.publicName}</option>`)
  ].join("");
}

async function loadAgenda(date = today(), barberId = "") {
  const params = new URLSearchParams();
  if (date) params.set("date", date);
  if (barberId) params.set("barberId", barberId);

  const response = await api(`/bookings/admin?${params.toString()}`);
  state.bookings = response.data || [];
  renderAgenda();
  renderDashboardBookings();
  renderMetrics();
}

function renderAgenda() {
  document.querySelector("#agendaTable").innerHTML = renderBookingsTable(state.bookings);
}

function renderDashboardBookings() {
  document.querySelector("#dashboardBookings").innerHTML = renderBookingsTable(state.bookings.slice(0, 8));
}

function renderBookingsTable(bookings) {
  return renderTable({
    columns: ["Horário", "Cliente", "Serviço", "Barbeiro", "Status"],
    rows: bookings.map((booking) => [
      `${booking.startsAt || "-"} - ${booking.endsAt || "-"}`,
      booking.clientName || "-",
      booking.serviceName || "-",
      booking.barberName || "-",
      statusBadge(booking.status)
    ]),
    empty: "Nenhuma reserva encontrada."
  });
}

async function loadSettings() {
  const response = await api("/settings");
  state.settings = response.data;
  const settings = state.settings || {};
  document.querySelector("#businessName").value = settings.businessName || "";
  document.querySelector("#businessPhone").value = settings.phone || "";
  document.querySelector("#businessAddress").value = settings.address || "";
  document.querySelector("#cancelLimit").value = settings.cancellationLimitMinutes || 120;
  document.querySelector("#slotInterval").value = settings.defaultSlotIntervalMinutes || 30;
  document.querySelector("#cancelPolicy").value = settings.cancellationPolicyText || "";
}

async function loadBusinessHours() {
  const response = await api("/schedules/business-hours");
  renderBusinessHours(response.data || []);
}

function renderBusinessHours(hours) {
  const byWeekday = new Map(hours.map((hour) => [hour.weekday, hour]));

  document.querySelector("#businessHoursForm").innerHTML = weekdayLabels.map((label, weekday) => {
    const hour = byWeekday.get(weekday) || {};
    return `
      <div class="hour-row" data-weekday="${weekday}">
        <strong>${label}</strong>
        <input class="hour-open" type="time" value="${hour.opensAt || "09:00"}">
        <input class="hour-close" type="time" value="${hour.closesAt || "19:00"}">
        <label class="check-row"><input class="hour-active" type="checkbox" ${hour.isActive === false ? "" : "checked"}> Aberto</label>
      </div>
    `;
  }).join("");
  document.querySelector("#metricHours").textContent = hours.filter((hour) => hour.isActive).length;
}

function renderMetrics() {
  document.querySelector("#metricServices").textContent = state.services.length;
  document.querySelector("#metricBarbers").textContent = state.barbers.length;
  document.querySelector("#metricBookings").textContent = state.bookings.length;
}

function renderTable({ columns, rows, empty = "Nenhum registro encontrado." }) {
  if (!rows.length) {
    return `<p class="form-message">${empty}</p>`;
  }

  return `
    <table>
      <thead>
        <tr>${columns.map((column) => `<th>${column}</th>`).join("")}</tr>
      </thead>
      <tbody>
        ${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}
      </tbody>
    </table>
  `;
}

function activeBadge(isActive) {
  return isActive ? `<span class="badge ok">Ativo</span>` : `<span class="badge off">Inativo</span>`;
}

function statusBadge(status) {
  const labels = {
    scheduled: "Agendada",
    confirmed: "Confirmada",
    completed: "Concluída",
    canceled: "Cancelada",
    no_show: "Não compareceu"
  };
  return `<span class="badge">${labels[status] || status || "-"}</span>`;
}

function money(value) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function resetServiceForm() {
  document.querySelector("#serviceForm").reset();
  document.querySelector("#serviceId").value = "";
  document.querySelector("#serviceActive").checked = true;
  document.querySelector("#serviceFormTitle").textContent = "Novo serviço";
  showMessage(document.querySelector("#serviceMessage"), "");
}

el.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  showMessage(el.loginMessage, "Entrando...");

  try {
    const response = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: document.querySelector("#loginEmail").value,
        password: document.querySelector("#loginPassword").value
      })
    });

    if (response.data.user.role !== "admin") {
      throw new Error("Este painel é exclusivo para administradores.");
    }

    state.token = response.data.token;
    state.user = response.data.user;
    localStorage.setItem("barbearia_admin_token", state.token);
    ensureLoggedIn();
  } catch (error) {
    showMessage(el.loginMessage, error.message, true);
  }
});

document.querySelector("#logoutButton").addEventListener("click", () => {
  state.token = null;
  localStorage.removeItem("barbearia_admin_token");
  ensureLoggedIn();
});

document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.view));
});

document.querySelector("#refreshServices").addEventListener("click", loadServices);
document.querySelector("#refreshBarbers").addEventListener("click", loadBarbers);
document.querySelector("#refreshAgenda").addEventListener("click", () => {
  loadAgenda(document.querySelector("#agendaDate").value, document.querySelector("#agendaBarber").value);
});
document.querySelector("#dashboardDate").addEventListener("change", (event) => {
  loadAgenda(event.target.value, "");
});

document.querySelector("#serviceForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = document.querySelector("#serviceId").value;
  const message = document.querySelector("#serviceMessage");

  const payload = {
    name: document.querySelector("#serviceName").value,
    description: document.querySelector("#serviceDescription").value,
    price: Number(document.querySelector("#servicePrice").value),
    durationMinutes: Number(document.querySelector("#serviceDuration").value),
    isActive: document.querySelector("#serviceActive").checked
  };

  try {
    await api(id ? `/services/${id}` : "/services", {
      method: id ? "PATCH" : "POST",
      body: JSON.stringify(payload)
    });
    showMessage(message, "Serviço salvo.");
    resetServiceForm();
    await loadServices();
  } catch (error) {
    showMessage(message, error.message, true);
  }
});

document.querySelector("#clearServiceForm").addEventListener("click", resetServiceForm);

document.querySelector("#servicesTable").addEventListener("click", (event) => {
  const id = event.target.dataset.editService;
  if (!id) return;

  const service = state.services.find((item) => item.id === id);
  if (!service) return;

  document.querySelector("#serviceId").value = service.id;
  document.querySelector("#serviceName").value = service.name;
  document.querySelector("#serviceDescription").value = service.description || "";
  document.querySelector("#servicePrice").value = service.price;
  document.querySelector("#serviceDuration").value = service.durationMinutes;
  document.querySelector("#serviceActive").checked = service.isActive;
  document.querySelector("#serviceFormTitle").textContent = "Editar serviço";
});

document.querySelector("#barberForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = document.querySelector("#barberMessage");

  const payload = {
    name: document.querySelector("#barberName").value,
    publicName: document.querySelector("#barberPublicName").value,
    email: document.querySelector("#barberEmail").value,
    phone: document.querySelector("#barberPhone").value,
    password: document.querySelector("#barberPassword").value,
    specialty: document.querySelector("#barberSpecialty").value,
    isActive: document.querySelector("#barberActive").checked
  };

  try {
    await api("/barbers", { method: "POST", body: JSON.stringify(payload) });
    event.target.reset();
    document.querySelector("#barberPassword").value = "barber123";
    document.querySelector("#barberActive").checked = true;
    showMessage(message, "Barbeiro criado.");
    await loadBarbers();
  } catch (error) {
    showMessage(message, error.message, true);
  }
});

document.querySelector("#saveBusinessHours").addEventListener("click", async () => {
  const message = document.querySelector("#hoursMessage");
  const hours = [...document.querySelectorAll(".hour-row")].map((row) => ({
    weekday: Number(row.dataset.weekday),
    opensAt: row.querySelector(".hour-open").value,
    closesAt: row.querySelector(".hour-close").value,
    isActive: row.querySelector(".hour-active").checked
  }));

  try {
    await api("/schedules/business-hours", {
      method: "PUT",
      body: JSON.stringify({ hours })
    });
    showMessage(message, "Horários salvos.");
    await loadBusinessHours();
  } catch (error) {
    showMessage(message, error.message, true);
  }
});

document.querySelector("#blockForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = document.querySelector("#blockMessage");
  const barberId = document.querySelector("#blockBarber").value;

  const payload = {
    barberId: barberId || null,
    date: document.querySelector("#blockDate").value,
    startsAt: document.querySelector("#blockStart").value,
    endsAt: document.querySelector("#blockEnd").value,
    reason: document.querySelector("#blockReason").value
  };

  try {
    await api("/schedules/blocks", { method: "POST", body: JSON.stringify(payload) });
    event.target.reset();
    document.querySelector("#blockDate").value = today();
    showMessage(message, "Bloqueio criado.");
  } catch (error) {
    showMessage(message, error.message, true);
  }
});

document.querySelector("#settingsForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = document.querySelector("#settingsMessage");
  const payload = {
    businessName: document.querySelector("#businessName").value,
    phone: document.querySelector("#businessPhone").value,
    address: document.querySelector("#businessAddress").value,
    cancellationLimitMinutes: Number(document.querySelector("#cancelLimit").value),
    defaultSlotIntervalMinutes: Number(document.querySelector("#slotInterval").value),
    cancellationPolicyText: document.querySelector("#cancelPolicy").value
  };

  try {
    await api("/settings", { method: "PATCH", body: JSON.stringify(payload) });
    showMessage(message, "Configurações salvas.");
  } catch (error) {
    showMessage(message, error.message, true);
  }
});

ensureLoggedIn();
