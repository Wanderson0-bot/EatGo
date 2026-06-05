
async function ensureOwnerAccess() {
  try {
    await loadOverview();
    return true;
  } catch (error) {
    await clearAdminSession();
    throw error;
  }
}

function showLoginShell(message) {
  adminUserState = null;
  setDashboardVisible(false);
  revealPage();
  setLoginFeedback(message || "Informe a senha administrativa para liberar esta área.");
}

function setupLoginForm() {
  const form = document.getElementById("admin-login-form");
  const passwordInput = document.getElementById("admin-password");

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    setLoginFeedback("Validando acesso administrativo...");

    try {
      await loginAdmin();
      await loadOverview();
      setDashboardVisible(true);
      setLoginFeedback("Acesso liberado.");
      form.reset();
    } catch (error) {
      await clearAdminSession();
      setLoginFeedback(error?.message || "Nao foi possivel autenticar o painel.");
      passwordInput?.focus();
    }
  });
}

function showAdminSection(sectionId) {
  const sections = [
    "visao-geral",
    "cadastrar-estabelecimento",
    "editar-estabelecimento"
  ];

  sections.forEach((id) => {
    const section = document.getElementById(id);

    if (!section) return;

    if (id === sectionId) {
      section.classList.remove("admin-hidden");
    } else {
      section.classList.add("admin-hidden");
    }
  });

  document.querySelectorAll("nav a").forEach((link) => {
    const href = link.getAttribute("href");

    if (href === `#${sectionId}`) {
      link.classList.add("ativo");
    } else {
      link.classList.remove("ativo");
    }
  });
}

async function submitEstablishmentForm(event) {
  event.preventDefault();
  const form = event.target;
  const formData = new FormData(form);
  const taxaEntregaRaw = String(formData.get("taxa_entrega") || "").trim();

  try {
    const menuItemsRaw = await Promise.all(
      Array.from(form.querySelectorAll(".admin-menu-item")).map(async (item) => ({
        nome: String(item.querySelector('[name="menu_item_nome"]')?.value || "").trim(),
        categoria: String(item.querySelector('[name="menu_item_categoria"]')?.value || "").trim() || null,
        imagem: await resolveImageFieldValue(
          item.querySelector('[name="menu_item_imagem_file"]'),
          item.querySelector('[name="menu_item_imagem"]')
        ),
        descricao: String(item.querySelector('[name="menu_item_descricao"]')?.value || "").trim() || null,
        preco: parseCurrencyInput(item.querySelector('[name="menu_item_preco"]')?.value || ""),
        preco_promocional: parseCurrencyInput(
          item.querySelector('[name="menu_item_preco_promocional"]')?.value || ""
        ),
        ativo: true
      }))
    );
    const menuItems = menuItemsRaw.filter((item) => item.nome || item.preco != null || item.descricao || item.categoria);

    const invalidMenuItem = menuItems.find((item) => !item.nome || item.preco == null || item.preco <= 0);
    if (invalidMenuItem) {
      alert("Preencha nome e preco de todos os itens do cardapio adicionados.");
      return;
    }

    const logoValue = await resolveImageFieldValue(
      form.querySelector('[name="logo_file"]'),
      form.querySelector('[name="logo_url"]')
    );

    const data = {
      nome: String(formData.get("nome") || "").trim(),
      cnpj: String(formData.get("cnpj") || "").trim() || null,
      email: String(formData.get("email") || "").trim(),
      responsavel_nome: String(formData.get("responsavel_nome") || "").trim(),
      senha_acesso: String(formData.get("senha_acesso") || ""),
      telefone: formatPhone(String(formData.get("telefone") || "").trim()),
      endereco: String(formData.get("endereco") || "").trim(),
      categoria: String(formData.get("categoria") || "").trim(),
      horario_abertura: String(formData.get("horario_abertura") || "").trim(),
      horario_fechamento: String(formData.get("horario_fechamento") || "").trim(),
      logo_url: logoValue,
      mercado_pago_access_token: String(formData.get("mercado_pago_access_token") || "").trim() || null,
      possui_entrega: formData.get("possui_entrega") === "1",
      taxa_entrega: taxaEntregaRaw
        ? Number(taxaEntregaRaw.replace(/[^0-9,.\-]/g, "").replace(",", "."))
        : null,
      descricao: String(formData.get("descricao") || "").trim() || null,
      menu_items: menuItems
    };

    const isEditing = Boolean(currentEditingEstablishmentId);
    const payload = { ...data };

    if (isEditing && !payload.senha_acesso) {
      delete payload.senha_acesso;
    }

    const response = await apiRequest(
      isEditing
        ? `/api/admin/establishments/${currentEditingEstablishmentId}`
        : "/api/admin/establishments",
      {
        method: isEditing ? "PATCH" : "POST",
        body: JSON.stringify(payload)
      }
    );
    alert(
      isEditing
        ? "Estabelecimento atualizado com sucesso, incluindo o cardapio."
        : `Estabelecimento cadastrado com sucesso!\n\nLogin da gestão: ${response?.data?.email_gestao || data.email}\nItens de cardápio: ${response?.data?.itens_cardapio || 0}`
    );
    resetEstablishmentForm();
    await loadOverview();
  } catch (error) {
    alert(`Erro ao ${currentEditingEstablishmentId ? "atualizar" : "cadastrar"} estabelecimento: ${error.message || "Tente novamente."}`);
  }
}

async function bootAdminPage() {
  if (window.__adminBootLoaded) return;
  window.__adminBootLoaded = true;
  const refreshButton = document.getElementById("admin-refresh");
  const logoutButton = document.getElementById("admin-logout");
  const removeEstablishmentBtn = document.getElementById("remove-establishment-btn");
  const loadEstablishmentBtn = document.getElementById("admin-load-establishment");
  const cancelEditBtn = document.getElementById("admin-cancel-edit");
  const cancelEditInlineBtn = document.getElementById("admin-cancel-edit-inline");
  const cadastroForm = document.getElementById("admin-cadastro-form");
  const editIdInput = document.getElementById("admin-edit-establishment-id");
  const toggleNitrogoButton = document.getElementById("admin-toggle-nitrogo");
  const navLinks = document.querySelectorAll("nav a");

  setupLoginForm();
  setupPasswordToggles();
  setupEstablishmentFormEnhancements();
  revealPage();

  // Setup navegação entre seções
  navLinks.forEach(link => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const sectionId = link.getAttribute("href").slice(1);
      showAdminSection(sectionId);
    });
  });

  setEstablishmentFormMode("create");

  cadastroForm?.addEventListener("submit", submitEstablishmentForm);

  loadEstablishmentBtn?.addEventListener("click", async () => {
    const id = editIdInput?.value?.trim();
    if (!id) {
      alert("Informe o ID do estabelecimento para editar.");
      return;
    }

    try {
      await openEstablishmentEditor(id);
      showAdminSection("cadastrar-estabelecimento");
    } catch (error) {
      alert(`Erro ao carregar estabelecimento: ${error.message || "Tente novamente."}`);
    }
  });

  cancelEditBtn?.addEventListener("click", () => {
    resetEstablishmentForm();
    showAdminSection("editar-estabelecimento");
  });

  cancelEditInlineBtn?.addEventListener("click", () => {
    resetEstablishmentForm();
    showAdminSection("editar-estabelecimento");
  });

  try {
    await ensureOwnerAccess();
    setDashboardVisible(true);
  } catch (error) {
    const adminUser = getAdminUser();
    const userName = adminUser?.nome ? ` para ${adminUser.nome}` : "";
    showLoginShell(
      error?.message ||
      `Informe a senha administrativa${userName} para continuar.`
    );
  }

  refreshButton?.addEventListener("click", async () => {
    refreshButton.disabled = true;

    try {
      await loadOverview();
    } catch (error) {
      showLoginShell("Sua sessão expirou.");
    } finally {
      refreshButton.disabled = false;
    }
  });

  logoutButton?.addEventListener("click", async () => {
    await clearAdminSession();
    showLoginShell("Sessao encerrada com sucesso.");
  });

  toggleNitrogoButton?.addEventListener("click", async () => {
    await toggleNitrogoPlatform();
  });

  removeEstablishmentBtn?.addEventListener("click", async () => {
    const idInput = document.getElementById("remove-establishment-id");
    const id = idInput.value.trim();
    if (!id) {
      alert("Por favor, insira o ID do estabelecimento.");
      return;
    }
    await removeEstablishment(id);
  });

  // Event listener para botões de remover estabelecimento (usando event delegation)
  document.addEventListener("click", async (event) => {
    const button = event.target.closest(".admin-btn-remove");
    const editButton = event.target.closest(".admin-btn-edit");
    const nitrogoSaveButton = event.target.closest(".admin-save-nitrogo");

    if (nitrogoSaveButton) {
      await saveNitrogoBenefit(nitrogoSaveButton.closest(".admin-nitrogo-row"));
      return;
    }

    if (editButton) {
      try {
        await openEstablishmentEditor(editButton.dataset.id);
        showAdminSection("cadastrar-estabelecimento");
      } catch (error) {
        alert(`Erro ao carregar estabelecimento: ${error.message || "Tente novamente."}`);
      }
      return;
    }

    if (!button) return;

    const establishmentId = button.dataset.id;
    await removeEstablishment(establishmentId);
  });
}

document.addEventListener("DOMContentLoaded", bootAdminPage);
