// app.js - ATUALIZADO COM ANALYTICS
import { db } from "./firebase-config.js";
import {
  FirestoreManager,
  UIUtils,
  CONFIG,
  AdminSession,
  AnalyticsManager,
} from "./utils.js";

import {
  collection,
  query,
  orderBy,
  onSnapshot,
  where,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

class TikTokShop {
  constructor() {
    this.accounts = [];
    this.filters = {
      status: "all",
      sort: "newest",
      maxPrice: "",
      minFollowers: "",
    };

    this.init();
  }

  async init() {
    this.bindEvents();
    this.loadAccounts();
    this.initTheme();

    // ✅ Trackear visita à página principal
    AnalyticsManager.trackPageView();
  }

  bindEvents() {
    // Theme Toggle
    document
      .getElementById("themeToggle")
      ?.addEventListener("click", () => this.toggleTheme());

    // Admin Login
    document
      .getElementById("adminBtn")
      ?.addEventListener("click", () => this.openAdminLogin());
    document
      .getElementById("confirmAdminLogin")
      ?.addEventListener("click", () => this.handleAdminLogin());
    document
      .getElementById("cancelAdminLogin")
      ?.addEventListener("click", () => this.closeAdminLogin());
    document
      .getElementById("adminPassword")
      ?.addEventListener("keypress", (e) => {
        if (e.key === "Enter") this.handleAdminLogin();
      });

    // Filtros
    document
      .getElementById("applyFilters")
      ?.addEventListener("click", () => this.applyFilters());
    document.getElementById("statusFilter")?.addEventListener("change", (e) => {
      this.filters.status = e.target.value;
    });
    document.getElementById("sortFilter")?.addEventListener("change", (e) => {
      this.filters.sort = e.target.value;
    });
    document.getElementById("priceFilter")?.addEventListener(
      "input",
      UIUtils.debounce((e) => {
        this.filters.maxPrice = e.target.value;
      }, 500)
    );
    document.getElementById("followersFilter")?.addEventListener(
      "input",
      UIUtils.debounce((e) => {
        this.filters.minFollowers = e.target.value;
      }, 500)
    );

    // Modal
    document.getElementById("accountModal")?.addEventListener("click", (e) => {
      if (e.target.id === "accountModal") this.closeModal();
    });

    // Fechar modal com ESC
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") this.closeModal();
    });
  }

  async loadAccounts() {
    const grid = document.getElementById("accountsGrid");
    if (!grid) return;

    try {
      UIUtils.showLoading(grid);

      // Carregar inicialmente sem filtros
      this.accounts = await FirestoreManager.getAllAccounts();
      this.renderAccounts(this.accounts);

      // Configurar listener em tempo real
      this.setupRealtimeListener();
    } catch (error) {
      console.error("Erro ao carregar contas:", error);
      UIUtils.showToast("Erro ao carregar contas", "error");
      UIUtils.showEmptyState(grid, "Erro ao carregar contas");
    }
  }

  setupRealtimeListener() {
    const q = query(collection(db, "accounts"), orderBy("createdAt", "desc"));

    onSnapshot(
      q,
      (snapshot) => {
        this.accounts = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Aplicar filtros atuais
        this.applyFilters(false);
      },
      (error) => {
        console.error("Erro no listener em tempo real:", error);
      }
    );
  }

  async applyFilters(showToast = true) {
    try {
      const grid = document.getElementById("accountsGrid");
      UIUtils.showLoading(grid);

      const filteredAccounts = await FirestoreManager.getAllAccounts(
        this.filters
      );
      this.renderAccounts(filteredAccounts);

      if (showToast) {
        UIUtils.showToast(
          `Filtros aplicados (${filteredAccounts.length} contas)`,
          "success"
        );
      }
    } catch (error) {
      console.error("Erro ao aplicar filtros:", error);
      UIUtils.showToast("Erro ao aplicar filtros", "error");
    }
  }

  renderAccounts(accounts) {
    const grid = document.getElementById("accountsGrid");
    const noResults = document.getElementById("noResults");

    if (!accounts || accounts.length === 0) {
      grid.innerHTML = "";
      noResults.classList.remove("hidden");
      return;
    }

    noResults.classList.add("hidden");

    grid.innerHTML = accounts
      .map((account) => this.createAccountCard(account))
      .join("");
  }

  createAccountCard(account) {
    const statusText =
      {
        available: "Disponível",
        reserved: "Reservada",
        sold: "Vendida",
      }[account.status] || "Disponível";

    const statusClass =
      {
        available:
          "bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100",
        reserved:
          "bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100",
        sold: "bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100",
      }[account.status] || "bg-green-100 text-green-800";

    return `
      <div class="account-card bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-105 h-card flex flex-col" 
           data-id="${account.id}" 
           onclick="window.tiktokShop.openAccountModal('${account.id}')">
        
        <!-- Badge Status -->
        <div class="absolute top-3 left-3 z-10">
          <span class="status-badge ${statusClass} text-xs font-semibold px-3 py-1 rounded-full shadow-sm">
            ${statusText}
          </span>
        </div>
        
        <!-- Banner -->
        <div class="h-banner overflow-hidden bg-gray-200 dark:bg-gray-700 relative">
          ${
            account.mainImageUrl
              ? `<img src="${account.mainImageUrl}" 
                  alt="${account.title}" 
                  class="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                  loading="lazy"
                  onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">`
              : ""
          }
          <div class="default-banner w-full h-full flex items-center justify-center bg-gradient-to-br from-primary to-secondary ${
            account.mainImageUrl ? "hidden" : ""
          }">
            <div class="text-center text-white">
              <i class="fab fa-tiktok text-3xl mb-2"></i>
              <p class="text-sm font-semibold">Banner Padrão</p>
            </div>
          </div>
        </div>
        
        <!-- Informações -->
        <div class="p-4 flex-1 flex flex-col justify-between">
          <div>
            <h3 class="font-bold text-lg text-gray-900 dark:text-white mb-2 line-clamp-2 leading-tight">
              ${account.title}
            </h3>
            <p class="text-gray-600 dark:text-gray-300 text-sm mb-3 flex items-center">
              <i class="fas fa-users mr-2 text-primary"></i>
              ${UIUtils.formatNumber(account.followers)} seguidores
            </p>
            ${
              account.description
                ? `
              <p class="text-gray-500 dark:text-gray-400 text-sm line-clamp-2 mb-3">
                ${account.description}
              </p>
            `
                : ""
            }
          </div>
          
          <div class="flex justify-between items-center">
            <span class="price text-xl font-bold text-green-600 dark:text-green-400">
              ${UIUtils.formatPrice(account.price)}
            </span>
            <button class="buy-btn ${
              account.status !== "available"
                ? "opacity-50 cursor-not-allowed"
                : "hover:scale-105"
            } 
                           bg-primary hover:bg-red-600 text-white px-4 py-2 rounded-lg font-semibold transition-all duration-200 flex items-center space-x-2"
                    ${account.status !== "available" ? "disabled" : ""}
                    onclick="event.stopPropagation(); window.tiktokShop.buyViaWhatsApp('${
                      account.id
                    }')">
              <i class="fab fa-whatsapp"></i>
              <span>${
                account.status === "available" ? "Comprar" : "Indisponível"
              }</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  openAdminLogin() {
    document.getElementById("adminLoginModal").classList.remove("hidden");
    document.getElementById("adminLoginModal").classList.add("flex");
    document.getElementById("adminPassword").focus();
  }

  closeAdminLogin() {
    document.getElementById("adminLoginModal").classList.add("hidden");
    document.getElementById("adminLoginModal").classList.remove("flex");
    document.getElementById("adminPassword").value = "";
  }

  handleAdminLogin() {
    const password = document.getElementById("adminPassword").value;

    if (password === CONFIG.adminPassword) {
      AdminSession.startSession();
      UIUtils.showToast("Login administrativo realizado!", "success");
      this.closeAdminLogin();
      setTimeout(() => {
        window.location.href = "admin.html";
      }, 1000);
    } else {
      UIUtils.showToast("Senha incorreta!", "error");
      document.getElementById("adminPassword").focus();
    }
  }

  async openAccountModal(accountId) {
    try {
      const account = await FirestoreManager.getAccountById(accountId);

      // ✅ Trackear visualização da conta específica
      AnalyticsManager.trackPageView(accountId);

      window.accountModal.open(account);
    } catch (error) {
      console.error("Erro ao abrir modal:", error);
      UIUtils.showToast("Erro ao carregar detalhes da conta", "error");
    }
  }

  closeModal() {
    window.accountModal.close();
  }

  buyViaWhatsApp(accountId) {
    const account = this.accounts.find((acc) => acc.id === accountId);
    if (!account || account.status !== "available") {
      UIUtils.showToast(
        "Esta conta não está disponível para compra",
        "warning"
      );
      return;
    }

    const message = `Olá, tenho interesse na conta *${account.title}* (ID: ${account.id}) — preço ${account.price} MT. Meu nome: ___. Como proceder com o pagamento?`;
    const url = `https://wa.me/${
      account.whatsappNumber || CONFIG.whatsappNumber
    }?text=${encodeURIComponent(message)}`;

    window.open(url, "_blank");

    // Opcional: marcar como reservada temporariamente
    // this.reserveAccount(accountId);
  }

  async reserveAccount(accountId) {
    try {
      await FirestoreManager.updateAccount(accountId, { status: "reserved" });
      UIUtils.showToast("Conta reservada temporariamente", "success");
    } catch (error) {
      console.error("Erro ao reservar conta:", error);
    }
  }

  initTheme() {
    const savedTheme = localStorage.getItem("theme") || "dark";
    const isDark = savedTheme === "dark";

    document.documentElement.classList.toggle("dark", isDark);

    const themeToggle = document.getElementById("themeToggle");
    if (themeToggle) {
      themeToggle.innerHTML = isDark
        ? '<i class="fas fa-sun"></i>'
        : '<i class="fas fa-moon"></i>';
    }
  }

  toggleTheme() {
    const isDark = document.documentElement.classList.toggle("dark");
    localStorage.setItem("theme", isDark ? "dark" : "light");

    const themeToggle = document.getElementById("themeToggle");
    if (themeToggle) {
      themeToggle.innerHTML = isDark
        ? '<i class="fas fa-sun"></i>'
        : '<i class="fas fa-moon"></i>';
    }

    UIUtils.showToast(`Tema ${isDark ? "escuro" : "claro"} ativado`, "success");
  }
}

// Inicializar aplicação quando DOM estiver pronto
document.addEventListener("DOMContentLoaded", () => {
  window.tiktokShop = new TikTokShop();
});

// Export para uso global
window.TikTokShop = TikTokShop;
