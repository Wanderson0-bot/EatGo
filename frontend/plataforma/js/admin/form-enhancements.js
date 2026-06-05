function setDashboardVisible(visible) {
  document.getElementById("admin-login-shell").classList.toggle("admin-hidden", visible);
  document.getElementById("admin-dashboard").classList.toggle("admin-hidden", !visible);
}

function setLoginFeedback(message) {
  const feedback = document.getElementById("admin-login-feedback");
  if (feedback) {
    feedback.textContent = message;
  }
}

function formatPhone(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 11);

  if (digits.length <= 2) {
    return digits ? `(${digits}` : "";
  }

  if (digits.length <= 7) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }

  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function formatCnpj(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 14);

  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function formatCurrencyInput(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 6);

  if (!digits) {
    return "";
  }

  const cents = Number(digits);
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function parseCurrencyInput(value) {
  if (!value) return null;

  const normalized = String(value)
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  const number = Number(normalized);

  return Number.isNaN(number) ? null : number;
}

function readFileAsDataUrl(file) {
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

async function resolveImageFieldValue(fileInput, hiddenInput) {
  const file = fileInput?.files?.[0];

  if (file) {
    const dataUrl = await readFileAsDataUrl(file);
    if (hiddenInput) {
      hiddenInput.value = dataUrl || "";
    }
    return dataUrl || null;
  }

  const currentValue = String(hiddenInput?.value || "").trim();
  return currentValue || null;
}

function syncImagePreview(previewEl, value) {
  if (!previewEl) {
    return;
  }

  const src = String(value || "").trim();
  previewEl.hidden = !src;
  previewEl.src = src || "";
}

function bindImageInputPreview(fileInput, hiddenInput, previewEl) {
  if (!fileInput || !hiddenInput || !previewEl) {
    return;
  }

  syncImagePreview(previewEl, hiddenInput.value);

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];

    if (!file) {
      syncImagePreview(previewEl, hiddenInput.value);
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      hiddenInput.value = dataUrl || "";
      syncImagePreview(previewEl, dataUrl);
    } catch (error) {
      fileInput.value = "";
      alert(error.message || "Não foi possível carregar a imagem.");
      syncImagePreview(previewEl, hiddenInput.value);
    }
  });
}

function setupPasswordToggles() {
  document.querySelectorAll(".gestao-toggle-senha").forEach((button) => {
    button.addEventListener("click", () => {
      const targetId = button.getAttribute("data-target");
      const input = document.getElementById(targetId);

      if (!input) {
        return;
      }

      const isPassword = input.type === "password";
      input.type = isPassword ? "text" : "password";
      button.textContent = isPassword ? "Ocultar" : "Ver";
      button.setAttribute("aria-label", isPassword ? "Ocultar senha" : "Mostrar senha");
    });
  });
}

function setupEstablishmentFormEnhancements() {
  const establishmentForm = document.getElementById("admin-cadastro-form");
  const phoneInput = document.getElementById("admin-telefone");
  const cnpjInput = document.getElementById("admin-cnpj");
  const cnpjTypeInputs = document.querySelectorAll('input[name="cnpj_tipo"]');
  const deliveryFeeInput = document.getElementById("admin-taxa-entrega");
  const deliveryField = document.getElementById("admin-taxa-entrega-campo");
  const deliveryTypeInputs = document.querySelectorAll('input[name="possui_entrega"]');
  const addMenuItemButton = document.getElementById("admin-add-menu-item");
  const menuItemsContainer = document.getElementById("admin-menu-items");
  const logoFileInput = establishmentForm?.querySelector('input[name="logo_file"]');
  const logoHiddenInput = establishmentForm?.querySelector('input[name="logo_url"]');
  const logoPreview = document.getElementById("admin-logo-preview");

  phoneInput?.addEventListener("input", () => {
    phoneInput.value = formatPhone(phoneInput.value);
  });

  cnpjInput?.addEventListener("input", () => {
    cnpjInput.value = formatCnpj(cnpjInput.value);
  });

  deliveryFeeInput?.addEventListener("input", () => {
    deliveryFeeInput.value = formatCurrencyInput(deliveryFeeInput.value);
  });

  const syncCnpjState = () => {
    const allowCnpj = document.querySelector('input[name="cnpj_tipo"]:checked')?.value !== "sem";

    if (!cnpjInput) {
      return;
    }

    cnpjInput.disabled = !allowCnpj;
    cnpjInput.required = allowCnpj;

    if (!allowCnpj) {
      cnpjInput.value = "";
      cnpjInput.placeholder = "Cadastro sem CNPJ";
    } else {
      cnpjInput.placeholder = "00.000.000/0000-00";
    }
  };

  const syncDeliveryState = () => {
    const hasDelivery = document.querySelector('input[name="possui_entrega"]:checked')?.value === "1";

    if (!deliveryField || !deliveryFeeInput) {
      return;
    }

    deliveryField.style.display = hasDelivery ? "grid" : "none";
    deliveryFeeInput.required = hasDelivery;

    if (!hasDelivery) {
      deliveryFeeInput.value = "";
    }
  };

  const buildMenuItemCard = (initialData = {}) => {
    const card = document.createElement("article");
    card.className = "admin-menu-item";
    card.innerHTML = `
      <div class="admin-menu-item-topo">
        <strong>Item do cardápio</strong>
        <button type="button" class="btn-secundario admin-menu-remover">Remover</button>
      </div>
      <div class="gestao-form-grid">
        <label class="gestao-campo">
          <span>Nome do item</span>
          <input type="text" name="menu_item_nome" placeholder="Ex.: Marmita executiva" value="${initialData.nome || ""}">
        </label>
        <label class="gestao-campo">
          <span>Categoria</span>
          <input type="text" name="menu_item_categoria" placeholder="Ex.: Almoço" value="${initialData.categoria || ""}">
        </label>
        <label class="gestao-campo gestao-campo-full">
          <span>Foto do item</span>
          <input type="file" name="menu_item_imagem_file" accept="image/*">
          <input type="hidden" name="menu_item_imagem" value="${escapeHtml(initialData.imagem || "")}">
          <img class="gestao-image-preview" alt="Prévia da foto do item" ${initialData.imagem ? `src="${escapeHtml(initialData.imagem)}"` : "hidden"}>
        </label>
        <label class="gestao-campo">
          <span>Preço</span>
          <div class="gestao-input-affix gestao-input-affix-prefix">
            <span class="gestao-prefixo">R$</span>
            <input type="text" name="menu_item_preco" placeholder="0,00" inputmode="decimal" value="${initialData.preco || ""}">
          </div>
        </label>
        <label class="gestao-campo">
          <span>Preço promocional</span>
          <div class="gestao-input-affix gestao-input-affix-prefix">
            <span class="gestao-prefixo">R$</span>
            <input type="text" name="menu_item_preco_promocional" placeholder="Opcional" inputmode="decimal" value="${initialData.preco_promocional || ""}">
          </div>
        </label>
        <label class="gestao-campo gestao-campo-full">
          <span>Descrição</span>
          <textarea name="menu_item_descricao" rows="3" placeholder="Descreva os ingredientes ou destaque do prato.">${initialData.descricao || ""}</textarea>
        </label>
      </div>
    `;

    card.querySelectorAll('input[name="menu_item_preco"], input[name="menu_item_preco_promocional"]').forEach((input) => {
      input.addEventListener("input", () => {
        input.value = formatCurrencyInput(input.value);
      });
    });

    bindImageInputPreview(
      card.querySelector('[name="menu_item_imagem_file"]'),
      card.querySelector('[name="menu_item_imagem"]'),
      card.querySelector(".gestao-image-preview")
    );

    card.querySelector(".admin-menu-remover")?.addEventListener("click", () => {
      card.remove();
    });

    return card;
  };

  const addMenuItemCard = (initialData = {}) => {
    menuItemsContainer?.appendChild(buildMenuItemCard(initialData));
  };

  addMenuItemButton?.addEventListener("click", addMenuItemCard);
  bindImageInputPreview(logoFileInput, logoHiddenInput, logoPreview);

  if (establishmentForm) {
    establishmentForm._resetAdminMenuItems = () => {
      if (menuItemsContainer) {
        menuItemsContainer.innerHTML = "";
      }
    };
    establishmentForm._addAdminMenuItemCard = addMenuItemCard;
    establishmentForm._syncAdminEstablishmentForm = () => {
      syncCnpjState();
      syncDeliveryState();
    };
  }

  cnpjTypeInputs.forEach((input) => {
    input.addEventListener("change", syncCnpjState);
  });

  deliveryTypeInputs.forEach((input) => {
    input.addEventListener("change", syncDeliveryState);
  });

  syncCnpjState();
  syncDeliveryState();
}
