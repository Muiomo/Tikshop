// admin.js - VERSÃO COMPLETA COM ESTATÍSTICAS DE VISITAS
import { db } from "./firebase-config.js";
import {
  AdminSession,
  StorageManager,
  FirestoreManager,
  UIUtils,
  Validator,
  CONFIG,
  AnalyticsManager,
} from "./utils.js";

import {
  onSnapshot,
  collection,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

class AdminPanel {
  constructor() {
    this.currentEditingId = null;
    this.bannerFile = null;
    this.additionalFiles = [];
    this.existingImages = [];
    this.cropper = null;
    this.cropCanvas = null;
    this.accounts = [];
    this.charts = {};

    this.init();
  }

  async init() {
    if (!AdminSession.validateSession()) {
      return;
    }

    this.bindEvents();
    this.startSessionTimer();
    this.loadAccounts();
    this.setupFileUploads();
    this.initTheme();
    this.initCharts();
    this.updateVisitsStats();
  }

  bindEvents() {
    // Theme Toggle
    document
      .getElementById("themeToggle")
      ?.addEventListener("click", () => this.toggleTheme());

    // Logout
    document
      .getElementById("logoutAdmin")
      ?.addEventListener("click", () => this.logout());

    // Form Submission
    document
      .getElementById("accountForm")
      ?.addEventListener("submit", (e) => this.handleSubmit(e));

    // Cancel Edit
    document
      .getElementById("cancelEdit")
      ?.addEventListener("click", () => this.cancelEdit());

    // File Uploads
    document
      .getElementById("bannerUploadBtn")
      ?.addEventListener("click", () => this.triggerBannerUpload());
    document
      .getElementById("accountBanner")
      ?.addEventListener("change", (e) => this.handleBannerSelect(e));
    document
      .getElementById("photosUploadBtn")
      ?.addEventListener("click", () => this.triggerPhotosUpload());
    document
      .getElementById("accountPhotos")
      ?.addEventListener("change", (e) => this.handlePhotosSelect(e));

    // Crop Modal
    document
      .getElementById("cancelCrop")
      ?.addEventListener("click", () => this.closeCropModal());
    document
      .getElementById("confirmCrop")
      ?.addEventListener("click", () => this.applyCrop());

    // Atualizar estatísticas a cada minuto
    setInterval(() => this.updateVisitsStats(), 60000);

    // Fechar modais
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.closeCropModal();
      }
    });
  }

  initCharts() {
    // Gráfico de Status (Doughnut)
    const statusCtx = document.getElementById("statusChart");
    if (statusCtx) {
      this.charts.status = new Chart(statusCtx, {
        type: "doughnut",
        data: {
          labels: ["Disponíveis", "Vendidas", "Reservadas"],
          datasets: [
            {
              data: [0, 0, 0],
              backgroundColor: [
                "#10B981", // Verde
                "#EF4444", // Vermelho
                "#F59E0B", // Amarelo
              ],
              borderWidth: 2,
              borderColor: document.documentElement.classList.contains("dark")
                ? "#374151"
                : "#FFFFFF",
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "bottom",
              labels: {
                color: document.documentElement.classList.contains("dark")
                  ? "#9CA3AF"
                  : "#6B7280",
                font: {
                  size: 12,
                },
              },
            },
          },
        },
      });
    }

    // Gráfico de Visitas (Line)
    const visitsCtx = document.getElementById("visitsChart");
    if (visitsCtx) {
      this.charts.visits = new Chart(visitsCtx, {
        type: "line",
        data: {
          labels: this.getLast7Days(),
          datasets: [
            {
              label: "Visitas Diárias",
              data: [0, 0, 0, 0, 0, 0, 0],
              borderColor: "#FF0050",
              backgroundColor: "rgba(255, 0, 80, 0.1)",
              borderWidth: 2,
              fill: true,
              tension: 0.4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                color: document.documentElement.classList.contains("dark")
                  ? "#9CA3AF"
                  : "#6B7280",
              },
              grid: {
                color: document.documentElement.classList.contains("dark")
                  ? "#374151"
                  : "#E5E7EB",
              },
            },
            x: {
              ticks: {
                color: document.documentElement.classList.contains("dark")
                  ? "#9CA3AF"
                  : "#6B7280",
              },
              grid: {
                color: document.documentElement.classList.contains("dark")
                  ? "#374151"
                  : "#E5E7EB",
              },
            },
          },
          plugins: {
            legend: {
              labels: {
                color: document.documentElement.classList.contains("dark")
                  ? "#9CA3AF"
                  : "#6B7280",
              },
            },
          },
        },
      });
    }
  }

  getLast7Days() {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      days.push(
        date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
      );
    }
    return days;
  }

  updateVisitsStats() {
    const stats = AnalyticsManager.getVisitsStats();

    // Atualizar cards de visitas
    if (document.getElementById("visitsToday")) {
      document.getElementById("visitsToday").textContent = stats.today;
    }
    if (document.getElementById("visitsThisWeek")) {
      document.getElementById("visitsThisWeek").textContent = stats.thisWeek;
    }
    if (document.getElementById("visitsThisMonth")) {
      document.getElementById("visitsThisMonth").textContent = stats.thisMonth;
    }
    if (document.getElementById("totalVisits")) {
      document.getElementById("totalVisits").textContent = stats.total;
    }

    // Atualizar gráfico de visitas dos últimos 7 dias
    if (this.charts.visits) {
      const last7DaysData = this.getLast7DaysVisits(stats.viewsData);
      this.charts.visits.data.datasets[0].data = last7DaysData;
      this.charts.visits.update();
    }
  }

  getLast7DaysVisits(viewsData) {
    const visitsByDay = {};
    const last7Days = [];

    // Inicializar últimos 7 dias
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateString = date.toISOString().split("T")[0];
      last7Days.push(dateString);
      visitsByDay[dateString] = 0;
    }

    // Contar visitas por dia
    viewsData.forEach((view) => {
      if (visitsByDay.hasOwnProperty(view.date)) {
        visitsByDay[view.date]++;
      }
    });

    // Retornar array na ordem dos últimos 7 dias
    return last7Days.map((date) => visitsByDay[date]);
  }

  updateDashboardStats() {
    const totalAccounts = this.accounts.length;
    const soldAccounts = this.accounts.filter(
      (acc) => acc.status === "sold"
    ).length;
    const availableAccounts = this.accounts.filter(
      (acc) => acc.status === "available"
    ).length;
    const reservedAccounts = this.accounts.filter(
      (acc) => acc.status === "reserved"
    ).length;
    const totalRevenue = this.accounts
      .filter((acc) => acc.status === "sold")
      .reduce((sum, acc) => sum + (parseFloat(acc.price) || 0), 0);

    // Atualizar cards
    if (document.getElementById("totalAccounts")) {
      document.getElementById("totalAccounts").textContent = totalAccounts;
    }
    if (document.getElementById("soldAccounts")) {
      document.getElementById("soldAccounts").textContent = soldAccounts;
    }
    if (document.getElementById("availableAccounts")) {
      document.getElementById("availableAccounts").textContent =
        availableAccounts;
    }
    if (document.getElementById("totalRevenue")) {
      document.getElementById("totalRevenue").textContent =
        UIUtils.formatPrice(totalRevenue);
    }

    // Atualizar gráfico de status
    if (this.charts.status) {
      this.charts.status.data.datasets[0].data = [
        availableAccounts,
        soldAccounts,
        reservedAccounts,
      ];
      this.charts.status.update();
    }

    // Atualizar estatísticas de visitas
    this.updateVisitsStats();
  }

  startSessionTimer() {
    const updateTimer = () => {
      const remaining = AdminSession.getRemainingTime();
      const timerElement = document.getElementById("adminSessionTimer");

      if (remaining <= 0) {
        this.logout();
        return;
      }

      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);

      if (timerElement) {
        timerElement.textContent = `Sessão expira em: ${minutes
          .toString()
          .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

        if (remaining < 60000) {
          timerElement.classList.add("text-red-500", "animate-pulse");
        } else if (remaining < 120000) {
          timerElement.classList.add("text-yellow-500");
        }
      }
    };

    updateTimer();
    this.sessionTimer = setInterval(updateTimer, 1000);
  }

  setupFileUploads() {
    // Drag and drop para banner
    const bannerArea = document.getElementById("bannerPreview");
    if (bannerArea) {
      bannerArea.addEventListener("dragover", (e) => {
        e.preventDefault();
        bannerArea.classList.add("border-primary", "bg-primary/10");
      });

      bannerArea.addEventListener("dragleave", () => {
        bannerArea.classList.remove("border-primary", "bg-primary/10");
      });

      bannerArea.addEventListener("drop", (e) => {
        e.preventDefault();
        bannerArea.classList.remove("border-primary", "bg-primary/10");

        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type.startsWith("image/")) {
          this.handleBannerFile(files[0]);
        }
      });
    }
  }

  loadAccounts() {
    const q = collection(db, "accounts");

    onSnapshot(
      q,
      (snapshot) => {
        this.accounts = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        this.renderAccountsTable(this.accounts);
        this.updateDashboardStats();
      },
      (error) => {
        console.error("Erro ao carregar contas:", error);
        UIUtils.showToast("Erro ao carregar contas", "error");
      }
    );
  }

  renderAccountsTable(accounts) {
    const tbody = document.getElementById("adminAccountsList");
    if (!tbody) return;

    if (accounts.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
            <i class="fas fa-inbox text-4xl mb-3 opacity-50"></i>
            <p class="text-lg font-semibold">Nenhuma conta cadastrada</p>
            <p class="text-sm">Use o formulário acima para adicionar sua primeira conta</p>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = accounts
      .map(
        (account) => `
          <tr class="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group">
            <!-- Conta -->
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="flex items-center">
                <div class="flex-shrink-0 h-10 w-10 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform">
                  <i class="fab fa-tiktok text-white"></i>
                </div>
                <div class="ml-4">
                  <div class="text-sm font-medium text-gray-900 dark:text-white group-hover:text-primary transition-colors">
                    ${account.title}
                  </div>
                  <div class="text-sm text-gray-500 dark:text-gray-400">
                    ID: ${account.id}
                  </div>
                </div>
              </div>
            </td>

            <!-- Status -->
            <td class="px-6 py-4 whitespace-nowrap">
              <span class="status-badge ${this.getStatusClass(
                account.status
              )} px-3 py-1 rounded-full text-xs font-medium inline-flex items-center space-x-1">
                ${this.getStatusIcon(account.status)}
                <span>${this.getStatusText(account.status)}</span>
              </span>
            </td>

            <!-- Seguidores -->
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
              <div class="flex items-center space-x-1">
                <i class="fas fa-users text-blue-500 text-xs"></i>
                <span>${UIUtils.formatNumber(account.followers)}</span>
              </div>
            </td>

            <!-- Visualizações -->
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
              <div class="flex items-center space-x-1">
                <i class="fas fa-eye text-purple-500 text-xs"></i>
                <span>${UIUtils.formatNumber(account.views || 0)}</span>
              </div>
            </td>

            <!-- Preço -->
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600 dark:text-green-400">
              <div class="flex items-center space-x-1">
                <i class="fas fa-tag text-green-500 text-xs"></i>
                <span>${UIUtils.formatPrice(account.price)}</span>
              </div>
            </td>

            <!-- Data -->
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
              <div class="flex items-center space-x-1">
                <i class="fas fa-calendar text-gray-400 text-xs"></i>
                <span>${this.formatDate(account.createdAt)}</span>
              </div>
            </td>

            <!-- Ações -->
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
              <div class="flex justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onclick="window.adminPanel.editAccount('${
                  account.id
                }')" 
                        class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 transition-colors p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        title="Editar">
                  <i class="fas fa-edit"></i>
                </button>
                
                ${
                  account.status === "available"
                    ? `
                  <button onclick="window.adminPanel.markAsSold('${account.id}')" 
                          class="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 transition-colors p-2 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20"
                          title="Marcar como Vendida">
                    <i class="fas fa-check"></i>
                  </button>
                `
                    : `
                  <button onclick="window.adminPanel.markAsAvailable('${account.id}')" 
                          class="text-yellow-600 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-300 transition-colors p-2 rounded-lg hover:bg-yellow-50 dark:hover:bg-yellow-900/20"
                          title="Marcar como Disponível">
                    <i class="fas fa-undo"></i>
                  </button>
                `
                }
                
                <button onclick="window.adminPanel.deleteAccount('${
                  account.id
                }')" 
                        class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition-colors p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                        title="Excluir">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </td>
          </tr>
        `
      )
      .join("");
  }

  getStatusIcon(status) {
    const icons = {
      available: '<i class="fas fa-circle text-green-500 text-xs"></i>',
      reserved: '<i class="fas fa-circle text-yellow-500 text-xs"></i>',
      sold: '<i class="fas fa-circle text-red-500 text-xs"></i>',
    };
    return icons[status] || icons.available;
  }

  async handleSubmit(e) {
    e.preventDefault();

    if (!AdminSession.validateSession()) {
      return;
    }

    const submitBtn = document.getElementById("submitAccount");
    const originalText = submitBtn.innerHTML;

    try {
      // Mostrar loading
      submitBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin mr-2"></i>Salvando...';
      submitBtn.disabled = true;

      // Coletar dados do formulário
      const formData = this.collectFormData();

      // Validar dados
      const errors = Validator.validateAccountData(formData);
      if (errors.length > 0) {
        throw new Error(errors.join(", "));
      }

      // Sanitizar dados
      const sanitizedData = Validator.sanitizeAccountData(formData);

      // Processar uploads de imagens como Base64
      await this.processImageUploadsBase64(sanitizedData);

      // Salvar no Firestore
      if (this.currentEditingId) {
        await FirestoreManager.updateAccount(
          this.currentEditingId,
          sanitizedData
        );
        UIUtils.showToast("Conta atualizada com sucesso!", "success");
      } else {
        await FirestoreManager.createAccount(sanitizedData);
        UIUtils.showToast("Conta criada com sucesso!", "success");
      }

      // Limpar formulário
      this.resetForm();
    } catch (error) {
      console.error("Erro ao salvar conta:", error);
      UIUtils.showToast(`Erro: ${error.message}`, "error");
    } finally {
      // Restaurar botão
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
    }
  }

  collectFormData() {
    return {
      title: document.getElementById("accountTitle").value,
      price: document.getElementById("accountPrice").value,
      followers: document.getElementById("accountFollowers").value,
      status: document.getElementById("accountStatus").value,
      description: document.getElementById("accountDescription").value,
      whatsappNumber: document.getElementById("accountWhatsApp").value,
      likes: document.getElementById("accountLikes").value || 0,
      videos: document.getElementById("accountVideos").value || 0,
      views: document.getElementById("accountViews").value || 0,
      stats: {
        likes: document.getElementById("accountLikes").value || 0,
        videos: document.getElementById("accountVideos").value || 0,
        bio: document.getElementById("accountBio")?.value || "",
      },
    };
  }

  async processImageUploadsBase64(accountData) {
    // Upload banner principal como Base64
    if (this.bannerFile) {
      try {
        UIUtils.validateImageFile(this.bannerFile);

        // Verificar tamanho do arquivo
        if (this.bannerFile.size > CONFIG.maxImageSize) {
          throw new Error(
            `Banner muito grande. Máximo ${CONFIG.maxImageSize / 1024 / 1024}MB`
          );
        }

        // Converter para Base64
        let base64Data = await StorageManager.fileToBase64(this.bannerFile);

        // Tentar otimizar a imagem
        try {
          base64Data = await StorageManager.optimizeImage(
            base64Data,
            this.bannerFile.type
          );
        } catch (optimizeError) {
          console.warn("Otimização falhou, usando original:", optimizeError);
          // Continua com o Base64 original se a otimização falhar
        }

        accountData.mainImageUrl = base64Data;
        accountData.mainImageType = this.bannerFile.type;
        accountData.mainImageSize = this.bannerFile.size;
      } catch (error) {
        throw new Error(`Erro no banner: ${error.message}`);
      }
    } else if (this.currentEditingId && this.existingImages[0]) {
      // Manter banner existente se não houver novo upload
      accountData.mainImageUrl = this.existingImages[0];
    }

    // Upload imagens adicionais como Base64
    if (this.additionalFiles.length > 0) {
      try {
        // Validar número máximo de imagens
        if (this.additionalFiles.length > CONFIG.maxImages) {
          throw new Error(`Máximo de ${CONFIG.maxImages} imagens permitidas`);
        }

        accountData.images = [];
        accountData.imageTypes = [];
        accountData.imageSizes = [];

        for (const file of this.additionalFiles) {
          UIUtils.validateImageFile(file);

          // Verificar tamanho do arquivo
          if (file.size > CONFIG.maxImageSize) {
            throw new Error(
              `Imagem ${file.name} muito grande. Máximo ${
                CONFIG.maxImageSize / 1024 / 1024
              }MB`
            );
          }

          // Converter para Base64
          let base64Data = await StorageManager.fileToBase64(file);

          // Tentar otimizar a imagem
          try {
            base64Data = await StorageManager.optimizeImage(
              base64Data,
              file.type
            );
          } catch (optimizeError) {
            console.warn("Otimização falhou, usando original:", optimizeError);
            // Continua com o Base64 original se a otimização falhar
          }

          accountData.images.push(base64Data);
          accountData.imageTypes.push(file.type);
          accountData.imageSizes.push(file.size);
        }
      } catch (error) {
        throw new Error(`Erro nas fotos: ${error.message}`);
      }
    } else if (this.currentEditingId && this.existingImages.length > 1) {
      // Manter imagens existentes se não houver novos uploads
      accountData.images = this.existingImages.slice(1);
    }
  }

  triggerBannerUpload() {
    document.getElementById("accountBanner").click();
  }

  handleBannerSelect(e) {
    const file = e.target.files[0];
    if (file) {
      this.handleBannerFile(file);
    }
  }

  handleBannerFile(file) {
    try {
      UIUtils.validateImageFile(file);

      // Verificar tamanho
      if (file.size > CONFIG.maxImageSize) {
        throw new Error(
          `Arquivo muito grande. Máximo ${CONFIG.maxImageSize / 1024 / 1024}MB`
        );
      }

      this.bannerFile = file;
      this.showBannerPreview(file);
    } catch (error) {
      UIUtils.showToast(error.message, "error");
    }
  }

  showBannerPreview(file) {
    const previewContainer = document.getElementById("bannerPreview");
    const reader = new FileReader();

    reader.onload = (e) => {
      const base64Data = e.target.result;
      previewContainer.innerHTML = `
        <div class="relative">
          <img src="${base64Data}" alt="Preview" class="w-full h-48 object-cover rounded-lg shadow-md">
          <div class="absolute top-2 right-2 flex space-x-2">
            <button type="button" onclick="window.adminPanel.openCropModal('${base64Data}')" 
                    class="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-full shadow-lg transition-colors">
              <i class="fas fa-crop"></i>
            </button>
            <button type="button" onclick="window.adminPanel.removeBanner()" 
                    class="bg-red-500 hover:bg-red-600 text-white p-2 rounded-full shadow-lg transition-colors">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <p class="text-sm text-gray-600 dark:text-gray-400 mt-2 text-center">
            ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)
            <br>
            <span class="text-xs text-green-600">✓ Armazenamento Base64</span>
          </p>
        </div>
      `;
    };

    reader.readAsDataURL(file);
  }

  removeBanner() {
    this.bannerFile = null;
    document.getElementById("accountBanner").value = "";
    document.getElementById("bannerPreview").innerHTML = "";
  }

  triggerPhotosUpload() {
    document.getElementById("accountPhotos").click();
  }

  handlePhotosSelect(e) {
    const files = Array.from(e.target.files);

    // Verificar limite
    if (this.additionalFiles.length + files.length > CONFIG.maxImages) {
      UIUtils.showToast(
        `Máximo de ${CONFIG.maxImages} imagens permitidas`,
        "error"
      );
      return;
    }

    files.forEach((file) => {
      try {
        UIUtils.validateImageFile(file);

        // Verificar tamanho
        if (file.size > CONFIG.maxImageSize) {
          UIUtils.showToast(
            `Imagem ${file.name} muito grande. Máximo ${
              CONFIG.maxImageSize / 1024 / 1024
            }MB`,
            "error"
          );
          return;
        }

        this.additionalFiles.push(file);
        this.showPhotoPreview(file);
      } catch (error) {
        UIUtils.showToast(`Erro em ${file.name}: ${error.message}`, "error");
      }
    });

    // Reset input para permitir selecionar os mesmos arquivos novamente
    e.target.value = "";
  }

  showPhotoPreview(file) {
    const previewContainer = document.getElementById("photosPreview");
    const reader = new FileReader();
    const fileId = Date.now();

    reader.onload = (e) => {
      const previewElement = document.createElement("div");
      previewElement.className = "relative";
      previewElement.innerHTML = `
        <div class="relative">
          <img src="${
            e.target.result
          }" alt="Preview" class="w-full h-24 object-cover rounded-lg shadow-md">
          <button type="button" onclick="window.adminPanel.removePhoto(${fileId})" 
                  class="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs shadow-lg transition-colors">
            <i class="fas fa-times"></i>
          </button>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center truncate">
            ${(file.size / 1024).toFixed(1)}KB
          </p>
        </div>
      `;

      previewContainer.appendChild(previewElement);

      // Armazenar referência para remoção
      file.previewId = fileId;
    };

    reader.readAsDataURL(file);
  }

  removePhoto(fileId) {
    this.additionalFiles = this.additionalFiles.filter(
      (file) => file.previewId !== fileId
    );
    this.updatePhotosPreview();
  }

  updatePhotosPreview() {
    const previewContainer = document.getElementById("photosPreview");
    previewContainer.innerHTML = "";

    this.additionalFiles.forEach((file) => {
      this.showPhotoPreview(file);
    });
  }

  openCropModal(imageUrl) {
    const modal = document.getElementById("cropModal");
    const image = document.getElementById("cropImage");

    image.src = imageUrl;
    modal.classList.remove("hidden");
    modal.classList.add("flex");

    // Inicializar cropper
    this.cropper = new Cropper(image, {
      aspectRatio: 16 / 9,
      viewMode: 1,
      autoCropArea: 1,
      responsive: true,
      restore: false,
      guides: true,
      center: true,
      highlight: false,
      cropBoxMovable: true,
      cropBoxResizable: true,
      toggleDragModeOnDblclick: false,
    });
  }

  closeCropModal() {
    const modal = document.getElementById("cropModal");
    modal.classList.add("hidden");
    modal.classList.remove("flex");

    if (this.cropper) {
      this.cropper.destroy();
      this.cropper = null;
    }
  }

  async applyCrop() {
    if (!this.cropper) return;

    try {
      const canvas = this.cropper.getCroppedCanvas({
        width: 800,
        height: 450,
        imageSmoothingQuality: "high",
      });

      // Converter canvas para blob e depois para Base64
      canvas.toBlob(
        async (blob) => {
          const file = new File([blob], "banner-cropped.jpg", {
            type: "image/jpeg",
          });
          this.bannerFile = file;

          // Mostrar preview do crop
          const reader = new FileReader();
          reader.onload = (e) => {
            this.showBannerPreview(file);
          };
          reader.readAsDataURL(blob);

          this.closeCropModal();
        },
        "image/jpeg",
        0.85
      ); // Qualidade 85%
    } catch (error) {
      console.error("Erro ao aplicar crop:", error);
      UIUtils.showToast("Erro ao processar imagem", "error");
    }
  }

  async editAccount(accountId) {
    try {
      const account = await FirestoreManager.getAccountById(accountId);

      this.currentEditingId = accountId;
      this.existingImages = [
        account.mainImageUrl,
        ...(account.images || []),
      ].filter((url) => url);

      // Preencher formulário COMPLETO
      document.getElementById("accountTitle").value = account.title;
      document.getElementById("accountPrice").value = account.price;
      document.getElementById("accountFollowers").value = account.followers;
      document.getElementById("accountStatus").value = account.status;
      document.getElementById("accountDescription").value =
        account.description || "";
      document.getElementById("accountWhatsApp").value =
        account.whatsappNumber || "";

      // PREENCHER campos que estavam faltando
      document.getElementById("accountLikes").value =
        account.likes || account.stats?.likes || "";
      document.getElementById("accountVideos").value =
        account.videos || account.stats?.videos || "";
      document.getElementById("accountViews").value = account.views || "";

      // Atualizar UI
      document.getElementById("formTitle").innerHTML =
        '<i class="fas fa-edit mr-2 text-primary"></i>Editar Conta';
      document.getElementById("cancelEdit").classList.remove("hidden");
      document.getElementById("submitAccount").innerHTML =
        '<i class="fas fa-save mr-2"></i>Atualizar Conta';

      // Mostrar preview das imagens existentes
      this.showExistingImagesPreview();

      // Scroll para o formulário
      document
        .getElementById("accountForm")
        .scrollIntoView({ behavior: "smooth" });

      UIUtils.showToast("Modo edição ativado", "success");
    } catch (error) {
      console.error("Erro ao carregar conta para edição:", error);
      UIUtils.showToast("Erro ao carregar conta", "error");
    }
  }

  showExistingImagesPreview() {
    // Banner principal
    if (this.existingImages[0]) {
      document.getElementById("bannerPreview").innerHTML = `
        <div class="relative">
          <img src="${this.existingImages[0]}" alt="Banner existente" class="w-full h-48 object-cover rounded-lg shadow-md">
          <div class="absolute top-2 right-2">
            <span class="bg-green-500 text-white text-xs px-2 py-1 rounded-full">
              Base64
            </span>
          </div>
          <p class="text-sm text-gray-600 dark:text-gray-400 mt-2 text-center">
            Banner atual (será mantido se não substituir)
          </p>
        </div>
      `;
    }

    // Fotos adicionais
    const additionalImages = this.existingImages.slice(1);
    if (additionalImages.length > 0) {
      const photosContainer = document.getElementById("photosPreview");
      photosContainer.innerHTML = additionalImages
        .map(
          (image, index) => `
            <div class="relative">
              <img src="${image}" alt="Foto ${
            index + 1
          }" class="w-full h-24 object-cover rounded-lg shadow-md">
              <div class="absolute top-1 right-1">
                <span class="bg-green-500 text-white text-xs px-1 py-0.5 rounded">
                  Base64
                </span>
              </div>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
                Foto ${index + 1}
              </p>
            </div>
          `
        )
        .join("");
    }
  }

  cancelEdit() {
    this.currentEditingId = null;
    this.existingImages = [];
    this.resetForm();

    document.getElementById("formTitle").innerHTML =
      '<i class="fas fa-plus-circle mr-2 text-primary"></i>Adicionar Nova Conta';
    document.getElementById("cancelEdit").classList.add("hidden");
    document.getElementById("submitAccount").innerHTML =
      '<i class="fas fa-save mr-2"></i>Salvar Conta';

    UIUtils.showToast("Edição cancelada", "info");
  }

  resetForm() {
    document.getElementById("accountForm").reset();
    this.bannerFile = null;
    this.additionalFiles = [];
    document.getElementById("bannerPreview").innerHTML = "";
    document.getElementById("photosPreview").innerHTML = "";
    this.currentEditingId = null;
    this.existingImages = [];
  }

  async deleteAccount(accountId) {
    if (
      !confirm(
        "Tem certeza que deseja excluir esta conta? Esta ação não pode ser desfeita."
      )
    ) {
      return;
    }

    try {
      await FirestoreManager.deleteAccount(accountId);
      UIUtils.showToast("Conta excluída com sucesso!", "success");
    } catch (error) {
      console.error("Erro ao excluir conta:", error);
      UIUtils.showToast("Erro ao excluir conta", "error");
    }
  }

  async markAsSold(accountId) {
    try {
      await FirestoreManager.markAsSold(accountId);
      UIUtils.showToast("Conta marcada como vendida!", "success");
    } catch (error) {
      console.error("Erro ao marcar como vendida:", error);
      UIUtils.showToast("Erro ao atualizar status", "error");
    }
  }

  async markAsAvailable(accountId) {
    try {
      await FirestoreManager.markAsAvailable(accountId);
      UIUtils.showToast("Conta marcada como disponível!", "success");
    } catch (error) {
      console.error("Erro ao marcar como disponível:", error);
      UIUtils.showToast("Erro ao atualizar status", "error");
    }
  }

  logout() {
    AdminSession.endSession();
    clearInterval(this.sessionTimer);
    UIUtils.showToast("Sessão encerrada", "info");
    setTimeout(() => {
      window.location.href = "index.html";
    }, 1000);
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

    // Atualizar cores dos gráficos
    this.updateChartsTheme();
  }

  updateChartsTheme() {
    const isDark = document.documentElement.classList.contains("dark");
    const textColor = isDark ? "#9CA3AF" : "#6B7280";
    const gridColor = isDark ? "#374151" : "#E5E7EB";

    // Atualizar gráfico de status
    if (this.charts.status) {
      this.charts.status.options.plugins.legend.labels.color = textColor;
      this.charts.status.data.datasets[0].borderColor = isDark
        ? "#374151"
        : "#FFFFFF";
      this.charts.status.update();
    }

    // Atualizar gráfico de visitas
    if (this.charts.visits) {
      this.charts.visits.options.scales.y.ticks.color = textColor;
      this.charts.visits.options.scales.y.grid.color = gridColor;
      this.charts.visits.options.scales.x.ticks.color = textColor;
      this.charts.visits.options.scales.x.grid.color = gridColor;
      this.charts.visits.options.plugins.legend.labels.color = textColor;
      this.charts.visits.update();
    }
  }

  getStatusClass(status) {
    const classes = {
      available:
        "bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100",
      reserved:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100",
      sold: "bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100",
    };
    return classes[status] || classes.available;
  }

  getStatusText(status) {
    const texts = {
      available: "Disponível",
      reserved: "Reservada",
      sold: "Vendida",
    };
    return texts[status] || "Disponível";
  }

  formatDate(timestamp) {
    if (!timestamp) return "N/A";

    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString("pt-MZ");
    } catch {
      return "Data inválida";
    }
  }
}

// Inicializar painel admin quando DOM estiver pronto
document.addEventListener("DOMContentLoaded", () => {
  window.adminPanel = new AdminPanel();
});

export default AdminPanel;
