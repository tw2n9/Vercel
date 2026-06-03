const API_URL = window.BARBEARIA_API_URL || localStorage.getItem("barbearia_api_url") || "http://localhost:3000/api/v1";

const state = {
  token: localStorage.getItem("barbearia_barbeiro_token"),
  user: null,
  bookings: []
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

function showMessage(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle("error", isError);
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
    await loadAgenda();
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

document.querySelector("#logoutButton").addEventListener("click", logout);
document.querySelector("#refreshAgenda").addEventListener("click", loadAgenda);
document.querySelector("#agendaDate").addEventListener("change", loadAgenda);

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
