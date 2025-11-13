// utils.js - VERSÃO COMPLETA COM ANALYTICS
import { db, storage, auth, analytics } from "./firebase-config.js";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  uploadString,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// ==================== CONFIGURAÇÕES OTIMIZADAS ====================
export const CONFIG = {
  whatsappNumber: "258841234567",
  adminPassword: "admin123",
  sessionTimeout: 5 * 60 * 1000,
  maxImages: 4,
  maxImageSize: 5 * 1024 * 1024,
  maxTotalSize: 2 * 1024 * 1024,
  storageStrategy: "base64",
};

// ==================== ADMIN SESSION ====================
export class AdminSession {
  static isAuthenticated() {
    const authData = sessionStorage.getItem("adminAuth");
    if (!authData) return false;

    try {
      const { authTime } = JSON.parse(authData);
      return Date.now() - authTime < CONFIG.sessionTimeout;
    } catch {
      return false;
    }
  }

  static startSession() {
    sessionStorage.setItem(
      "adminAuth",
      JSON.stringify({
        authTime: Date.now(),
      })
    );
  }

  static endSession() {
    sessionStorage.removeItem("adminAuth");
  }

  static getRemainingTime() {
    const authData = sessionStorage.getItem("adminAuth");
    if (!authData) return 0;

    try {
      const { authTime } = JSON.parse(authData);
      const elapsed = Date.now() - authTime;
      return Math.max(0, CONFIG.sessionTimeout - elapsed);
    } catch {
      return 0;
    }
  }

  static validateSession() {
    if (!this.isAuthenticated()) {
      this.endSession();
      window.location.href = "index.html";
      return false;
    }
    return true;
  }
}

// ==================== STORAGE MANAGEMENT ====================
export class StorageManager {
  // Upload de imagem única (para quando migrar para Storage)
  static async uploadImage(file, path) {
    try {
      const storageRef = ref(storage, path);
      const snapshot = await uploadBytes(storageRef, file);
      return await getDownloadURL(snapshot.ref);
    } catch (error) {
      console.error("Erro no upload:", error);
      throw new Error(`Falha no upload: ${error.message}`);
    }
  }

  // Upload múltiplo de imagens
  static async uploadMultipleImages(files, basePath) {
    const uploadPromises = files.map((file, index) => {
      const path = `${basePath}/image_${Date.now()}_${index}.jpg`;
      return this.uploadImage(file, path);
    });

    return await Promise.all(uploadPromises);
  }

  // Deletar imagem
  static async deleteImage(url) {
    try {
      const matches = url.match(/accounts%2F(.+?)\?/);
      if (matches && matches[1]) {
        const path = `accounts/${matches[1]}`;
        const storageRef = ref(storage, path);
        await deleteObject(storageRef);
      }
    } catch (error) {
      console.warn("Não foi possível deletar imagem:", error);
    }
  }

  // Deletar múltiplas imagens
  static async deleteMultipleImages(urls) {
    const deletePromises = urls.map((url) => this.deleteImage(url));
    await Promise.allSettled(deletePromises);
  }

  // ✅ CONVERTER arquivo para Base64
  static fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  }

  // ✅ COMPRESSÃO INTELIGENTE
  static async compressImageForFirestore(
    base64Data,
    mimeType,
    targetMaxSizeKB = 300
  ) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;

        console.log(`🖼️ Imagem original: ${width}x${height}px`);

        let targetWidth = 800;
        let quality = 0.8;

        if (width > 2000) targetWidth = 600;
        if (width > 3000) targetWidth = 400;

        const newHeight = Math.round((height * targetWidth) / width);

        canvas.width = targetWidth;
        canvas.height = newHeight;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, targetWidth, newHeight);

        const attemptCompression = (currentQuality) => {
          try {
            const compressedBase64 = canvas.toDataURL(
              "image/jpeg",
              currentQuality
            );
            const sizeKB =
              Math.floor(
                (compressedBase64.length - "data:image/jpeg;base64,".length) *
                  0.75
              ) / 1024;

            console.log(
              `🎯 Tentativa: ${
                currentQuality * 100
              }% qualidade → ${sizeKB.toFixed(1)}KB`
            );

            if (sizeKB <= targetMaxSizeKB || currentQuality <= 0.3) {
              console.log(
                `✅ Compressão final: ${targetWidth}x${newHeight}px | ${
                  currentQuality * 100
                }% qualidade | ${sizeKB.toFixed(1)}KB`
              );
              resolve(compressedBase64);
            } else {
              const newQuality = Math.max(0.3, currentQuality * 0.8);
              setTimeout(() => attemptCompression(newQuality), 10);
            }
          } catch (error) {
            reject(error);
          }
        };

        attemptCompression(quality);
      };
      img.onerror = reject;
      img.src = base64Data;
    });
  }

  // ✅ VERSÃO SIMPLES
  static async simpleCompress(base64Data, mimeType) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");

        const maxWidth = 600;
        const maxHeight = 400;

        let { width, height } = img;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        try {
          const compressedBase64 = canvas.toDataURL("image/jpeg", 0.5);
          const sizeKB =
            Math.floor(
              (compressedBase64.length - "data:image/jpeg;base64,".length) *
                0.75
            ) / 1024;

          console.log(
            `📦 Compressão simples: ${width}x${height}px | ${sizeKB.toFixed(
              1
            )}KB`
          );
          resolve(compressedBase64);
        } catch (error) {
          reject(error);
        }
      };
      img.onerror = reject;
      img.src = base64Data;
    });
  }

  // ✅ MÉTODO PRINCIPAL
  static async autoCompressImage(file) {
    try {
      console.log(
        `🚀 Iniciando compressão automática: ${file.name} (${(
          file.size /
          1024 /
          1024
        ).toFixed(2)}MB)`
      );

      const originalBase64 = await this.fileToBase64(file);

      if (file.size < 200 * 1024) {
        console.log("📦 Arquivo pequeno, compressão leve...");
        return await this.simpleCompress(originalBase64, file.type);
      } else {
        console.log("🔧 Arquivo grande, compressão inteligente...");
        return await this.compressImageForFirestore(
          originalBase64,
          file.type,
          250
        );
      }
    } catch (error) {
      console.error("❌ Erro na compressão:", error);
      throw new Error("Falha ao comprimir imagem");
    }
  }

  // ✅ Otimizar imagem (alias para autoCompressImage)
  static async optimizeImage(base64Data, mimeType) {
    return this.autoCompressImage(base64Data, mimeType);
  }

  // ✅ CALCULAR tamanho real do Base64
  static getBase64Size(base64String) {
    if (!base64String) return 0;
    const base64Data = base64String.includes(",")
      ? base64String.split(",")[1]
      : base64String;
    return (base64Data.length * 3) / 4;
  }
}

// ==================== FIRESTORE OPERATIONS ====================
export class FirestoreManager {
  // Coleção de contas
  static get accountsCollection() {
    return collection(db, "accounts");
  }

  // Buscar todas as contas
  static async getAllAccounts(filters = {}) {
    let q = query(this.accountsCollection, orderBy("createdAt", "desc"));

    // Aplicar filtros
    if (filters.status && filters.status !== "all") {
      q = query(q, where("status", "==", filters.status));
    }

    if (filters.maxPrice) {
      q = query(q, where("price", "<=", Number(filters.maxPrice)));
    }

    if (filters.minFollowers) {
      q = query(q, where("followers", ">=", Number(filters.minFollowers)));
    }

    // Ordenação
    if (filters.sort) {
      switch (filters.sort) {
        case "oldest":
          q = query(q, orderBy("createdAt", "asc"));
          break;
        case "price_asc":
          q = query(q, orderBy("price", "asc"));
          break;
        case "price_desc":
          q = query(q, orderBy("price", "desc"));
          break;
        case "followers_asc":
          q = query(q, orderBy("followers", "asc"));
          break;
        case "followers_desc":
          q = query(q, orderBy("followers", "desc"));
          break;
      }
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  // Buscar conta por ID
  static async getAccountById(id) {
    const docRef = doc(db, "accounts", id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    } else {
      throw new Error("Conta não encontrada");
    }
  }

  // Criar nova conta
  static async createAccount(accountData) {
    const data = {
      ...accountData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      views: 0,
      status: accountData.status || "available",
    };

    const docRef = await addDoc(this.accountsCollection, data);
    return docRef.id;
  }

  // Atualizar conta
  static async updateAccount(id, accountData) {
    const docRef = doc(db, "accounts", id);
    const data = {
      ...accountData,
      updatedAt: serverTimestamp(),
    };

    await updateDoc(docRef, data);
  }

  // Deletar conta
  static async deleteAccount(id) {
    const docRef = doc(db, "accounts", id);
    await deleteDoc(docRef);
  }

  // Marcar como vendida
  static async markAsSold(id) {
    await this.updateAccount(id, { status: "sold" });
  }

  // Marcar como disponível
  static async markAsAvailable(id) {
    await this.updateAccount(id, { status: "available" });
  }
}

// ==================== UI UTILITIES ====================
export class UIUtils {
  // Mostrar toast/notificação
  static showToast(message, type = "info", duration = 3000) {
    // Remove toast existente
    const existingToast = document.getElementById("globalToast");
    if (existingToast) {
      existingToast.remove();
    }

    // Ícones SVG para cada tipo
    const icons = {
      success: `<svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
      </svg>`,
      error: `<svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
      </svg>`,
      warning: `<svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
      </svg>`,
      info: `<svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
      </svg>`,
    };

    // Cores para cada tipo
    const colors = {
      success: "bg-green-500 border-green-600",
      error: "bg-red-500 border-red-600",
      warning: "bg-yellow-500 border-yellow-600",
      info: "bg-blue-500 border-blue-600",
    };

    // Cria toast com ícone
    const toast = document.createElement("div");
    toast.id = "globalToast";
    toast.className = `fixed top-20 left-1/2 transform -translate-x-1/2 z-50 px-4 py-3 rounded-lg text-white font-semibold text-sm border shadow-lg transition-all duration-300 flex items-center ${colors[type]}`;
    toast.innerHTML = `${icons[type]}${message}`;
    toast.style.opacity = "0";
    toast.style.transform = "translateX(-50%) translateY(-20px)";

    document.body.appendChild(toast);

    // Animação de entrada
    setTimeout(() => {
      toast.style.opacity = "1";
      toast.style.transform = "translateX(-50%) translateY(0)";
    }, 10);

    // Auto-remove
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(-50%) translateY(-20px)";
      setTimeout(() => {
        if (toast.parentNode) {
          toast.remove();
        }
      }, 300);
    }, duration);
  }

  // Formatar número (seguidores, likes)
  static formatNumber(num) {
    if (!num || isNaN(num)) return "0";
    const number = parseInt(num);
    if (number >= 1000000) {
      return (number / 1000000).toFixed(1) + "M";
    } else if (number >= 1000) {
      return (number / 1000).toFixed(1) + "K";
    }
    return number.toString();
  }

  // Formatar preço
  static formatPrice(price) {
    return new Intl.NumberFormat("pt-MZ", {
      style: "currency",
      currency: "MZN",
    })
      .format(price)
      .replace("MZN", "MT");
  }

  // Validar arquivo de imagem
  static validateImageFile(file) {
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    const maxSize = CONFIG.maxImageSize;

    if (!validTypes.includes(file.type)) {
      throw new Error("Tipo de arquivo inválido. Use JPG, PNG ou WebP.");
    }

    if (file.size > maxSize) {
      throw new Error(
        `Arquivo muito grande. Máximo ${(maxSize / 1024 / 1024).toFixed(1)}MB.`
      );
    }

    return true;
  }

  // Criar URL de objeto para preview
  static createObjectURL(file) {
    return URL.createObjectURL(file);
  }

  // Revogar URL de objeto
  static revokeObjectURL(url) {
    if (url && url.startsWith("blob:")) {
      URL.revokeObjectURL(url);
    }
  }

  // Debounce function para otimização
  static debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Loading spinner
  static showLoading(container) {
    container.innerHTML = `
      <div class="col-span-full text-center py-12">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p class="text-gray-600 dark:text-gray-400">Carregando...</p>
      </div>
    `;
  }

  // Empty state
  static showEmptyState(container, message = "Nenhum item encontrado") {
    container.innerHTML = `
      <div class="col-span-full text-center py-12">
        <i class="fas fa-search text-4xl text-gray-400 mb-4"></i>
        <h3 class="text-xl font-semibold text-gray-600 dark:text-gray-400 mb-2">${message}</h3>
        <p class="text-gray-500 dark:text-gray-500">Tente ajustar os filtros ou verificar novamente mais tarde.</p>
      </div>
    `;
  }
}

// ==================== VALIDATION ====================
export class Validator {
  static validateAccountData(data) {
    const errors = [];

    if (!data.title || data.title.trim().length < 2) {
      errors.push("Título deve ter pelo menos 2 caracteres");
    }

    if (!data.price || data.price < 0 || data.price > 1000000) {
      errors.push("Preço deve ser entre 0 e 1.000.000 MT");
    }

    if (!data.followers || data.followers < 0 || data.followers > 100000000) {
      errors.push("Seguidores deve ser entre 0 e 100.000.000");
    }

    if (data.description && data.description.length > 1000) {
      errors.push("Descrição muito longa (máx. 1000 caracteres)");
    }

    if (
      data.status &&
      !["available", "reserved", "sold"].includes(data.status)
    ) {
      errors.push("Status inválido");
    }

    return errors;
  }

  static sanitizeAccountData(data) {
    return {
      title: (data.title?.trim() || "").substring(0, 100),
      price: Math.max(0, Math.min(1000000, Number(data.price) || 0)),
      followers: Math.max(0, Math.min(100000000, Number(data.followers) || 0)),
      status: data.status || "available",
      description: (data.description?.trim() || "").substring(0, 1000),
      whatsappNumber: data.whatsappNumber?.trim() || "",
      likes: Math.max(0, Number(data.likes) || 0),
      videos: Math.max(0, Number(data.videos) || 0),
      views: Math.max(0, Number(data.views) || 0),
      stats: {
        likes: Math.max(0, Number(data.stats?.likes) || 0),
        videos: Math.max(0, Number(data.stats?.videos) || 0),
        bio: (data.stats?.bio?.trim() || "").substring(0, 500),
      },
      mainImageUrl: data.mainImageUrl || null,
      images: data.images || [],
    };
  }

  // ✅ VALIDAR tamanho total do documento
  static validateDocumentSize(accountData) {
    let totalSize = 0;

    if (accountData.mainImageUrl) {
      totalSize += StorageManager.getBase64Size(accountData.mainImageUrl);
    }

    if (accountData.images && accountData.images.length > 0) {
      accountData.images.forEach((image) => {
        totalSize += StorageManager.getBase64Size(image);
      });
    }

    const maxSafeSize = 900 * 1024;

    if (totalSize > maxSafeSize) {
      throw new Error(
        `Documento muito grande (${(totalSize / 1024).toFixed(
          1
        )}KB). Reduza o número de imagens.`
      );
    }

    console.log(
      `📊 Tamanho total do documento: ${(totalSize / 1024).toFixed(1)}KB`
    );
    return true;
  }
}

// ==================== ANALYTICS MANAGER ====================
export class AnalyticsManager {
  static async trackPageView(accountId = null) {
    try {
      const today = new Date().toISOString().split("T")[0];
      const viewData = {
        timestamp: new Date(),
        date: today,
        accountId: accountId,
        type: accountId ? "account_view" : "page_view",
        userAgent: navigator.userAgent,
        path: window.location.pathname,
      };

      this.saveViewToLocalStorage(viewData);

      console.log("📊 Page view tracked:", viewData);
    } catch (error) {
      console.warn("Erro ao trackear page view:", error);
    }
  }

  static saveViewToLocalStorage(viewData) {
    try {
      const views = JSON.parse(localStorage.getItem("page_views") || "[]");
      views.push(viewData);

      if (views.length > 1000) {
        views.splice(0, views.length - 1000);
      }

      localStorage.setItem("page_views", JSON.stringify(views));
    } catch (error) {
      console.warn("Erro ao salvar view no localStorage:", error);
    }
  }

  static getVisitsStats() {
    try {
      const views = JSON.parse(localStorage.getItem("page_views") || "[]");
      const now = new Date();

      // Visitas hoje
      const today = now.toISOString().split("T")[0];
      const todayViews = views.filter((view) => view.date === today);

      // Visitas esta semana
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thisWeekViews = views.filter(
        (view) => new Date(view.timestamp) >= weekAgo
      );

      // Visitas este mês
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const thisMonthViews = views.filter(
        (view) => new Date(view.timestamp) >= monthAgo
      );

      // Visitas totais
      const totalViews = views.length;

      // Visitas únicas (por dia)
      const uniqueDays = new Set(views.map((view) => view.date)).size;

      return {
        today: todayViews.length,
        thisWeek: thisWeekViews.length,
        thisMonth: thisMonthViews.length,
        total: totalViews,
        uniqueDays: uniqueDays,
        viewsData: views,
      };
    } catch (error) {
      console.warn("Erro ao calcular estatísticas:", error);
      return {
        today: 0,
        thisWeek: 0,
        thisMonth: 0,
        total: 0,
        uniqueDays: 0,
        viewsData: [],
      };
    }
  }

  static getAccountViews(accountId) {
    try {
      const views = JSON.parse(localStorage.getItem("page_views") || "[]");
      return views.filter((view) => view.accountId === accountId).length;
    } catch (error) {
      return 0;
    }
  }

  static clearOldData() {
    try {
      const views = JSON.parse(localStorage.getItem("page_views") || "[]");
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const recentViews = views.filter(
        (view) => new Date(view.timestamp) >= monthAgo
      );

      localStorage.setItem("page_views", JSON.stringify(recentViews));
      console.log("🧹 Dados antigos de analytics removidos");
    } catch (error) {
      console.warn("Erro ao limpar dados antigos:", error);
    }
  }

  static clearAllData() {
    try {
      localStorage.removeItem("page_views");
      console.log("🧹 Todas as estatísticas foram limpas");
      return true;
    } catch (error) {
      console.warn("Erro ao limpar todas as estatísticas:", error);
      return false;
    }
  }
}

// Limpar dados antigos a cada inicialização
AnalyticsManager.clearOldData();

// Exportar tudo como objeto global para facilitar acesso
window.AppUtils = {
  AdminSession,
  StorageManager,
  FirestoreManager,
  UIUtils,
  Validator,
  AnalyticsManager,
  CONFIG,
};
