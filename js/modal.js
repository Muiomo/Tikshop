// modal.js - ATUALIZADO COM ANALYTICS
import { UIUtils, CONFIG, AnalyticsManager } from "./utils.js";

class AccountModal {
  constructor() {
    this.currentAccount = null;
    this.currentImageIndex = 0;
    this.isFullscreen = false;
    this.init();
  }

  init() {
    this.bindEvents();
  }

  bindEvents() {
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (this.isFullscreen) {
          this.exitFullscreen();
        } else {
          this.close();
        }
      }
      if (e.key === "ArrowLeft") this.previousImage();
      if (e.key === "ArrowRight") this.nextImage();
    });
  }

  async open(account) {
    console.log("🔍 [MODAL] Dados recebidos COMPLETOS:", account);

    this.currentAccount = account;
    this.currentImageIndex = 0;
    this.isFullscreen = false;

    this.renderModal();
    this.showModal();
  }

  close() {
    const modal = document.getElementById("accountModal");
    if (modal) {
      modal.classList.add("hidden");
      modal.classList.remove("flex");
      document.body.classList.remove("overflow-hidden");
    }
    this.currentAccount = null;
    this.currentImageIndex = 0;
    this.isFullscreen = false;
  }

  renderModal() {
    const modal = document.getElementById("accountModal");
    if (!modal) return;

    modal.innerHTML = this.getModalContent();
    this.bindModalEvents();
  }

  getModalContent() {
    const account = this.currentAccount;
    if (!account)
      return '<div class="p-8 text-center">Erro: Conta não carregada</div>';

    const allImages = [account.mainImageUrl, ...(account.images || [])].filter(
      (url) => url && url.trim() !== ""
    );

    // ✅ BUSCAR DADOS DE TODAS AS FONTES POSSÍVEIS
    const views = account.views || 0;
    const likes = account.likes || account.stats?.likes || 0;
    const totalVideos = account.videos || account.stats?.videos || 0;
    const followers = account.followers || 0;

    // ✅ OBTER visualizações do analytics
    const accountViews = AnalyticsManager.getAccountViews(account.id);
    const totalViews = Math.max(views, accountViews);

    return `
      <div class="modal-overlay fixed inset-0 bg-black bg-opacity-70 z-[100] flex items-center justify-center p-4" id="accountModalOverlay">
        <div class="modal-content bg-white dark:bg-gray-800 rounded-xl overflow-hidden w-full max-w-5xl max-h-[90vh] flex flex-col relative z-[101]">
          <!-- Header -->
          <div class="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <h2 class="text-xl font-bold text-gray-900 dark:text-white truncate">${this.escapeHtml(
              account.title
            )}</h2>
            <button onclick="window.accountModal.close()" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors z-[110]">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>

          <!-- Content -->
          <div class="flex-1 overflow-hidden flex flex-col md:flex-row">
            <!-- Galeria -->
            <div class="w-full md:w-[45%] border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-700 flex flex-col">
              <div class="flex-1 bg-gray-100 dark:bg-gray-700 flex items-center justify-center p-4 relative min-h-[300px]">
                ${
                  allImages.length > 0
                    ? `
                  <div class="relative w-full h-full flex items-center justify-center">
                    <img src="${allImages[this.currentImageIndex]}" 
                         alt="${this.escapeHtml(account.title)}"
                         class="max-w-full max-h-full object-contain transition-transform duration-300"
                         id="mainGalleryImage">
                    
                    <div class="absolute top-3 left-3 bg-black bg-opacity-70 text-white px-3 py-1 rounded-full text-xs font-medium z-10">
                      ${this.currentImageIndex + 1} / ${allImages.length}
                    </div>

                    <button onclick="window.accountModal.toggleFullscreen()" 
                            class="absolute top-3 right-3 bg-black bg-opacity-70 text-white p-2 rounded-full hover:bg-opacity-90 transition-all z-10">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/>
                      </svg>
                    </button>

                    ${
                      allImages.length > 1
                        ? `
                      <button onclick="window.accountModal.previousImage()" 
                              class="absolute left-3 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-70 text-white p-2 rounded-full hover:bg-opacity-90 transition-all z-10 disabled:opacity-30"
                              ${this.currentImageIndex === 0 ? "disabled" : ""}>
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
                        </svg>
                      </button>

                      <button onclick="window.accountModal.nextImage()" 
                              class="absolute right-3 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-70 text-white p-2 rounded-full hover:bg-opacity-90 transition-all z-10 disabled:opacity-30"
                              ${
                                this.currentImageIndex === allImages.length - 1
                                  ? "disabled"
                                  : ""
                              }>
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                        </svg>
                      </button>
                    `
                        : ""
                    }
                  </div>
                `
                    : `
                  <div class="text-center text-gray-500 dark:text-gray-400">
                    <svg class="w-16 h-16 mx-auto mb-2 opacity-50" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                    </svg>
                    <p class="text-sm">Sem imagem</p>
                  </div>
                `
                }
              </div>

              ${
                allImages.length > 1
                  ? `
                <div class="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex-shrink-0">
                  <div class="flex space-x-2 overflow-x-auto pb-1 custom-scrollbar">
                    ${allImages
                      .map(
                        (image, index) => `
                      <div class="cursor-pointer border-2 ${
                        index === this.currentImageIndex
                          ? "border-blue-500"
                          : "border-gray-300 dark:border-gray-600"
                      } rounded-lg overflow-hidden flex-shrink-0 transition-all duration-200 hover:scale-105"
                           onclick="window.accountModal.changeImage(${index})">
                        <img src="${image}" 
                             alt="Thumb ${index + 1}"
                             class="w-16 h-16 object-cover">
                      </div>
                    `
                      )
                      .join("")}
                  </div>
                </div>
              `
                  : ""
              }
            </div>

            <!-- Informações -->
            <div class="w-full md:w-[55%] overflow-y-auto flex flex-col">
              <div class="p-6 space-y-6 flex-1">
                <!-- Status e Preço -->
                <div class="flex justify-between items-center">
                  <span class="status-badge ${this.getStatusClass(
                    account.status
                  )} px-3 py-1.5 rounded-full text-xs font-semibold">
                    ${this.getStatusText(account.status)}
                  </span>
                  <div class="text-right">
                    <div class="text-2xl font-bold text-green-600 dark:text-green-400 flex items-center justify-end">
                      <svg class="w-5 h-5 mr-1 text-green-500" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                      </svg>
                      ${UIUtils.formatPrice(account.price)}
                    </div>
                    <div class="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center justify-end">
                      <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                      ${this.formatNumber(totalViews)} visualizações
                    </div>
                  </div>
                </div>

                <!-- Estatísticas -->
                <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div class="text-center p-3 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-800 rounded-lg border border-blue-200 dark:border-blue-700">
                    <div class="text-lg font-bold text-blue-600 dark:text-blue-300 flex items-center justify-center">
                      <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                        <circle cx="8.5" cy="7" r="4"/>
                        <path d="M20 8v6M23 11h-6"/>
                      </svg>
                      ${this.formatNumber(followers)}
                    </div>
                    <div class="text-xs text-blue-600 dark:text-blue-300 font-medium mt-1">Seguidores</div>
                  </div>
                  
                  <div class="text-center p-3 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900 dark:to-red-800 rounded-lg border border-red-200 dark:border-red-700">
                    <div class="text-lg font-bold text-red-600 dark:text-red-300 flex items-center justify-center">
                      <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/>
                      </svg>
                      ${this.formatNumber(likes)}
                    </div>
                    <div class="text-xs text-red-600 dark:text-red-300 font-medium mt-1">Curtidas</div>
                  </div>
                  
                  <div class="text-center p-3 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900 dark:to-purple-800 rounded-lg border border-purple-200 dark:border-purple-700">
                    <div class="text-lg font-bold text-purple-600 dark:text-purple-300 flex items-center justify-center">
                      <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M23 7l-7 5 7 5V7z"/>
                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                      </svg>
                      ${this.formatNumber(totalVideos)}
                    </div>
                    <div class="text-xs text-purple-600 dark:text-purple-300 font-medium mt-1">Vídeos</div>
                  </div>

                  <div class="text-center p-3 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900 dark:to-green-800 rounded-lg border border-green-200 dark:border-green-700">
                    <div class="text-lg font-bold text-green-600 dark:text-green-300 flex items-center justify-center">
                      <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                      ${this.formatNumber(totalViews)}
                    </div>
                    <div class="text-xs text-green-600 dark:text-green-300 font-medium mt-1">Visualizações</div>
                  </div>
                </div>

                <!-- Descrição -->
                ${
                  account.description
                    ? `
                  <div>
                    <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                      <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                        <polyline points="14,2 14,8 20,8"/>
                        <line x1="16" y1="13" x2="8" y2="13"/>
                        <line x1="16" y1="17" x2="8" y2="17"/>
                        <polyline points="10,9 9,9 8,9"/>
                      </svg>
                      Descrição
                    </h3>
                    <div class="text-sm text-gray-600 dark:text-gray-300 leading-relaxed break-words overflow-wrap-anywhere hyphens-auto max-h-32 overflow-y-auto custom-scrollbar">
                      ${this.escapeHtml(account.description)}
                    </div>
                  </div>
                `
                    : ""
                }
              </div>

              <!-- Botão Compra -->
              <div class="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex-shrink-0">
                <button onclick="window.accountModal.buyViaWhatsApp()" 
                        ${account.status !== "available" ? "disabled" : ""}
                        class="w-full ${
                          account.status !== "available"
                            ? "opacity-50 cursor-not-allowed"
                            : "hover:scale-[1.02] active:scale-[0.98]"
                        } 
                               bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white py-4 rounded-lg font-semibold text-base transition-all duration-200 flex items-center justify-center space-x-3 shadow-lg">
                  <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893-.001-3.189-1.248-6.189-3.515-8.453"/>
                  </svg>
                  <span>${
                    account.status === "available"
                      ? "Comprar via WhatsApp"
                      : "Indisponível"
                  }</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  bindModalEvents() {
    const overlay = document.getElementById("accountModalOverlay");
    if (overlay) {
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) {
          this.close();
        }
      });
    }
  }

  showModal() {
    const modal = document.getElementById("accountModal");
    if (modal) {
      modal.classList.remove("hidden");
      modal.classList.add("flex");
      document.body.classList.add("overflow-hidden");
    }
  }

  changeImage(index) {
    this.currentImageIndex = index;
    this.renderModal();
  }

  previousImage() {
    if (this.currentImageIndex > 0) {
      this.currentImageIndex--;
      this.renderModal();
    }
  }

  nextImage() {
    const allImages = [
      this.currentAccount.mainImageUrl,
      ...(this.currentAccount.images || []),
    ].filter((url) => url);
    if (this.currentImageIndex < allImages.length - 1) {
      this.currentImageIndex++;
      this.renderModal();
    }
  }

  toggleFullscreen() {
    if (this.isFullscreen) {
      this.exitFullscreen();
    } else {
      this.enterFullscreen();
    }
  }

  enterFullscreen() {
    const allImages = [
      this.currentAccount.mainImageUrl,
      ...(this.currentAccount.images || []),
    ].filter((url) => url);
    const currentImage = allImages[this.currentImageIndex];

    const fullscreenModal = document.createElement("div");
    fullscreenModal.className =
      "fixed inset-0 bg-black z-[200] flex items-center justify-center p-4";
    fullscreenModal.innerHTML = `
      <div class="relative w-full h-full flex items-center justify-center">
        <img src="${currentImage}" 
             alt="Imagem em tela cheia" 
             class="max-w-full max-h-full object-contain">
        
        <div class="absolute top-6 left-6 bg-black bg-opacity-70 text-white px-4 py-2 rounded-full text-sm font-medium z-10">
          ${this.currentImageIndex + 1} / ${allImages.length}
        </div>

        <button onclick="window.accountModal.exitFullscreen()" 
                class="absolute top-6 right-6 bg-black bg-opacity-70 text-white p-3 rounded-full hover:bg-opacity-90 transition-all z-10">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>

        ${
          allImages.length > 1
            ? `
          <button onclick="window.accountModal.previousImage(); window.accountModal.updateFullscreenImage();" 
                  class="absolute left-6 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-70 text-white p-3 rounded-full hover:bg-opacity-90 transition-all z-10 disabled:opacity-30"
                  ${this.currentImageIndex === 0 ? "disabled" : ""}>
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
            </svg>
          </button>

          <button onclick="window.accountModal.nextImage(); window.accountModal.updateFullscreenImage();" 
                  class="absolute right-6 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-70 text-white p-3 rounded-full hover:bg-opacity-90 transition-all z-10 disabled:opacity-30"
                  ${
                    this.currentImageIndex === allImages.length - 1
                      ? "disabled"
                      : ""
                  }>
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
            </svg>
          </button>
        `
            : ""
        }
      </div>
    `;

    document.body.appendChild(fullscreenModal);
    this.isFullscreen = true;
  }

  updateFullscreenImage() {
    const fullscreenModal = document.querySelector(
      ".fixed.inset-0.bg-black.z-\\[200\\]"
    );
    if (fullscreenModal) {
      const allImages = [
        this.currentAccount.mainImageUrl,
        ...(this.currentAccount.images || []),
      ].filter((url) => url);
      const currentImage = allImages[this.currentImageIndex];

      const img = fullscreenModal.querySelector("img");
      const counter = fullscreenModal.querySelector(".absolute.top-6");

      if (img) img.src = currentImage;
      if (counter)
        counter.textContent = `${this.currentImageIndex + 1} / ${
          allImages.length
        }`;

      const prevBtn = fullscreenModal.querySelector("button:nth-of-type(2)");
      const nextBtn = fullscreenModal.querySelector("button:nth-of-type(3)");

      if (prevBtn) {
        prevBtn.disabled = this.currentImageIndex === 0;
        prevBtn.classList.toggle(
          "disabled:opacity-30",
          this.currentImageIndex === 0
        );
      }
      if (nextBtn) {
        nextBtn.disabled = this.currentImageIndex === allImages.length - 1;
        nextBtn.classList.toggle(
          "disabled:opacity-30",
          this.currentImageIndex === allImages.length - 1
        );
      }
    }
  }

  exitFullscreen() {
    const fullscreenModal = document.querySelector(
      ".fixed.inset-0.bg-black.z-\\[200\\]"
    );
    if (fullscreenModal) {
      fullscreenModal.remove();
    }
    this.isFullscreen = false;
  }

  buyViaWhatsApp() {
    const account = this.currentAccount;
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
    this.close();
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
      return date.toLocaleDateString("pt-MZ", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Data inválida";
    }
  }

  formatNumber(num) {
    if (!num || isNaN(num)) return "0";
    const number = parseInt(num);
    if (number >= 1000000) {
      return (number / 1000000).toFixed(1) + "M";
    } else if (number >= 1000) {
      return (number / 1000).toFixed(1) + "K";
    }
    return number.toString();
  }

  escapeHtml(unsafe) {
    if (!unsafe) return "";
    return unsafe
      .toString()
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}

// CSS
const addModalStyles = () => {
  const style = document.createElement("style");
  style.textContent = `
    .custom-scrollbar::-webkit-scrollbar {
      height: 6px;
      width: 6px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
      background: #f1f1f1;
      border-radius: 3px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: #c1c1c1;
      border-radius: 3px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
      background: #a8a8a8;
    }
    .dark .custom-scrollbar::-webkit-scrollbar-track {
      background: #374151;
    }
    .dark .custom-scrollbar::-webkit-scrollbar-thumb {
      background: #6b7280;
    }
    .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover {
      background: #9ca3af;
    }
    .overflow-wrap-anywhere {
      overflow-wrap: anywhere;
    }
  `;
  document.head.appendChild(style);
};

// Inicializar
document.addEventListener("DOMContentLoaded", () => {
  addModalStyles();
  window.accountModal = new AccountModal();
});

export default AccountModal;
