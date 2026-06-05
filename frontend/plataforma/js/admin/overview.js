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
  if (!confirm(`Tem certeza que deseja remover o estabelecimento com ID ${id}?\n\nEsta ação irá excluir o estabelecimento e os dados vinculados do banco de dados.`)) {
    return;
  }

  const typedId = window.prompt(
    `Para confirmar a exclusão permanente, digite o ID ${id}:`,
    ""
  );

  if (typedId == null) {
    return;
  }

  if (String(typedId).trim() !== String(id).trim()) {
    alert("O ID informado não confere. A exclusão foi cancelada.");
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

async function fetchEstablishmentDetails(id) {
  const response = await apiRequest(`/api/admin/establishments/${id}`);
  return response?.data || null;
}

function setEstablishmentFormMode(mode, establishment = null) {
  const form = document.getElementById("admin-cadastro-form");
  const submitButton = form?.querySelector('button[type="submit"]');
  const editPanel = document.getElementById("admin-form-mode-panel");
  const editLabel = document.getElementById("admin-form-mode-label");
  const cancelButton = document.getElementById("admin-cancel-edit");
  const inlineCancelButton = document.getElementById("admin-cancel-edit-inline");
  const passwordInput = document.getElementById("admin-senha-acesso");
  const editIdInput = document.getElementById("admin-edit-establishment-id");

  currentEditingEstablishmentId = mode === "edit" ? String(establishment?.id_estabelecimento || "") : null;

  if (submitButton) {
    submitButton.textContent = mode === "edit"
      ? "Salvar alterações do estabelecimento"
      : "Cadastrar estabelecimento";
  }

  if (passwordInput) {
    passwordInput.required = mode !== "edit";
    passwordInput.placeholder = mode === "edit"
      ? "Preencha apenas se quiser alterar a senha"
      : "Minimo de 8 caracteres";
  }

  if (editPanel && editLabel) {
    editPanel.classList.toggle("admin-hidden", mode !== "edit");
    editLabel.textContent = mode === "edit" && establishment
      ? `Editando ID ${establishment.id_estabelecimento} • ${establishment.nome || "Estabelecimento"}`
      : "Nenhum estabelecimento carregado.";
  }

  if (cancelButton) {
    cancelButton.classList.toggle("admin-hidden", mode !== "edit");
  }

  if (inlineCancelButton) {
    inlineCancelButton.classList.toggle("admin-hidden", mode !== "edit");
  }

  if (mode === "edit" && editIdInput && currentEditingEstablishmentId) {
    editIdInput.value = currentEditingEstablishmentId;
  }
}

function populateEstablishmentForm(establishment) {
  const form = document.getElementById("admin-cadastro-form");
  if (!form || !establishment) {
    return;
  }

  form.elements.nome.value = establishment.nome || "";
  form.elements.cnpj.value = establishment.cnpj || "";
  form.elements.email.value = establishment.email || establishment.management_user?.email || "";
  form.elements.responsavel_nome.value = establishment.management_user?.nome || "";
  form.elements.senha_acesso.value = "";
  form.elements.telefone.value = establishment.telefone || "";
  form.elements.endereco.value = establishment.endereco || "";
  form.elements.categoria.value = establishment.categoria || "";
  form.elements.horario_abertura.value = establishment.horario_abertura || "";
  form.elements.horario_fechamento.value = establishment.horario_fechamento || "";
  form.elements.logo_url.value = establishment.logo_url || "";
  if (form.elements.logo_file) {
    form.elements.logo_file.value = "";
  }
  syncImagePreview(document.getElementById("admin-logo-preview"), establishment.logo_url || "");
  form.elements.mercado_pago_access_token.value = establishment.mercado_pago_access_token || "";
  form.elements.descricao.value = establishment.descricao || "";
  form.elements.taxa_entrega.value = establishment.taxa_entrega != null
    ? formatCurrencyInput(String(establishment.taxa_entrega).replace(".", ""))
    : "";

  const cnpjType = establishment.cnpj ? "com" : "sem";
  const cnpjTypeInput = form.querySelector(`input[name="cnpj_tipo"][value="${cnpjType}"]`);
  if (cnpjTypeInput) {
    cnpjTypeInput.checked = true;
  }

  const entregaValue = establishment.possui_entrega ? "1" : "0";
  const entregaInput = form.querySelector(`input[name="possui_entrega"][value="${entregaValue}"]`);
  if (entregaInput) {
    entregaInput.checked = true;
  }

  if (typeof form._resetAdminMenuItems === "function") {
    form._resetAdminMenuItems();
  }

  if (Array.isArray(establishment.menu_items) && typeof form._addAdminMenuItemCard === "function") {
    establishment.menu_items.forEach((item) => {
      form._addAdminMenuItemCard({
        nome: item.nome || "",
        categoria: item.categoria || "",
        imagem: item.imagem || "",
        descricao: item.descricao || "",
        preco: item.preco != null ? formatCurrencyInput(String(item.preco).replace(".", "")) : "",
        preco_promocional: item.preco_promocional != null
          ? formatCurrencyInput(String(item.preco_promocional).replace(".", ""))
          : ""
      });
    });
  }

  if (typeof form._syncAdminEstablishmentForm === "function") {
    form._syncAdminEstablishmentForm();
  }
}

function resetEstablishmentForm() {
  const form = document.getElementById("admin-cadastro-form");
  if (!form) {
    return;
  }

  form.reset();

  const defaultCnpjType = form.querySelector('input[name="cnpj_tipo"][value="com"]');
  const defaultDeliveryType = form.querySelector('input[name="possui_entrega"][value="1"]');

  if (defaultCnpjType) {
    defaultCnpjType.checked = true;
  }

  if (defaultDeliveryType) {
    defaultDeliveryType.checked = true;
  }

  if (typeof form._resetAdminMenuItems === "function") {
    form._resetAdminMenuItems();
  }

  if (typeof form._syncAdminEstablishmentForm === "function") {
    form._syncAdminEstablishmentForm();
  }

  syncImagePreview(document.getElementById("admin-logo-preview"), "");

  setEstablishmentFormMode("create");
}

async function openEstablishmentEditor(id) {
  const establishment = await fetchEstablishmentDetails(id);
  populateEstablishmentForm(establishment);
  setEstablishmentFormMode("edit", establishment);
}

function renderOverview(data) {
  currentPlatformConfig = {
    nitrogo: {
      enabled: Boolean(data?.platformConfig?.nitrogo?.enabled)
    }
  };
  const summary = data.summary || {};
  const recentOrders = Array.isArray(data.recentOrders) ? data.recentOrders : [];
  const topEstablishments = Array.isArray(data.topEstablishments) ? data.topEstablishments : [];
  const topClients = Array.isArray(data.topClients) ? data.topClients : [];
  const monthlyPerformance = getMonthlyPerformanceInsights(
    Array.isArray(data.monthlyPerformance) ? data.monthlyPerformance : []
  );

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
  const monthlyPerformanceTable = document.getElementById("admin-monthly-performance-table");
  const nitrogoBenefitsTable = document.getElementById("admin-nitrogo-benefits-table");
  const monthReference = document.getElementById("admin-analise-mes-atual");
  const nitrogoBenefitedTotal = document.getElementById("admin-nitrogo-beneficiados-total");
  const nitrogoRecommendedTotal = document.getElementById("admin-nitrogo-recomendados-total");
  const nitrogoStatusLabel = document.getElementById("admin-nitrogo-status-label");
  const nitrogoStatusText = document.getElementById("admin-nitrogo-status-texto");
  const nitrogoToggleButton = document.getElementById("admin-toggle-nitrogo");

  if (nitrogoStatusLabel) {
    nitrogoStatusLabel.textContent = currentPlatformConfig.nitrogo.enabled
      ? "NitroGo ativado"
      : "NitroGo desativado";
  }

  if (nitrogoStatusText) {
    nitrogoStatusText.textContent = currentPlatformConfig.nitrogo.enabled
      ? "A seção está visível na home e os benefícios podem ser mostrados aos clientes."
      : "A seção não está visível na home.";
  }

  if (nitrogoToggleButton) {
    nitrogoToggleButton.textContent = currentPlatformConfig.nitrogo.enabled
      ? "Desativar NitroGo"
      : "Ativar NitroGo";
  }

  if (monthReference) {
    monthReference.textContent = formatMonthLabel();
  }

  if (nitrogoBenefitedTotal) {
    nitrogoBenefitedTotal.textContent = monthlyPerformance.filter(
      (item) => Number(item.nitrogo_ativo) === 1
    ).length;
  }

  if (nitrogoRecommendedTotal) {
    nitrogoRecommendedTotal.textContent = monthlyPerformance.filter(
      (item) => item.recommended
    ).length;
  }

  ordersTable.innerHTML = `
    <div class="gestao-tabela-linha gestao-tabela-head">
      <span>Pedido</span>
      <span>Cliente</span>
      <span>Estabelecimento</span>
      <span>Status</span>
    </div>
    ${recentOrders.length
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
      : '<div class="gestao-tabela-linha"><span <div class="gestao-tabela-empty"> Nenhum pedido encontrado.</span></div>'
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
    ${topEstablishments.length
      ? topEstablishments
        .map(
          (establishment) => `
                <div class="gestao-tabela-linha">
                  <span>
                    ${establishment.nome}
                    <small class="admin-table-note">ID ${establishment.id_estabelecimento} • ${Number(establishment.ativo) ? "Ativo" : "Inativo"}</small>
                  </span>
                  <span>${establishment.categoria || "-"}</span>
                  <span>${Number(establishment.pedidos_total || 0)}</span>
                  <span>${formatCurrency(establishment.faturamento_aprovado || 0)}</span>
                  <span>
                    <button class="btn-secundario admin-btn-edit" data-id="${establishment.id_estabelecimento}" title="Editar estabelecimento">
                      Editar
                    </button>
                    <button class="btn-remover admin-btn-remove" data-id="${establishment.id_estabelecimento}" title="Remover estabelecimento">
                      🗑️
                    </button>
                  </span>
                </div>
              `
        )
        .join("")
      : '<div class="gestao-tabela-linha"><span <div class="gestao-tabela-empty">Nenhum estabelecimento encontrado.</span></div>'
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
    ${topClients.length
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
      : '<div class="gestao-tabela-linha"><span <div class="gestao-tabela-empty">Nenhum cliente encontrado.</span></div>'
    }
  `;

  if (monthlyPerformanceTable) {
    monthlyPerformanceTable.innerHTML = `
      <div class="gestao-tabela-linha gestao-tabela-head">
        <span>Estabelecimento</span>
        <span>Pedidos no mês</span>
        <span>Faturamento no mês</span>
        <span>Comparativo</span>
        <span>Status</span>
      </div>
      ${monthlyPerformance.length
        ? monthlyPerformance
          .map((item) => `
                <div class="gestao-tabela-linha admin-analytics-row">
                  <span>
                    ${escapeHtml(item.nome || "-")}
                    <small class="admin-table-note">
                      ID ${Number(item.id_estabelecimento || 0)} • Último pedido: ${escapeHtml(formatDateTime(item.ultimo_pedido_em))}
                    </small>
                  </span>
                  <span>
                    <strong>${Number(item.currentOrders || 0)}</strong>
                    <small class="admin-table-note">${escapeHtml(item.categoria || "Sem categoria")}</small>
                  </span>
                  <span>${formatCurrency(item.currentRevenue || 0)}</span>
                  <span>
                    <strong>${formatDeltaLabel(item.ordersDelta, (value) => `${value} pedidos`)}</strong>
                    <small class="admin-table-note">${formatDeltaLabel(item.revenueDelta, (value) => formatCurrency(value))}</small>
                  </span>
                  <span>
                    <span class="admin-performance-badge ${item.recommended ? "is-warning" : "is-ok"}">${escapeHtml(item.status)}</span>
                  </span>
                </div>
              `)
          .join("")
        : '<div class="gestao-tabela-linha"><span <div class="gestao-tabela-empty">Nenhum estabelecimento encontrado para análise.</span></div>'
      }
    `;
  }

  if (nitrogoBenefitsTable) {
    nitrogoBenefitsTable.innerHTML = `
      <div class="gestao-tabela-linha gestao-tabela-head">
        <span>Estabelecimento</span>
        <span>Ativar benefício</span>
        <span>Cupom subsidiado</span>
        <span>Frete grátis</span>
        <span>Ação</span>
      </div>
      ${monthlyPerformance.length
        ? monthlyPerformance
          .map((item) => {
            const active = Number(item.nitrogo_ativo) === 1;
            return `
                  <div class="gestao-tabela-linha admin-nitrogo-row" data-establishment-id="${Number(item.id_estabelecimento || 0)}">
                    <span>
                      ${escapeHtml(item.nome || "-")}
                      <small class="admin-table-note">${item.recommended ? "Recomendado para apoio" : "Elegível para avaliação manual"}</small>
                    </span>
                    <span>
                      <label class="admin-switch">
                        <input type="checkbox" class="admin-nitrogo-active" ${active ? "checked" : ""}>
                        <span>Ativo</span>
                      </label>
                    </span>
                    <span>
                      <div class="gestao-input-affix gestao-input-affix-prefix admin-inline-affix">
                        <span class="gestao-prefixo">R$</span>
                        <input
                          type="text"
                          class="admin-nitrogo-cupom"
                          inputmode="decimal"
                          placeholder="0,00"
                          value="${active && item.nitrogo_cupom_valor != null ? escapeHtml(Number(item.nitrogo_cupom_valor).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })) : ""}"
                        >
                      </div>
                    </span>
                    <span>
                      <label class="admin-switch">
                        <input type="checkbox" class="admin-nitrogo-frete" ${Number(item.nitrogo_frete_gratis) === 1 ? "checked" : ""}>
                        <span>Liberado</span>
                      </label>
                    </span>
                    <span>
                      <button type="button" class="btn-primario btn-admin-acao admin-save-nitrogo">Salvar benefício</button>
                    </span>
                  </div>
                `;
          })
          .join("")
        : '<div class="gestao-tabela-linha"><span <div class="gestao-tabela-empty">Nenhum estabelecimento disponível para configurar benefícios.</span></div>'
      }
    `;

    nitrogoBenefitsTable
      .querySelectorAll(".admin-nitrogo-cupom")
      .forEach((input) => {
        input.addEventListener("input", () => {
          input.value = formatCurrencyInput(input.value);
        });
      });
  }
}

async function loadOverview() {
  const response = await apiRequest("/api/admin/overview");
  renderOverview(response.data || {});
}

async function toggleNitrogoPlatform() {
  const nextEnabled = !currentPlatformConfig.nitrogo.enabled;
  const toggleButton = document.getElementById("admin-toggle-nitrogo");

  toggleButton?.setAttribute("disabled", "disabled");

  try {
    await apiRequest("/api/admin/platform-config/nitrogo", {
      method: "PATCH",
      body: JSON.stringify({
        enabled: nextEnabled
      })
    });

    await loadOverview();
    alert(nextEnabled ? "NitroGo ativado com sucesso." : "NitroGo desativado com sucesso.");
  } catch (error) {
    alert(`Erro ao atualizar o NitroGo: ${error.message || "Tente novamente."}`);
  } finally {
    toggleButton?.removeAttribute("disabled");
  }
}

async function saveNitrogoBenefit(row) {
  if (!row) {
    return;
  }

  const establishmentId = Number(row.dataset.establishmentId || 0);
  const activeInput = row.querySelector(".admin-nitrogo-active");
  const cupomInput = row.querySelector(".admin-nitrogo-cupom");
  const freteInput = row.querySelector(".admin-nitrogo-frete");
  const saveButton = row.querySelector(".admin-save-nitrogo");

  if (!establishmentId || !activeInput || !cupomInput || !freteInput) {
    return;
  }

  const nitrogoAtivo = activeInput.checked;
  const cupomValor = parseCurrencyInput(cupomInput.value);
  const freteGratis = freteInput.checked;

  if (nitrogoAtivo && !freteGratis && (!cupomValor || cupomValor <= 0)) {
    alert("Ative frete grátis ou informe um valor de cupom para salvar o benefício NitroGo.");
    cupomInput.focus();
    return;
  }

  saveButton?.setAttribute("disabled", "disabled");

  try {
    await apiRequest(`/api/admin/establishments/${establishmentId}`, {
      method: "PATCH",
      body: JSON.stringify({
        nitrogo_ativo: nitrogoAtivo,
        nitrogo_cupom_valor: nitrogoAtivo ? (cupomValor || null) : null,
        nitrogo_frete_gratis: nitrogoAtivo ? freteGratis : false
      })
    });

    await loadOverview();
    alert("Benefício NitroGo salvo com sucesso.");
  } catch (error) {
    alert(`Erro ao salvar benefício NitroGo: ${error.message || "Tente novamente."}`);
  } finally {
    saveButton?.removeAttribute("disabled");
  }
}

