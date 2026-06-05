// Arquivo global da plataforma EatGo.
// Centraliza comportamentos compartilhados do front-end:
// home, cadastro, restaurante, carrinho, perfil, acessibilidade e gestão.
const API_PROTOCOL = window.location.protocol === "file:" ? "http:" : window.location.protocol;
const defaultPerfil = {
  nome: "Cliente EatGo",
  email: "Cadastro pendente",
  telefone: "Nao informado",
  endereco: "Nao informado",
  status: "Cadastro rapido",
  resumo:
    "Complete seu cadastro uma vez e seus dados ficarao salvos para as proximas visitas.",
  pedidosMes: 0,
  pagamento: "Pagamento redirecionado para o Mercado Pago",
  preferencias: [
    "Entrega padrao",
    "Dados salvos no navegador",
    "Checkout mais rapido",
    "Acesso automatico"
  ],
};

const defaultAcessibilidade = {
  contraste: false,
  "fonte-ampliada": false,
  teclado: true,
  "movimento-reduzido": false,
};

let currentCategory = "restaurantes";
let eatgoUiReady = false;
let resolvedApiBaseUrl = null;
let apiBaseUrlPromise = null;
let partnerUserState = null;
let publicStatePromise = null;
let publicStateCache = {
  carrinho: [],
  perfil: {},
  clienteId: null,
  clienteCadastroConcluido: false,
  acessibilidade: {},
  cadastroRascunho: null,
  restaurantesCadastrados: [],
  ultimoPagamentoSincronizado: null,
};

function normalizeDocument(value) {
  return String(value || "").replace(/\D/g, "");
}

async function extractApiError(response) {
  const fallback = `Falha ao carregar dados do backend: ${response.status} ${response.statusText}`;
  const text = await response.text();

  if (!text) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(text);

    const fieldErrors = parsed.details?.fieldErrors;
    if (fieldErrors && typeof fieldErrors === "object") {
      const details = Object.entries(fieldErrors)
        .flatMap(([field, messages]) =>
          Array.isArray(messages) && messages.length
            ? [`${field}: ${messages.join(", ")}`]
            : []
        )
        .join(" | ");

      if (details) {
        return `${parsed.message || parsed.error || "Dados invalidos."} ${details}`;
      }
    }

    return parsed.message || parsed.error || fallback;
  } catch (error) {
    return `${fallback} - ${text}`;
  }
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

function verificarStatusLoja(horarioAbertura, horarioFechamento) {
  if (!horarioAbertura || !horarioFechamento) {
    return {
      aberto: false,
      texto: "FECHADO",
    };
  }

  const agora = new Date();
  const formatTime = (horario) => String(horario).split(":").slice(0, 2).join(":");
  const toMinutes = (horario) => {
    const [hora, minuto] = String(horario).split(":").map(Number);
    if (!Number.isInteger(hora) || !Number.isInteger(minuto)) {
      return null;
    }

    return (hora * 60) + minuto;
  };
  const aberturaEmMinutos = toMinutes(horarioAbertura);
  const fechamentoEmMinutos = toMinutes(horarioFechamento);
  const aberturaFormatada = formatTime(horarioAbertura);
  const fechamentoFormatado = formatTime(horarioFechamento);

  if (aberturaEmMinutos == null || fechamentoEmMinutos == null) {
    return {
      aberto: false,
      texto: "FECHADO",
    };
  }

  if (aberturaEmMinutos === fechamentoEmMinutos) {
    return {
      aberto: true,
      texto: "🟢 Aberto 24h"
    };
  }

  const agoraEmMinutos = (agora.getHours() * 60) + agora.getMinutes();
  const atravessaMeiaNoite = fechamentoEmMinutos < aberturaEmMinutos;
  const aberto = atravessaMeiaNoite
    ? agoraEmMinutos >= aberturaEmMinutos || agoraEmMinutos <= fechamentoEmMinutos
    : agoraEmMinutos >= aberturaEmMinutos && agoraEmMinutos <= fechamentoEmMinutos;

  return {
    aberto,
    texto: aberto
      ? `🟢 Aberto até ${fechamentoFormatado}`
      : `🔴 Fechado • Abre às ${aberturaFormatada}`
  };
}

function getEstablishmentOperatingStatus(establishment) {
  if (!establishment || typeof establishment !== "object") {
    return {
      aberto: false,
      texto: "FECHADO"
    };
  }

  return verificarStatusLoja(
    establishment.horario_abertura,
    establishment.horario_fechamento
  );
}

function notifyClosedEstablishment(establishmentName, establishment) {
  const status = getEstablishmentOperatingStatus(establishment);
  const nome = establishmentName || establishment?.nome || "Este estabelecimento";

  showAlert(
    `${ nome } está fechado no momento. ${ status.texto.replace(/^🔴\s*/, "") }`,
    {
      title: "Estabelecimento fechado",
      tag: "Pedidos"
    }
  );
}

function buildApiCandidates() {
  const configured = getConfiguredApiBaseUrl();
  const candidates = [];

  if (configured) {
    candidates.push(configured.replace(/\/$/, ""));
  }

  const staticDevPorts = ["5500", "5501"];

  if (
    window.location.protocol !== "file:" &&
    !staticDevPorts.includes(window.location.port)
  ) {
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
          // Tenta a próxima origem até encontrar o backend ativo.
        }
      }

      resolvedApiBaseUrl = candidates[0] || `${API_PROTOCOL}//127.0.0.1:3000`;
      return resolvedApiBaseUrl;
    })();
  }

  return apiBaseUrlPromise;
}

function getPartnerLoginUrl() {
  return isPartnerPage() ? "../plataforma/login.html" : "login.html";
}

async function apiGet(path) {
  const baseUrl = await resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(await extractApiError(response));
  }

  const body = await response.json();
  return body.data;
}

function getPartnerUser() {
  return partnerUserState;
}

function setPartnerUser(user) {
  partnerUserState = user || null;
}

async function clearPartnerSession() {
  try {
    const baseUrl = await resolveApiBaseUrl();
    await fetch(`${baseUrl}/api/auth/partner/logout`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    // Mesmo que o backend não encontre a sessão, limpamos o estado em memória.
  }

  partnerUserState = null;
}

function getPublicState() {
  return publicStateCache;
}

function readPublicStateFromStorage() {
  try {
    const raw = window.localStorage.getItem(PUBLIC_STATE_STORAGE_KEY);
    return raw ? normalizePublicState(JSON.parse(raw)) : normalizePublicState();
  } catch (error) {
    return normalizePublicState();
  }
}

function normalizePublicState(state = {}) {
  return {
    carrinho: Array.isArray(state.carrinho) ? state.carrinho : [],
    perfil: state.perfil && typeof state.perfil === "object" ? state.perfil : {},
    clienteId: state.clienteId ? String(state.clienteId) : null,
    clienteCadastroConcluido: Boolean(state.clienteCadastroConcluido),
    acessibilidade:
      state.acessibilidade && typeof state.acessibilidade === "object"
        ? state.acessibilidade
        : {},
    cadastroRascunho:
      state.cadastroRascunho && typeof state.cadastroRascunho === "object"
        ? state.cadastroRascunho
        : null,
    restaurantesCadastrados: Array.isArray(state.restaurantesCadastrados)
      ? state.restaurantesCadastrados
      : [],
    ultimoPagamentoSincronizado: state.ultimoPagamentoSincronizado
      ? String(state.ultimoPagamentoSincronizado)
      : null,
  };
}

function writePublicStateToStorage(state) {
  try {
    window.localStorage.setItem(
      PUBLIC_STATE_STORAGE_KEY,
      JSON.stringify(normalizePublicState(state))
    );
  } catch (error) {
    // Ignora falhas de armazenamento local.
  }
}

function mergePublicStates(remoteState = {}, localState = {}) {
  const remote = normalizePublicState(remoteState);
  const local = normalizePublicState(localState);

  return normalizePublicState({
    ...remote,
    carrinho: remote.carrinho.length ? remote.carrinho : local.carrinho,
    perfil: Object.keys(remote.perfil || {}).length ? remote.perfil : local.perfil,
    clienteId: remote.clienteId || local.clienteId,
    clienteCadastroConcluido:
      remote.clienteCadastroConcluido || local.clienteCadastroConcluido,
    acessibilidade: Object.keys(remote.acessibilidade || {}).length
      ? remote.acessibilidade
      : local.acessibilidade,
    cadastroRascunho: remote.cadastroRascunho || local.cadastroRascunho,
    restaurantesCadastrados: remote.restaurantesCadastrados.length
      ? remote.restaurantesCadastrados
      : local.restaurantesCadastrados,
    ultimoPagamentoSincronizado:
      remote.ultimoPagamentoSincronizado || local.ultimoPagamentoSincronizado,
  });
}

async function initializePublicState() {
  if (!publicStatePromise) {
    publicStatePromise = (async () => {
      const localState = readPublicStateFromStorage();
      publicStateCache = localState;
      const response = await apiRequest("/api/session/public-state");
      publicStateCache = mergePublicStates(response?.data || {}, localState);
      writePublicStateToStorage(publicStateCache);
      return publicStateCache;
    })();
  }

  return publicStatePromise;
}

async function persistPublicState() {
  writePublicStateToStorage(publicStateCache);
  const response = await apiRequest("/api/session/public-state", {
    method: "PUT",
    body: JSON.stringify({
      state: publicStateCache,
    }),
  });

  publicStateCache = mergePublicStates(
    response?.data || publicStateCache,
    publicStateCache
  );
  writePublicStateToStorage(publicStateCache);
  return publicStateCache;
}

function updatePublicState(updater) {
  const currentState = normalizePublicState(publicStateCache);
  const nextState =
    typeof updater === "function" ? updater(currentState) : updater;
  publicStateCache = normalizePublicState(nextState);
  return persistPublicState();
}

async function apiRequest(path, options = {}) {
  const baseUrl = await resolveApiBaseUrl();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    credentials: "include",
    headers,
  });

  if (response.status === 401) {
    const bypass401Redirect =
      path === "/api/auth/partner/login" ||
      path === "/api/auth/partner/recover-password" ||
      path === "/api/admin/login";

    if (!bypass401Redirect && isPartnerPage()) {
      await clearPartnerSession();
      window.location.href = getPartnerLoginUrl();
      return null;
    }
  }

  if (!response.ok) {
    throw new Error(await extractApiError(response));
  }

  return response.json();
}

async function loginPartner(email, senha) {
  const payload = { email, senha };
  const response = await apiRequest("/api/auth/partner/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (!response) {
    throw new Error("Falha ao efetuar login.");
  }

  setPartnerUser(response.user);
  return response.user;
}

async function recoverPartnerPassword(email) {
  return apiRequest("/api/auth/partner/recover-password", {
    method: "POST",
    body: JSON.stringify({
      email
    }),
  });
}

async function resetPartnerPassword(token, senha) {
  return apiRequest("/api/auth/partner/reset-password", {
    method: "POST",
    body: JSON.stringify({
      token,
      senha
    }),
  });
}

async function fetchPartnerMe() {
  const response = await apiRequest("/api/auth/me");
  return response?.user || null;
}

async function fetchManagementEstablishment() {
  const response = await apiRequest("/api/management/establishment");
  return response?.data || null;
}

async function fetchManagementMenuItems() {
  const response = await apiRequest("/api/management/menu-items");
  return response?.data || [];
}

async function createManagementMenuItem(payload) {
  return apiRequest("/api/management/menu-items", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

async function updateManagementMenuItem(id, payload) {
  return apiRequest(`/api/management/menu-items/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

async function deleteManagementMenuItem(id) {
  return apiRequest(`/api/management/menu-items/${id}`, {
    method: "DELETE",
  });
}

async function fetchManagementOrders() {
  const response = await apiRequest("/api/management/orders");
  return response?.data || [];
}

async function updateManagementEstablishment(updates) {
  const response = await apiRequest("/api/management/establishment", {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
  return response;
}

async function updateManagementOrderStatus(id, status) {
  const response = await apiRequest(`/api/management/orders/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  return response;
}

async function reviewManagementOrderCancellation(id, payload) {
  return apiRequest(`/api/management/orders/${id}/cancel-review`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

async function fetchClientOrders(idCliente) {
  if (!idCliente) {
    return [];
  }

  const response = await apiRequest(`/api/orders/client/${encodeURIComponent(idCliente)}`);
  return response?.data || [];
}

async function cancelClientOrder(idPedido, idCliente, motivo) {
  return apiRequest(`/api/orders/${encodeURIComponent(idPedido)}/cancel`, {
    method: "PATCH",
    body: JSON.stringify({
      id_cliente: Number(idCliente),
      motivo
    }),
  });
}

function getStatusBadgeClass(status) {
  switch (status) {
    case "aguardando_pagamento":
      return "status-badge neutral";
    case "aberto":
    case "pago":
    case "confirmado":
      return "status-badge warning";
    case "preparando":
    case "saiu_para_entrega":
      return "status-badge success";
    case "entregue":
      return "status-badge success";
    case "cancelado":
      return "status-badge danger";
    default:
      return "status-badge neutral";
  }
}

function formatStatusLabel(status) {
  switch (status) {
    case "aguardando_pagamento":
      return "Aguardando pagamento";
    case "aberto":
      return "Pago";
    case "pago":
      return "Pago";
    case "confirmado":
      return "Confirmado";
    case "preparando":
      return "Preparando";
    case "saiu_para_entrega":
      return "Saiu para entrega";
    case "entregue":
      return "Entregue";
    case "cancelado":
      return "Cancelado";
    default:
      return status;
  }
}

function formatPaymentStatusLabel(status) {
  switch (status) {
    case "aprovado":
      return "Aprovado";
    case "pendente":
      return "Pendente";
    case "cancelado":
      return "Cancelado";
    case "rejeitado":
      return "Rejeitado";
    default:
      return status || "-";
  }
}

function formatCancellationStatusLabel(status) {
  switch (status) {
    case "solicitado":
      return "Solicitado";
    case "em_analise":
      return "Em analise";
    case "aprovado_total":
      return "Reembolso total aprovado";
    case "aprovado_parcial":
      return "Reembolso parcial aprovado";
    case "negado":
      return "Cancelamento negado";
    default:
      return "Sem solicitacao";
  }
}

function isPartnerPage() {
  return window.location.pathname.includes("/gestao/");
}

function isLoginPage() {
  return window.location.pathname.endsWith("login.html");
}

async function ensurePartnerAuth() {
  if (isLoginPage()) {
    return true;
  }

  const user = getPartnerUser();
  if (!user) {
    let authUser = null;
    try {
      authUser = await fetchPartnerMe();
    } catch (error) {
      authUser = null;
    }

    if (!authUser) {
      window.location.href = getPartnerLoginUrl();
      return false;
    }
    setPartnerUser(authUser);
  }

  return true;
}

let cachedEstablishments = null;
