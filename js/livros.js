(function () {
  "use strict";

  var pageId = document.body.getAttribute("data-page") || "";
  var state = window.SoterStorage ? window.SoterStorage.getState() : null;

  if (state && state.data) {
    state.data.lastVisitedPage = pageId;
    state.data.lastVisitedAt = new Date().toISOString();
    window.SoterStorage.save(state);
  }

  if (window.SoterTracker && typeof window.SoterTracker.init === "function") {
    window.SoterTracker.init({ tracker: "livros" });
  }
}());
