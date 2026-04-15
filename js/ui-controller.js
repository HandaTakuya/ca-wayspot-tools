/**
 * UI Controller Module (Modals, Panels, Themes, Event Listeners)
 */
const CA_UI = {
    currentLang: localStorage.getItem('appLang') || 'th',
    currentTheme: localStorage.getItem('caWayspotTheme') || 'default',
    isControlPanelOpen: true,

    t(key, params = {}) {
        let str = CA_I18N[this.currentLang][key] || key;
        for (let p in params) {
            str = str.replace(`{${p}}`, params[p]);
        }
        return str;
    },

    applyTranslations() {
        document.querySelectorAll('[data-i18n]').forEach(el => { 
            el.innerHTML = this.t(el.getAttribute('data-i18n')); 
        });
        document.querySelectorAll('[data-tooltip-i18n]').forEach(el => { 
            el.setAttribute('data-tooltip', this.t(el.getAttribute('data-tooltip-i18n'))); 
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { 
            el.setAttribute('placeholder', this.t(el.getAttribute('data-i18n-placeholder'))); 
        });

        const langSelect = document.getElementById('setting-language');
        if (langSelect) langSelect.value = this.currentLang;
    },

    setTheme(themeName) {
        this.currentTheme = themeName;
        document.body.setAttribute('data-theme', themeName);
        localStorage.setItem('caWayspotTheme', themeName);
        this.updateThemeUI();
    },

    updateThemeUI() {
        document.querySelectorAll('.theme-btn').forEach(btn => {
            if (btn.getAttribute('data-theme') === this.currentTheme) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    },

    openModal(id) {
        const overlay = document.getElementById(id);
        if (!overlay) return;
        const modal = overlay.querySelector('.modal');
        overlay.style.display = 'flex';
        void overlay.offsetWidth; // trigger reflow
        overlay.classList.add('active');
        if (modal) modal.classList.add('active');
    },

    closeModal(id) {
        const overlay = document.getElementById(id);
        if (!overlay) return;
        const modal = overlay.querySelector('.modal');
        overlay.classList.remove('active');
        if (modal) modal.classList.remove('active');
        setTimeout(() => {
            overlay.style.display = 'none';
            if (modal) modal.scrollTop = 0;
        }, 300);
    },

    toggleControlPanel() {
        const panel = document.getElementById('control-panel');
        const btn = document.getElementById('btn-toggle-control');
        
        this.isControlPanelOpen = !this.isControlPanelOpen;
        
        if (this.isControlPanelOpen) {
            panel.classList.remove('collapsed');
            btn.innerText = '🔽';
        } else {
            panel.classList.add('collapsed');
            btn.innerText = '🔼';
        }
    },

    validateInput(name, imageUrl) {
        if (!name || name.trim() === '') {
            alert(this.t('invalidName'));
            return false;
        }
        if (imageUrl && imageUrl.trim() !== '') {
            const urlPattern = /^(https?:\/\/.*\.(?:png|jpg|jpeg|gif|webp|svg|bmp))$/i;
            const simplePattern = /^https?:\/\/.+/i;
            if (!simplePattern.test(imageUrl)) {
                alert(this.t('invalidImageUrl'));
                return false;
            }
        }
        return true;
    },

    escapeHTML(str) {
        if (!str) return '';
        const charsToReplace = { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' };
        return str.replace(/[&<>'"]/g, tag => charsToReplace[tag] || tag);
    },

    generateId() {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 9);
    }
};
