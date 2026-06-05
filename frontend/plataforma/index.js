// Loader por funcionalidade da plataforma.
(function loadPlatformModules() {
  const currentScript = document.currentScript;
  const baseUrl = currentScript
    ? new URL("js/platform/", currentScript.src).href
    : "js/platform/";

  const pathname = window.location.pathname;
  const pageName = pathname.split("/").pop() || "index.html";
  const isManagementPage = pathname.includes("/gestao/");

  const commonPublicModules = [
    "core.js",
    "catalog.js",
    "ui-feedback.js",
    "state-cart-accessibility.js",
  ];

  const modulesByPage = {
    "index.html": [
      ...commonPublicModules,
      "home-restaurant.js",
      "boot.js"
    ],
    "restaurantes.html": [
      ...commonPublicModules,
      "home-restaurant.js",
      "cart-checkout.js",
      "boot.js"
    ],
    "carrinho.html": [
      ...commonPublicModules,
      "cart-checkout.js",
      "forms-profile-help.js",
      "boot.js"
    ],
    "perfil.html": [
      ...commonPublicModules,
      "forms-profile-help.js",
      "boot.js"
    ],
    "acessibilidade.html": [
      "core.js",
      "ui-feedback.js",
      "state-cart-accessibility.js",
      "boot.js"
    ],
    "central-ajuda.html": [
      "core.js",
      "ui-feedback.js",
      "state-cart-accessibility.js",
      "forms-profile-help.js",
      "boot.js"
    ],
    "sobre-nos.html": [
      "core.js",
      "ui-feedback.js",
      "state-cart-accessibility.js",
      "boot.js"
    ],
    "login.html": [
      "core.js",
      "ui-feedback.js",
      "home-restaurant.js",
      "boot.js"
    ],
    "reset.html": [
      "core.js",
      "ui-feedback.js",
      "home-restaurant.js",
      "boot.js"
    ]
  };

  const commonManagementModules = [
    "core.js",
    "catalog.js",
    "ui-feedback.js",
    "management.js",
    "boot.js"
  ];

  const managementModulesByPage = {
    "configuracoes.html": [
      "core.js",
      "catalog.js",
      "ui-feedback.js",
      "forms-profile-help.js",
      "management.js",
      "boot.js"
    ]
  };

  const modules = isManagementPage
    ? managementModulesByPage[pageName] || commonManagementModules
    : modulesByPage[pageName] || [
        "core.js",
        "ui-feedback.js",
        "state-cart-accessibility.js",
        "boot.js"
      ];

  document.write(
    modules.map((moduleName) => `<script src="${baseUrl}${moduleName}"></script>`).join("")
  );
})();
