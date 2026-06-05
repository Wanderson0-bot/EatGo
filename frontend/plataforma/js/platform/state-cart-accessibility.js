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

function getNitrogoCheckoutDiscount(carrinho, tipoRecebimento) {
  if (!Array.isArray(carrinho) || !carrinho.length) {
    return 0;
  }

  const establishmentInfo = carrinho[0] || {};
  const sameEstablishment =
    Number(currentNitrogoCheckoutState.establishmentId) ===
    Number(establishmentInfo.id_estabelecimento);

  if (!currentNitrogoCheckoutState.available || !currentNitrogoCheckoutState.applied || !sameEstablishment) {
    return 0;
  }

  const subtotal = carrinho.reduce(
    (sum, item) => sum + Number(item.precoNumero || 0) * Number(item.quantidade || 0),
    0
  );
  const deliveryFee =
    tipoRecebimento === "entrega" &&
      (establishmentInfo.possui_entrega === 1 || establishmentInfo.possui_entrega === true) &&
      currentNitrogoCheckoutState.freeDelivery
      ? Number(establishmentInfo.taxa_entrega || 0)
      : 0;

  return Math.min(
    subtotal + deliveryFee,
    Math.max(Number(currentNitrogoCheckoutState.couponValue || 0), 0)
  );
}

function syncNitrogoCheckoutState(establishment) {
  const establishmentId = Number(establishment?.id_estabelecimento || 0);
  const available = Number(establishment?.nitrogo_ativo) === 1;

  if (
    Number(currentNitrogoCheckoutState.establishmentId) !== establishmentId
  ) {
    currentNitrogoCheckoutState = {
      establishmentId,
      available,
      applied: false,
      couponValue: Number(establishment?.nitrogo_cupom_valor || 0),
      freeDelivery: Number(establishment?.nitrogo_frete_gratis) === 1
    };
    return;
  }

  currentNitrogoCheckoutState = {
    ...currentNitrogoCheckoutState,
    establishmentId,
    available,
    couponValue: Number(establishment?.nitrogo_cupom_valor || 0),
    freeDelivery: Number(establishment?.nitrogo_frete_gratis) === 1
  };

  if (!available) {
    currentNitrogoCheckoutState.applied = false;
  }
}

function setCarrinho(carrinho) {
  publicStateCache.carrinho = Array.isArray(carrinho) ? carrinho : [];
  writePublicStateToStorage(publicStateCache);
  renderCartBadge();
  persistPublicState();
}

function getCartItemsCount() {
  return getCarrinho().reduce((sum, item) => sum + Number(item.quantidade || 0), 0);
}

function renderCartBadge() {
  const totalItems = getCartItemsCount();
  const cartLinks = document.querySelectorAll('a[href="carrinho.html"]');

  cartLinks.forEach((link) => {
    link.classList.add("cart-link");

    let badge = link.querySelector(".cart-badge");
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "cart-badge";
      link.appendChild(badge);
    }

    badge.textContent = String(totalItems);
    badge.hidden = totalItems <= 0;
  });
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

function getClientCancellationPolicyMessage() {
  return "Antes do preparo, o cancelamento gera reembolso total. Durante o preparo, o pedido vai para analise do estabelecimento e o reembolso pode ser total, parcial ou negado. Apos sair para entrega, o cancelamento pode ser bloqueado ou ter taxa, geralmente sem reembolso.";
}

function canClientCancelOrder(order) {
  return (
    ["pago", "confirmado", "preparando"].includes(order.status) &&
    !["em_analise", "aprovado_total", "aprovado_parcial", "negado"].includes(order.cancelamento_status)
  );
}

function getOrderCancellationSummary(order) {
  if (!order.cancelamento_status || order.cancelamento_status === "nenhum") {
    return "";
  }

  const details = [`Cancelamento: ${formatCancellationStatusLabel(order.cancelamento_status)}`];

  if (order.cancelamento_valor_reembolso != null) {
    details.push(`Reembolso: ${formatCurrency(Number(order.cancelamento_valor_reembolso || 0))}`);
  }

  if (order.cancelamento_taxa != null && Number(order.cancelamento_taxa || 0) > 0) {
    details.push(`Taxa: ${formatCurrency(Number(order.cancelamento_taxa || 0))}`);
  }

  if (order.cancelamento_analise_texto) {
    details.push(order.cancelamento_analise_texto);
  }

  return details.join(" • ");
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
            <span>Pagamento: ${formatPaymentStatusLabel(order.pagamento_status)}</span>
            <span>${order.tipo_recebimento === "entrega" ? "Entrega" : "Retirada"}</span>
          </div>
          ${order.itens?.length ? `
            <div class="perfil-pedido-meta">
              ${order.itens.map((item) => `<span>${item.quantidade}x ${item.nome}</span>`).join("")}
            </div>
          ` : ""}
          ${getOrderCancellationSummary(order) ? `<p>${getOrderCancellationSummary(order)}</p>` : ""}
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
  const cadastro = await showClientRegistrationModal({
    nome: perfilSalvo.nome !== defaultPerfil.nome ? perfilSalvo.nome : "",
    email: perfilSalvo.email !== defaultPerfil.email ? perfilSalvo.email : "",
    telefone: perfilSalvo.telefone !== defaultPerfil.telefone ? perfilSalvo.telefone : "",
    endereco: perfilSalvo.endereco !== defaultPerfil.endereco ? perfilSalvo.endereco : ""
  });

  if (!cadastro) {
    return null;
  }

  try {
    await syncClientRegistration(cadastro);
    showToast("Cadastro salvo com sucesso.");
    return getPerfil();
  } catch (error) {
    showToast(error.message || "Não foi possível salvar seu cadastro.", "error");
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
