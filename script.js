const API_URL = window.BARBEARIA_API_URL || localStorage.getItem("barbearia_api_url") || "http://localhost:3000/api/v1";

const state = {
  token: localStorage.getItem("barbearia_cliente_token"),
  user: null,
  services: [],
  barbers: [],
  reservations: [],
  selectedService: null,
  selectedBarber: null,
  selectedDate: today(),
  selectedSlot: null
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

function money(value) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function setAuthTab(tab) {
  document.querySelectorAll(".tab").forEach((button) => button.classList.toggle("active", button.dataset.authTab === tab));
  document.querySelectorAll(".auth-form").forEach((form) => form.classList.remove("active"));
  document.querySelector(`#${tab}Form`).classList.add("active");
}

function setView(view) {
  document.querySelectorAll(".view").forEach((item) => item.classList.remove("active"));
  document.querySelector(`#${view}`).classList.add("active");
  document.querySelectorAll("[data-view-target]").forEach((item) => {
    item.classList.toggle("active", item.dataset.viewTarget === view);
  });

  if (view === "reservations") loadReservations();
}

function updateAuthView() {
  if (state.token) {
    document.querySelector("#authView").classList.add("hidden");
    document.querySelector("#appView").classList.remove("hidden");
    initializeApp();
  } else {
    document.querySelector("#authView").classList.remove("hidden");
    document.querySelector("#appView").classList.add("hidden");
  }
}

async function initializeApp() {
  document.querySelector("#bookingDate").value = state.selectedDate;

  try {
    const me = await api("/users/me");
    state.user = me.data;
    document.querySelector("#homeTitle").textContent = `Olá, ${state.user.name}`;
    document.querySelector("#profileName").value = state.user.name;
    document.querySelector("#profilePhone").value = state.user.phone;
    document.querySelector("#profileEmail").value = state.user.email;

    await Promise.all([loadServices(), loadBarbers(), loadReservations()]);
    renderNextBooking();
  } catch (error) {
    console.error(error);
    logout();
  }
}

async function loadServices() {
  const response = await api("/services");
  state.services = response.data || [];
  renderServices();
}

function renderServices() {
  document.querySelector("#servicesList").innerHTML = state.services.map((service) => `
    <button class="select-card ${state.selectedService?.id === service.id ? "active" : ""}" data-service-id="${service.id}">
      <strong>${service.name}</strong>
      <span>${service.durationMinutes} min · ${money(service.price)}</span>
      <span>${service.description || ""}</span>
    </button>
  `).join("") || `<p class="form-message">Nenhum serviço disponível.</p>`;
  updateSummary();
}

async function loadBarbers() {
  const response = await api("/barbers");
  state.barbers = response.data || [];
  renderBarbers();
}

function renderBarbers() {
  document.querySelector("#barbersList").innerHTML = state.barbers.map((barber) => `
    <button class="select-card ${state.selectedBarber?.id === barber.id ? "active" : ""}" data-barber-id="${barber.id}">
      <strong>${barber.publicName}</strong>
      <span>${barber.specialty || "Barbeiro"}</span>
    </button>
  `).join("") || `<p class="form-message">Nenhum barbeiro disponível.</p>`;
  updateSummary();
}

async function loadSlots() {
  const container = document.querySelector("#slotsList");

  if (!state.selectedService || !state.selectedBarber || !state.selectedDate) {
    container.innerHTML = `<p class="form-message">Escolha serviço e barbeiro para ver horários.</p>`;
    return;
  }

  container.innerHTML = `<p class="form-message">Carregando horários...</p>`;

  try {
    const params = new URLSearchParams({
      serviceId: state.selectedService.id,
      barberId: state.selectedBarber.id,
      date: state.selectedDate
    });

    const response = await api(`/schedules/availability?${params.toString()}`);
    const slots = response.data.availableSlots || [];

    container.innerHTML = slots.map((slot) => `
      <button class="slot-button ${state.selectedSlot === slot ? "active" : ""}" data-slot="${slot}">${slot}</button>
    `).join("") || `<p class="form-message">Nenhum horário disponível nesta data.</p>`;
  } catch (error) {
    container.innerHTML = `<p class="form-message error">${error.message}</p>`;
  }
}

async function loadReservations() {
  try {
    const response = await api("/bookings/my");
    state.reservations = response.data || [];
    renderReservations();
    renderNextBooking();
  } catch (error) {
    document.querySelector("#reservationsList").innerHTML = `<p class="form-message error">${error.message}</p>`;
  }
}

function renderReservations() {
  const container = document.querySelector("#reservationsList");

  if (!state.reservations.length) {
    container.innerHTML = `<p class="form-message">Você ainda não tem reservas.</p>`;
    return;
  }

  container.innerHTML = state.reservations.map((reservation) => `
    <article class="reservation-card">
      <header>
        <strong>${reservation.serviceName}</strong>
        <span class="badge ${reservation.status === "canceled" ? "canceled" : ""}">${statusLabel(reservation.status)}</span>
      </header>
      <span>${reservation.barberName}</span>
      <span>${formatDate(reservation.date)} · ${formatTime(reservation.startsAt)} - ${formatTime(reservation.endsAt)}</span>
      <strong>${money(reservation.priceSnapshot)}</strong>
      ${reservation.status === "scheduled" ? `<button class="button secondary" data-cancel-booking="${reservation.id}">Cancelar</button>` : ""}
    </article>
  `).join("");
}

function renderNextBooking() {
  const card = document.querySelector("#nextBookingCard");
  const next = state.reservations.find((booking) => booking.status === "scheduled" || booking.status === "confirmed");

  if (!next) {
    card.innerHTML = `
      <strong>Nenhum horário marcado</strong>
      <span>Agende seu próximo atendimento agora.</span>
      <button class="button primary" data-view-target="booking">Agendar agora</button>
    `;
    return;
  }

  card.innerHTML = `
    <strong>Próximo horário</strong>
    <span>${next.serviceName} com ${next.barberName}</span>
    <span>${formatDate(next.date)} · ${formatTime(next.startsAt)}</span>
  `;
}

function statusLabel(status) {
  const labels = {
    scheduled: "Agendada",
    confirmed: "Confirmada",
    completed: "Concluída",
    canceled: "Cancelada",
    no_show: "Não compareceu"
  };
  return labels[status] || status;
}

function formatTime(value) {
  return String(value || "-").slice(0, 5);
}

function formatDate(value) {
  return String(value || "-").slice(0, 10);
}

function updateSummary() {
  document.querySelector("#summaryService").textContent = state.selectedService?.name || "-";
  document.querySelector("#summaryBarber").textContent = state.selectedBarber?.publicName || "-";
  document.querySelector("#summaryDate").textContent = state.selectedDate || "-";
  document.querySelector("#summarySlot").textContent = state.selectedSlot || "-";
  document.querySelector("#summaryPrice").textContent = state.selectedService ? money(state.selectedService.price) : "-";
}

function logout() {
  state.token = null;
  state.user = null;
  localStorage.removeItem("barbearia_cliente_token");
  updateAuthView();
}

document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => setAuthTab(button.dataset.authTab));
});

document.querySelectorAll("[data-view-target]").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.viewTarget));
});

document.body.addEventListener("click", async (event) => {
  const viewTarget = event.target.dataset.viewTarget;
  if (viewTarget) setView(viewTarget);

  const serviceId = event.target.closest("[data-service-id]")?.dataset.serviceId;
  if (serviceId) {
    state.selectedService = state.services.find((service) => service.id === serviceId);
    state.selectedSlot = null;
    renderServices();
    await loadSlots();
  }

  const barberId = event.target.closest("[data-barber-id]")?.dataset.barberId;
  if (barberId) {
    state.selectedBarber = state.barbers.find((barber) => barber.id === barberId);
    state.selectedSlot = null;
    renderBarbers();
    await loadSlots();
  }

  const slot = event.target.dataset.slot;
  if (slot) {
    state.selectedSlot = slot;
    await loadSlots();
    updateSummary();
  }

  const bookingId = event.target.dataset.cancelBooking;
  if (bookingId && confirm("Cancelar esta reserva?")) {
    await api(`/bookings/${bookingId}/cancel`, {
      method: "PATCH",
      body: JSON.stringify({ reason: "Cancelado pelo cliente" })
    });
    await loadReservations();
  }
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

    state.token = response.data.token;
    localStorage.setItem("barbearia_cliente_token", state.token);
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
    const response = await api("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: document.querySelector("#registerName").value,
        phone: document.querySelector("#registerPhone").value,
        email: document.querySelector("#registerEmail").value,
        password: document.querySelector("#registerPassword").value
      })
    });

    state.token = response.data.token;
    localStorage.setItem("barbearia_cliente_token", state.token);
    updateAuthView();
  } catch (error) {
    showMessage(message, error.message, true);
  }
});

document.querySelector("#bookingDate").addEventListener("change", async (event) => {
  state.selectedDate = event.target.value;
  state.selectedSlot = null;
  updateSummary();
  await loadSlots();
});

document.querySelector("#confirmBooking").addEventListener("click", async () => {
  const message = document.querySelector("#bookingMessage");

  if (!state.selectedService || !state.selectedBarber || !state.selectedDate || !state.selectedSlot) {
    showMessage(message, "Escolha serviço, barbeiro, data e horário.", true);
    return;
  }

  try {
    const response = await api("/bookings", {
      method: "POST",
      body: JSON.stringify({
        serviceId: state.selectedService.id,
        barberId: state.selectedBarber.id,
        date: state.selectedDate,
        startsAt: state.selectedSlot
      })
    });

    showMessage(message, `Reserva confirmada para ${response.data.startsAt}.`);
    state.selectedSlot = null;
    await Promise.all([loadSlots(), loadReservations()]);
    setView("reservations");
  } catch (error) {
    showMessage(message, error.message, true);
  }
});

document.querySelector("#profileForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = document.querySelector("#profileMessage");

  try {
    const response = await api("/users/me", {
      method: "PATCH",
      body: JSON.stringify({
        name: document.querySelector("#profileName").value,
        phone: document.querySelector("#profilePhone").value
      })
    });

    state.user = response.data;
    showMessage(message, "Perfil atualizado.");
  } catch (error) {
    showMessage(message, error.message, true);
  }
});

document.querySelector("#logoutButton").addEventListener("click", logout);

updateAuthView();
