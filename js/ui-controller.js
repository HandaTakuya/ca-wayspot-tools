/**
 * UI Controller Module (Modals, Panels, Themes, Event Listeners)
 */
const CA_UI = {
    currentLang: localStorage.getItem('appLang') || 'th',
    currentTheme: localStorage.getItem('caWayspotTheme') || 'default',
    isControlPanelOpen: false,

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

    // Popup card shared by user Wayspots and Live POIs — hero photo with the
    // name and type badge floating over it, then an icon-box info grid
    // (same layout as the pogodpu.com Pokédex detail page).
    // opts: { name, typeLabel, color, imgUrl, fallbackIcon, corner, badges, boxes, footer }
    // boxes: [{ label, value, wide, mono }] — values are inserted as-is, escape before passing.
    spotCardHTML(opts) {
        const esc = (s) => this.escapeHTML(String(s ?? ''));
        const img = opts.imgUrl
            ? `<img crossorigin="anonymous" class="spot-card-hero-img" src="${esc(opts.imgUrl)}" onerror="this.remove()">`
            : '';
        const badges = (opts.badges || []).join('');
        const boxes = (opts.boxes || []).map(b => `
            <div class="spot-card-box${b.wide ? ' spot-card-box-wide' : ''}">
                <div class="spot-card-box-head">
                    <span class="spot-card-box-label">${b.label}</span>
                </div>
                <div class="spot-card-box-value${b.mono ? ' spot-card-mono' : ''}">${b.value}</div>
            </div>`).join('');
        return `
            <div class="spot-card" style="--spot-color: ${esc(opts.color)};">
                <div class="spot-card-hero">
                    <div class="spot-card-hero-fallback">${opts.fallbackIcon || '📍'}</div>
                    ${img}
                    <div class="spot-card-corner">${opts.corner || ''}</div>
                    <div class="spot-card-header">
                        <h4 class="spot-card-name">${esc(opts.name)}</h4>
                        <div class="spot-card-badges">
                            <span class="spot-card-type-badge">${esc(opts.typeLabel)}</span>
                            ${badges}
                        </div>
                    </div>
                </div>
                <div class="spot-card-body">
                    <div class="spot-card-grid">${boxes}</div>
                    ${opts.footer || ''}
                </div>
            </div>`;
    },

    generateId() {
        try {
            if (typeof crypto !== 'undefined' && crypto.randomUUID) {
                return crypto.randomUUID();
            }
        } catch (e) {}
        return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 9);
    }
};
