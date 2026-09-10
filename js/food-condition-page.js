(function () {
  "use strict";

  // Legacy compatibility only. The canonical finder and result renderer live in food-list.js.
  if (location.pathname.startsWith("/food/conditions/")) {
    location.replace("/food/" + location.search + location.hash);
  }
})();
