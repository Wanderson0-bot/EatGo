// Compatibility loader for pages that still include plataforma/admin.js directly.
(function loadAdminModules() {
  const currentScript = document.currentScript;
  const baseUrl = currentScript
    ? new URL("js/admin/", currentScript.src).href
    : "js/admin/";
  const modules = [
    "core.js",
    "overview.js",
    "form-enhancements.js",
    "boot.js"
  ];

  document.write(
    modules.map((moduleName) => `<script src="${baseUrl}${moduleName}"></script>`).join("")
  );
})();
