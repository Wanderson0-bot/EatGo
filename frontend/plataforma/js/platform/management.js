function renderPartnerHeader() {
  const user = getPartnerUser();
  if (!user) {
    return;
  }

  const dashboardTitle = document.getElementById("dashboard-title");
  const dashboardRestaurant = document.getElementById("dashboard-restaurante");

  if (dashboardTitle) {
    dashboardTitle.textContent = `Resumo do estabelecimento ${ user.estabelecimento_nome } `;
  }

  if (dashboardRestaurant) {
    dashboardRestaurant.textContent = `Bem - vindo ao painel de gestão de ${ user.estabelecimento_nome }.`;
  }
}

const MANAGEMENT_POLL_INTERVAL_MS = 15000;
let managementPollingTimer = null;
let knownManagementOrderIds = null;
let knownClientOrderState = new Map();

function getManagementPageType() {
  const path = window.location.pathname;

  if (path.endsWith("/gestao/index.html") || path.endsWith("/gestao/index")) {
    return "dashboard";
  }

  if (path.endsWith("/gestao/pedidos.html") || path.endsWith("/gestao/pedidos")) {
    return "pedidos";
  }

  if (path.endsWith("/gestao/vendas.html") || path.endsWith("/gestao/vendas")) {
    return "vendas";
  }

  if (path.endsWith("/gestao/entregas.html") || path.endsWith("/gestao/entregas")) {
    return "entregas";
  }

  if (path.endsWith("/gestao/cardapio.html") || path.endsWith("/gestao/cardapio")) {
    return "cardapio";
  }

  if (path.endsWith("/gestao/configuracoes.html") || path.endsWith("/gestao/configuracoes")) {
    return "configuracoes";
  }

  return null;
}

function notifyNewManagementOrders(orders) {
  const openApprovedOrders = orders.filter(
    (order) => order.status === "pago" && order.pagamento_status === "aprovado"
  );
  const currentIds = new Set(openApprovedOrders.map((order) => String(order.id_pedido)));

  if (!knownManagementOrderIds) {
    knownManagementOrderIds = currentIds;
    return;
  }

  const newOrders = openApprovedOrders.filter(
    (order) => !knownManagementOrderIds.has(String(order.id_pedido))
  );

  if (newOrders.length) {
    const latestOrder = newOrders[0];
    showToast(
      newOrders.length === 1
        ? `Novo pedido #${ latestOrder.id_pedido } de ${ latestOrder.cliente_nome }.`
        : `${ newOrders.length } novos pedidos aguardando confirmacao.`,
      "success"
    );
  }

  knownManagementOrderIds = currentIds;
}

function notifyClientOrderUpdates(orders) {
  orders.forEach((order) => {
    const previous = knownClientOrderState.get(String(order.id_pedido));
    const nextSnapshot = {
      status: order.status,
      cancelamento_status: order.cancelamento_status
    };

    if (!previous) {
      knownClientOrderState.set(String(order.id_pedido), nextSnapshot);
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

    knownClientOrderState.set(String(order.id_pedido), nextSnapshot);
  });
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

async function handleManagementCancellationDecision(orderId, decisao) {
  if (decisao === "negar") {
    const analiseTexto = await showPrompt({
      title: "Negar cancelamento",
      message: "Explique ao cliente por que o cancelamento foi negado.",
      label: "Análise",
      defaultValue: "O pedido ja estava em preparo e nao pode ser cancelado sem custo.",
      tag: "Gestao"
    });

    if (analiseTexto === null) {
      return false;
    }

    await reviewManagementOrderCancellation(orderId, {
      decisao,
      taxa: 0,
      analise_texto: analiseTexto.trim()
    });
    return true;
  }

  if (decisao === "aprovar_total") {
    const analiseTexto = await showPrompt({
      title: "Aprovar reembolso total",
      message: "Informe uma observação para o cliente.",
      label: "Análise",
      defaultValue: "Cancelamento aceito com reembolso total.",
      tag: "Gestao"
    });

    if (analiseTexto === null) {
      return false;
    }

    await reviewManagementOrderCancellation(orderId, {
      decisao,
      analise_texto: analiseTexto.trim()
    });
    return true;
  }

  const valorPrompt = await showPrompt({
    title: "Reembolso parcial",
    message: "Informe o valor do reembolso parcial em reais.",
    label: "Valor do reembolso",
    defaultValue: "0,00",
    tag: "Gestao"
  });

  if (valorPrompt === null) {
    return false;
  }

  const analiseTexto = await showPrompt({
    title: "Reembolso parcial",
    message: "Explique ao cliente a decisão tomada.",
    label: "Análise",
    defaultValue: "Cancelamento aceito parcialmente devido ao preparo iniciado.",
    tag: "Gestao"
  });

  if (analiseTexto === null) {
    return false;
  }

  await reviewManagementOrderCancellation(orderId, {
    decisao,
    valor_reembolso: Number(String(valorPrompt).replace(/[^0-9,.-]/g, "").replace(",", ".")),
    analise_texto: analiseTexto.trim()
  });
  return true;
}

function renderGestaoDashboard(establishment, orders) {
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
    cards[0].querySelector("p").textContent = `${ paidTodayOrders.length } pedidos pagos hoje`;

    cards[1].querySelector("strong").textContent = String(ongoingOrders).padStart(2, "0");
    cards[1].querySelector("p").textContent = `${ ongoingOrders } pedidos em andamento`;

    cards[2].querySelector("strong").textContent = formatCurrency(averageTicket);
    cards[2].querySelector("p").textContent = "Ticket médio do dia";
  }

  const statusItems = document.querySelectorAll(".gestao-status-item");
  if (statusItems.length >= 3) {
    const prepareCount = orders.filter((order) => order.pagamento_status === "aprovado" && order.status === "preparando").length;
    const deliveryCount = orders.filter((order) => order.pagamento_status === "aprovado" && order.status === "saiu_para_entrega").length;
    const attentionCount = orders.filter((order) => order.pagamento_status === "aprovado" && ["pago", "confirmado"].includes(order.status)).length;

    statusItems[0].querySelector("strong").textContent = "Em preparo";
    statusItems[0].querySelector("p").textContent = `${ prepareCount } pedidos em produção`;
    statusItems[0].querySelector("b").textContent = String(prepareCount);

    statusItems[1].querySelector("strong").textContent = "Saiu para entrega";
    statusItems[1].querySelector("p").textContent = `${ deliveryCount } pedidos com entregadores`;
    statusItems[1].querySelector("b").textContent = String(deliveryCount);

    statusItems[2].querySelector("strong").textContent = "Precisam de atenção";
    statusItems[2].querySelector("p").textContent = `${ attentionCount } pedidos em progresso`;
    statusItems[2].querySelector("b").textContent = String(attentionCount);
  }
}

async function setupGestaoDashboard() {
  const [establishment, orders] = await Promise.all([
    fetchManagementEstablishment(),
    fetchManagementOrders(),
  ]);

  renderGestaoDashboard(establishment, orders);
}

function createOrderRow(order) {
  const cancellationActions = order.cancelamento_status === "em_analise"
    ? `
      < button class="btn-primario" type = "button" data - review - cancel - total="${order.id_pedido}" > Aprovar total</button >
      <button class="btn-secundario" type="button" data-review-cancel-partial="${order.id_pedido}">Aprovar parcial</button>
      <button class="btn-secundario" type="button" data-review-cancel-deny="${order.id_pedido}">Negar</button>
    `
    : `
      < button class="btn-primario" type = "button" data - accept - order="${order.id_pedido}" > Aceitar</button >
        <button class="btn-secundario" type="button" data-reject-order="${order.id_pedido}">Recusar</button>
    `;

  return `
      < div class="gestao-tabela-linha" >
      <span>#${order.id_pedido}</span>
      <span>
        ${order.cliente_nome}
        ${order.tipo_recebimento === "entrega" ? `<br><small>${order.cliente_endereco || "Endereço não disponível"}</small>` : ""}
      </span>
      <span>${order.tipo_recebimento === "entrega" ? "Delivery" : "Retirada"}</span>
      <span>${formatCurrency(Number(order.total || 0))}</span>
      <span>
        ${getOrderBadge(order)}
        <br><small>Pagamento: ${formatPaymentStatusLabel(order.pagamento_status)}</small>
        ${order.cancelamento_status && order.cancelamento_status !== "nenhum" ? `<br><small>Cancelamento: ${formatCancellationStatusLabel(order.cancelamento_status)}</small>` : ""}
      </span>
      <span class="card-acoes">
        ${cancellationActions}
      </span>
    </div >
      `;
}

function renderGestaoPedidos(orders) {
  const newOrders = orders.filter(
    (order) => order.status === "pago" && order.pagamento_status === "aprovado"
  );
  const cancellationReviewOrders = orders.filter((order) => order.cancelamento_status === "em_analise");
  const preparingOrders = orders.filter(
    (order) => order.pagamento_status === "aprovado" && order.status === "preparando"
  );
  const routeOrders = orders.filter(
    (order) => order.pagamento_status === "aprovado" && order.status === "saiu_para_entrega"
  );
  const waitingActionOrders = orders.filter(
    (order) => order.pagamento_status === "aprovado" && ["pago", "confirmado"].includes(order.status)
  );
  const table = document.getElementById("pedidos-tabela");

  const cards = document.querySelectorAll(".gestao-card-metrica");
  if (cards.length >= 3) {
    cards[0].querySelector("strong").textContent = String(preparingOrders.length).padStart(2, "0");
    cards[0].querySelector("p").textContent = "Pedidos sendo preparados na cozinha.";

    cards[1].querySelector("strong").textContent = String(routeOrders.length).padStart(2, "0");
    cards[1].querySelector("p").textContent = "Entregadores a caminho dos clientes.";

    cards[2].querySelector("strong").textContent = String(waitingActionOrders.length).padStart(2, "0");
    cards[2].querySelector("p").textContent = "Pedidos aguardando ação da loja.";
  }

  const statusItems = document.querySelectorAll(".gestao-status-item");
  if (statusItems.length >= 3) {
    statusItems[0].querySelector("strong").textContent = "Em preparo";
    statusItems[0].querySelector("p").textContent = `${ preparingOrders.length } pedidos em produção`;
    statusItems[0].querySelector("b").textContent = String(preparingOrders.length);

    statusItems[1].querySelector("strong").textContent = "Saiu para entrega";
    statusItems[1].querySelector("p").textContent = `${ routeOrders.length } pedidos em rota`;
    statusItems[1].querySelector("b").textContent = String(routeOrders.length);

    statusItems[2].querySelector("strong").textContent = "Aguardando ação";
    statusItems[2].querySelector("p").textContent = `${ waitingActionOrders.length } pedidos precisam de confirmação`;
    statusItems[2].querySelector("b").textContent = String(waitingActionOrders.length);
  }

  if (!table) {
    return;
  }

  const displayedOrders = [...cancellationReviewOrders, ...newOrders];

  if (!displayedOrders.length) {
    table.innerHTML = `
      < div class="gestao-tabela-linha gestao-tabela-head" >
        <span>Pedido</span>
        <span>Cliente</span>
        <span>Canal</span>
        <span>Total</span>
        <span>Status</span>
        <span>Ações</span>
      </div >
      <div class="gestao-tabela-linha">
        <span colspan="6">Nenhum pedido aguardando ação.</span>
      </div>
    `;
    return;
  }

  table.innerHTML = `
      < div class="gestao-tabela-linha gestao-tabela-head" >
      <span>Pedido</span>
      <span>Cliente</span>
      <span>Canal</span>
      <span>Total</span>
      <span>Status</span>
      <span>Ações</span>
    </div >
      ${ displayedOrders.map(createOrderRow).join("") }
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

  table.querySelectorAll("[data-review-cancel-total]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        const completed = await handleManagementCancellationDecision(button.dataset.reviewCancelTotal, "aprovar_total");
        if (!completed) return;
        showToast("Cancelamento aprovado com reembolso total.", "success");
        await setupGestaoPedidos();
      } catch (error) {
        showToast(error.message || "Não foi possível concluir a análise.", "error");
      }
    });
  });

  table.querySelectorAll("[data-review-cancel-partial]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        const completed = await handleManagementCancellationDecision(button.dataset.reviewCancelPartial, "aprovar_parcial");
        if (!completed) return;
        showToast("Cancelamento aprovado com reembolso parcial.", "success");
        await setupGestaoPedidos();
      } catch (error) {
        showToast(error.message || "Não foi possível concluir a análise.", "error");
      }
    });
  });

  table.querySelectorAll("[data-review-cancel-deny]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        const completed = await handleManagementCancellationDecision(button.dataset.reviewCancelDeny, "negar");
        if (!completed) return;
        showToast("Cancelamento negado com sucesso.", "success");
        await setupGestaoPedidos();
      } catch (error) {
        showToast(error.message || "Não foi possível concluir a análise.", "error");
      }
    });
  });
}

async function setupGestaoPedidos() {
  const orders = await fetchManagementOrders();
  renderGestaoPedidos(orders);
}

function renderGestaoVendas(orders) {
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
  const hourLabel = bestHour ? `${ bestHour[0] } h - ${ Number(bestHour[0]) + 1 } h` : "-";

  const cards = document.querySelectorAll(".gestao-card-metrica");
  if (cards.length >= 3) {
    cards[0].querySelector("strong").textContent = formatCurrency(totalRevenue);
    cards[0].querySelector("p").textContent = `${ paidOrders.length } pedidos pagos no período`;

    cards[1].querySelector("strong").textContent = channelCounts.delivery >= channelCounts.pickup ? "Delivery" : "Retirada";
    cards[1].querySelector("p").textContent = `${ Math.max(channelCounts.delivery, channelCounts.pickup) } pedidos`;

    cards[2].querySelector("strong").textContent = hourLabel;
    cards[2].querySelector("p").textContent = "Horário de maior demanda";
  }

  const recentOrders = paidOrders.slice(0, 4);
  const tabela = document.querySelector(".gestao-tabela");
  if (!tabela) {
    return;
  }

  tabela.innerHTML = `
      < div class="gestao-tabela-linha gestao-tabela-head" >
      <span>Pedido</span>
      <span>Cliente</span>
      <span>Canal</span>
      <span>Total</span>
      <span>Status</span>
    </div >
      ${
      recentOrders
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
        .join("")
    }
    `;
}

async function setupGestaoVendas() {
  const orders = await fetchManagementOrders();
  renderGestaoVendas(orders);
}

function getDeliveryAction(order) {
  if (order.pagamento_status !== "aprovado") {
    return null;
  }

  if (order.status === "confirmado") {
    return { nextStatus: "preparando", label: "Iniciar preparo" };
  }

  if (order.status === "preparando") {
    return {
      nextStatus: order.tipo_recebimento === "entrega" ? "saiu_para_entrega" : "entregue",
      label: order.tipo_recebimento === "entrega" ? "Saiu para entrega" : "Marcar retirada"
    };
  }

  if (order.status === "saiu_para_entrega") {
    return { nextStatus: "entregue", label: "Marcar entregue" };
  }

  return null;
}

function renderGestaoEntregas(orders) {
  const paidOrders = orders.filter((order) => order.pagamento_status === "aprovado");
  const atrasoCount = paidOrders.filter((order) => order.status === "pago").length;
  const atencaoCount = paidOrders.filter((order) => ["confirmado", "preparando"].includes(order.status)).length;
  const noPrazoCount = paidOrders.filter((order) => ["saiu_para_entrega", "entregue"].includes(order.status)).length;

  const statusItems = document.querySelectorAll(".gestao-status-item");
  if (statusItems.length >= 3) {
    statusItems[0].querySelector("strong").textContent = "Atrasado";
    statusItems[0].querySelector("p").textContent = `${ atrasoCount } pedidos aguardando ação`;
    statusItems[0].querySelector("b").textContent = String(atrasoCount);

    statusItems[1].querySelector("strong").textContent = "Atenção";
    statusItems[1].querySelector("p").textContent = `${ atencaoCount } pedidos em preparação`;
    statusItems[1].querySelector("b").textContent = String(atencaoCount);

    statusItems[2].querySelector("strong").textContent = "No prazo";
    statusItems[2].querySelector("p").textContent = `${ noPrazoCount } pedidos em rota ou entregues`;
    statusItems[2].querySelector("b").textContent = String(noPrazoCount);
  }

  const operationOrders = paidOrders.filter((order) =>
    ["confirmado", "preparando", "saiu_para_entrega", "entregue"].includes(order.status)
  );
  const tabela = document.querySelector(".gestao-tabela");
  if (!tabela) {
    return;
  }

  tabela.innerHTML = `
      < div class="gestao-tabela-linha gestao-tabela-head" >
      <span>Pedido</span>
      <span>Cliente</span>
      <span>Canal</span>
      <span>Atualização</span>
      <span>Status</span>
      <span>Ações</span>
    </div >
      ${
      operationOrders
        .map(
          (order) => {
            const action = getDeliveryAction(order);
            return `
          <div class="gestao-tabela-linha">
            <span>#${order.id_pedido}</span>
            <span>${order.cliente_nome}</span>
            <span>${order.tipo_recebimento === "entrega" ? "Delivery" : "Retirada"}</span>
            <span>${getTimeString(order.atualizado_em || order.criado_em)}</span>
            <span class="${getStatusBadgeClass(order.status)}">${formatStatusLabel(order.status)}</span>
            <span class="card-acoes">
              ${action ? `<button class="btn-primario" type="button" data-delivery-next-status="${action.nextStatus}" data-delivery-order-id="${order.id_pedido}">${action.label}</button>` : `<span class="status-badge neutral">Sem ação</span>`}
            </span>
          </div>
        `;
          }
        )
        .join("")
    }
    `;

  tabela.querySelectorAll("[data-delivery-order-id][data-delivery-next-status]").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;

      try {
        await updateManagementOrderStatus(
          button.dataset.deliveryOrderId,
          button.dataset.deliveryNextStatus
        );
        showToast("Status da entrega atualizado com sucesso.", "success");
        await setupGestaoEntregas();
      } catch (error) {
        showToast(error.message || "Não foi possível atualizar a entrega.", "error");
      } finally {
        button.disabled = false;
      }
    });
  });
}

async function setupGestaoEntregas() {
  const orders = await fetchManagementOrders();
  renderGestaoEntregas(orders);
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
  const imageFileInput = form?.querySelector('input[name="imagem_file"]');
  const imageHiddenInput = form?.querySelector('input[name="imagem"]');
  const imagePreview = document.getElementById("cardapio-imagem-preview");

  if (!tabela) {
    return;
  }

  let items = [];
  let editingItemId = null;

  function resetForm() {
    editingItemId = null;
    form?.reset();
    if (imageHiddenInput) {
      imageHiddenInput.value = "";
    }
    syncFileImagePreview(imagePreview, "");

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
    if (imageFileInput) {
      imageFileInput.value = "";
    }
    syncFileImagePreview(imagePreview, item.imagem || "");
    form.ativo.checked = Boolean(item.ativo);

    if (formTitle) {
      formTitle.textContent = `Editando ${ item.nome } `;
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

  async function getMenuPayload() {
    if (!form) {
      return null;
    }

    return {
      nome: form.nome.value.trim(),
      descricao: form.descricao.value.trim() || null,
      categoria: form.categoria.value.trim() || null,
      preco: Number(form.preco.value),
      preco_promocional: form.preco_promocional.value ? Number(form.preco_promocional.value) : null,
      imagem: await resolveImageInputValue(imageFileInput, imageHiddenInput),
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

  bindFileImagePreview(imageFileInput, imageHiddenInput, imagePreview);

  function renderItems() {
    if (!items.length) {
      tabela.innerHTML = `
      < div class="gestao-tabela-linha gestao-tabela-head" >
          <span>Item</span>
          <span>Categoria</span>
          <span>Preço</span>
          <span>Status</span>
          <span>Ações</span>
        </div >
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
      < div class="gestao-tabela-linha gestao-tabela-head" >
        <span>Item</span>
        <span>Categoria</span>
        <span>Preço</span>
        <span>Status</span>
        <span>Ações</span>
      </div >
      ${
      items
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
        .join("")
    }
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
          `Deseja remover "${item?.nome || "este item"}" do cardápio ? `,
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
          showToast(error.message || "Não foi possível remover o item.", "error");
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
        showToast(error.message || "Não foi possível atualizar o cardápio.", "error");
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

    try {
      const payload = await getMenuPayload();
      if (!payload) {
        return;
      }

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
      showToast(error.message || "Não foi possível salvar o item.", "error");
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
      : "Conta Mercado Pago não conectada. Informe o access token da conta que deve receber os pagamentos.";
  }
  const deliveryRadio = form.querySelector(
    `input[name = "tipo-entrega"][value = "${establishment.possui_entrega ? "sim" : "nao"}"]`
  );
  if (deliveryRadio) {
    deliveryRadio.checked = true;
    deliveryRadio.dispatchEvent(new Event("change"));
  }
  const taxaEntregaField = form.elements.taxa_entrega || form.elements["taxa-entrega"];
  if (taxaEntregaField) {
    taxaEntregaField.value = establishment.taxa_entrega || "";
  }
  form.horario_abertura.value = establishment.horario_abertura || "";
  form.horario_fechamento.value = establishment.horario_fechamento || "";

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
      horario_abertura: form.horario_abertura.value.trim(),
      horario_fechamento: form.horario_fechamento.value.trim()
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

async function refreshManagementView({ notify = false } = {}) {
  const pageType = getManagementPageType();

  if (!pageType) {
    return;
  }

  if (["dashboard", "pedidos", "vendas", "entregas", "cardapio", "configuracoes"].includes(pageType)) {
    const orders = await fetchManagementOrders().catch(() => null);

    if (orders && notify) {
      notifyNewManagementOrders(orders);
    } else if (orders && knownManagementOrderIds === null) {
      notifyNewManagementOrders(orders);
    }

    if (pageType === "dashboard" && orders) {
      const establishment = await fetchManagementEstablishment().catch(() => null);
      if (establishment) {
        renderGestaoDashboard(establishment, orders);
      }
      return;
    }

    if (pageType === "pedidos" && orders) {
      renderGestaoPedidos(orders);
      return;
    }

    if (pageType === "vendas" && orders) {
      renderGestaoVendas(orders);
      return;
    }

    if (pageType === "entregas" && orders) {
      renderGestaoEntregas(orders);
      return;
    }
  }
}

function startManagementRealtimeUpdates() {
  if (managementPollingTimer) {
    window.clearInterval(managementPollingTimer);
    managementPollingTimer = null;
  }

  if (!isPartnerPage()) {
    return;
  }

  managementPollingTimer = window.setInterval(() => {
    refreshManagementView({ notify: true }).catch(() => { });
  }, MANAGEMENT_POLL_INTERVAL_MS);
}

async function initializeGestaoPage() {
  if (!isPartnerPage()) {
    return;
  }

  const authOk = await ensurePartnerAuth();
  if (!authOk) {
    return;
  }

  const pageType = getManagementPageType();
  if (pageType === "dashboard") {
    await setupGestaoDashboard();
  }

  if (pageType === "pedidos") {
    await setupGestaoPedidos();
  }

  if (pageType === "vendas") {
    await setupGestaoVendas();
  }

  if (pageType === "entregas") {
    await setupGestaoEntregas();
  }

  if (pageType === "cardapio") {
    await setupGestaoCardapio();
  }

  if (pageType === "configuracoes") {
    await setupGestaoConfiguracoes();
  }

  await refreshManagementView();
  startManagementRealtimeUpdates();
}

