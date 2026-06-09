const API_URL = window.BARBEARIA_API_URL || localStorage.getItem("barbearia_api_url") || "http://localhost:3000/api/v1";

const state = {
  token: localStorage.getItem("barbearia_barbeiro_token"),
  user: null,
  barberProfile: null,
  bookings: [],
  workingHours: []
};

const weekdayLabels = ["Domingo", "Segunda", "Terca", "Quarta", "Quinta", "Sexta", "Sabado"];

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

function showMessage(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle("error", isError);
}

function setAuthPanel(panel) {
  document.querySelectorAll(".auth-tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.authPanel === panel);
  });

  document.querySelector("#loginForm").classList.toggle("active", panel === "login");
  document.querySelector("#registerForm").classList.toggle("active", panel === "register");
  showMessage(document.querySelector("#loginMessage"), "");
  showMessage(document.querySelector("#registerMessage"), "");
}

function updateAuthView() {
  if (state.token) {
    document.querySelector("#loginView").classList.add("hidden");
    document.querySelector("#appView").classList.remove("hidden");
    initializeApp();
  } else {
    document.querySelector("#loginView").classList.remove("hidden");
    document.querySelector("#appView").classList.add("hidden");
  }
}

async function initializeApp() {
  document.querySelector("#agendaDate").value = today();

  try {
    const me = await api("/users/me");
    if (me.data.role !== "barber") {
      throw new Error("Esta área é exclusiva para barbeiros.");
    }

    state.user = me.data;
    document.querySelector("#barberName").textContent = state.user.name;
    await Promise.all([loadAgenda(), loadBarberProfile(), loadWorkingHours()]);
  } catch (error) {
    console.error(error);
    logout();
  }
}

async function loadAgenda() {
  const date = document.querySelector("#agendaDate").value || today();
  const response = await api(`/bookings/barber/me?date=${date}`);
  state.bookings = response.data || [];
  renderAgenda();
  renderMetrics();
}

function renderAgenda() {
  const list = document.querySelector("#agendaList");
  const hint = document.querySelector("#agendaHint");

  hint.textContent = `${state.bookings.length} atendimento(s) encontrado(s).`;

  if (!state.bookings.length) {
    list.innerHTML = `<p class="form-message">Nenhum atendimento para esta data.</p>`;
    return;
  }

  list.innerHTML = state.bookings.map((booking) => `
    <article class="booking-card">
      <header>
        <div class="booking-main">
          <strong>${formatTime(booking.startsAt)} - ${formatTime(booking.endsAt)}</strong>
          <span>${booking.clientName}</span>
          <span>${booking.serviceName}</span>
        </div>
        <span class="badge ${booking.status}">${statusLabel(booking.status)}</span>
      </header>
      ${renderActions(booking)}
    </article>
  `).join("");
}

function renderActions(booking) {
  if (booking.status !== "scheduled" && booking.status !== "confirmed") {
    return "";
  }

  return `
    <div class="booking-actions">
      <button class="button primary" data-complete="${booking.id}">Marcar concluído</button>
      <button class="button danger" data-noshow="${booking.id}">Não compareceu</button>
    </div>
  `;
}

function renderMetrics() {
  document.querySelector("#metricTotal").textContent = state.bookings.length;
  document.querySelector("#metricScheduled").textContent = state.bookings.filter((item) => item.status === "scheduled" || item.status === "confirmed").length;
  document.querySelector("#metricCompleted").textContent = state.bookings.filter((item) => item.status === "completed").length;
}

async function loadWorkingHours() {
  const response = await api("/schedules/me/working-hours");
  state.workingHours = response.data || [];
  renderWorkingHours();
}

async function loadBarberProfile() {
  const response = await api("/barbers/me");
  state.barberProfile = response.data;
  document.querySelector("#defaultServiceDuration").value = response.data.defaultServiceDurationMinutes || "";
}

async function saveBarberProfile() {
  const message = document.querySelector("#workingHoursMessage");
  const duration = Number(document.querySelector("#defaultServiceDuration").value);

  if (!duration || duration <= 0) {
    showMessage(message, "Informe um tempo de corte valido.", true);
    return;
  }

  showMessage(message, "Salvando tempo...");

  try {
    const response = await api("/barbers/me", {
      method: "PATCH",
      body: JSON.stringify({ defaultServiceDurationMinutes: duration })
    });

    state.barberProfile = response.data;
    showMessage(message, response.message || "Tempo salvo.");
  } catch (error) {
    showMessage(message, error.message, true);
  }
}

function renderWorkingHours() {
  const form = document.querySelector("#workingHoursForm");
  const byWeekday = new Map();

  for (const hour of state.workingHours) {
    const hours = byWeekday.get(hour.weekday) || [];
    hours.push(hour);
    byWeekday.set(hour.weekday, hours);
  }

  form.innerHTML = weekdayLabels.map((label, weekday) => {
    const hours = byWeekday.get(weekday) || [];
    const isActive = weekday !== 0 && (hours.length ? hours.some((hour) => hour.isActive !== false) : true);
    const hourRows = hours.length ? hours : [{ startsAt: "", endsAt: "" }];

    return `
      <div class="hour-row" data-weekday="${weekday}">
        <div class="hour-day">
          <label class="check-row"><input class="day-active" type="checkbox" ${isActive ? "checked" : ""}> ${label}</label>
          <button class="button secondary add-hour" type="button" data-add-hour>Adicionar horario</button>
        </div>
        <div class="hour-blocks">
          ${hourRows.map((hour) => renderHourBlock(hour)).join("")}
        </div>
      </div>
    `;
  }).join("");
}

function renderHourBlock(hour = {}) {
  return `
    <div class="hour-block">
      <input class="hour-start" type="time" value="${formatTime(hour.startsAt || "")}">
      <input class="hour-end" type="time" value="${formatTime(hour.endsAt || "")}">
      <button class="button danger remove-hour" type="button" data-remove-hour>Remover</button>
    </div>
  `;
}

function collectWorkingHours() {
  const hours = [];

  for (const row of document.querySelectorAll(".hour-row")) {
    const weekday = Number(row.dataset.weekday);
    const isActive = row.querySelector(".day-active").checked;

    if (!isActive) continue;

    for (const block of row.querySelectorAll(".hour-block")) {
      const startsAt = block.querySelector(".hour-start").value;
      const endsAt = block.querySelector(".hour-end").value;

      if (!startsAt && !endsAt) continue;
      if (!startsAt || !endsAt) {
        throw new Error("Preencha inicio e fim de cada bloco de horario.");
      }
      if (startsAt >= endsAt) {
        throw new Error("O horario inicial deve ser menor que o horario final.");
      }

      hours.push({ weekday, startsAt, endsAt, isActive: true });
    }
  }

  return hours;
}

async function saveWorkingHours() {
  const message = document.querySelector("#workingHoursMessage");
  showMessage(message, "Salvando...");

  try {
    const hours = collectWorkingHours();
    const response = await api("/schedules/me/working-hours", {
      method: "PUT",
      body: JSON.stringify({ hours })
    });

    state.workingHours = response.data || [];
    renderWorkingHours();
    showMessage(message, response.message || "Horarios salvos.");
  } catch (error) {
    showMessage(message, error.message, true);
  }
}

function statusLabel(status) {
  const labels = {
    scheduled: "Agendado",
    confirmed: "Confirmado",
    completed: "Concluído",
    canceled: "Cancelado",
    no_show: "Não compareceu"
  };
  return labels[status] || status;
}

function formatTime(value) {
  return String(value || "-").slice(0, 5);
}

function logout() {
  state.token = null;
  state.user = null;
  localStorage.removeItem("barbearia_barbeiro_token");
  updateAuthView();
}

document.querySelectorAll(".auth-tab").forEach((button) => {
  button.addEventListener("click", () => setAuthPanel(button.dataset.authPanel));
});

document.querySelector("#loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = document.querySelector("#loginMessage");
  showMessage(message, "Entrando...");

  try {
    const response = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: document.querySelector("#loginEmail").value,
        password: document.querySelector("#loginPassword").value
      })
    });

    if (response.data.user.role !== "barber") {
      throw new Error("Use uma conta de barbeiro para acessar esta área.");
    }

    state.token = response.data.token;
    localStorage.setItem("barbearia_barbeiro_token", state.token);
    updateAuthView();
  } catch (error) {
    showMessage(message, error.message, true);
  }
});

document.querySelector("#registerForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = document.querySelector("#registerMessage");
  showMessage(message, "Criando conta...");

  try {
    const response = await api("/auth/register-barber", {
      method: "POST",
      body: JSON.stringify({
        name: document.querySelector("#registerName").value,
        publicName: document.querySelector("#registerPublicName").value,
        email: document.querySelector("#registerEmail").value,
        phone: document.querySelector("#registerPhone").value,
        password: document.querySelector("#registerPassword").value
      })
    });

    state.token = response.data.token;
    localStorage.setItem("barbearia_barbeiro_token", state.token);
    updateAuthView();
  } catch (error) {
    showMessage(message, error.message, true);
  }
});

document.querySelector("#logoutButton").addEventListener("click", logout);
document.querySelector("#refreshAgenda").addEventListener("click", loadAgenda);
document.querySelector("#agendaDate").addEventListener("change", loadAgenda);
document.querySelector("#saveBarberProfile").addEventListener("click", saveBarberProfile);
document.querySelector("#saveWorkingHours").addEventListener("click", saveWorkingHours);
document.querySelector("#workingHoursForm").addEventListener("click", (event) => {
  const row = event.target.closest(".hour-row");
  if (!row) return;

  if (event.target.dataset.addHour !== undefined) {
    row.querySelector(".hour-blocks").insertAdjacentHTML("beforeend", renderHourBlock());
  }

  if (event.target.dataset.removeHour !== undefined) {
    const blocks = row.querySelectorAll(".hour-block");
    if (blocks.length > 1) {
      event.target.closest(".hour-block").remove();
    } else {
      const block = event.target.closest(".hour-block");
      block.querySelector(".hour-start").value = "";
      block.querySelector(".hour-end").value = "";
    }
  }
});

document.querySelector("#agendaList").addEventListener("click", async (event) => {
  const completeId = event.target.dataset.complete;
  const noShowId = event.target.dataset.noshow;

  try {
    if (completeId) {
      await api(`/bookings/${completeId}/complete`, { method: "PATCH" });
      await loadAgenda();
    }

    if (noShowId && confirm("Marcar cliente como não compareceu?")) {
      await api(`/bookings/${noShowId}/no-show`, { method: "PATCH" });
      await loadAgenda();
    }
  } catch (error) {
    alert(error.message);
  }
});

updateAuthView();
