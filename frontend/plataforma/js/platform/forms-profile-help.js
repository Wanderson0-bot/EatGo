let knownProfileClientOrderState = new Map();

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
    `input[name = "tipo-entrega"][value = "${rascunho.entrega || "sim"}"]`
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
    !endereco
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
  pedidosMes.textContent = `${ perfil.pedidosMes } pedidos este mes`;
  pagamento.textContent = perfil.pagamento;
  nome.textContent = perfil.nome;
  email.textContent = perfil.email;
  telefone.textContent = perfil.telefone;
  endereco.textContent = perfil.endereco;

  if (preferencias) {
    preferencias.innerHTML = perfil.preferencias
      .map((item) => `<span>${item}</span>`)
      .join("");
  }
}

function notifyProfileClientOrderUpdates(orders) {
  orders.forEach((order) => {
    const orderId = String(order.id_pedido);
    const previous = knownProfileClientOrderState.get(orderId);
    const nextSnapshot = {
      status: order.status,
      cancelamento_status: order.cancelamento_status
    };

    if (!previous) {
      knownProfileClientOrderState.set(orderId, nextSnapshot);
      return;
    }

    if (previous.cancelamento_status !== order.cancelamento_status) {
      if (order.cancelamento_status === "em_analise") {
        showToast(`Pedido #${ order.id_pedido }: cancelamento enviado para analise.`, "info");
      } else if (order.cancelamento_status === "aprovado_total") {
        showToast(`Pedido #${ order.id_pedido }: reembolso total aprovado.`, "success");
      } else if (order.cancelamento_status === "aprovado_parcial") {
        showToast(`Pedido #${ order.id_pedido }: reembolso parcial aprovado.`, "success");
      } else if (order.cancelamento_status === "negado") {
        showToast(`Pedido #${ order.id_pedido }: cancelamento negado pelo estabelecimento.`, "warning");
      }
    } else if (previous.status !== order.status && order.status === "saiu_para_entrega") {
      showToast(`Pedido #${ order.id_pedido } saiu para entrega.`, "success");
    }

    knownProfileClientOrderState.set(orderId, nextSnapshot);
  });
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
      showToast(error.message || "Não foi possível sincronizar o perfil no backend.", "warning");
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
        notifyProfileClientOrderUpdates(orders);
        renderProfileOrders(orders);

        ordersSection.querySelectorAll("[data-client-cancel-order]").forEach((button) => {
          button.addEventListener("click", async () => {
            const confirmed = await showConfirm(
              `${ getClientCancellationPolicyMessage() } Confirma a solicitação de cancelamento deste pedido ? `,
              {
                title: "Cancelar pedido",
                tag: "Pedidos",
                confirmLabel: "Continuar cancelamento",
              }
            );

            if (!confirmed) {
              return;
            }

            const motivo = await showPrompt({
              title: "Motivo do cancelamento",
              message: "Explique rapidamente o motivo para enviar a solicitação ao estabelecimento.",
              label: "Motivo",
              defaultValue: "Nao poderei receber o pedido.",
              tag: "Pedidos"
            });

            if (motivo === null) {
              return;
            }

            try {
              await cancelClientOrder(button.dataset.clientCancelOrder, clientId, motivo.trim());
              showToast("Solicitação de cancelamento enviada com sucesso.", "success");
              await loadOrders();
            } catch (error) {
              showToast(error.message || "Não foi possível cancelar o pedido.", "error");
            }
          });
        });
      } catch (error) {
        showToast(error.message || "Não foi possível carregar seus pedidos.", "warning");
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

    window.setInterval(() => {
      if (hasClientRegistration()) {
        loadOrders().catch(() => { });
      }
    }, 15000);
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
  const isCartPage =
    window.location.pathname.endsWith("/carrinho.html") ||
    window.location.pathname.endsWith("/carrinho");
  const isProfilePage = window.location.pathname.endsWith("/perfil.html");

  if (!isCartPage && !isProfilePage) {
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

  const syncKey = `${ paymentReference }:${ paymentStatus }:${ params.get("payment_id") || "" } `;
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
      if (typeof renderCarrinho === "function") {
        renderCarrinho();
      }
      await showAlert("Pagamento aprovado com sucesso no Mercado Pago.", {
        title: "Pedido confirmado",
        tag: "Checkout"
      });
      if (isProfilePage) {
        const clientId = getClientId();
        if (clientId) {
          fetchClientOrders(clientId).catch(() => []);
        }
      } else {
        window.location.href = "perfil.html";
        return;
      }
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
    showToast(error.message || "Não foi possível sincronizar o retorno do pagamento.", "warning");
  } finally {
    const cleanUrl = `${ window.location.pathname }${ window.location.hash || "" } `;
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
      visibleItems === 1 ? "1 resposta encontrada" : `${ visibleItems } respostas encontradas`;
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

    const destinatario = "eatgo630@gmail.com";
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
