function renderCarrinho() {
  // Recalcula resumo, subtotal, taxas e total do checkout.
  renderCartBadge();
  const lista = document.getElementById("carrinho-lista");
  const contagem = document.getElementById("carrinho-contagem");
  const checkoutItens = document.getElementById("checkout-itens");
  const subtotalEl = document.getElementById("checkout-subtotal");
  const descontoEl = document.getElementById("checkout-desconto");
  const descontoLinha = document.getElementById("checkout-desconto-linha");
  const entregaEl = document.getElementById("checkout-entrega");
  const totalEl = document.getElementById("checkout-total");
  const cupomWrapper = document.getElementById("checkout-cupom");
  const cupomDescricao = document.getElementById("checkout-cupom-descricao");
  const cupomAplicar = document.getElementById("checkout-cupom-aplicar");
  const entregaOpcaoValor = document.querySelector('.opcao-entrega input[value="entrega"]')?.closest(".opcao-entrega")?.querySelector("em");
  const radioSelecionado = document.querySelector(
    'input[name="tipo-recebimento"]:checked'
  );

  if (
    !lista ||
    !contagem ||
    !checkoutItens ||
    !subtotalEl ||
    !descontoEl ||
    !descontoLinha ||
    !entregaEl ||
    !totalEl ||
    !cupomWrapper ||
    !cupomDescricao ||
    !cupomAplicar ||
    !entregaOpcaoValor
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
  const nitrogoFreeDelivery =
    currentNitrogoCheckoutState.available &&
    currentNitrogoCheckoutState.applied &&
    Number(currentNitrogoCheckoutState.establishmentId) === Number(establishmentInfo.id_estabelecimento) &&
    currentNitrogoCheckoutState.freeDelivery;
  const entrega =
    carrinho.length && radioSelecionado?.value === "entrega"
      ? nitrogoFreeDelivery
        ? 0
        : deliveryFee
      : 0;
  const desconto = getNitrogoCheckoutDiscount(
    carrinho,
    radioSelecionado?.value || "entrega"
  );
  const total = Math.max(subtotal + entrega - desconto, 0);

  const establishmentName = establishmentInfo.restauranteNome || "Estabelecimento";
  contagem.textContent = carrinho.length
    ? `${ totalItens } ${ totalItens === 1 ? "item" : "itens" } • ${ establishmentName } `
    : `${ totalItens } ${ totalItens === 1 ? "item" : "itens" } `;
  subtotalEl.textContent = formatCurrency(subtotal);
  descontoEl.textContent = `- ${ formatCurrency(desconto) } `;
  descontoLinha.hidden = desconto <= 0;
  entregaEl.textContent = formatCurrency(entrega);
  totalEl.textContent = formatCurrency(total);
  entregaOpcaoValor.textContent = nitrogoFreeDelivery
    ? "Grátis com NitroGo"
    : `+ ${ formatCurrency(deliveryFee) } `;

  const availableNitrogoBenefits = [];
  if (Number(currentNitrogoCheckoutState.couponValue || 0) > 0) {
    availableNitrogoBenefits.push(`Cupom de ${ formatCurrency(currentNitrogoCheckoutState.couponValue) } `);
  }
  if (currentNitrogoCheckoutState.freeDelivery) {
    availableNitrogoBenefits.push("frete grátis");
  }
  cupomWrapper.hidden = !carrinho.length || !currentNitrogoCheckoutState.available;
  cupomDescricao.textContent = availableNitrogoBenefits.length
    ? `${ availableNitrogoBenefits.join(" e ") } para ${ establishmentName } `
    : `Benefício NitroGo disponível para ${ establishmentName } `;
  cupomAplicar.textContent = currentNitrogoCheckoutState.applied ? "Remover cupom" : "Aplicar cupom";

  if (!carrinho.length) {
    currentNitrogoCheckoutState.applied = false;
    cupomWrapper.hidden = true;
    descontoLinha.hidden = true;
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
              <button type="button" class="btn-secundario carrinho-item-remover" data-cart-id="${item.id}">Remover</button>
            </div>
          </div>
          <strong>${formatCurrency(item.precoNumero * item.quantidade)}</strong>
        </article>
      `
    )
    .join("");

  checkoutItens.innerHTML = `
      <p class="checkout-itens-titulo">Itens do pedido</p>
      ${
      carrinho
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
        .join("")
    }
    `;
}

async function hydrateCartRestaurantNames() {
  const carrinho = getCarrinho();

  if (!carrinho.length) {
    return;
  }

  const itemsWithoutRestaurantName = carrinho.filter(
    (item) => !String(item.restauranteNome || "").trim() && item.id_estabelecimento
  );

  if (!itemsWithoutRestaurantName.length) {
    return;
  }

  const uniqueRestaurantIds = [...new Set(
    itemsWithoutRestaurantName.map((item) => String(item.id_estabelecimento))
  )];

  try {
    const establishments = await Promise.all(
      uniqueRestaurantIds.map((id) => fetchEstablishment(id).catch(() => null))
    );

    const nameById = new Map();
    establishments.forEach((establishment, index) => {
      if (establishment?.nome) {
        nameById.set(uniqueRestaurantIds[index], establishment.nome);
      }
    });

    let updated = false;
    const nextCart = carrinho.map((item) => {
      if (String(item.restauranteNome || "").trim()) {
        return item;
      }

      const fallbackName = nameById.get(String(item.id_estabelecimento));
      if (!fallbackName) {
        return item;
      }

      updated = true;
      return {
        ...item,
        restauranteNome: fallbackName
      };
    });

    if (updated) {
      setCarrinho(nextCart);
    }
  } catch (error) {
    // Se a hidratação falhar, mantemos o carrinho funcionando com o fallback visual.
  }
}

async function hydrateCheckoutEstablishmentBenefits() {
  const carrinho = getCarrinho();
  if (!carrinho.length) {
    currentNitrogoCheckoutState = {
      establishmentId: null,
      available: false,
      applied: false,
      couponValue: 0,
      freeDelivery: false
    };
    return;
  }

  const establishmentId = carrinho[0]?.id_estabelecimento;
  if (!establishmentId) {
    return;
  }

  try {
    const establishment = await fetchEstablishment(establishmentId);
    syncNitrogoCheckoutState(establishment);
  } catch (error) {
    currentNitrogoCheckoutState = {
      establishmentId: Number(establishmentId),
      available: false,
      applied: false,
      couponValue: 0,
      freeDelivery: false
    };
  }
}

function setupCarrinhoPage() {
  const lista = document.getElementById("carrinho-lista");
  const botaoFinalizar = document.querySelector(".checkout-button");
  const botaoLimpar = document.querySelector(".limpar-button");
  const botaoCupom = document.getElementById("checkout-cupom-aplicar");
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
  Promise.all([hydrateCartRestaurantNames(), hydrateCheckoutEstablishmentBenefits()]).then(() => {
    syncDeliveryOptions();
    renderCarrinho();
  });

  opcoesRecebimento.forEach((input) => {
    input.addEventListener("change", () => {
      renderCarrinho();
    });
  });

  botaoCupom?.addEventListener("click", () => {
    if (!currentNitrogoCheckoutState.available) {
      return;
    }

    currentNitrogoCheckoutState.applied = !currentNitrogoCheckoutState.applied;
    renderCarrinho();
    showToast(
      currentNitrogoCheckoutState.applied
        ? "Cupom NitroGo aplicado ao checkout."
        : "Cupom NitroGo removido do checkout."
    );
  });

  lista.addEventListener("click", (event) => {
    const button = event.target.closest("[data-cart-id]");

    if (!button) {
      return;
    }

    const carrinho = getCarrinho().filter((item) => item.id !== button.dataset.cartId);
    setCarrinho(carrinho);
    currentNitrogoCheckoutState.applied = false;
    syncDeliveryOptions();
    hydrateCheckoutEstablishmentBenefits().then(() => renderCarrinho());
  });

  botaoLimpar.addEventListener("click", () => {
    setCarrinho([]);
    currentNitrogoCheckoutState.applied = false;
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

    const confirmed = await showConfirm(
      `${ getClientCancellationPolicyMessage() } Deseja seguir para o pagamento no Mercado Pago ? `,
      {
        title: "Confirmação de compra",
        tag: "Checkout",
        confirmLabel: "Ir para o pagamento",
        cancelLabel: "Voltar"
      }
    );

    if (!confirmed) {
      return;
    }

    try {
      const result = await submitOrder();
      if (!result) {
        return;
      }

      const checkoutUrl = result?.data?.checkout_url;
      if (!checkoutUrl) {
        throw new Error("Não foi possível gerar a página de pagamento.");
      }

      window.location.href = checkoutUrl;
    } catch (error) {
      showToast(error.message || "Erro ao finalizar o pedido.", "error");
    }
  });
}

