document.addEventListener("DOMContentLoaded", function () {
  const callIfLoaded = (name, ...args) => {
    if (typeof window[name] === "function") {
      return window[name](...args);
    }

    if (typeof globalThis[name] === "function") {
      return globalThis[name](...args);
    }

    return undefined;
  };

  const hasPublicState =
    typeof publicStateCache !== "undefined" &&
    typeof mergePublicStates === "function" &&
    typeof readPublicStateFromStorage === "function";

  if (hasPublicState) {
    publicStateCache = mergePublicStates(publicStateCache, readPublicStateFromStorage());
  }

  callIfLoaded("renderCartBadge");
  callIfLoaded("applyAccessibilityPreferences");
  callIfLoaded("setupUiFeedback");
  callIfLoaded("setupCategorias");
  callIfLoaded("setupSearch");
  callIfLoaded("setupEntregaCards");
  callIfLoaded("setupPaymentSection");
  callIfLoaded("setupCadastroForm");
  callIfLoaded("setupRestaurantRegistrationPage");
  callIfLoaded("renderizarPaginaRestaurante");
  callIfLoaded("setupCarrinhoPage");
  callIfLoaded("setupLoginPage");
  callIfLoaded("setupResetPage");
  callIfLoaded("initializeGestaoPage");
  callIfLoaded("handleCheckoutReturn");
  callIfLoaded("setupCentralAjudaPage");

  if (typeof initializePublicState !== "function") {
    return;
  }

  initializePublicState()
    .catch(() => {
      if (hasPublicState) {
        publicStateCache = mergePublicStates(publicStateCache, readPublicStateFromStorage());
      }
    })
    .finally(() => {
      callIfLoaded("renderCartBadge");
      callIfLoaded("applyAccessibilityPreferences");
      callIfLoaded("setupPerfilPage");
      callIfLoaded("setupAccessibilityPage");
      callIfLoaded("renderCarrinho");
    });
});
