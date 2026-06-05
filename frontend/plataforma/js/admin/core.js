const API_PROTOCOL = window.location.protocol === "file:" ? "http:" : window.location.protocol;

let resolvedApiBaseUrl = null;
let apiBaseUrlPromise = null;
let adminUserState = null;
const ADMIN_TOKEN_STORAGE_KEY = "eatgo_admin_token";
let currentEditingEstablishmentId = null;
let currentPlatformConfig = {
  nitrogo: {
    enabled: false
  }
};

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDateTime(value) {
  if (!value) {
    return "Sem pedidos";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Sem pedidos";
  }

  return date.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

function formatMonthLabel() {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric"
  }).format(new Date());
}

function getMonthlyPerformanceInsights(items = []) {
  const activeItems = items.filter((item) => Number(item.ativo) === 1);
  const baseItems = activeItems.length ? activeItems : items;
  const count = Math.max(baseItems.length, 1);

  const averageOrders =
    baseItems.reduce((sum, item) => sum + Number(item.pedidos_mes_atual || 0), 0) / count;
  const averageRevenue =
    baseItems.reduce((sum, item) => sum + Number(item.faturamento_mes_atual || 0), 0) / count;

  return items.map((item) => {
    const currentOrders = Number(item.pedidos_mes_atual || 0);
    const previousOrders = Number(item.pedidos_mes_anterior || 0);
    const currentRevenue = Number(item.faturamento_mes_atual || 0);
    const previousRevenue = Number(item.faturamento_mes_anterior || 0);
    const revenueDelta = currentRevenue - previousRevenue;
    const ordersDelta = currentOrders - previousOrders;

    let status = "Estável";
    let recommended = false;

    if (currentOrders === 0 && currentRevenue === 0) {
      status = "Crítico";
      recommended = true;
    } else if (
      (averageOrders > 0 && currentOrders < averageOrders * 0.5) ||
      (averageRevenue > 0 && currentRevenue < averageRevenue * 0.5)
    ) {
      status = "Apoio recomendado";
      recommended = true;
    } else if (previousRevenue > 0 && currentRevenue < previousRevenue * 0.8) {
      status = "Em queda";
      recommended = true;
    }

    return {
      ...item,
      currentOrders,
      previousOrders,
      currentRevenue,
      previousRevenue,
      revenueDelta,
      ordersDelta,
      status,
      recommended
    };
  });
}

function formatDeltaLabel(delta, formatter = (value) => value) {
  if (!delta) {
    return "Sem variação";
  }

  const signal = delta > 0 ? "+" : "";
  return `${signal}${formatter(delta)}`;
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

function getAdminToken() {
  try {
    return window.sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || "";
  } catch (error) {
    return "";
  }
}

function setAdminToken(token) {
  try {
    if (token) {
      window.sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
    } else {
      window.sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    }
  } catch (error) {
    // Ignora falhas de armazenamento local.
  }
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
        "Content-Type": "application/json",
        ...(getAdminToken() ? { Authorization: `Bearer ${getAdminToken()}` } : {})
      }
    });
  } catch (error) {
    // Ignora falhas de logout remoto e limpa o estado em memória.
  }

  adminUserState = null;
  setAdminToken("");
}

function revealPage() {
  document.body.classList.remove("admin-locked");
}

async function apiRequest(path, options = {}) {
  const baseUrl = await resolveApiBaseUrl();
  const adminToken = getAdminToken();
  const headers = {
    "Content-Type": "application/json",
    ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    credentials: "include",
    headers
  });

  if (response.status === 401 || response.status === 403) {
    adminUserState = null;
    setAdminToken("");
    const body = await response.text();
    let message = "Acesso administrativo inválido ou expirado.";
    try {
      const json = JSON.parse(body);
      if (json?.message || json?.error) {
        message = json.message || json.error;
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
      const fieldErrors = json?.details?.fieldErrors || {};
      const flattenedFieldErrors = Object.values(fieldErrors)
        .flat()
        .filter(Boolean);

      if (flattenedFieldErrors.length) {
        message = flattenedFieldErrors.join(" ");
      } else if (json?.message || json?.error) {
        message = json.message || json.error;
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

  if (!passwordInput) {
    throw new Error("Campo de senha não encontrado.");
  }

  const senha = passwordInput.value.trim();

  if (!senha) {
    throw new Error("Digite a senha administrativa.");
  }

  const response = await apiRequest("/api/admin/login", {
    method: "POST",
    body: JSON.stringify({ senha })
  });

  if (!response?.token) {
    throw new Error("Sessão administrativa inválida.");
  }

  setAdminToken(response.token);
  setAdminSession(response.user || null);

  return response.user || null;
}

