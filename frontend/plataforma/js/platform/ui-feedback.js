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

function addItemToCart(menuItem, quantity = 1, context = {}) {
  if (!menuItem) {
    return;
  }

  const currentCart = getCarrinho();
  const restaurantId = Number(
    context.id_estabelecimento ??
    menuItem.id_estabelecimento ??
    currentRestaurantId
  );
  const restaurantName =
    context.restauranteNome ||
    menuItem.restauranteNome ||
    currentRestaurantName ||
    "Estabelecimento";
  const restaurantData = {
    ...(currentRestaurantData || {}),
    ...(context || {})
  };

  if (!getEstablishmentOperatingStatus(restaurantData).aberto) {
    notifyClosedEstablishment(restaurantName, restaurantData);
    return null;
  }

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
      quantidade: quantity,
      tempo: menuItem.tempo || "Tempo não disponível"
    });
  }

  setCarrinho(currentCart);
  if (typeof renderCarrinho === "function") {
    renderCarrinho();
  }
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

  const establishment = await fetchEstablishment(establishmentId);
  const establishmentStatus = getEstablishmentOperatingStatus(establishment);
  if (!establishmentStatus.aberto) {
    await showAlert(
      `${ establishment.nome || "Este estabelecimento" } está fechado no momento. ${ establishmentStatus.texto.replace(/^🔴\s*/, "") }`,
      {
        title: "Pedido indisponível",
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
    nitrogo_utilizado:
      currentNitrogoCheckoutState.applied &&
      Number(currentNitrogoCheckoutState.establishmentId) === Number(establishmentId),
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
    return () => { };
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

function showClientRegistrationModal(defaultValues = {}) {
  return new Promise((resolve) => {
    const wrapper = document.createElement("div");
    wrapper.className = "eatgo-modal-form-grid";

    const fields = [
      { key: "nome", label: "Nome completo", type: "text", placeholder: "Seu nome", minLength: 2, maxLength: 200 },
      { key: "email", label: "Email", type: "email", placeholder: "voce@email.com" },
      { key: "telefone", label: "Telefone", type: "tel", placeholder: "(11) 99999-0000", minLength: 8, maxLength: 20 },
      { key: "endereco", label: "Endereco", type: "text", placeholder: "Rua, numero e bairro", minLength: 5, maxLength: 200 }
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
      input.value = defaultValues[field.key] || "";
      if (field.minLength) {
        input.minLength = field.minLength;
      }
      if (field.maxLength) {
        input.maxLength = field.maxLength;
      }
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

            const invalidInput = Object.values(inputs).find((input) => !input.checkValidity());

            if (invalidInput) {
              invalidInput.reportValidity();
              invalidInput.focus();
              showToast("Confira os dados do cadastro.", "error");
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
