let cachedEstablishmentsPromise = null;
const establishmentCache = new Map();
const establishmentPromiseCache = new Map();
const establishmentMenuCache = new Map();
const establishmentMenuPromiseCache = new Map();
let currentRestaurantMenu = [];
let currentRestaurantId = null;
let currentRestaurantName = null;
let currentRestaurantData = null;
const PUBLIC_STATE_STORAGE_KEY = "eatgo_public_state";
let cachedPlatformConfig = null;
let cachedPlatformConfigPromise = null;
let currentNitrogoCheckoutState = {
  establishmentId: null,
  available: false,
  applied: false,
  couponValue: 0,
  freeDelivery: false
};

async function fetchEstablishments() {
  if (Array.isArray(cachedEstablishments)) {
    return cachedEstablishments;
  }

  if (!cachedEstablishmentsPromise) {
    cachedEstablishmentsPromise = apiGet("/api/public/establishments")
      .then((data) => {
        cachedEstablishments = Array.isArray(data) ? data : [];
        cachedEstablishmentsPromise = null;
        return cachedEstablishments;
      })
      .catch((error) => {
        cachedEstablishmentsPromise = null;
        throw error;
      });
  }

  return cachedEstablishmentsPromise;
}

async function fetchPlatformConfig() {
  if (cachedPlatformConfig) {
    return cachedPlatformConfig;
  }

  if (!cachedPlatformConfigPromise) {
    cachedPlatformConfigPromise = apiGet("/api/public/platform-config")
      .then((data) => {
        cachedPlatformConfig = data || { nitrogo: { enabled: false } };
        cachedPlatformConfigPromise = null;
        return cachedPlatformConfig;
      })
      .catch((error) => {
        cachedPlatformConfigPromise = null;
        throw error;
      });
  }

  return cachedPlatformConfigPromise;
}

async function fetchEstablishment(id) {
  const normalizedId = String(id);

  if (establishmentCache.has(normalizedId)) {
    return establishmentCache.get(normalizedId);
  }

  if (!establishmentPromiseCache.has(normalizedId)) {
    establishmentPromiseCache.set(
      normalizedId,
      apiGet(`/api/public/establishments/${encodeURIComponent(id)}`)
        .then((data) => {
          establishmentCache.set(normalizedId, data);
          establishmentPromiseCache.delete(normalizedId);
          return data;
        })
        .catch((error) => {
          establishmentPromiseCache.delete(normalizedId);
          throw error;
        })
    );
  }

  return establishmentPromiseCache.get(normalizedId);
}

async function fetchEstablishmentMenu(id) {
  const normalizedId = String(id);

  if (establishmentMenuCache.has(normalizedId)) {
    return establishmentMenuCache.get(normalizedId);
  }

  if (!establishmentMenuPromiseCache.has(normalizedId)) {
    establishmentMenuPromiseCache.set(
      normalizedId,
      apiGet(`/api/public/establishments/${encodeURIComponent(id)}/menu`)
        .then((data) => {
          const items = Array.isArray(data) ? data : [];
          establishmentMenuCache.set(normalizedId, items);
          establishmentMenuPromiseCache.delete(normalizedId);
          return items;
        })
        .catch((error) => {
          establishmentMenuPromiseCache.delete(normalizedId);
          throw error;
        })
    );
  }

  return establishmentMenuPromiseCache.get(normalizedId);
}

function isDrinkMenuItem(item) {
  const text = normalizeText(
    `${item?.categoria || ""} ${item?.nome || ""} ${item?.descricao || ""}`
  );

  return [
    "bebida",
    "bebidas",
    "suco",
    "refrigerante",
    "agua",
    "água",
    "cafe",
    "café",
    "cha",
    "chá",
    "drink",
    "cerveja",
    "vinho"
  ].some((keyword) => text.includes(keyword));
}

function formatNitrogoBenefit(restaurante) {
  const benefits = [];
  const couponValue = Number(restaurante?.nitrogo_cupom_valor || 0);

  if (couponValue > 0) {
    benefits.push(`Cupom de ${formatCurrency(couponValue)}`);
  }

  if (Number(restaurante?.nitrogo_frete_gratis) === 1) {
    benefits.push("Frete grátis");
  }

  return benefits.length ? benefits.join(" • ") : "Benefício exclusivo na EatGo";
}

function getSafeImageSrc(imageUrl, fallback = "src/logo.png") {
  const value = String(imageUrl || "").trim();

  if (!value) {
    return fallback;
  }

  if (value.startsWith("file://")) {
    return fallback;
  }

  if (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("data:image/") ||
    value.startsWith("src/") ||
    value.startsWith("./") ||
    value.startsWith("../") ||
    value.startsWith("/")
  ) {
    return value;
  }

  return fallback;
}

function readImageFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve(null);
      return;
    }

    if (!String(file.type || "").startsWith("image/")) {
      reject(new Error("Selecione apenas arquivos de imagem."));
      return;
    }

    if (Number(file.size || 0) > 2 * 1024 * 1024) {
      reject(new Error("A imagem deve ter no máximo 2 MB."));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem selecionada."));
    reader.readAsDataURL(file);
  });
}

async function resolveImageInputValue(fileInput, hiddenInput) {
  const file = fileInput?.files?.[0];

  if (file) {
    const dataUrl = await readImageFileAsDataUrl(file);
    if (hiddenInput) {
      hiddenInput.value = dataUrl || "";
    }
    return dataUrl || null;
  }

  const currentValue = String(hiddenInput?.value || "").trim();
  return currentValue || null;
}

function syncFileImagePreview(previewEl, value) {
  if (!previewEl) {
    return;
  }

  const src = String(value || "").trim();
  previewEl.hidden = !src;
  previewEl.src = src || "";
}

function bindFileImagePreview(fileInput, hiddenInput, previewEl) {
  if (!fileInput || !hiddenInput || !previewEl) {
    return;
  }

  syncFileImagePreview(previewEl, hiddenInput.value);

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];

    if (!file) {
      syncFileImagePreview(previewEl, hiddenInput.value);
      return;
    }

    try {
      const dataUrl = await readImageFileAsDataUrl(file);
      hiddenInput.value = dataUrl || "";
      syncFileImagePreview(previewEl, dataUrl);
    } catch (error) {
      fileInput.value = "";
      showToast(error.message || "Não foi possível carregar a imagem.", "error");
      syncFileImagePreview(previewEl, hiddenInput.value);
    }
  });
}

function hasClientRegistration() {
  const state = getPublicState();
  const perfil = getPerfil();

  return Boolean(
    state.clienteId &&
    state.clienteCadastroConcluido &&
    perfil.email &&
    perfil.email !== defaultPerfil.email &&
    perfil.nome &&
    perfil.nome !== defaultPerfil.nome
  );
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
    return null;
  }
}

async function createClient(profile) {
  const response = await apiRequest("/api/public/clients", {
    method: "POST",
    body: JSON.stringify(profile),
  });

  console.log("CREATE CLIENT RESPONSE:", response);
  console.log("CREATE CLIENT DATA:", response?.data);

  return response?.data || null;
}

async function saveClientProfile(profile) {
  const current = getPerfil();

  const saved = {
    ...current,
    ...profile,
  };

  console.log("SALVANDO PERFIL:", saved);

  const apiBaseUrl = await resolveApiBaseUrl();

  const response = await fetch(
    `${apiBaseUrl}/api/public/clients/${saved.id_cliente}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        nome: saved.nome,
        telefone: saved.telefone,
        endereco: saved.endereco,
      }),
    }
  );

  const data = await response.json();

  console.log("RESPOSTA PUT:", data);

  if (!response.ok) {
    throw new Error(data.message || "Erro ao atualizar perfil");
  }

  publicStateCache.perfil = saved;

  await persistPublicState();

  return saved;
}

async function syncClientRegistration(profile) {
  if (!profile?.email) {
    throw new Error("Informe um email válido para concluir o cadastro.");
  }

  const existingClient = await fetchClientByEmail(profile.email);
  const client = existingClient || (await createClient(profile));

  if (!client?.id_cliente) {
    throw new Error("Não foi possível concluir o cadastro do cliente.");
  }

  const perfilCompleto = {
    ...profile,
    id_cliente: client.id_cliente,
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
  };

  publicStateCache.perfil = perfilCompleto;

  await setClientId(client.id_cliente);
  await markClientRegistrationDone();
  await saveClientProfile(perfilCompleto);

  return client;
}
