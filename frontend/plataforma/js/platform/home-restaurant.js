function getHomeCards() {
  return document.querySelectorAll("#cards-container .card");
}

function mostrarCategoria(categoria) {
  const botoesCategoria = document.querySelectorAll(".opcao");
  const cards = getHomeCards();
  const sectionTag = document.getElementById("section-tag");
  const sectionTitle = document.getElementById("section-title");

  if (!botoesCategoria.length || !sectionTag || !sectionTitle) {
    return;
  }

  currentCategory = categoria;

  const textosCategoria = {
    restaurantes: {
      tag: "Marketplace",
      titulo: "Estabelecimentos em destaque",
    },
    comidas: {
      tag: "Marketplace",
      titulo: "Comidas dos restaurantes cadastrados",
    },
    bebidas: {
      tag: "Marketplace",
      titulo: "Bebidas dos restaurantes cadastrados",
    },
  };

  botoesCategoria.forEach((botao) => {
    const ativa = botao.dataset.categoria === categoria;
    botao.classList.toggle("ativa", ativa);
    botao.setAttribute("aria-pressed", String(ativa));
  });

  cards.forEach((card) => {
    card.hidden = card.dataset.categoria !== categoria;
  });

  sectionTag.textContent = textosCategoria[categoria].tag;
  sectionTitle.textContent = textosCategoria[categoria].titulo;
}

async function renderizarCardsHome() {
  const container = document.getElementById("cards-container");
  const promotionsContainer = document.getElementById("listaPromocoes");
  const nitrogoContainer = document.getElementById("listaNitrogo");
  const nitrogoSection = document.querySelector(".nitrogo");
  if (!container) {
    return;
  }

  try {
    const [platformConfig, restaurantes] = await Promise.all([
      fetchPlatformConfig(),
      fetchEstablishments()
    ]);
    const nitrogoEnabled = Boolean(platformConfig?.nitrogo?.enabled);

    if (nitrogoSection) {
      nitrogoSection.hidden = !nitrogoEnabled;
    }

    const menusByRestaurant = await Promise.all(
      restaurantes.map(async (restaurante) => {
        try {
          return {
            restaurante,
            itens: await fetchEstablishmentMenu(restaurante.id_estabelecimento)
          };
        } catch (error) {
          console.error(
            `Falha ao carregar o cardapio do estabelecimento ${restaurante.id_estabelecimento}.`,
            error
          );
          return {
            restaurante,
            itens: []
          };
        }
      })
    );
    const foodItems = [];
    const drinkItems = [];

    if (!restaurantes.length) {
      container.innerHTML = `
        <article class="card card-home-vazio" data-categoria="restaurantes">
          <div class="card-conteudo">
            <h3>Nenhum estabelecimento disponível</h3>
            <p>Os estabelecimentos e cardápios deverão ser carregados a partir do banco de dados.</p>
            <div class="card-acoes">
              <a class="btn-primario" href="central-ajuda.html#central-ajuda-form">Solicitar parceria</a>
            </div>
          </div>
        </article>
      `;
      if (promotionsContainer) {
        promotionsContainer.innerHTML = `
          <article class="card card-home-vazio">
            <div class="card-conteudo">
              <h3>Promocoes indisponiveis</h3>
              <p>Assim que houver estabelecimentos cadastrados, as ofertas do dia aparecem aqui.</p>
            </div>
          </article>
        `;
      }
      if (nitrogoContainer && nitrogoEnabled) {
        nitrogoContainer.innerHTML = `
          <article class="card card-home-vazio">
            <div class="card-conteudo">
              <h3>Nenhum parceiro no NitroGo</h3>
              <p>Quando a administração liberar benefícios subsidiados, os estabelecimentos participantes aparecerão aqui.</p>
            </div>
          </article>
        `;
      }
      mostrarCategoria("restaurantes");
      return;
    }

    menusByRestaurant.forEach(({ restaurante, itens }) => {
      itens.forEach((item) => {
        const entry = { restaurante, item };

        if (isDrinkMenuItem(item)) {
          drinkItems.push(entry);
        } else {
          foodItems.push(entry);
        }
      });
    });

    const restaurantCards = restaurantes
      .map((restaurante) => {
        const status = getEstablishmentOperatingStatus(restaurante);
        return `
      <article class="card" data-categoria="restaurantes">
        <img src="${getSafeImageSrc(restaurante.logo_url)}" alt="${restaurante.nome || "Estabelecimento"}" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='src/logo.png';">
          <div class="card-conteudo">
            <h3>${restaurante.nome || "Estabelecimento"}</h3>
            <p>${restaurante.descricao || "Descrição não disponível."}</p>
            <p class="restaurante-status ${status.aberto ? "open" : "closed"} card-status-inline">${status.texto}</p>
            <div class="card-acoes">
              <a class="btn-primario" href="restaurantes.html?id=${restaurante.id_estabelecimento}">Acessar</a>
            </div>
          </div>
        </article>
      `;
      })
      .join("");

    const foodCards = foodItems
      .map(({ restaurante, item }) => {
        const status = getEstablishmentOperatingStatus(restaurante);
        return `
      <article class="card" data-categoria="comidas" hidden>
        <img src="${getSafeImageSrc(item.imagem || restaurante.logo_url, "src/caseiras.png")}" alt="${item.nome || "Comida"}" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='src/caseiras.png';">
          <div class="card-conteudo">
            <h3>${item.nome || "Item"}</h3>
            <p>${restaurante.nome || "Estabelecimento"} • ${item.categoria || "Comida"}</p>
            <p class="restaurante-status ${status.aberto ? "open" : "closed"} card-status-inline">${status.texto}</p>
            <div class="card-acoes">
              <button type="button" class="btn-primario" data-action="pedir-agora-index" data-item-id="${item.id_cardapio}" data-restaurant-id="${restaurante.id_estabelecimento}" data-restaurant-name="${restaurante.nome || "Estabelecimento"}" data-delivery-fee="${Number(restaurante.taxa_entrega || 0)}" data-has-delivery="${Number(restaurante.possui_entrega || 0)}" data-opening-time="${restaurante.horario_abertura || ""}" data-closing-time="${restaurante.horario_fechamento || ""}">Pedir agora</button>
              <button type="button" class="btn-secundario" data-action="adicionar-carrinho-index" data-item-id="${item.id_cardapio}" data-restaurant-id="${restaurante.id_estabelecimento}" data-restaurant-name="${restaurante.nome || "Estabelecimento"}" data-delivery-fee="${Number(restaurante.taxa_entrega || 0)}" data-has-delivery="${Number(restaurante.possui_entrega || 0)}" data-opening-time="${restaurante.horario_abertura || ""}" data-closing-time="${restaurante.horario_fechamento || ""}">Adicionar ao carrinho</button>
            </div>
          </div>
        </article>
      `;
      })
      .join("");

    const drinkCards = drinkItems
      .map(({ restaurante, item }) => {
        const status = getEstablishmentOperatingStatus(restaurante);
        return `
      <article class="card" data-categoria="bebidas" hidden>
        <img src="${getSafeImageSrc(item.imagem || restaurante.logo_url, "src/gelados.png")}" alt="${item.nome || "Bebida"}" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='src/gelados.png';">
          <div class="card-conteudo">
            <h3>${item.nome || "Item"}</h3>
            <p>${restaurante.nome || "Estabelecimento"} • ${item.categoria || "Bebida"}</p>
            <p class="restaurante-status ${status.aberto ? "open" : "closed"} card-status-inline">${status.texto}</p>
            <div class="card-acoes">
              <button type="button" class="btn-primario" data-action="pedir-agora-index" data-item-id="${item.id_cardapio}" data-restaurant-id="${restaurante.id_estabelecimento}" data-restaurant-name="${restaurante.nome || "Estabelecimento"}" data-delivery-fee="${Number(restaurante.taxa_entrega || 0)}" data-has-delivery="${Number(restaurante.possui_entrega || 0)}" data-opening-time="${restaurante.horario_abertura || ""}" data-closing-time="${restaurante.horario_fechamento || ""}">Pedir agora</button>
              <button type="button" class="btn-secundario" data-action="adicionar-carrinho-index" data-item-id="${item.id_cardapio}" data-restaurant-id="${restaurante.id_estabelecimento}" data-restaurant-name="${restaurante.nome || "Estabelecimento"}" data-delivery-fee="${Number(restaurante.taxa_entrega || 0)}" data-has-delivery="${Number(restaurante.possui_entrega || 0)}" data-opening-time="${restaurante.horario_abertura || ""}" data-closing-time="${restaurante.horario_fechamento || ""}">Adicionar ao carrinho</button>
            </div>
          </div>
        </article>
      `;
      })
      .join("");

    container.innerHTML = restaurantCards + foodCards + drinkCards;

    // Handler para botões de pedir agora e adicionar ao carrinho nos cards comidas/bebidas
    container.onclick = async (event) => {
      const button = event.target.closest("button[data-action][data-item-id][data-restaurant-id]");
      if (!button) {
        return;
      }

      const action = button.dataset.action;
      const itemId = Number(button.dataset.itemId);
      const restaurantId = Number(button.dataset.restaurantId);

      // Buscar dados do item no cardápio do restaurante
      try {
        const menu = await fetchEstablishmentMenu(restaurantId);
        const item = menu.find((m) => Number(m.id_cardapio) === itemId);

        if (!item) {
          showToast("Item não encontrado.", "error");
          return;
        }

	        const context = {
	          id_estabelecimento: restaurantId,
	          restauranteNome: button.dataset.restaurantName || "Estabelecimento",
	          taxa_entrega: Number(button.dataset.deliveryFee || 0),
	          possui_entrega: Number(button.dataset.hasDelivery || 0),
            horario_abertura: button.dataset.openingTime || "",
            horario_fechamento: button.dataset.closingTime || ""
	        };

	        if (action === "pedir-agora-index") {
	          button.disabled = true;
	          const perfil = await ensureClientRegistration();

	          if (!perfil) {
	            button.disabled = false;
	            return;
	          }

	          // Adicionar ao carrinho e ir para página de carrinho
	          const updatedCart = addItemToCart(item, 1, context);
	          if (updatedCart) {
	            window.location.href = "carrinho.html";
	            return;
	          }

	          button.disabled = false;
	        } else if (action === "adicionar-carrinho-index") {
	          const perfil = await ensureClientRegistration();

	          if (!perfil) {
	            return;
	          }

	          // Apenas adicionar ao carrinho
	          addItemToCart(item, 1, context);
        }
      } catch (error) {
        console.error(error);
        showToast("Erro ao processar item. Tente novamente.", "error");
      }
    };

    if (promotionsContainer) {
      const promotionFallbacks = ["src/caseiras.png", "src/massas.png", "src/churrasco.png"];
      promotionsContainer.innerHTML = restaurantes
        .slice(0, 3)
        .map((restaurante, index) => {
          const status = getEstablishmentOperatingStatus(restaurante);
          return `
      <article class="card">
        <img src="${getSafeImageSrc(restaurante.logo_url, promotionFallbacks[index] || "src/logo.png")}" alt="${restaurante.nome || "Promocao EatGo"}" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='${promotionFallbacks[index] || "src/logo.png"}';">
          <div class="card-conteudo">
            <h3>${restaurante.nome || "Estabelecimento"}</h3>
            <p>${restaurante.categoria || "Oferta especial do dia"}</p>
            <p class="restaurante-status ${status.aberto ? "open" : "closed"} card-status-inline">${status.texto}</p>
            <div class="card-acoes">
              <a class="btn-primario" href="restaurantes.html?id=${restaurante.id_estabelecimento}">Ver oferta</a>
            </div>
          </div>
        </article>
      `;
        })
        .join("");
    }

    if (nitrogoContainer && nitrogoEnabled) {
      const nitrogoEstablishments = restaurantes.filter(
        (restaurante) => Number(restaurante.nitrogo_ativo) === 1
      );

      nitrogoContainer.innerHTML = nitrogoEstablishments.length
        ? nitrogoEstablishments
            .map((restaurante) => {
              const status = getEstablishmentOperatingStatus(restaurante);
              return `
      <article class="card nitrogo-card">
        <img src="${getSafeImageSrc(restaurante.logo_url)}" alt="${restaurante.nome || "Estabelecimento NitroGo"}" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='src/logo.png';">
          <div class="card-conteudo">
            <span class="nitrogo-card-tag">Subsidiado 100% pela EatGo</span>
            <h3>${restaurante.nome || "Estabelecimento"}</h3>
            <p>${formatNitrogoBenefit(restaurante)}</p>
            <p class="restaurante-status ${status.aberto ? "open" : "closed"} card-status-inline">${status.texto}</p>
            <div class="card-acoes">
              <a class="btn-primario" href="restaurantes.html?id=${restaurante.id_estabelecimento}">Usar na EatGo</a>
            </div>
          </div>
        </article>
      `;
            })
            .join("")
        : `
          <article class="card card-home-vazio">
            <div class="card-conteudo">
              <h3>Nenhum parceiro no NitroGo</h3>
              <p>No momento não há estabelecimentos com cupom subsidiado ou frete grátis ativo.</p>
            </div>
          </article>
        `;
    }

    mostrarCategoria("restaurantes");
  } catch (error) {
    console.error(error);
    container.innerHTML = `
      <article class="card card-home-vazio" data-categoria="restaurantes">
        <div class="card-conteudo">
          <h3>Erro ao carregar estabelecimentos</h3>
          <p>Não foi possível obter os dados do banco de dados. Verifique se o backend está rodando.</p>
        </div>
      </article>
    `;
    if (nitrogoSection) {
      nitrogoSection.hidden = true;
    }
    if (promotionsContainer) {
      promotionsContainer.innerHTML = `
        <article class="card card-home-vazio">
          <div class="card-conteudo">
            <h3>Promoções indisponíveis</h3>
            <p>Assim que o backend responder, as ofertas do dia aparecem aqui.</p>
          </div>
        </article>
      `;
    }
    if (nitrogoContainer) {
      nitrogoContainer.innerHTML = `
        <article class="card card-home-vazio">
          <div class="card-conteudo">
            <h3>NitroGo indisponível</h3>
            <p>Não foi possível carregar os estabelecimentos beneficiários agora.</p>
          </div>
        </article>
      `;
    }
    showToast("Não foi possível carregar os estabelecimentos do backend.", "error");
  }
}

function setupCategorias() {
  const botoesCategoria = document.querySelectorAll(".opcao");

  if (!botoesCategoria.length) {
    return;
  }

  botoesCategoria.forEach((botao) => {
    botao.addEventListener("click", () => {
      mostrarCategoria(botao.dataset.categoria);
    });
  });

  renderizarCardsHome();
}

function setupSearch() {
  const form = document.querySelector(".search-form");
  const input = form?.querySelector(".search");
  const sectionTag = document.getElementById("section-tag");
  const sectionTitle = document.getElementById("section-title");

  if (!form || !input || !sectionTag || !sectionTitle) {
    return;
  }

  function filterCards() {
    const query = normalizeText(input.value.trim());
    const cards = getHomeCards();

    if (!query) {
      mostrarCategoria(currentCategory);
      return;
    }

    let visibleCount = 0;

    cards.forEach((card) => {
      const content = normalizeText(card.textContent);
      const matches = content.includes(query);
      card.hidden = !matches;

      if (matches) {
        visibleCount += 1;
      }
    });

    sectionTag.textContent = "Busca";
    sectionTitle.textContent =
      visibleCount > 0
        ? `Resultados para "${input.value.trim()}"`
        : `Nenhum resultado para "${input.value.trim()}"`;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    filterCards();
  });

  input.addEventListener("input", () => {
    if (!input.value.trim()) {
      mostrarCategoria(currentCategory);
    }
  });
}

async function renderizarPaginaRestaurante() {
  // Renderiza a página de estabelecimento a partir do id recebido na URL.
  const nomeEl = document.getElementById("restaurante-nome");
  const cardapioEl = document.getElementById("restaurante-cardapio-lista");
  const capaEl = document.getElementById("restaurante-capa");
  const descricaoEl = document.getElementById("restaurante-descricao");
  const enderecoEl = document.getElementById("restaurante-endereco");
  const tempoEl = document.getElementById("restaurante-tempo");
  const categoriaEl = document.getElementById("restaurante-categoria");
  const statusEl = document.getElementById("restaurante-status");
  const avaliacaoEl = document.getElementById("restaurante-avaliacao");

  if (
    !nomeEl ||
    !cardapioEl ||
    !capaEl ||
    !descricaoEl ||
    !enderecoEl ||
    !tempoEl ||
    !categoriaEl ||
    !statusEl ||
    !avaliacaoEl
  ) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const restauranteId = params.get("id");

  if (!restauranteId) {
    document.title = "Estabelecimento | EatGo";
    capaEl.src = "src/logo.png";
    capaEl.alt = "Estabelecimento";
    nomeEl.textContent = "Estabelecimento não encontrado";
    descricaoEl.textContent =
      "Os dados do estabelecimento e do cardápio devem ser carregados a partir do banco de dados.";
    enderecoEl.textContent = "Endereço não disponível";
    tempoEl.textContent = "Tempo não disponível";
    categoriaEl.textContent = "Categoria não disponível";
    statusEl.textContent = "Horário não disponível";
    statusEl.className = "restaurante-status closed";
    avaliacaoEl.textContent = "Avaliação não disponível";
    cardapioEl.innerHTML = `
      <article class="card card-cardapio">
        <div class="card-conteudo">
          <h3>Cardápio não disponível</h3>
          <p>O ID do estabelecimento está ausente ou inválido.</p>
        </div>
      </article>
    `;
    return;
  }

  try {
    const restaurante = await fetchEstablishment(restauranteId);
    const cardapio = await fetchEstablishmentMenu(restauranteId);

    document.title = `${ restaurante.nome || "Estabelecimento" } | EatGo`;
    capaEl.src = getSafeImageSrc(restaurante.logo_url);
    capaEl.alt = restaurante.nome || "Estabelecimento";
    nomeEl.textContent = restaurante.nome || "Estabelecimento";
    descricaoEl.textContent =
      restaurante.descricao || "Cardápio aguardando dados do banco.";
    enderecoEl.textContent = restaurante.endereco || "Endereço não disponível";
    tempoEl.textContent = restaurante.possui_entrega === 1 ? "Entrega disponível" : "Sem entrega";
    categoriaEl.textContent = restaurante.categoria || "Categoria não disponível";
    const status = verificarStatusLoja(
      restaurante.horario_abertura,
      restaurante.horario_fechamento
    );
    statusEl.textContent = status.texto;
    statusEl.className = status.aberto
      ? "restaurante-status open"
      : "restaurante-status closed";
    avaliacaoEl.textContent = "Avaliação não disponível";

    currentRestaurantMenu = cardapio;
    currentRestaurantId = Number(restauranteId);
    currentRestaurantName = restaurante.nome || "Estabelecimento";
    currentRestaurantData = restaurante;

    if (!Array.isArray(cardapio) || !cardapio.length) {
      cardapioEl.innerHTML = `
        <article class="card card-cardapio">
          <div class="card-conteudo">
            <h3>Cardápio vazio</h3>
            <p>Não há itens disponíveis para este estabelecimento no momento.</p>
          </div>
        </article>
      `;
      return;
    }

    cardapioEl.innerHTML = cardapio
      .map((item) => `
        <article class="card card-cardapio">
          ${item.imagem ? `<img src="${item.imagem}" alt="${item.nome || "Item"}" loading="lazy" decoding="async">` : ""}
          <div class="card-conteudo">
            <h3>${item.nome || "Item"}</h3>
            <p>${item.descricao || "Sem descrição."}</p>
            <p class="cardapio-preco">${formatCurrency(Number(item.preco_promocional ?? item.preco ?? 0))}</p>
            ${item.preco_promocional ? `<p class="cardapio-preco-promocional">${formatCurrency(Number(item.preco))}</p>` : ""}
	            <div class="card-acoes">
	              <button type="button" class="btn-primario" data-action="pedir-agora" data-item-id="${item.id_cardapio}" ${status.aberto ? "" : "disabled"}>${status.aberto ? "Pedir agora" : "Fechado no momento"}</button>
	              <button type="button" class="btn-secundario" data-action="adicionar-carrinho" data-item-id="${item.id_cardapio}" ${status.aberto ? "" : "disabled"}>Adicionar ao carrinho</button>
	            </div>
	          </div>
	        </article>
      `)
      .join("");

    cardapioEl.onclick = async (event) => {
      const button = event.target.closest("button[data-action][data-item-id]");
      if (!button) {
        return;
      }

      const itemId = Number(button.dataset.itemId);
      const item = currentRestaurantMenu.find(
        (menuItem) => Number(menuItem.id_cardapio) === itemId
      );

      if (!item) {
        return;
      }

      if (button.dataset.action === "adicionar-carrinho") {
        const perfil = await ensureClientRegistration();

        if (!perfil) {
          return;
        }

        addItemToCart(item);
        return;
      }

      if (button.dataset.action === "pedir-agora") {
        button.disabled = true;
        const perfil = await ensureClientRegistration();

        if (!perfil) {
          button.disabled = false;
          return;
        }

        const updatedCart = addItemToCart(item);
        if (updatedCart) {
          window.location.href = "carrinho.html";
          return;
        }
        button.disabled = false;
      }
    };
  } catch (error) {
    console.error(error);
    document.title = "Estabelecimento | EatGo";
    capaEl.src = "src/logo.png";
    capaEl.alt = "Estabelecimento";
    nomeEl.textContent = "Estabelecimento indisponível";
    descricaoEl.textContent =
      "Não foi possível carregar os dados do estabelecimento. Verifique a conexão com o backend.";
    enderecoEl.textContent = "Endereço não disponível";
    tempoEl.textContent = "Tempo não disponível";
    categoriaEl.textContent = "Categoria não disponível";
    statusEl.textContent = "Horário não disponível";
    statusEl.className = "restaurante-status closed";
    avaliacaoEl.textContent = "Avaliação não disponível";
    cardapioEl.innerHTML = `
      <article class="card card-cardapio">
        <div class="card-conteudo">
          <h3>Erro ao carregar cardápio</h3>
          <p>Não foi possível obter as informações do banco de dados.</p>
        </div>
      </article>
    `;
    showToast("Não foi possível carregar o estabelecimento do backend.", "error");
  }
}

function setupLoginPage() {
  const loginForm = document.getElementById("partner-login-form");
  const recoveryForm = document.getElementById("partner-recovery-form");
  const recoveryToggle = document.getElementById("toggle-recovery-form");
  if (!loginForm) {
    return;
  }

  fetchPartnerMe()
    .then((user) => {
      if (user) {
        setPartnerUser(user);
        window.location.href = "../gestao/index.html";
      }
    })
    .catch(() => { });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = loginForm.email.value.trim();
    const senha = loginForm.senha.value;
    const submitButton = loginForm.querySelector("button[type='submit']");

    submitButton.disabled = true;

    try {
      await loginPartner(email, senha);
      window.location.href = "../gestao/index.html";
    } catch (error) {
      await showAlert(error.message || "Não foi possível realizar o login.", {
        title: "Falha no login",
        tag: "Gestao"
      });
    } finally {
      submitButton.disabled = false;
    }
  });

  recoveryToggle?.addEventListener("click", () => {
    const expanded = recoveryToggle.getAttribute("aria-expanded") === "true";
    recoveryToggle.setAttribute("aria-expanded", String(!expanded));
    recoveryForm.hidden = expanded;
  });

  recoveryForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = recoveryForm.email.value.trim();
    const submitButton = recoveryForm.querySelector("button[type='submit']");

    submitButton.disabled = true;

    try {
      await recoverPartnerPassword(email);
      recoveryForm.reset();
      recoveryForm.hidden = true;
      recoveryToggle?.setAttribute("aria-expanded", "false");
      await showAlert("Enviamos o link de recuperacao para o email informado.", {
        title: "Recuperacao iniciada",
        tag: "Gestao"
      });
    } catch (error) {
      await showAlert(error.message || "Não foi possível enviar o link de recuperação.", {
        title: "Falha na recuperacao",
        tag: "Gestao"
      });
    } finally {
      submitButton.disabled = false;
    }
  });
}

function setupResetPage() {
  const form = document.getElementById("reset-form");
  const message = document.getElementById("msg");

  if (!form) {
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const token = new URLSearchParams(window.location.search).get("token");
    const senha = form.senha.value;
    const submitButton = form.querySelector("button[type='submit']");

    if (!token) {
      if (message) {
        message.textContent = "Token de recuperacao ausente ou invalido.";
      }
      return;
    }

    submitButton.disabled = true;

    try {
      await resetPartnerPassword(token, senha);
      if (message) {
        message.textContent = "Senha redefinida com sucesso. Voce ja pode entrar na gestao.";
      }
      form.reset();
      window.setTimeout(() => {
        window.location.href = "login.html";
      }, 1500);
    } catch (error) {
      if (message) {
        message.textContent = error.message || "Nao foi possivel redefinir a senha.";
      }
    } finally {
      submitButton.disabled = false;
    }
  });
}
