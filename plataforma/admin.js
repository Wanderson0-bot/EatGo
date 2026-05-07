const API_PROTOCOL = window.location.protocol === "file:" ? "http:" : window.location.protocol;

let resolvedApiBaseUrl = null;
let apiBaseUrlPromise = null;
let adminUserState = null;

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function getConfiguredApiBaseUrl() {
  const metaValue = document
    .querySelector('meta[name="eatgo-api-base-url"]')
    ?.getAttribute("content")
    ?.trim();

  if (window.EATGO_API_BASE_URL) {
    return String(window.EATGO_API_BASE_URL).trim();
  }

  if (metaValue) {
    return metaValue;
  }

  return "";
}

function buildApiCandidates() {
  const configured = getConfiguredApiBaseUrl();
  const candidates = [];

  if (configured) {
    candidates.push(configured.replace(/\/$/, ""));
  }

  if (window.location.protocol !== "file:") {
    candidates.push(window.location.origin);
  }

  candidates.push(
    `${API_PROTOCOL}//127.0.0.1:3000`,
    `${API_PROTOCOL}//localhost:3000`,
    `${API_PROTOCOL}//127.0.0.1:3001`,
    `${API_PROTOCOL}//localhost:3001`,
    `${API_PROTOCOL}//127.0.0.1:3002`,
    `${API_PROTOCOL}//localhost:3002`
  );

  return candidates.filter(
    (value, index, list) => value && list.indexOf(value) === index
  );
}

async function resolveApiBaseUrl() {
  if (resolvedApiBaseUrl) {
    return resolvedApiBaseUrl;
  }

  if (!apiBaseUrlPromise) {
    const candidates = buildApiCandidates();

    apiBaseUrlPromise = (async () => {
      for (const candidate of candidates) {
        try {
          const response = await fetch(`${candidate}/health`, { method: "GET" });
          if (response.ok) {
            resolvedApiBaseUrl = candidate;
            return candidate;
          }
        } catch (error) {
          // Tenta a próxima origem.
        }
      }

      resolvedApiBaseUrl = candidates[0] || `${API_PROTOCOL}//127.0.0.1:3000`;
      return resolvedApiBaseUrl;
    })();
  }

  return apiBaseUrlPromise;
}

function getAdminUser() {
  return adminUserState;
}

function setAdminSession(user) {
  adminUserState = user || null;
}

async function clearAdminSession() {
  try {
    const baseUrl = await resolveApiBaseUrl();
    await fetch(`${baseUrl}/api/admin/logout`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    // Ignora falhas de logout remoto e limpa o estado em memória.
  }

  adminUserState = null;
}

function revealPage() {
  document.body.classList.remove("admin-locked");
}

async function apiRequest(path, options = {}) {
  const baseUrl = await resolveApiBaseUrl();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    credentials: "include",
    headers
  });

  if (response.status === 401 || response.status === 403) {
    adminUserState = null;
    const body = await response.text();
    let message = "Acesso administrativo inválido ou expirado.";
    try {
      const json = JSON.parse(body);
      if (json?.message) {
        message = json.message;
      }
    } catch (error) {
      if (body) {
        message = body;
      }
    }
    throw new Error(message);
  }

  if (!response.ok) {
    const errorText = await response.text();
    let message = `Falha ao carregar dados: ${response.status} ${response.statusText}`;
    try {
      const json = JSON.parse(errorText);
      if (json?.message) {
        message = json.message;
      }
    } catch (error) {
      if (errorText) {
        message = `${message} - ${errorText}`;
      }
    }
    throw new Error(message);
  }

  return response.json();
}

async function loginAdmin() {
  const passwordInput = document.getElementById("admin-password");
  const senha = passwordInput?.value?.trim() || "";
  const response = await apiRequest("/api/admin/login", {
    method: "POST",
    body: JSON.stringify({ senha })
  });

  if (!response?.token) {
    throw new Error("Não foi possível iniciar a sessão administrativa.");
  }

  setAdminSession(response.user || null);
  return response.user || null;
}

function getStatusBadgeClass(status) {
  switch (String(status || "").toLowerCase()) {
    case "aprovado":
    case "approved":
    case "entregue":
      return "status-badge success";
    case "pendente":
    case "pending":
    case "aberto":
    case "confirmado":
    case "preparando":
      return "status-badge warning";
    case "cancelado":
    case "rejeitado":
    case "rejected":
      return "status-badge danger";
    default:
      return "status-badge neutral";
  }
}

function formatStatusLabel(status) {
  const statusMap = {
    "aprovado": "Aprovado",
    "approved": "Aprovado",
    "entregue": "Entregue",
    "pendente": "Pendente",
    "pending": "Pendente",
    "aberto": "Aberto",
    "confirmado": "Confirmado",
    "preparando": "Preparando",
    "cancelado": "Cancelado",
    "rejeitado": "Rejeitado",
    "rejected": "Rejeitado"
  };
  const statusLower = String(status || "").toLowerCase();
  return statusMap[statusLower] || String(status || "-");
}

async function removeEstablishment(id) {
  if (!confirm(`Tem certeza que deseja remover o estabelecimento com ID ${id}?\n\nEsta ação irá desativar o estabelecimento e todos os seus usuários.`)) {
    return;
  }

  try {
    await apiRequest(`/api/admin/establishments/${id}`, {
      method: "DELETE"
    });

    alert("Estabelecimento removido com sucesso!");
    await loadOverview(); // Recarregar dados
  } catch (error) {
    alert(`Erro ao remover estabelecimento: ${error.message || "Tente novamente."}`);
  }
}

function renderOverview(data) {
  const summary = data.summary || {};
  const recentOrders = Array.isArray(data.recentOrders) ? data.recentOrders : [];
  const topEstablishments = Array.isArray(data.topEstablishments) ? data.topEstablishments : [];
  const topClients = Array.isArray(data.topClients) ? data.topClients : [];

  document.getElementById("admin-estabelecimentos-ativos").textContent =
    Number(summary.estabelecimentos_ativos || 0);
  document.getElementById("admin-estabelecimentos-resumo").textContent =
    `${Number(summary.estabelecimentos_total || 0)} cadastrados • ${Number(summary.estabelecimentos_com_entrega || 0)} com entrega`;
  document.getElementById("admin-clientes-total").textContent =
    Number(summary.clientes_total || 0);
  document.getElementById("admin-faturamento-aprovado").textContent =
    formatCurrency(summary.faturamento_aprovado || 0);
  document.getElementById("admin-pagamentos-aprovados").textContent =
    `${Number(summary.pagamentos_aprovados || 0)} pagamentos aprovados`;

  const ordersTable = document.getElementById("admin-orders-table");
  const establishmentsTable = document.getElementById("admin-establishments-table");
  const topClientsTable = document.getElementById("admin-top-clients-table");

  ordersTable.innerHTML = `
    <div class="gestao-tabela-linha gestao-tabela-head">
      <span>Pedido</span>
      <span>Cliente</span>
      <span>Estabelecimento</span>
      <span>Status</span>
    </div>
    ${
      recentOrders.length
        ? recentOrders
            .map(
              (order) => `
                <div class="gestao-tabela-linha">
                  <span>#${order.id_pedido} • ${formatCurrency(order.total)}</span>
                  <span>${order.cliente_nome || "-"}</span>
                  <span>${order.estabelecimento_nome || "-"}</span>
                  <span class="${getStatusBadgeClass(order.pagamento_status)}">${formatStatusLabel(order.pagamento_status)}</span>
                </div>
              `
            )
            .join("")
        : '<div class="gestao-tabela-linha"><span colspan="4">Nenhum pedido encontrado.</span></div>'
    }
  `;

  establishmentsTable.innerHTML = `
    <div class="gestao-tabela-linha gestao-tabela-head">
      <span>Loja</span>
      <span>Categoria</span>
      <span>Pedidos</span>
      <span>Faturamento</span>
      <span>Ações</span>
    </div>
    ${
      topEstablishments.length
        ? topEstablishments
            .map(
              (establishment) => `
                <div class="gestao-tabela-linha">
                  <span>${establishment.nome} <small class="admin-table-note">${Number(establishment.ativo) ? "Ativo" : "Inativo"}</small></span>
                  <span>${establishment.categoria || "-"}</span>
                  <span>${Number(establishment.pedidos_total || 0)}</span>
                  <span>${formatCurrency(establishment.faturamento_aprovado || 0)}</span>
                  <span>
                    <button class="btn-remover admin-btn-remove" data-id="${establishment.id_estabelecimento}" title="Remover estabelecimento">
                      🗑️
                    </button>
                  </span>
                </div>
              `
            )
            .join("")
        : '<div class="gestao-tabela-linha"><span colspan="5">Nenhum estabelecimento encontrado.</span></div>'
    }
  `;

  topClientsTable.innerHTML = `
    <div class="gestao-tabela-linha gestao-tabela-head">
      <span>Cliente</span>
      <span>Email</span>
      <span>Telefone</span>
      <span>Pedidos</span>
      <span>Total Gasto</span>
    </div>
    ${
      topClients.length
        ? topClients
            .map(
              (client) => `
                <div class="gestao-tabela-linha">
                  <span>${client.nome || "-"}</span>
                  <span>${client.email || "-"}</span>
                  <span>${client.telefone || "-"}</span>
                  <span>${Number(client.pedidos_total || 0)}</span>
                  <span>${formatCurrency(client.total_gasto || 0)}</span>
                </div>
              `
            )
            .join("")
        : '<div class="gestao-tabela-linha"><span colspan="5">Nenhum cliente encontrado.</span></div>'
    }
  `;
}

async function loadOverview() {
  const response = await apiRequest("/api/admin/overview");
  renderOverview(response.data || {});
}

function setDashboardVisible(visible) {
  document.getElementById("admin-login-shell").classList.toggle("admin-hidden", visible);
  document.getElementById("admin-dashboard").classList.toggle("admin-hidden", !visible);
}

function setLoginFeedback(message) {
  const feedback = document.getElementById("admin-login-feedback");
  if (feedback) {
    feedback.textContent = message;
  }
}

async function ensureOwnerAccess() {
  try {
    await loadOverview();
    return true;
  } catch (error) {
    await clearAdminSession();
    throw error;
  }
}

function showLoginShell(message) {
  adminUserState = null;
  setDashboardVisible(false);
  revealPage();
  setLoginFeedback(message || "Informe a senha administrativa para liberar esta área.");
}

function setupLoginForm() {
  const form = document.getElementById("admin-login-form");
  const passwordInput = document.getElementById("admin-password");
  const toggleButton = document.getElementById("admin-toggle-password");

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    setLoginFeedback("Validando acesso administrativo...");

    try {
      await loginAdmin();
      await loadOverview();
      setDashboardVisible(true);
      setLoginFeedback("Acesso liberado.");
      form.reset();
    } catch (error) {
      await clearAdminSession();
      setLoginFeedback(error?.message || "Nao foi possivel autenticar o painel.");
      passwordInput?.focus();
    }
  });

  toggleButton?.addEventListener("click", () => {
    const isPassword = passwordInput.type === "password";
    passwordInput.type = isPassword ? "text" : "password";
    toggleButton.textContent = isPassword ? "🙈" : "👁️";
  });
}

function showAdminSection(sectionId) {
  const allSections = document.querySelectorAll('[id="visao-geral"], [id="cadastrar-estabelecimento"]');
  allSections.forEach(section => {
    if (section.id === sectionId) {
      section.classList.remove("admin-hidden");
    } else {
      section.classList.add("admin-hidden");
    }
  });
  
  const navLinks = document.querySelectorAll("nav a");
  navLinks.forEach(link => {
    if (link.getAttribute("href") === `#${sectionId}`) {
      link.classList.add("ativo");
    } else {
      link.classList.remove("ativo");
    }
  });
}

async function submitEstablishmentForm(event) {
  event.preventDefault();
  const form = event.target;
  const formData = new FormData(form);
  const taxaEntregaRaw = String(formData.get("taxa_entrega") || "").trim();
  const data = {
    nome: String(formData.get("nome") || "").trim(),
    cnpj: String(formData.get("cnpj") || "").trim(),
    email: String(formData.get("email") || "").trim(),
    responsavel_nome: String(formData.get("responsavel_nome") || "").trim(),
    senha_acesso: String(formData.get("senha_acesso") || ""),
    telefone: String(formData.get("telefone") || "").trim(),
    endereco: String(formData.get("endereco") || "").trim(),
    categoria: String(formData.get("categoria") || "").trim(),
    horario_funcionamento: String(formData.get("horario_funcionamento") || "").trim(),
    mercado_pago_access_token: String(formData.get("mercado_pago_access_token") || "").trim() || null,
    possui_entrega: formData.get("possui_entrega") === "1",
    taxa_entrega: taxaEntregaRaw
      ? Number(taxaEntregaRaw.replace(/[^0-9,.\-]/g, "").replace(",", "."))
      : null,
    descricao: String(formData.get("descricao") || "").trim() || null
  };

  try {
    const response = await apiRequest("/api/admin/establishments", {
      method: "POST",
      body: JSON.stringify(data)
    });
    alert(
      `Estabelecimento cadastrado com sucesso!\n\nLogin da gestão: ${response?.data?.email_gestao || data.email}`
    );
    form.reset();
    showAdminSection("visao-geral");
    await loadOverview();
  } catch (error) {
    alert(`Erro ao cadastrar estabelecimento: ${error.message || "Tente novamente."}`);
  }
}

async function bootAdminPage() {
  const refreshButton = document.getElementById("admin-refresh");
  const logoutButton = document.getElementById("admin-logout");
  const removeEstablishmentBtn = document.getElementById("remove-establishment-btn");
  const cadastroForm = document.getElementById("admin-cadastro-form");
  const navLinks = document.querySelectorAll("nav a");

  setupLoginForm();
  revealPage();

  // Setup navegação entre seções
  navLinks.forEach(link => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const sectionId = link.getAttribute("href").slice(1);
      showAdminSection(sectionId);
    });
  });

  // Setup formulário de cadastro de estabelecimento
  cadastroForm?.addEventListener("submit", submitEstablishmentForm);

  // Setup toggle da taxa de entrega
  const entregaRadios = document.querySelectorAll('input[name="possui_entrega"]');
  entregaRadios.forEach(radio => {
    radio.addEventListener("change", () => {
      const taxaField = document.getElementById("admin-taxa-entrega-campo");
      const entregaAtiva = document.querySelector('input[name="possui_entrega"]:checked')?.value === "1";
      if (entregaAtiva) {
        taxaField.style.display = "block";
      } else {
        taxaField.style.display = "none";
      }
    });
  });

  document.querySelector('input[name="possui_entrega"]:checked')?.dispatchEvent(new Event("change"));

  try {
    await ensureOwnerAccess();
    setDashboardVisible(true);
  } catch (error) {
    const adminUser = getAdminUser();
    const userName = adminUser?.nome ? ` para ${adminUser.nome}` : "";
    showLoginShell(
      error?.message ||
        `Informe a senha administrativa${userName} para continuar.`
    );
  }

  refreshButton?.addEventListener("click", async () => {
    try {
      await loadOverview();
    } catch (error) {
      showLoginShell("Sua sessao administrativa expirou.");
    }
  });

  logoutButton?.addEventListener("click", async () => {
    await clearAdminSession();
    showLoginShell("Sessao encerrada com sucesso.");
  });

  removeEstablishmentBtn?.addEventListener("click", async () => {
    const idInput = document.getElementById("remove-establishment-id");
    const id = idInput.value.trim();
    if (!id) {
      alert("Por favor, insira o ID do estabelecimento.");
      return;
    }
    await removeEstablishment(id);
  });

  // Event listener para botões de remover estabelecimento (usando event delegation)
  document.addEventListener("click", async (event) => {
    const button = event.target.closest(".admin-btn-remove");
    if (!button) return;

    const establishmentId = button.dataset.id;
    const establishmentName = button.closest(".gestao-tabela-linha").querySelector("span:first-child").textContent.split(" ")[0];

    await removeEstablishment(establishmentId, establishmentName);
  });
}

document.addEventListener("DOMContentLoaded", bootAdminPage);
