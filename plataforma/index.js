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

async function initializePublicState() {
  if (!publicStatePromise) {
    publicStatePromise = (async () => {
      const response = await apiRequest("/api/session/public-state");
      publicStateCache = normalizePublicState(response?.data || {});
      return publicStateCache;
    })();
  }

  return publicStatePromise;
}

async function persistPublicState() {
  const response = await apiRequest("/api/session/public-state", {
    method: "PUT",
    body: JSON.stringify({
      state: publicStateCache,
    }),
  });

  publicStateCache = normalizePublicState(response?.data || publicStateCache);
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

async function recoverPartnerPassword(email, cnpj, novaSenha) {
  return apiRequest("/api/auth/partner/recover-password", {
    method: "POST",
    body: JSON.stringify({
      email,
      cnpj: normalizeDocument(cnpj),
      nova_senha: novaSenha
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

async function fetchClientOrders(idCliente) {
  if (!idCliente) {
    return [];
  }

  const response = await apiRequest(`/api/orders/client/${encodeURIComponent(idCliente)}`);
  return response?.data || [];
}

async function cancelClientOrder(idPedido, idCliente) {
  return apiRequest(`/api/orders/${encodeURIComponent(idPedido)}/cancel`, {
    method: "PATCH",
    body: JSON.stringify({
      id_cliente: Number(idCliente)
    }),
  });
}

function getStatusBadgeClass(status) {
  switch (status) {
    case "aguardando_pagamento":
      return "status-badge neutral";
    case "aberto":
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
      return "Aberto";
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
let currentRestaurantMenu = [];
let currentRestaurantId = null;
let currentRestaurantName = null;
let currentRestaurantData = null;

async function fetchEstablishments() {
  if (Array.isArray(cachedEstablishments)) {
    return cachedEstablishments;
  }

  const data = await apiGet("/api/public/establishments");
  cachedEstablishments = Array.isArray(data) ? data : [];
  return cachedEstablishments;
}

async function fetchEstablishment(id) {
  return apiGet(`/api/public/establishments/${encodeURIComponent(id)}`);
}

async function fetchEstablishmentMenu(id) {
  return apiGet(`/api/public/establishments/${encodeURIComponent(id)}/menu`);
}

function hasClientRegistration() {
  return Boolean(getPublicState().clienteId);
}

function markClientRegistrationDone() {
  publicStateCache.clienteCadastroConcluido = true;
  return persistPublicState();
}

function getClientId() {
  return getPublicState().clienteId;
}

function setClientId(id) {
  publicStateCache.clienteId = id ? String(id) : null;
  return persistPublicState();
}

async function fetchClientByEmail(email) {
  if (!email) {
    return null;
  }

  try {
    return await apiGet(`/api/public/clients?email=${encodeURIComponent(email)}`);
  } catch (error) {
    if (error.message.includes("404")) {
      return null;
    }
    throw error;
  }
}

async function createClient(profile) {
  const response = await apiRequest("/api/public/clients", {
    method: "POST",
    body: JSON.stringify(profile),
  });

  return response?.data || null;
}

function saveClientProfile(profile) {
  const current = getPerfil();
  const saved = {
    ...current,
    ...profile,
  };
  publicStateCache.perfil = saved;
  persistPublicState();
  return saved;
}

async function syncClientRegistration(profile) {
  if (!profile?.email) {
    throw new Error("Informe um email valido para concluir o cadastro.");
  }

  const existingClient = await fetchClientByEmail(profile.email);
  const client = existingClient || (await createClient(profile));

  if (!client?.id_cliente) {
    throw new Error("Nao foi possivel concluir o cadastro do cliente.");
  }

  await setClientId(client.id_cliente);
  await markClientRegistrationDone();
  saveClientProfile({
    ...profile,
    status: "Cliente cadastrado",
    resumo:
      "Seus dados estao salvos neste navegador para agilizar pedidos e acessos futuros.",
    pagamento: getPerfil().pagamento || "Nenhum metodo salvo",
    preferencias: [
      "Entrega padrao",
      "Dados salvos com seguranca local",
      "Checkout mais rapido",
      "Acesso automatico"
    ]
  });

  return client;
}

function normalizeText(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function formatCurrency(value) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function getInputValueByNames(form, names = []) {
  for (const name of names) {
    const field = form?.elements?.[name];

    if (!field) {
      continue;
    }

    if (typeof field.value === "string") {
      return field.value;
    }
  }

  return "";
}

function setupUiFeedback() {
  // Monta uma única vez a infraestrutura de modais e toasts.
  if (eatgoUiReady) {
    return;
  }

  const uiRoot = document.createElement("div");
  uiRoot.innerHTML = `
    <div class="eatgo-toast-area" id="eatgo-toast-area" aria-live="polite" aria-atomic="true"></div>
    <div class="eatgo-modal-overlay" id="eatgo-modal-overlay" hidden>
      <div class="eatgo-modal" role="dialog" aria-modal="true" aria-labelledby="eatgo-modal-title">
        <div class="eatgo-modal-topo">
          <p class="eatgo-modal-tag" id="eatgo-modal-tag">EatGo</p>
          <h2 id="eatgo-modal-title">Titulo</h2>
          <p id="eatgo-modal-message">Mensagem</p>
        </div>
        <div class="eatgo-modal-body" id="eatgo-modal-body"></div>
        <div class="eatgo-modal-acoes" id="eatgo-modal-acoes"></div>
      </div>
    </div>
  `;

  document.body.appendChild(uiRoot);
  eatgoUiReady = true;
}

function showToast(message, type = "info") {
  // Toast curto para feedback rápido.
  setupUiFeedback();

  const area = document.getElementById("eatgo-toast-area");
  if (!area) {
    return;
  }

  const toast = document.createElement("div");
  toast.className = `eatgo-toast eatgo-toast-${type}`;
  toast.textContent = message;
  area.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add("ativa");
  });

  window.setTimeout(() => {
    toast.classList.remove("ativa");
    window.setTimeout(() => toast.remove(), 220);
  }, 2600);
}

// Account widget removed; auth is handled using the existing registration modal flow.

function getRestaurantMenuItem(itemId) {
  return currentRestaurantMenu.find(
    (menuItem) => Number(menuItem.id_cardapio) === Number(itemId)
  );
}

function addItemToCart(menuItem, quantity = 1) {
  if (!menuItem) {
    return;
  }

  const currentCart = getCarrinho();
  const restaurantId = currentRestaurantId;
  const restaurantName = currentRestaurantName || "Estabelecimento";
  const restaurantData = currentRestaurantData || {};

  if (
    currentCart.length &&
    currentCart.some((item) => Number(item.id_estabelecimento) !== Number(restaurantId))
  ) {
    showAlert(
      "Seu carrinho já contém itens de outro estabelecimento. Limpe o carrinho antes de adicionar deste restaurante.",
      {
        title: "Restaurante diferente",
        tag: "Carrinho"
      }
    );
    return;
  }

  const price = Number(
    menuItem.preco_promocional != null && menuItem.preco_promocional !== ""
      ? menuItem.preco_promocional
      : menuItem.preco
  );

  const existingItem = currentCart.find(
    (item) => Number(item.id_cardapio) === Number(menuItem.id_cardapio)
  );

  if (existingItem) {
    existingItem.quantidade += quantity;
  } else {
    currentCart.push({
      id: String(menuItem.id_cardapio),
      id_cardapio: Number(menuItem.id_cardapio),
      id_estabelecimento: Number(restaurantId),
      restauranteNome: restaurantName,
      taxa_entrega: Number(restaurantData.taxa_entrega || 0),
      possui_entrega: Number(restaurantData.possui_entrega || 0),
      nome: menuItem.nome || "Item",
      descricao: menuItem.descricao || "",
      imagem: menuItem.imagem || "src/logo.png",
      precoNumero: price,
      quantidade,
      tempo: menuItem.tempo || "Tempo não disponível"
    });
  }

  setCarrinho(currentCart);
  renderCarrinho();
  showToast("Item adicionado ao carrinho.");
  return currentCart;
}

async function submitOrder() {
  const carrinho = getCarrinho();

  if (!carrinho.length) {
    await showAlert("Adicione pelo menos um item antes de finalizar a compra.", {
      title: "Carrinho vazio",
      tag: "Checkout"
    });
    return null;
  }

  let clienteId = Number(getClientId());
  if (!clienteId) {
    const perfil = await ensureClientRegistration();
    if (!perfil) {
      return null;
    }
    clienteId = Number(getClientId());
    if (!clienteId) {
      return null;
    }
  }

  const establishmentId = Number(carrinho[0].id_estabelecimento);
  if (
    carrinho.some(
      (item) => Number(item.id_estabelecimento) !== Number(establishmentId)
    )
  ) {
    await showAlert(
      "O carrinho deve conter itens de apenas um estabelecimento.",
      {
        title: "Carrinho inválido",
        tag: "Checkout"
      }
    );
    return null;
  }

  const tipo_recebimento =
    document.querySelector('input[name="tipo-recebimento"]:checked')?.value ||
    "entrega";

  const payload = {
    id_cliente: clienteId,
    id_estabelecimento: establishmentId,
    tipo_recebimento,
    forma_pagamento: "Mercado Pago",
    observacao: null,
    itens: carrinho.map((item) => ({
      id_cardapio: Number(item.id_cardapio),
      quantidade: Number(item.quantidade)
    }))
  };

  return apiRequest("/api/orders", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

function setupRestaurantRegistrationPage() {
  const form = document.querySelector(".cadastro-form");
  if (!form) {
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    window.location.href = "central-ajuda.html#central-ajuda-form";
  });
}

function openModal({ title, message, tag = "EatGo", body = null, actions = [] }) {
  // Modal base reutilizado por alertas, prompts e confirmações.
  setupUiFeedback();

  const overlay = document.getElementById("eatgo-modal-overlay");
  const tagEl = document.getElementById("eatgo-modal-tag");
  const titleEl = document.getElementById("eatgo-modal-title");
  const messageEl = document.getElementById("eatgo-modal-message");
  const bodyEl = document.getElementById("eatgo-modal-body");
  const actionsEl = document.getElementById("eatgo-modal-acoes");

  if (!overlay || !tagEl || !titleEl || !messageEl || !bodyEl || !actionsEl) {
    return () => {};
  }

  tagEl.textContent = tag;
  titleEl.textContent = title;
  messageEl.textContent = message || "";
  bodyEl.innerHTML = "";
  actionsEl.innerHTML = "";

  if (body) {
    bodyEl.appendChild(body);
  }

  overlay.hidden = false;
  document.body.classList.add("eatgo-modal-aberto");

  const close = () => {
    overlay.hidden = true;
    bodyEl.innerHTML = "";
    actionsEl.innerHTML = "";
    document.body.classList.remove("eatgo-modal-aberto");
  };

  actions.forEach((action, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = action.variant === "secondary"
      ? "eatgo-modal-btn eatgo-modal-btn-secundario"
      : "eatgo-modal-btn eatgo-modal-btn-primario";
    button.textContent = action.label;
    button.addEventListener("click", () => action.onClick(close));
    actionsEl.appendChild(button);

    if (index === 0) {
      window.setTimeout(() => button.focus(), 0);
    }
  });

  return close;
}

function showAlert(message, options = {}) {
  return new Promise((resolve) => {
    openModal({
      title: options.title || "Aviso",
      message,
      tag: options.tag || "EatGo",
      actions: [
        {
          label: options.buttonLabel || "Fechar",
          onClick: (close) => {
            close();
            resolve(true);
          },
        },
      ],
    });
  });
}

function showConfirm(message, options = {}) {
  return new Promise((resolve) => {
    openModal({
      title: options.title || "Confirmar ação",
      message,
      tag: options.tag || "EatGo",
      actions: [
        {
          label: options.confirmLabel || "Confirmar",
          onClick: (close) => {
            close();
            resolve(true);
          },
        },
        {
          label: options.cancelLabel || "Cancelar",
          variant: "secondary",
          onClick: (close) => {
            close();
            resolve(false);
          },
        },
      ],
    });
  });
}

function showPrompt({ title, message, label, defaultValue = "", tag = "Perfil" }) {
  return new Promise((resolve) => {
    const wrapper = document.createElement("label");
    wrapper.className = "eatgo-modal-campo";

    const labelEl = document.createElement("span");
    labelEl.textContent = label;

    const input = document.createElement("input");
    input.type = "text";
    input.value = defaultValue;
    input.placeholder = label;

    wrapper.append(labelEl, input);

    const finish = (value, close) => {
      close();
      resolve(value);
    };

    openModal({
      title,
      message,
      tag,
      body: wrapper,
      actions: [
        {
          label: "Salvar",
          onClick: (close) => finish(input.value, close),
        },
        {
          label: "Cancelar",
          variant: "secondary",
          onClick: (close) => finish(null, close),
        },
      ],
    });

    window.setTimeout(() => {
      input.focus();
      input.select();
    }, 0);

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        const overlay = document.getElementById("eatgo-modal-overlay");
        if (!overlay?.hidden) {
          const close = () => {
            overlay.hidden = true;
            document.getElementById("eatgo-modal-body").innerHTML = "";
            document.getElementById("eatgo-modal-acoes").innerHTML = "";
            document.body.classList.remove("eatgo-modal-aberto");
          };
          finish(input.value, close);
        }
      }
    });
  });
}

function showClientRegistrationModal() {
  return new Promise((resolve) => {
    const wrapper = document.createElement("div");
    wrapper.className = "eatgo-modal-form-grid";

    const fields = [
      { key: "nome", label: "Nome completo", type: "text", placeholder: "Seu nome" },
      { key: "email", label: "Email", type: "email", placeholder: "voce@email.com" },
      { key: "telefone", label: "Telefone", type: "text", placeholder: "(11) 99999-0000" },
      { key: "endereco", label: "Endereco", type: "text", placeholder: "Rua, numero e bairro" }
    ];

    const inputs = {};

    fields.forEach((field) => {
      const label = document.createElement("label");
      label.className = "eatgo-modal-campo";

      const span = document.createElement("span");
      span.textContent = field.label;

      const input = document.createElement("input");
      input.type = field.type;
      input.placeholder = field.placeholder;
      input.required = true;

      label.append(span, input);
      wrapper.appendChild(label);
      inputs[field.key] = input;
    });

    const finish = (value, close) => {
      close();
      resolve(value);
    };

    openModal({
      title: "Complete seu cadastro",
      message:
        "Voce so precisa preencher seus dados uma vez. Depois disso, a plataforma lembrara automaticamente de voce neste navegador.",
      tag: "Conta",
      body: wrapper,
      actions: [
        {
          label: "Salvar cadastro",
          onClick: (close) => {
            const payload = {
              nome: inputs.nome.value.trim(),
              email: inputs.email.value.trim(),
              telefone: inputs.telefone.value.trim(),
              endereco: inputs.endereco.value.trim()
            };

            if (Object.values(payload).some((value) => !value)) {
              showToast("Preencha todos os campos para continuar.", "error");
              return;
            }

            finish(payload, close);
          }
        },
        {
          label: "Cancelar",
          variant: "secondary",
          onClick: (close) => {
            close();
            resolve(null);
          }
        }
      ]
    });

    window.setTimeout(() => inputs.nome.focus(), 0);
  });
}

function getPerfil() {
  return { ...defaultPerfil, ...(getPublicState().perfil || {}) };
}

function getAcessibilidade() {
  return {
    ...defaultAcessibilidade,
    ...(getPublicState().acessibilidade || {}),
  };
}

function getCarrinho() {
  return Array.isArray(getPublicState().carrinho) ? getPublicState().carrinho : [];
}

function setCarrinho(carrinho) {
  publicStateCache.carrinho = Array.isArray(carrinho) ? carrinho : [];
  persistPublicState();
}

function getRestaurantesCadastrados() {
  return Array.isArray(getPublicState().restaurantesCadastrados)
    ? getPublicState().restaurantesCadastrados
    : [];
}

function updateOrderCount(incremento) {
  const perfil = getPerfil();
  perfil.pedidosMes += incremento;
  publicStateCache.perfil = perfil;
  persistPublicState();
}

function canClientCancelOrder(order) {
  return ["aguardando_pagamento", "aberto", "confirmado"].includes(order.status);
}

function renderProfileOrders(orders) {
  const list = document.getElementById("perfil-pedidos-lista");
  const emptyState = document.getElementById("perfil-pedidos-vazio");

  if (!list || !emptyState) {
    return;
  }

  if (!orders.length) {
    list.innerHTML = "";
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;
  list.innerHTML = orders
    .map(
      (order) => `
        <article class="perfil-pedido-card">
          <div class="perfil-pedido-topo">
            <div>
              <strong>Pedido #${order.id_pedido}</strong>
              <p>${order.estabelecimento_nome || "Estabelecimento"} • ${getDateString(order.criado_em)} às ${getTimeString(order.criado_em)}</p>
            </div>
            ${getOrderBadge(order)}
          </div>
          <div class="perfil-pedido-meta">
            <span>Total: ${formatCurrency(Number(order.total || 0))}</span>
            <span>Pagamento: ${order.pagamento_status}</span>
            <span>${order.tipo_recebimento === "entrega" ? "Entrega" : "Retirada"}</span>
          </div>
          <div class="card-acoes">
            ${canClientCancelOrder(order) ? `<button type="button" class="btn-secundario" data-client-cancel-order="${order.id_pedido}">Cancelar pedido</button>` : ""}
          </div>
        </article>
      `
    )
    .join("");
}

async function ensureClientRegistration() {
  if (hasClientRegistration()) {
    return getPerfil();
  }

  const perfilSalvo = getPerfil();
  const perfilJaPreenchido =
    perfilSalvo.email &&
    perfilSalvo.email !== defaultPerfil.email &&
    perfilSalvo.nome &&
    perfilSalvo.nome !== defaultPerfil.nome;

  const cadastro = perfilJaPreenchido
    ? {
        nome: perfilSalvo.nome,
        email: perfilSalvo.email,
        telefone: perfilSalvo.telefone,
        endereco: perfilSalvo.endereco
      }
    : await showClientRegistrationModal();

  if (!cadastro) {
    return null;
  }

  try {
    await syncClientRegistration(cadastro);
    showToast("Cadastro salvo com sucesso.");
    return getPerfil();
  } catch (error) {
    showToast(error.message || "Nao foi possivel salvar seu cadastro.", "error");
    return null;
  }
}

function injectAccessibilityStyles() {
  if (document.getElementById("eatgo-accessibility-style")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "eatgo-accessibility-style";
  style.textContent = `
    html.acessibilidade-fonte-ampliada {
      font-size: 112.5%;
    }

    html.acessibilidade-teclado *:focus-visible {
      outline: 3px solid #f06000 !important;
      outline-offset: 3px !important;
    }

    html.acessibilidade-movimento-reduzido *,
    html.acessibilidade-movimento-reduzido *::before,
    html.acessibilidade-movimento-reduzido *::after {
      animation: none !important;
      transition: none !important;
      scroll-behavior: auto !important;
    }

    html.acessibilidade-contraste body {
      background: #000 !important;
      color: #fff !important;
    }

    html.acessibilidade-contraste header,
    html.acessibilidade-contraste footer,
    html.acessibilidade-contraste .card,
    html.acessibilidade-contraste .carrinho-section,
    html.acessibilidade-contraste .checkout-section,
    html.acessibilidade-contraste .perfil-card,
    html.acessibilidade-contraste .perfil-resumo,
    html.acessibilidade-contraste .acessibilidade-card,
    html.acessibilidade-contraste .cadastro-card,
    html.acessibilidade-contraste .restaurante-cardapio,
    html.acessibilidade-contraste .opcao,
    html.acessibilidade-contraste .opcao-entrega,
    html.acessibilidade-contraste .cardapio-opcao,
    html.acessibilidade-contraste .perfil-dado,
    html.acessibilidade-contraste .acessibilidade-opcao,
    html.acessibilidade-contraste .carrinho-item {
      background: #111 !important;
      color: #fff !important;
      border-color: rgba(255, 255, 255, 0.22) !important;
      box-shadow: none !important;
    }

    html.acessibilidade-contraste h1,
    html.acessibilidade-contraste h2,
    html.acessibilidade-contraste h3,
    html.acessibilidade-contraste strong,
    html.acessibilidade-contraste span,
    html.acessibilidade-contraste p,
    html.acessibilidade-contraste label,
    html.acessibilidade-contraste a,
    html.acessibilidade-contraste button {
      color: #fff !important;
    }
  `;

  document.head.appendChild(style);
}

function applyAccessibilityPreferences() {
  // Aplica no documento as preferências visuais salvas do usuário.
  injectAccessibilityStyles();

  const accessibility = getAcessibilidade();
  const html = document.documentElement;

  html.classList.toggle("acessibilidade-contraste", accessibility.contraste);
  html.classList.toggle(
    "acessibilidade-fonte-ampliada",
    accessibility["fonte-ampliada"]
  );
  html.classList.toggle("acessibilidade-teclado", accessibility.teclado);
  html.classList.toggle(
    "acessibilidade-movimento-reduzido",
    accessibility["movimento-reduzido"]
  );
}

function setupAccessibilityPage() {
  const inputs = document.querySelectorAll("[data-accessibility]");

  if (!inputs.length) {
    return;
  }

  const accessibility = getAcessibilidade();

  inputs.forEach((input) => {
    const key = input.dataset.accessibility;
    input.checked = Boolean(accessibility[key]);

    input.addEventListener("change", () => {
      accessibility[key] = input.checked;
      publicStateCache.acessibilidade = accessibility;
      persistPublicState();
      applyAccessibilityPreferences();
    });
  });
}

function getHomeCards() {
  return document.querySelectorAll("#cards-container .card");
}

function mostrarCategoria(categoria) {
  const botoesCategoria = document.querySelectorAll(".opcao");
  const cards = getHomeCards();
  const sectionTag = document.getElementById("section-tag");
  const sectionTitle = document.getElementById("section-title");

  if (!botoesCategoria.length || !sectionTag || !sectionTitle) {
    return;
  }

  currentCategory = categoria;

  const textosCategoria = {
    restaurantes: {
      tag: "Marketplace",
      titulo: "Estabelecimentos serao carregados do banco de dados",
    },
    comidas: {
      tag: "Marketplace",
      titulo: "Comidas serao carregadas do banco de dados",
    },
    bebidas: {
      tag: "Marketplace",
      titulo: "Bebidas serao carregadas do banco de dados",
    },
  };

  botoesCategoria.forEach((botao) => {
    const ativa = botao.dataset.categoria === categoria;
    botao.classList.toggle("ativa", ativa);
    botao.setAttribute("aria-pressed", String(ativa));
  });

  cards.forEach((card) => {
    card.hidden = card.dataset.categoria !== categoria;
  });

  sectionTag.textContent = textosCategoria[categoria].tag;
  sectionTitle.textContent = textosCategoria[categoria].titulo;
}

async function renderizarCardsHome() {
  const container = document.getElementById("cards-container");
  const promotionsContainer = document.getElementById("listaPromocoes");
  if (!container) {
    return;
  }

  try {
    const restaurantes = await fetchEstablishments();

    if (!restaurantes.length) {
      container.innerHTML = `
        <article class="card card-home-vazio" data-categoria="restaurantes">
          <div class="card-conteudo">
            <h3>Nenhum estabelecimento disponível</h3>
            <p>Os estabelecimentos e cardápios deverão ser carregados a partir do banco de dados.</p>
            <div class="card-acoes">
              <a class="btn-primario" href="central-ajuda.html#central-ajuda-form">Solicitar parceria</a>
            </div>
          </div>
        </article>
      `;
      mostrarCategoria("restaurantes");
      return;
    }

    container.innerHTML = restaurantes
      .map((restaurante) => `
        <article class="card" data-categoria="restaurantes">
          <img src="src/logo.png" alt="${restaurante.nome || "Estabelecimento"}">
          <div class="card-conteudo">
            <h3>${restaurante.nome || "Estabelecimento"}</h3>
            <p>${restaurante.descricao || "Descrição não disponível."}</p>
            <div class="card-acoes">
              <a class="btn-primario" href="restaurantes.html?id=${restaurante.id_estabelecimento}">Acessar</a>
            </div>
          </div>
        </article>
      `)
      .join("");

    if (promotionsContainer) {
      promotionsContainer.innerHTML = restaurantes
        .slice(0, 3)
        .map((restaurante, index) => `
          <article class="card">
            <img src="${["src/caseiras.png", "src/massas.png", "src/churrasco.png"][index] || "src/logo.png"}" alt="${restaurante.nome || "Promocao EatGo"}">
            <div class="card-conteudo">
              <h3>${restaurante.nome || "Estabelecimento"}</h3>
              <p>${restaurante.categoria || "Oferta especial do dia"}</p>
              <div class="card-acoes">
                <a class="btn-primario" href="restaurantes.html?id=${restaurante.id_estabelecimento}">Ver oferta</a>
              </div>
            </div>
          </article>
        `)
        .join("");
    }

    mostrarCategoria("restaurantes");
  } catch (error) {
    console.error(error);
    container.innerHTML = `
      <article class="card card-home-vazio" data-categoria="restaurantes">
        <div class="card-conteudo">
          <h3>Erro ao carregar estabelecimentos</h3>
          <p>Não foi possível obter os dados do banco de dados. Verifique se o backend está rodando.</p>
        </div>
      </article>
    `;
    if (promotionsContainer) {
      promotionsContainer.innerHTML = `
        <article class="card card-home-vazio">
          <div class="card-conteudo">
            <h3>Promoções indisponíveis</h3>
            <p>Assim que o backend responder, as ofertas do dia aparecem aqui.</p>
          </div>
        </article>
      `;
    }
    showToast("Não foi possível carregar os estabelecimentos do backend.", "error");
  }
}

function setupCategorias() {
  const botoesCategoria = document.querySelectorAll(".opcao");

  if (!botoesCategoria.length) {
    return;
  }

  botoesCategoria.forEach((botao) => {
    botao.addEventListener("click", () => {
      mostrarCategoria(botao.dataset.categoria);
    });
  });

  renderizarCardsHome();
}

function setupSearch() {
  const form = document.querySelector(".search-form");
  const input = form?.querySelector(".search");
  const sectionTag = document.getElementById("section-tag");
  const sectionTitle = document.getElementById("section-title");

  if (!form || !input || !sectionTag || !sectionTitle) {
    return;
  }

  function filterCards() {
    const query = normalizeText(input.value.trim());
    const cards = getHomeCards();

    if (!query) {
      mostrarCategoria(currentCategory);
      return;
    }

    let visibleCount = 0;

    cards.forEach((card) => {
      const content = normalizeText(card.textContent);
      const matches = content.includes(query);
      card.hidden = !matches;

      if (matches) {
        visibleCount += 1;
      }
    });

    sectionTag.textContent = "Busca";
    sectionTitle.textContent =
      visibleCount > 0
        ? `Resultados para "${input.value.trim()}"`
        : `Nenhum resultado para "${input.value.trim()}"`;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    filterCards();
  });

  input.addEventListener("input", () => {
    if (!input.value.trim()) {
      mostrarCategoria(currentCategory);
    }
  });
}

async function renderizarPaginaRestaurante() {
  // Renderiza a página de estabelecimento a partir do id recebido na URL.
  const nomeEl = document.getElementById("restaurante-nome");
  const cardapioEl = document.getElementById("restaurante-cardapio-lista");
  const capaEl = document.getElementById("restaurante-capa");
  const descricaoEl = document.getElementById("restaurante-descricao");
  const enderecoEl = document.getElementById("restaurante-endereco");
  const tempoEl = document.getElementById("restaurante-tempo");
  const categoriaEl = document.getElementById("restaurante-categoria");
  const horarioEl = document.getElementById("restaurante-horario");
  const avaliacaoEl = document.getElementById("restaurante-avaliacao");

  if (
    !nomeEl ||
    !cardapioEl ||
    !capaEl ||
    !descricaoEl ||
    !enderecoEl ||
    !tempoEl ||
    !categoriaEl ||
    !horarioEl ||
    !avaliacaoEl
  ) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const restauranteId = params.get("id");

  if (!restauranteId) {
    document.title = "Estabelecimento | EatGo";
    capaEl.src = "src/logo.png";
    capaEl.alt = "Estabelecimento";
    nomeEl.textContent = "Estabelecimento não encontrado";
    descricaoEl.textContent =
      "Os dados do estabelecimento e do cardápio devem ser carregados a partir do banco de dados.";
    enderecoEl.textContent = "Endereço não disponível";
    tempoEl.textContent = "Tempo não disponível";
    categoriaEl.textContent = "Categoria não disponível";
    horarioEl.textContent = "Horário não disponível";
    avaliacaoEl.textContent = "Avaliação não disponível";
    cardapioEl.innerHTML = `
      <article class="card card-cardapio">
        <div class="card-conteudo">
          <h3>Cardápio não disponível</h3>
          <p>O ID do estabelecimento está ausente ou inválido.</p>
        </div>
      </article>
    `;
    return;
  }

  try {
    const restaurante = await fetchEstablishment(restauranteId);
    const cardapio = await fetchEstablishmentMenu(restauranteId);

    document.title = `${restaurante.nome || "Estabelecimento"} | EatGo`;
    capaEl.src = "src/logo.png";
    capaEl.alt = restaurante.nome || "Estabelecimento";
    nomeEl.textContent = restaurante.nome || "Estabelecimento";
    descricaoEl.textContent =
      restaurante.descricao || "Cardápio aguardando dados do banco.";
    enderecoEl.textContent = restaurante.endereco || "Endereço não disponível";
    tempoEl.textContent = restaurante.possui_entrega === 1 ? "Entrega disponível" : "Sem entrega";
    categoriaEl.textContent = restaurante.categoria || "Categoria não disponível";
    horarioEl.textContent = restaurante.horario_funcionamento || "Horário não disponível";
    avaliacaoEl.textContent = "Avaliação não disponível";

    currentRestaurantMenu = cardapio;
    currentRestaurantId = Number(restauranteId);
    currentRestaurantName = restaurante.nome || "Estabelecimento";
    currentRestaurantData = restaurante;

    if (!Array.isArray(cardapio) || !cardapio.length) {
      cardapioEl.innerHTML = `
        <article class="card card-cardapio">
          <div class="card-conteudo">
            <h3>Cardápio vazio</h3>
            <p>Não há itens disponíveis para este estabelecimento no momento.</p>
          </div>
        </article>
      `;
      return;
    }

    cardapioEl.innerHTML = cardapio
      .map((item) => `
        <article class="card card-cardapio">
          <div class="card-conteudo">
            <h3>${item.nome || "Item"}</h3>
            <p>${item.descricao || "Sem descrição."}</p>
            <p class="cardapio-preco">${formatCurrency(Number(item.preco_promocional ?? item.preco ?? 0))}</p>
            ${item.preco_promocional ? `<p class="cardapio-preco-promocional">${formatCurrency(Number(item.preco))}</p>` : ""}
            <div class="card-acoes">
              <button type="button" class="btn-primario" data-action="pedir-agora" data-item-id="${item.id_cardapio}">Pedir agora</button>
              <button type="button" class="btn-secundario" data-action="adicionar-carrinho" data-item-id="${item.id_cardapio}">Adicionar ao carrinho</button>
            </div>
          </div>
        </article>
      `)
      .join("");

    cardapioEl.onclick = (event) => {
      const button = event.target.closest("button[data-action][data-item-id]");
      if (!button) {
        return;
      }

      const itemId = Number(button.dataset.itemId);
      const item = currentRestaurantMenu.find(
        (menuItem) => Number(menuItem.id_cardapio) === itemId
      );

      if (!item) {
        return;
      }

      if (button.dataset.action === "adicionar-carrinho") {
        addItemToCart(item);
        return;
      }

      if (button.dataset.action === "pedir-agora") {
        addItemToCart(item);
        window.location.href = "carrinho.html";
      }
    };
  } catch (error) {
    console.error(error);
    document.title = "Estabelecimento | EatGo";
    capaEl.src = "src/logo.png";
    capaEl.alt = "Estabelecimento";
    nomeEl.textContent = "Estabelecimento indisponível";
    descricaoEl.textContent =
      "Não foi possível carregar os dados do estabelecimento. Verifique a conexão com o backend.";
    enderecoEl.textContent = "Endereço não disponível";
    tempoEl.textContent = "Tempo não disponível";
    categoriaEl.textContent = "Categoria não disponível";
    horarioEl.textContent = "Horário não disponível";
    avaliacaoEl.textContent = "Avaliação não disponível";
    cardapioEl.innerHTML = `
      <article class="card card-cardapio">
        <div class="card-conteudo">
          <h3>Erro ao carregar cardápio</h3>
          <p>Não foi possível obter as informações do banco de dados.</p>
        </div>
      </article>
    `;
    showToast("Não foi possível carregar o estabelecimento do backend.", "error");
  }
}

function setupLoginPage() {
  const loginForm = document.getElementById("partner-login-form");
  const recoveryForm = document.getElementById("partner-recovery-form");
  const recoveryToggle = document.getElementById("toggle-recovery-form");
  if (!loginForm) {
    return;
  }

  fetchPartnerMe()
    .then((user) => {
      if (user) {
        setPartnerUser(user);
        window.location.href = "../gestao/index.html";
      }
    })
    .catch(() => {});

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = loginForm.email.value.trim();
    const senha = loginForm.senha.value;
    const submitButton = loginForm.querySelector("button[type='submit']");

    submitButton.disabled = true;

    try {
      await loginPartner(email, senha);
      window.location.href = "../gestao/index.html";
    } catch (error) {
      await showAlert(error.message || "Não foi possível realizar o login.", {
        title: "Falha no login",
        tag: "Gestao"
      });
    } finally {
      submitButton.disabled = false;
    }
  });

  recoveryToggle?.addEventListener("click", () => {
    const expanded = recoveryToggle.getAttribute("aria-expanded") === "true";
    recoveryToggle.setAttribute("aria-expanded", String(!expanded));
    recoveryForm.hidden = expanded;
  });

  recoveryForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = recoveryForm.email_recuperacao.value.trim();
    const cnpj = recoveryForm.cnpj.value.trim();
    const novaSenha = recoveryForm.nova_senha.value;
    const submitButton = recoveryForm.querySelector("button[type='submit']");

    submitButton.disabled = true;

    try {
      await recoverPartnerPassword(email, cnpj, novaSenha);
      recoveryForm.reset();
      recoveryForm.hidden = true;
      recoveryToggle?.setAttribute("aria-expanded", "false");
      await showAlert("Senha redefinida com sucesso. Faça login com a nova senha.", {
        title: "Acesso recuperado",
        tag: "Gestao"
      });
    } catch (error) {
      await showAlert(error.message || "Nao foi possivel redefinir a senha.", {
        title: "Falha na recuperacao",
        tag: "Gestao"
      });
    } finally {
      submitButton.disabled = false;
    }
  });
}

function renderPartnerHeader() {
  const user = getPartnerUser();
  if (!user) {
    return;
  }

  const dashboardTitle = document.getElementById("dashboard-title");
  const dashboardRestaurant = document.getElementById("dashboard-restaurante");

  if (dashboardTitle) {
    dashboardTitle.textContent = `Resumo do estabelecimento ${user.estabelecimento_nome}`;
  }

  if (dashboardRestaurant) {
    dashboardRestaurant.textContent = `Bem-vindo ao painel de gestão de ${user.estabelecimento_nome}.`;
  }
}

function getDateString(dateString) {
  return new Date(dateString).toLocaleDateString("pt-BR");
}

function getTimeString(dateString) {
  return new Date(dateString).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function getOrderBadge(order) {
  return `<span class="${getStatusBadgeClass(order.status)}">${formatStatusLabel(order.status)}</span>`;
}

async function setupGestaoDashboard() {
  const [establishment, orders] = await Promise.all([
    fetchManagementEstablishment(),
    fetchManagementOrders(),
  ]);

  renderPartnerHeader();

  const today = new Date().toDateString();
  const todayOrders = orders.filter((order) => new Date(order.criado_em).toDateString() === today);
  const paidTodayOrders = todayOrders.filter((order) => order.pagamento_status === "aprovado");
  const totalRevenue = paidTodayOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const ongoingOrders = paidTodayOrders.filter((order) => !["entregue", "cancelado"].includes(order.status)).length;
  const averageTicket = paidTodayOrders.length ? totalRevenue / paidTodayOrders.length : 0;

  const cards = document.querySelectorAll(".gestao-card-metrica");
  if (cards.length >= 3) {
    cards[0].querySelector("strong").textContent = formatCurrency(totalRevenue);
    cards[0].querySelector("p").textContent = `${paidTodayOrders.length} pedidos pagos hoje`;

    cards[1].querySelector("strong").textContent = String(ongoingOrders).padStart(2, "0");
    cards[1].querySelector("p").textContent = `${ongoingOrders} pedidos em andamento`;

    cards[2].querySelector("strong").textContent = formatCurrency(averageTicket);
    cards[2].querySelector("p").textContent = "Ticket médio do dia";
  }

  const statusItems = document.querySelectorAll(".gestao-status-item");
  if (statusItems.length >= 3) {
    const prepareCount = orders.filter((order) => order.pagamento_status === "aprovado" && order.status === "preparando").length;
    const deliveryCount = orders.filter((order) => order.pagamento_status === "aprovado" && order.status === "saiu_para_entrega").length;
    const attentionCount = orders.filter((order) => order.pagamento_status === "aprovado" && ["aberto", "confirmado"].includes(order.status)).length;

    statusItems[0].querySelector("strong").textContent = "Em preparo";
    statusItems[0].querySelector("p").textContent = `${prepareCount} pedidos em produção`;
    statusItems[0].querySelector("b").textContent = String(prepareCount);

    statusItems[1].querySelector("strong").textContent = "Saiu para entrega";
    statusItems[1].querySelector("p").textContent = `${deliveryCount} pedidos com entregadores`;
    statusItems[1].querySelector("b").textContent = String(deliveryCount);

    statusItems[2].querySelector("strong").textContent = "Precisam de atenção";
    statusItems[2].querySelector("p").textContent = `${attentionCount} pedidos em progresso`;
    statusItems[2].querySelector("b").textContent = String(attentionCount);
  }
}

function createOrderRow(order) {
  return `
    <div class="gestao-tabela-linha">
      <span>#${order.id_pedido}</span>
      <span>
        ${order.cliente_nome}
        ${order.tipo_recebimento === "entrega" ? `<br><small>${order.cliente_endereco || "Endereço não disponível"}</small>` : ""}
      </span>
      <span>${order.tipo_recebimento === "entrega" ? "Delivery" : "Retirada"}</span>
      <span>${formatCurrency(Number(order.total || 0))}</span>
      <span>
        ${getOrderBadge(order)}
        <br><small>Pagamento: ${order.pagamento_status}</small>
      </span>
      <span class="card-acoes">
        <button class="btn-primario" type="button" data-accept-order="${order.id_pedido}">Aceitar</button>
        <button class="btn-secundario" type="button" data-reject-order="${order.id_pedido}">Recusar</button>
      </span>
    </div>
  `;
}

async function setupGestaoPedidos() {
  const orders = await fetchManagementOrders();
  const newOrders = orders.filter(
    (order) => order.status === "aberto" && order.pagamento_status === "aprovado"
  );
  const table = document.getElementById("pedidos-tabela");
  if (!table) {
    return;
  }

  if (!newOrders.length) {
    table.innerHTML = `
      <div class="gestao-tabela-linha gestao-tabela-head">
        <span>Pedido</span>
        <span>Cliente</span>
        <span>Canal</span>
        <span>Total</span>
        <span>Status</span>
        <span>Ações</span>
      </div>
      <div class="gestao-tabela-linha">
        <span colspan="6">Nenhum pedido novo encontrado.</span>
      </div>
    `;
    return;
  }

  table.innerHTML = `
    <div class="gestao-tabela-linha gestao-tabela-head">
      <span>Pedido</span>
      <span>Cliente</span>
      <span>Canal</span>
      <span>Total</span>
      <span>Status</span>
      <span>Ações</span>
    </div>
    ${newOrders.map(createOrderRow).join("")}
  `;

  table.querySelectorAll("[data-accept-order]").forEach((button) => {
    button.addEventListener("click", async () => {
      const orderId = button.dataset.acceptOrder;
      try {
        await updateManagementOrderStatus(orderId, "confirmado");
        showToast("Pedido confirmado com sucesso.", "success");
      } catch (error) {
        console.error(error);
        showToast("Erro ao confirmar o pedido.", "error");
      }
      await setupGestaoPedidos();
    });
  });

  table.querySelectorAll("[data-reject-order]").forEach((button) => {
    button.addEventListener("click", async () => {
      const orderId = button.dataset.rejectOrder;
      try {
        await updateManagementOrderStatus(orderId, "cancelado");
        showToast("Pedido recusado com sucesso.", "success");
      } catch (error) {
        console.error(error);
        showToast("Erro ao recusar o pedido.", "error");
      }
      await setupGestaoPedidos();
    });
  });
}

async function setupGestaoVendas() {
  const orders = await fetchManagementOrders();
  const paidOrders = orders.filter((order) => order.pagamento_status === "aprovado");
  const totalRevenue = paidOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const channelCounts = paidOrders.reduce(
    (acc, order) => {
      if (order.tipo_recebimento === "entrega") acc.delivery += 1;
      else acc.pickup += 1;
      return acc;
    },
    { delivery: 0, pickup: 0 }
  );

  const peakHour = paidOrders.reduce((acc, order) => {
    const hour = new Date(order.criado_em).getHours();
    acc[hour] = (acc[hour] || 0) + 1;
    return acc;
  }, {});

  const bestHour = Object.entries(peakHour).sort((a, b) => b[1] - a[1])[0];
  const hourLabel = bestHour ? `${bestHour[0]}h - ${Number(bestHour[0]) + 1}h` : "-";

  const cards = document.querySelectorAll(".gestao-card-metrica");
  if (cards.length >= 3) {
    cards[0].querySelector("strong").textContent = formatCurrency(totalRevenue);
    cards[0].querySelector("p").textContent = `${paidOrders.length} pedidos pagos no período`;

    cards[1].querySelector("strong").textContent = channelCounts.delivery >= channelCounts.pickup ? "Delivery" : "Retirada";
    cards[1].querySelector("p").textContent = `${Math.max(channelCounts.delivery, channelCounts.pickup)} pedidos`;

    cards[2].querySelector("strong").textContent = hourLabel;
    cards[2].querySelector("p").textContent = "Horário de maior demanda";
  }

  const recentOrders = paidOrders.slice(0, 4);
  const tabela = document.querySelector(".gestao-tabela");
  if (!tabela) {
    return;
  }

  tabela.innerHTML = `
    <div class="gestao-tabela-linha gestao-tabela-head">
      <span>Pedido</span>
      <span>Cliente</span>
      <span>Canal</span>
      <span>Total</span>
      <span>Status</span>
    </div>
    ${recentOrders
      .map(
        (order) => `
          <div class="gestao-tabela-linha">
            <span>#${order.id_pedido}</span>
            <span>${order.cliente_nome}</span>
            <span>${order.tipo_recebimento === "entrega" ? "Delivery" : "Retirada"}</span>
            <span>${formatCurrency(Number(order.total || 0))}</span>
            <span class="${getStatusBadgeClass(order.status)}">${formatStatusLabel(order.status)}</span>
          </div>
        `
      )
      .join("")}
  `;
}

async function setupGestaoEntregas() {
  const orders = await fetchManagementOrders();
  const paidOrders = orders.filter((order) => order.pagamento_status === "aprovado");
  const atrasoCount = paidOrders.filter((order) => order.status === "aberto").length;
  const atencaoCount = paidOrders.filter((order) => ["confirmado", "preparando"].includes(order.status)).length;
  const noPrazoCount = paidOrders.filter((order) => ["saiu_para_entrega", "entregue"].includes(order.status)).length;

  const statusItems = document.querySelectorAll(".gestao-status-item");
  if (statusItems.length >= 3) {
    statusItems[0].querySelector("strong").textContent = "Atrasado";
    statusItems[0].querySelector("p").textContent = `${atrasoCount} pedidos aguardando ação`;
    statusItems[0].querySelector("b").textContent = String(atrasoCount);

    statusItems[1].querySelector("strong").textContent = "Atenção";
    statusItems[1].querySelector("p").textContent = `${atencaoCount} pedidos em preparação`;
    statusItems[1].querySelector("b").textContent = String(atencaoCount);

    statusItems[2].querySelector("strong").textContent = "No prazo";
    statusItems[2].querySelector("p").textContent = `${noPrazoCount} pedidos em rota ou entregues`;
    statusItems[2].querySelector("b").textContent = String(noPrazoCount);
  }

  const entregues = paidOrders.filter((order) => order.status === "entregue");
  const tabela = document.querySelector(".gestao-tabela");
  if (!tabela) {
    return;
  }

  tabela.innerHTML = `
    <div class="gestao-tabela-linha gestao-tabela-head">
      <span>Pedido</span>
      <span>Cliente</span>
      <span>Entregador</span>
      <span>Previsão</span>
      <span>Status</span>
    </div>
    ${entregues
      .map(
        (order) => `
          <div class="gestao-tabela-linha">
            <span>#${order.id_pedido}</span>
            <span>${order.cliente_nome}</span>
            <span>Equipe</span>
            <span>${getTimeString(order.criado_em)}</span>
            <span class="status-badge success">Concluída</span>
          </div>
        `
      )
      .join("")}
  `;
}

async function setupGestaoCardapio() {
  const tabela = document.getElementById("cardapio-tabela");
  const refreshButton = document.getElementById("atualizar-cardapio-button");
  const form = document.getElementById("cardapio-form");
  const formTitle = document.getElementById("cardapio-form-title");
  const formText = document.getElementById("cardapio-form-text");
  const submitButton = document.getElementById("cardapio-salvar-button");
  const editButton = document.getElementById("cardapio-editar-button");
  const cancelEditButton = document.getElementById("cardapio-cancelar-edicao-button");

  if (!tabela) {
    return;
  }

  let items = [];
  let editingItemId = null;

  function resetForm() {
    editingItemId = null;
    form?.reset();

    if (form?.ativo) {
      form.ativo.checked = true;
    }

    if (formTitle) {
      formTitle.textContent = "Faça mudanças no menu atual";
    }

    if (formText) {
      formText.textContent = "Cadastre itens, altere preços e ajuste a disponibilidade em tempo real.";
    }

    if (submitButton) {
      submitButton.textContent = "Salvar item";
    }

    cancelEditButton?.setAttribute("hidden", "hidden");
  }

  function fillForm(item) {
    if (!form || !item) {
      return;
    }

    editingItemId = Number(item.id_cardapio);
    form.nome.value = item.nome || "";
    form.descricao.value = item.descricao || "";
    form.categoria.value = item.categoria || "";
    form.preco.value = Number(item.preco || 0);
    form.preco_promocional.value = item.preco_promocional ?? "";
    form.imagem.value = item.imagem || "";
    form.ativo.checked = Boolean(item.ativo);

    if (formTitle) {
      formTitle.textContent = `Editando ${item.nome}`;
    }

    if (formText) {
      formText.textContent = "Revise os campos abaixo e salve para atualizar o cardápio.";
    }

    if (submitButton) {
      submitButton.textContent = "Salvar alterações";
    }

    cancelEditButton?.removeAttribute("hidden");
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function getMenuPayload() {
    if (!form) {
      return null;
    }

    return {
      nome: form.nome.value.trim(),
      descricao: form.descricao.value.trim() || null,
      categoria: form.categoria.value.trim() || null,
      preco: Number(form.preco.value),
      preco_promocional: form.preco_promocional.value ? Number(form.preco_promocional.value) : null,
      imagem: form.imagem.value.trim() || null,
      ativo: Boolean(form.ativo.checked),
    };
  }

  async function loadItems(showFeedback = false) {
    const freshItems = await fetchManagementMenuItems();
    items = Array.isArray(freshItems) ? freshItems : [];
    renderItems();

    if (showFeedback) {
      showToast("Cardápio atualizado com sucesso.");
    }
  }

  function renderItems() {
    if (!items.length) {
      tabela.innerHTML = `
        <div class="gestao-tabela-linha gestao-tabela-head">
          <span>Item</span>
          <span>Categoria</span>
          <span>Preço</span>
          <span>Status</span>
          <span>Ações</span>
        </div>
        <div class="gestao-tabela-linha">
          <span>Nenhum item de cardápio encontrado.</span>
          <span>-</span>
          <span>-</span>
          <span>-</span>
          <span>-</span>
        </div>
      `;
      return;
    }

    tabela.innerHTML = `
      <div class="gestao-tabela-linha gestao-tabela-head">
        <span>Item</span>
        <span>Categoria</span>
        <span>Preço</span>
        <span>Status</span>
        <span>Ações</span>
      </div>
      ${items
        .map(
          (item) => `
            <div class="gestao-tabela-linha">
              <span>
                <strong>${item.nome}</strong>
                <br><small>${item.descricao || "Sem descrição"}</small>
              </span>
              <span>${item.categoria || "-"}</span>
              <span>
                ${formatCurrency(Number(item.preco || 0))}
                ${item.preco_promocional ? `<br><small>Promo: ${formatCurrency(Number(item.preco_promocional || 0))}</small>` : ""}
              </span>
              <span class="${item.ativo ? "status-badge success" : "status-badge danger"}">${item.ativo ? "Disponível" : "Indisponível"}</span>
              <span class="card-acoes">
                <button type="button" class="btn-secundario" data-menu-edit="${item.id_cardapio}">Editar</button>
                <button type="button" class="btn-perigo" data-menu-delete="${item.id_cardapio}">Remover</button>
              </span>
            </div>
          `
        )
        .join("")}
    `;

    tabela.querySelectorAll("[data-menu-edit]").forEach((button) => {
      button.addEventListener("click", () => {
        const item = items.find((entry) => Number(entry.id_cardapio) === Number(button.dataset.menuEdit));
        fillForm(item);
      });
    });

    tabela.querySelectorAll("[data-menu-delete]").forEach((button) => {
      button.addEventListener("click", async () => {
        const item = items.find((entry) => Number(entry.id_cardapio) === Number(button.dataset.menuDelete));
        const confirmed = await showConfirm(
          `Deseja remover "${item?.nome || "este item"}" do cardápio?`,
          {
            title: "Remover item",
            tag: "Cardápio",
            confirmLabel: "Remover",
          }
        );

        if (!confirmed) {
          return;
        }

        try {
          await deleteManagementMenuItem(button.dataset.menuDelete);
          if (editingItemId === Number(button.dataset.menuDelete)) {
            resetForm();
          }
          await loadItems();
          showToast("Item removido com sucesso.", "success");
        } catch (error) {
          showToast(error.message || "Nao foi possivel remover o item.", "error");
        }
      });
    });
  }

  await loadItems();

  if (refreshButton) {
    refreshButton.addEventListener("click", async () => {
      try {
        await loadItems(true);
      } catch (error) {
        showToast(error.message || "Nao foi possivel atualizar o cardápio.", "error");
      }
    });
  }

  editButton?.addEventListener("click", () => {
    form?.scrollIntoView({ behavior: "smooth", block: "start" });
    form?.nome.focus();
  });

  cancelEditButton?.addEventListener("click", () => {
    resetForm();
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const payload = getMenuPayload();
    if (!payload) {
      return;
    }

    try {
      if (editingItemId) {
        await updateManagementMenuItem(editingItemId, payload);
        showToast("Item atualizado com sucesso.", "success");
      } else {
        await createManagementMenuItem(payload);
        showToast("Item criado com sucesso.", "success");
      }

      resetForm();
      await loadItems();
    } catch (error) {
      showToast(error.message || "Nao foi possivel salvar o item.", "error");
    }
  });

  resetForm();
}

async function setupGestaoConfiguracoes() {
  const form = document.getElementById("gestao-config-form");
  const saveButton = document.getElementById("gestao-config-salvar");
  const saveTopButton = document.getElementById("gestao-config-salvar-topo");
  const mercadoPagoStatus = document.getElementById("gestao-mp-status");
  if (!form || !saveButton) {
    return;
  }

  const establishment = await fetchManagementEstablishment();
  if (!establishment) {
    return;
  }

  form.nome.value = establishment.nome || "";
  if (form.cnpj) {
    form.cnpj.value = establishment.cnpj || "";
  }
  form.telefone.value = establishment.telefone || "";
  form.endereco.value = establishment.endereco || "";
  if (mercadoPagoStatus) {
    mercadoPagoStatus.textContent = establishment.mercado_pago_configurado
      ? "Conta Mercado Pago conectada. Preencha novamente apenas se quiser trocar o recebedor."
      : "Conta Mercado Pago nao conectada. Informe o access token da conta que deve receber os pagamentos.";
  }
  const deliveryRadio = form.querySelector(
    `input[name="tipo-entrega"][value="${establishment.possui_entrega ? "sim" : "nao"}"]`
  );
  if (deliveryRadio) {
    deliveryRadio.checked = true;
    deliveryRadio.dispatchEvent(new Event("change"));
  }
  const taxaEntregaField = form.elements.taxa_entrega || form.elements["taxa-entrega"];
  if (taxaEntregaField) {
    taxaEntregaField.value = establishment.taxa_entrega || "";
  }
  const [horarioAbertura = "", horarioFechamento = ""] = String(
    establishment.horario_funcionamento || ""
  ).split(/\s*-\s*/);
  form.horario_abertura.value = horarioAbertura;
  form.horario_fechamento.value = horarioFechamento || horarioAbertura;

  saveButton.addEventListener("click", async () => {
    const updates = {
      nome: form.nome.value.trim(),
      cnpj: form.cnpj?.value.trim() || null,
      telefone: form.telefone.value.trim(),
      endereco: form.endereco.value.trim(),
      possui_entrega: form.querySelector('input[name="tipo-entrega"]:checked')?.value === "sim",
      taxa_entrega: getInputValueByNames(form, ["taxa_entrega", "taxa-entrega"])
        ? Number(getInputValueByNames(form, ["taxa_entrega", "taxa-entrega"]).replace(/[^0-9,\.]/g, "").replace(",", "."))
        : null,
      horario_funcionamento: `${form.horario_abertura.value.trim()} - ${form.horario_fechamento.value.trim()}`
    };

    const mercadoPagoToken = form.mercado_pago_access_token?.value.trim();
    if (mercadoPagoToken) {
      updates.mercado_pago_access_token = mercadoPagoToken;
    }

    try {
      await updateManagementEstablishment(updates);
      showToast("Informações atualizadas com sucesso.");
    } catch (error) {
      await showAlert(error.message || "Erro ao atualizar os dados.", {
        title: "Falha ao salvar",
        tag: "Gestao"
      });
    }
  });

  saveTopButton?.addEventListener("click", () => {
    saveButton.click();
  });
}

async function initializeGestaoPage() {
  if (!isPartnerPage()) {
    return;
  }

  const authOk = await ensurePartnerAuth();
  if (!authOk) {
    return;
  }

  const path = window.location.pathname;
  if (path.endsWith("/gestao/index.html") || path.endsWith("/gestao/index")) {
    await setupGestaoDashboard();
  }

  if (path.endsWith("/gestao/pedidos.html") || path.endsWith("/gestao/pedidos")) {
    await setupGestaoPedidos();
  }

  if (path.endsWith("/gestao/vendas.html") || path.endsWith("/gestao/vendas")) {
    await setupGestaoVendas();
  }

  if (path.endsWith("/gestao/entregas.html") || path.endsWith("/gestao/entregas")) {
    await setupGestaoEntregas();
  }

  if (path.endsWith("/gestao/cardapio.html") || path.endsWith("/gestao/cardapio")) {
    await setupGestaoCardapio();
  }

  if (path.endsWith("/gestao/configuracoes.html") || path.endsWith("/gestao/configuracoes")) {
    await setupGestaoConfiguracoes();
  }
}

function renderCarrinho() {
  // Recalcula resumo, subtotal, taxas e total do checkout.
  const lista = document.getElementById("carrinho-lista");
  const contagem = document.getElementById("carrinho-contagem");
  const checkoutItens = document.getElementById("checkout-itens");
  const subtotalEl = document.getElementById("checkout-subtotal");
  const entregaEl = document.getElementById("checkout-entrega");
  const totalEl = document.getElementById("checkout-total");
  const radioSelecionado = document.querySelector(
    'input[name="tipo-recebimento"]:checked'
  );

  if (
    !lista ||
    !contagem ||
    !checkoutItens ||
    !subtotalEl ||
    !entregaEl ||
    !totalEl
  ) {
    return;
  }

  const carrinho = getCarrinho();
  const establishmentInfo = carrinho[0] || {};
  const totalItens = carrinho.reduce((sum, item) => sum + item.quantidade, 0);
  const subtotal = carrinho.reduce(
    (sum, item) => sum + item.precoNumero * item.quantidade,
    0
  );
  const deliveryFee =
    establishmentInfo.possui_entrega === 1 || establishmentInfo.possui_entrega === true
      ? Number(establishmentInfo.taxa_entrega || 0)
      : 0;
  const entrega =
    carrinho.length && radioSelecionado?.value === "entrega" ? deliveryFee : 0;
  const total = subtotal + entrega;

  contagem.textContent = `${totalItens} ${totalItens === 1 ? "item" : "itens"}`;
  subtotalEl.textContent = formatCurrency(subtotal);
  entregaEl.textContent = formatCurrency(entrega);
  totalEl.textContent = formatCurrency(total);

  if (!carrinho.length) {
    lista.innerHTML = `
      <article class="carrinho-item">
        <div class="carrinho-item-info">
          <h3>Seu carrinho está vazio</h3>
          <p>Quando os pratos vierem do banco de dados, eles aparecerão aqui.</p>
        </div>
      </article>
    `;
    checkoutItens.innerHTML = `
      <p class="checkout-itens-titulo">Itens do pedido</p>
      <div class="checkout-item-resumo">
        <div>
          <strong>Nenhum item selecionado</strong>
          <span>Adicione produtos para ver o resumo crescer aqui.</span>
        </div>
      </div>
    `;
    return;
  }

  lista.innerHTML = carrinho
    .map(
      (item) => `
        <article class="carrinho-item">
          <img src="${item.imagem || "src/logo.png"}" alt="${item.nome}">
          <div class="carrinho-item-info">
            <h3>${item.nome}</h3>
            <p>${item.restauranteNome || "Estabelecimento"} • ${item.descricao || ""}</p>
            <div class="item-meta">
              <span>${item.quantidade} ${item.quantidade === 1 ? "unidade" : "unidades"}</span>
              <span>${item.tempo || "Tempo não disponível"}</span>
            </div>
            <div class="card-acoes">
              <button type="button" class="btn-secundario" data-cart-id="${item.id}">Remover</button>
            </div>
          </div>
          <strong>${formatCurrency(item.precoNumero * item.quantidade)}</strong>
        </article>
      `
    )
    .join("");

  checkoutItens.innerHTML = `
    <p class="checkout-itens-titulo">Itens do pedido</p>
    ${carrinho
      .map(
        (item) => `
          <div class="checkout-item-resumo">
            <div>
              <strong>${item.quantidade}x ${item.nome}</strong>
              <span>${item.restauranteNome || "Estabelecimento"}</span>
            </div>
            <span class="checkout-item-preco">${formatCurrency(
              item.precoNumero * item.quantidade
            )}</span>
          </div>
        `
      )
      .join("")}
  `;
}

function setupCarrinhoPage() {
  const lista = document.getElementById("carrinho-lista");
  const botaoFinalizar = document.querySelector(".checkout-button");
  const botaoLimpar = document.querySelector(".limpar-button");
  const opcoesRecebimento = document.querySelectorAll(
    'input[name="tipo-recebimento"]'
  );

  if (!lista || !botaoFinalizar || !botaoLimpar) {
    return;
  }

  function syncDeliveryOptions() {
    const carrinho = getCarrinho();
    const establishmentInfo = carrinho[0] || {};
    const entregaInput = document.querySelector('input[name="tipo-recebimento"][value="entrega"]');
    const retiradaInput = document.querySelector('input[name="tipo-recebimento"][value="retirada"]');
    const entregaLabel = entregaInput?.closest(".opcao-entrega");

    if (!entregaInput || !retiradaInput || !entregaLabel) {
      return;
    }

    const hasDelivery =
      establishmentInfo.possui_entrega === 1 || establishmentInfo.possui_entrega === true;

    entregaInput.disabled = carrinho.length ? !hasDelivery : false;
    entregaLabel.classList.toggle("desabilitada", carrinho.length && !hasDelivery);

    if (carrinho.length && !hasDelivery && entregaInput.checked) {
      retiradaInput.checked = true;
    }
  }

  syncDeliveryOptions();
  renderCarrinho();

  opcoesRecebimento.forEach((input) => {
    input.addEventListener("change", () => {
      renderCarrinho();
    });
  });

  lista.addEventListener("click", (event) => {
    const button = event.target.closest("[data-cart-id]");

    if (!button) {
      return;
    }

    const carrinho = getCarrinho().filter((item) => item.id !== button.dataset.cartId);
    setCarrinho(carrinho);
    syncDeliveryOptions();
    renderCarrinho();
  });

  botaoLimpar.addEventListener("click", () => {
    setCarrinho([]);
    syncDeliveryOptions();
    renderCarrinho();
    showToast("Carrinho limpo com sucesso.");
  });

  botaoFinalizar.addEventListener("click", async () => {
    const perfil = await ensureClientRegistration();

    if (!perfil) {
      return;
    }

    const carrinho = getCarrinho();

    if (!carrinho.length) {
      await showAlert("Adicione pelo menos um item antes de finalizar a compra.", {
        title: "Carrinho vazio",
        tag: "Checkout",
      });
      return;
    }

    try {
      const result = await submitOrder();
      if (!result) {
        return;
      }

      const checkoutUrl = result?.data?.checkout_url;
      if (!checkoutUrl) {
        throw new Error("Nao foi possivel gerar a pagina de pagamento.");
      }

      window.location.href = checkoutUrl;
    } catch (error) {
      showToast(error.message || "Erro ao finalizar o pedido.", "error");
    }
  });
}

function setupEntregaCards() {
  // Alterna o estado visual das opções de entrega e da taxa.
  const opcoesEntrega = document.querySelectorAll(".opcao-entrega");
  const campoTaxaEntrega = document.getElementById("campo-taxa-entrega");
  const inputTaxaEntrega = campoTaxaEntrega?.querySelector('input[name="taxa-entrega"], input[name="taxa_entrega"]');

  if (!opcoesEntrega.length) {
    return;
  }

  function atualizarCampoTaxa() {
    if (!campoTaxaEntrega || !inputTaxaEntrega) {
      return;
    }

    const entregaSelecionada = document.querySelector(
      'input[name="tipo-entrega"][value="sim"]'
    );
    const mostrarCampo = Boolean(entregaSelecionada?.checked);

    campoTaxaEntrega.classList.toggle("campo-oculto", !mostrarCampo);
    inputTaxaEntrega.required = mostrarCampo;

    if (!mostrarCampo) {
      inputTaxaEntrega.value = "";
    }
  }

  const grupos = new Map();

  opcoesEntrega.forEach((opcao) => {
    const input = opcao.querySelector('input[type="radio"]');
    const groupName = input?.name;

    if (!input || !groupName) {
      return;
    }

    if (!grupos.has(groupName)) {
      grupos.set(groupName, []);
    }

    grupos.get(groupName).push({ opcao, input });
  });

  grupos.forEach((items) => {
    items.forEach(({ opcao, input }) => {
      opcao.classList.toggle("ativa", input.checked);

      input.addEventListener("change", () => {
        items.forEach(({ opcao: itemOpcao, input: itemInput }) => {
          itemOpcao.classList.toggle("ativa", itemInput.checked);
        });

        atualizarCampoTaxa();
      });
    });
  });

  atualizarCampoTaxa();
}

function setupPaymentSection() {
  const cardFields = document.getElementById("checkout-card-fields");

  if (!cardFields) {
    return;
  }

  cardFields.hidden = false;
}

function getCadastroFormData(form) {
  // Normaliza os dados do formulário de parceiro antes de salvar/enviar.
  const formData = new FormData(form);

  return {
    nome: formData.get("nome-restaurante") || "",
    cnpj: formData.get("cnpj") || "",
    email: formData.get("email-comercial") || "",
    mercadoPagoAccessToken: formData.get("mercado-pago-access-token") || "",
    telefone: formData.get("telefone") || "",
    endereco: formData.get("endereco") || "",
    categoria: formData.get("categoria") || "",
    horario: formData.get("horario-funcionamento") || "",
    entrega: formData.get("tipo-entrega") || "sim",
    taxaEntrega: formData.get("taxa-entrega") || "",
    descricao: formData.get("descricao") || "",
    cardapioManual: formData.get("cardapio-manual") || "",
    cardapioPdf: formData.get("cardapio-pdf")?.name || "",
  };
}

function preencherCadastroRascunho(form, rascunho) {
  if (!rascunho) {
    return;
  }

  form.elements["nome-restaurante"].value = rascunho.nome || "";
  form.elements.cnpj.value = rascunho.cnpj || "";
  form.elements["email-comercial"].value = rascunho.email || "";
  if (form.elements["mercado-pago-access-token"]) {
    form.elements["mercado-pago-access-token"].value =
      rascunho.mercadoPagoAccessToken || "";
  }
  form.elements.telefone.value = rascunho.telefone || "";
  form.elements.endereco.value = rascunho.endereco || "";
  form.elements.categoria.value = rascunho.categoria || "";
  form.elements["horario-funcionamento"].value = rascunho.horario || "";
  form.elements["taxa-entrega"].value = rascunho.taxaEntrega || "";
  form.elements.descricao.value = rascunho.descricao || "";
  form.elements["cardapio-manual"].value = rascunho.cardapioManual || "";

  const radio = form.querySelector(
    `input[name="tipo-entrega"][value="${rascunho.entrega || "sim"}"]`
  );

  if (radio) {
    radio.checked = true;
    radio.dispatchEvent(new Event("change"));
  }
}

function setupCadastroForm() {
  // Fluxo local do cadastro de estabelecimentos enquanto o backend não é consumido.
  const form = document.querySelector(".cadastro-form");
  const botaoRascunho = document.querySelector(".cadastro-btn-secundario");

  if (!form || !botaoRascunho) {
    return;
  }

  preencherCadastroRascunho(
    form,
    getPublicState().cadastroRascunho
  );

  botaoRascunho.addEventListener("click", () => {
    const rascunho = getCadastroFormData(form);
    publicStateCache.cadastroRascunho = rascunho;
    persistPublicState();
    showToast("Rascunho salvo com sucesso.");
  });
}

function renderPerfil() {
  const nomeResumo = document.getElementById("perfil-nome-resumo");
  const status = document.getElementById("perfil-status");
  const resumo = document.getElementById("perfil-resumo-texto");
  const avatar = document.getElementById("perfil-avatar");
  const pedidosMes = document.getElementById("perfil-pedidos-mes");
  const pagamento = document.getElementById("perfil-pagamento");
  const nome = document.getElementById("perfil-nome");
  const email = document.getElementById("perfil-email");
  const telefone = document.getElementById("perfil-telefone");
  const endereco = document.getElementById("perfil-endereco");
  const preferencias = document.getElementById("perfil-preferencias");

  if (
    !nomeResumo ||
    !status ||
    !resumo ||
    !avatar ||
    !pedidosMes ||
    !pagamento ||
    !nome ||
    !email ||
    !telefone ||
    !endereco ||
    !preferencias
  ) {
    return;
  }

  const perfil = getPerfil();
  const iniciais = perfil.nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join("")
    .toUpperCase();

  nomeResumo.textContent = perfil.nome;
  status.textContent = perfil.status;
  resumo.textContent = perfil.resumo;
  avatar.textContent = iniciais || "EG";
  pedidosMes.textContent = `${perfil.pedidosMes} pedidos este mes`;
  pagamento.textContent = perfil.pagamento;
  nome.textContent = perfil.nome;
  email.textContent = perfil.email;
  telefone.textContent = perfil.telefone;
  endereco.textContent = perfil.endereco;
  preferencias.innerHTML = perfil.preferencias
    .map((item) => `<span>${item}</span>`)
    .join("");
}

function setupPerfilPage() {
  const botaoEditar = document.querySelector(".perfil-edit-btn");
  const ordersSection = document.getElementById("perfil-pedidos-lista");

  if (!botaoEditar) {
    return;
  }

  if (hasClientRegistration()) {
    renderPerfil();
  } else {
    ensureClientRegistration().then((perfil) => {
      if (perfil) {
        renderPerfil();
      }
    });
  }

  botaoEditar.addEventListener("click", async () => {
    await ensureClientRegistration();
    const perfilAtual = getPerfil();
    const nome = await showPrompt({
      title: "Editar perfil",
      message: "Atualize seus dados de forma rápida.",
      label: "Nome completo",
      defaultValue: perfilAtual.nome,
      tag: "Perfil",
    });
    if (nome === null) return;

    const email = await showPrompt({
      title: "Editar perfil",
      message: "Informe seu melhor email.",
      label: "Email",
      defaultValue: perfilAtual.email,
      tag: "Perfil",
    });
    if (email === null) return;

    const telefone = await showPrompt({
      title: "Editar perfil",
      message: "Atualize seu telefone para contato.",
      label: "Telefone",
      defaultValue: perfilAtual.telefone,
      tag: "Perfil",
    });
    if (telefone === null) return;

    const endereco = await showPrompt({
      title: "Editar perfil",
      message: "Defina o endereço principal da conta.",
      label: "Endereço",
      defaultValue: perfilAtual.endereco,
      tag: "Perfil",
    });
    if (endereco === null) return;

    const perfilAtualizado = {
      ...perfilAtual,
      nome: nome.trim() || perfilAtual.nome,
      email: email.trim() || perfilAtual.email,
      telefone: telefone.trim() || perfilAtual.telefone,
      endereco: endereco.trim() || perfilAtual.endereco,
    };

    publicStateCache.perfil = perfilAtualizado;
    await persistPublicState();

    try {
      await syncClientRegistration(perfilAtualizado);
    } catch (error) {
      showToast(error.message || "Nao foi possivel sincronizar o perfil no backend.", "warning");
    }

    renderPerfil();
    showToast("Perfil atualizado com sucesso.");
  });

  if (ordersSection) {
    const loadOrders = async () => {
      const clientId = getClientId();

      if (!clientId) {
        renderProfileOrders([]);
        return;
      }

      try {
        const orders = await fetchClientOrders(clientId);
        renderProfileOrders(orders);

        ordersSection.querySelectorAll("[data-client-cancel-order]").forEach((button) => {
          button.addEventListener("click", async () => {
            const confirmed = await showConfirm(
              "Deseja cancelar este pedido? Essa ação não pode ser desfeita.",
              {
                title: "Cancelar pedido",
                tag: "Pedidos",
                confirmLabel: "Cancelar pedido",
              }
            );

            if (!confirmed) {
              return;
            }

            try {
              await cancelClientOrder(button.dataset.clientCancelOrder, clientId);
              showToast("Pedido cancelado com sucesso.", "success");
              await loadOrders();
            } catch (error) {
              showToast(error.message || "Nao foi possivel cancelar o pedido.", "error");
            }
          });
        });
      } catch (error) {
        showToast(error.message || "Nao foi possivel carregar seus pedidos.", "warning");
      }
    };

    if (hasClientRegistration()) {
      loadOrders();
    } else {
      ensureClientRegistration().then((perfil) => {
        if (perfil) {
          loadOrders();
        }
      });
    }
  }
}

// Funções globais temporárias para ações de cardápio ainda não integradas.
window.adicionarCarrinho = function adicionarCarrinho() {
  showAlert(
    "Os itens do cardápio não estão mais fixos no front-end. Carregue-os do banco de dados para ativar esta ação.",
    {
      title: "Ação indisponível",
      tag: "Cardápio",
    }
  );
};

window.pedirAgora = function pedirAgora() {
  showAlert(
    "Os itens do cardápio não estão mais fixos no front-end. Carregue-os do banco de dados para ativar esta ação.",
    {
      title: "Ação indisponível",
      tag: "Cardápio",
    }
  );
};

async function handleCheckoutReturn() {
  if (!window.location.pathname.endsWith("/carrinho.html") && !window.location.pathname.endsWith("/carrinho")) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const paymentStatus =
    params.get("status") ||
    params.get("collection_status") ||
    params.get("payment_status");
  const paymentReference = params.get("external_reference") || params.get("ref");

  if (!paymentStatus || !paymentReference) {
    return;
  }

  const syncKey = `${paymentReference}:${paymentStatus}:${params.get("payment_id") || ""}`;
  if (getPublicState().ultimoPagamentoSincronizado === syncKey) {
    return;
  }

  try {
    await apiRequest("/api/orders/payment-return", {
      method: "POST",
      body: JSON.stringify({
        pagamento_referencia: paymentReference,
        payment_id: params.get("payment_id"),
        status: paymentStatus,
        status_detail: params.get("status_detail")
      })
    });

    publicStateCache.ultimoPagamentoSincronizado = syncKey;
    await persistPublicState();

    if (String(paymentStatus).toLowerCase() === "approved") {
      if (getCarrinho().length > 0) {
        updateOrderCount(1);
      }
      setCarrinho([]);
      renderCarrinho();
      await showAlert("Pagamento aprovado com sucesso no Mercado Pago.", {
        title: "Pedido confirmado",
        tag: "Checkout"
      });
    } else if (String(paymentStatus).toLowerCase() === "pending") {
      await showAlert("Seu pagamento foi enviado e está aguardando confirmação.", {
        title: "Pagamento pendente",
        tag: "Checkout"
      });
    } else {
      await showAlert("O pagamento não foi aprovado. Você pode revisar e tentar novamente.", {
        title: "Pagamento não concluído",
        tag: "Checkout"
      });
    }
  } catch (error) {
    showToast(error.message || "Nao foi possivel sincronizar o retorno do pagamento.", "warning");
  } finally {
    const cleanUrl = `${window.location.pathname}${window.location.hash || ""}`;
    window.history.replaceState({}, document.title, cleanUrl);
  }
}

function setupCentralAjudaPage() {
  const page = document.querySelector("[data-central-ajuda]");
  if (!page) {
    return;
  }

  const searchInput = document.getElementById("ajuda-search");
  const faqItems = Array.from(document.querySelectorAll(".faq-item"));
  const categoryButtons = Array.from(document.querySelectorAll("[data-ajuda-categoria]"));
  const form = document.getElementById("central-ajuda-form");
  const resultCount = document.getElementById("ajuda-result-count");
  let activeCategory = "todas";

  function updateResultCount(visibleItems) {
    if (!resultCount) {
      return;
    }

    resultCount.textContent =
      visibleItems === 1 ? "1 resposta encontrada" : `${visibleItems} respostas encontradas`;
  }

  function filterFaq() {
    const query = normalizeText(searchInput?.value?.trim() || "");
    let visibleItems = 0;

    faqItems.forEach((item) => {
      const category = item.dataset.category || "todas";
      const matchesCategory = activeCategory === "todas" || category === activeCategory;
      const matchesQuery = !query || normalizeText(item.textContent).includes(query);
      const visible = matchesCategory && matchesQuery;
      item.hidden = !visible;

      if (visible) {
        visibleItems += 1;
      }
    });

    updateResultCount(visibleItems);
  }

  faqItems.forEach((item) => {
    const trigger = item.querySelector(".faq-question");
    if (!trigger) {
      return;
    }

    trigger.addEventListener("click", () => {
      const expanded = item.classList.toggle("is-open");
      trigger.setAttribute("aria-expanded", String(expanded));
    });
  });

  categoryButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activeCategory = button.dataset.ajudaCategoria || "todas";
      categoryButtons.forEach((item) => {
        const active = item === button;
        item.classList.toggle("ativa", active);
        item.setAttribute("aria-pressed", String(active));
      });
      filterFaq();
    });
  });

  searchInput?.addEventListener("input", filterFaq);

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const nome = form.nome.value.trim();
    const email = form.email.value.trim();
    const assunto = form.assunto.value.trim();
    const mensagem = form.mensagem.value.trim();

    if (!nome || !email || !assunto || !mensagem) {
      showToast("Preencha todos os campos antes de enviar.", "error");
      return;
    }

    const destinatario = "suporte@eatgo.com";
    const subject = encodeURIComponent(`[Central de Ajuda] ${assunto}`);
    const body = encodeURIComponent(
      `Ola, equipe EatGo!\n\nNome: ${nome}\nEmail: ${email}\nAssunto: ${assunto}\nMensagem: ${mensagem}`
    );
    window.location.href = `mailto:${destinatario}?subject=${subject}&body=${body}`;
    form.reset();
    await showAlert("Seu aplicativo de email foi aberto com a mensagem pronta para envio.", {
      title: "Contato iniciado",
      tag: "Central de ajuda"
    });
  });

  filterFaq();
}

window.mensagemCentral = function mensagemCentral() {
  return true;
};

document.addEventListener("DOMContentLoaded", function () {
  initializePublicState()
    .catch(() => {
      publicStateCache = normalizePublicState(publicStateCache);
    })
    .finally(() => {
      applyAccessibilityPreferences();
      setupUiFeedback();
      setupCategorias();
      setupSearch();
      setupEntregaCards();
      setupPaymentSection();
      setupCadastroForm();
      setupRestaurantRegistrationPage();
      setupPerfilPage();
      setupAccessibilityPage();
      renderizarPaginaRestaurante();
      setupCarrinhoPage();
      setupLoginPage();
      initializeGestaoPage();
      handleCheckoutReturn();
      setupCentralAjudaPage();
    });
});
