(function () {
  function renderAgentCards() {
    const target = document.querySelector("[data-agent-grid]");
    if (!target || !window.DEARLOG_AGENTS) return;

    target.innerHTML = window.DEARLOG_AGENTS.map((agent) => `
      <article class="agent-card" data-group="${agent.group}">
        <h3>${agent.title}</h3>
        <span class="agent-name">${agent.name}</span>
        <p>${agent.description}</p>
        <div class="agent-meta">${agent.files}</div>
      </article>
    `).join("");
  }

  function markActiveNav() {
    const current = location.pathname.split("/").pop() || "dearlog-workflow.html";
    document.querySelectorAll(".nav-link").forEach((link) => {
      const href = link.getAttribute("href") || "";
      const hrefFile = href.split("/").pop();
      if (hrefFile === current) link.classList.add("is-active");
      else link.classList.remove("is-active");
    });
  }

  renderAgentCards();
  markActiveNav();
})();
