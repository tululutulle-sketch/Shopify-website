/* TULULU theme — global interactions (vanilla ES6, no dependencies). */
(() => {
  const theme = window.theme || {};
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isDesktop = () => window.matchMedia('(min-width: 1024px)').matches;

  /* ---------- Helpers ---------- */
  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])';

  function trapFocus(container, event) {
    if (event.key !== 'Tab') return;
    const items = [...container.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  function debounce(fn, wait = 300) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
  }

  function showToast(message) {
    const toast = document.querySelector('[data-toast]');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('is-visible'), 2600);
  }

  async function fetchJSON(url, options = {}) {
    const res = await fetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(options.headers || {}) }
    });
    const data = await res.json();
    if (!res.ok || data.status) throw data;
    return data;
  }

  function parseHTML(html) {
    return new DOMParser().parseFromString(html, 'text/html');
  }

  /* ---------- Base overlay (drawers & modals) ---------- */
  class OverlayElement extends HTMLElement {
    connectedCallback() {
      this.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) this.close(); });
      this.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') this.close();
        trapFocus(this, e);
      });
    }
    open(opener) {
      this.opener = opener || document.activeElement;
      this.hidden = false;
      document.body.classList.add('is-locked');
      requestAnimationFrame(() => requestAnimationFrame(() => this.classList.add('is-open')));
      const panel = this.querySelector('[role="dialog"]');
      setTimeout(() => (panel || this).focus({ preventScroll: true }), 50);
      if (this.opener && this.opener.setAttribute) this.opener.setAttribute('aria-expanded', 'true');
    }
    close() {
      if (this.hidden) return;
      this.classList.remove('is-open');
      document.body.classList.remove('is-locked');
      if (this.opener && this.opener.setAttribute) this.opener.setAttribute('aria-expanded', 'false');
      setTimeout(() => { this.hidden = true; }, reduceMotion ? 0 : 450);
      if (this.opener && this.opener.focus) this.opener.focus({ preventScroll: true });
    }
  }

  class MenuDrawer extends OverlayElement {}
  customElements.define('menu-drawer', MenuDrawer);
  class DialogModal extends OverlayElement {}
  customElements.define('dialog-modal', DialogModal);

  document.addEventListener('click', (e) => {
    const menuBtn = e.target.closest('[data-menu-open]');
    if (menuBtn) document.getElementById('MenuDrawer')?.open(menuBtn);
    const modalBtn = e.target.closest('[data-modal-open]');
    if (modalBtn) document.getElementById(modalBtn.dataset.modalOpen)?.open(modalBtn);
  });

  /* ---------- Announcement bar ---------- */
  class AnnouncementBar extends HTMLElement {
    connectedCallback() {
      this.messages = [...this.querySelectorAll('.announcement-bar__message')];
      if (this.messages.length < 2) return;
      this.index = 0;
      this.querySelector('[data-prev]')?.addEventListener('click', () => this.go(this.index - 1, true));
      this.querySelector('[data-next]')?.addEventListener('click', () => this.go(this.index + 1, true));
      this.addEventListener('mouseenter', () => this.stop());
      this.addEventListener('mouseleave', () => this.play());
      this.addEventListener('focusin', () => this.stop());
      this.play();
    }
    play() {
      if (this.dataset.autoplay !== 'true' || reduceMotion) return;
      this.stop();
      this.timer = setInterval(() => this.go(this.index + 1), Number(this.dataset.speed) || 5000);
    }
    stop() { clearInterval(this.timer); }
    go(i, manual) {
      const n = this.messages.length;
      this.index = (i + n) % n;
      this.messages.forEach((m, idx) => {
        m.classList.toggle('is-active', idx === this.index);
        m.setAttribute('aria-hidden', idx === this.index ? 'false' : 'true');
      });
      if (manual) this.play();
    }
  }
  customElements.define('announcement-bar', AnnouncementBar);

  /* ---------- Sticky header, dropdowns, search ---------- */
  class StickyHeader extends HTMLElement {
    connectedCallback() {
      if (this.dataset.sticky === 'true') {
        const onScroll = () => this.classList.toggle('is-scrolled', window.scrollY > 10);
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
      }
      const panel = this.querySelector('#SearchPanel');
      this.querySelectorAll('[data-search-open]').forEach((btn) =>
        btn.addEventListener('click', () => {
          const open = panel.hidden;
          panel.hidden = !open;
          btn.setAttribute('aria-expanded', String(open));
          if (open) panel.querySelector('input[type="search"]').focus();
        })
      );
      this.querySelector('[data-search-close]')?.addEventListener('click', () => this.closeSearch());
      panel?.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.closeSearch(); });
    }
    closeSearch() {
      const panel = this.querySelector('#SearchPanel');
      panel.hidden = true;
      const btn = this.querySelector('[data-search-open]');
      btn?.setAttribute('aria-expanded', 'false');
      btn?.focus();
    }
  }
  customElements.define('sticky-header', StickyHeader);

  class DetailsDropdown extends HTMLElement {
    connectedCallback() {
      this.trigger = this.querySelector('.header__link');
      this.addEventListener('mouseenter', () => isDesktop() && this.open());
      this.addEventListener('mouseleave', () => this.close());
      this.addEventListener('focusout', (e) => { if (!this.contains(e.relatedTarget)) this.close(); });
      this.addEventListener('keydown', (e) => { if (e.key === 'Escape') { this.close(); this.trigger.focus(); } });
      this.trigger.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown' || e.key === ' ') {
          e.preventDefault();
          this.open();
          this.querySelector('.dropdown__link')?.focus();
        }
      });
      this.trigger.addEventListener('click', (e) => {
        // Touch devices: first tap opens the dropdown, second tap follows the link.
        if (!this.classList.contains('is-open') && window.matchMedia('(hover: none)').matches) {
          e.preventDefault();
          this.open();
        }
      });
    }
    open() { this.classList.add('is-open'); this.trigger.setAttribute('aria-expanded', 'true'); }
    close() { this.classList.remove('is-open'); this.trigger.setAttribute('aria-expanded', 'false'); }
  }
  customElements.define('details-dropdown', DetailsDropdown);

  class PredictiveSearch extends HTMLElement {
    connectedCallback() {
      this.input = this.querySelector('input[type="search"]');
      this.results = this.querySelector('[data-results]');
      this.popular = this.querySelector('[data-popular]');
      this.input.addEventListener('input', debounce(() => this.search(), 280));
      this.input.addEventListener('keydown', (e) => this.navigate(e));
    }
    async search() {
      const q = this.input.value.trim();
      if (this.controller) this.controller.abort();
      if (q.length < 2) {
        this.results.innerHTML = '';
        if (this.popular) this.popular.hidden = false;
        this.input.setAttribute('aria-expanded', 'false');
        return;
      }
      this.controller = new AbortController();
      try {
        const url = `${theme.routes.predictiveSearch}?q=${encodeURIComponent(q)}&resources[type]=product,collection,query&resources[limit]=6&section_id=predictive-search`;
        const res = await fetch(url, { signal: this.controller.signal });
        const html = await res.text();
        const content = parseHTML(html).querySelector('[data-predictive-results]');
        this.results.innerHTML = content ? content.outerHTML : '';
        if (this.popular) this.popular.hidden = true;
        this.input.setAttribute('aria-expanded', 'true');
      } catch (err) {
        if (err.name !== 'AbortError') this.results.innerHTML = '';
      }
    }
    navigate(e) {
      if (!['ArrowDown', 'ArrowUp'].includes(e.key)) return;
      const links = [...this.results.querySelectorAll('a')];
      if (!links.length) return;
      e.preventDefault();
      const i = links.indexOf(document.activeElement);
      const next = e.key === 'ArrowDown' ? Math.min(i + 1, links.length - 1) : i - 1;
      (next < 0 ? this.input : links[next]).focus();
    }
  }
  customElements.define('predictive-search', PredictiveSearch);

  /* ---------- Hero slider ---------- */
  class HeroSlider extends HTMLElement {
    connectedCallback() {
      this.slides = [...this.querySelectorAll('.hero__slide')];
      this.dots = [...this.querySelectorAll('[data-dot]')];
      if (this.slides.length < 2) return;
      this.index = 0;
      this.querySelector('[data-prev]')?.addEventListener('click', () => this.go(this.index - 1));
      this.querySelector('[data-next]')?.addEventListener('click', () => this.go(this.index + 1));
      this.dots.forEach((dot) => dot.addEventListener('click', () => this.go(Number(dot.dataset.dot))));
      this.addEventListener('mouseenter', () => this.stop());
      this.addEventListener('mouseleave', () => this.play());
      this.addEventListener('focusin', () => this.stop());
      let startX = 0;
      this.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; }, { passive: true });
      this.addEventListener('touchend', (e) => {
        const dx = e.changedTouches[0].clientX - startX;
        if (Math.abs(dx) > 50) this.go(this.index + (dx < 0 ? 1 : -1));
      });
      this.play();
    }
    play() {
      if (this.dataset.autoplay !== 'true' || reduceMotion) return;
      this.stop();
      this.timer = setInterval(() => this.go(this.index + 1, true), Number(this.dataset.speed) || 7000);
    }
    stop() { clearInterval(this.timer); }
    go(i, auto) {
      const n = this.slides.length;
      this.index = (i + n) % n;
      this.slides.forEach((s, idx) => {
        const active = idx === this.index;
        s.classList.toggle('is-active', active);
        s.setAttribute('aria-hidden', String(!active));
        s.querySelectorAll('a').forEach((a) => (active ? a.removeAttribute('tabindex') : a.setAttribute('tabindex', '-1')));
      });
      this.dots.forEach((d, idx) => {
        d.classList.toggle('is-active', idx === this.index);
        idx === this.index ? d.setAttribute('aria-current', 'true') : d.removeAttribute('aria-current');
      });
      if (!auto) this.play();
    }
  }
  customElements.define('hero-slider', HeroSlider);

  /* ---------- Quantity input ---------- */
  class QuantityInput extends HTMLElement {
    connectedCallback() {
      this.input = this.querySelector('input');
      this.querySelectorAll('button').forEach((btn) =>
        btn.addEventListener('click', () => {
          const min = Number(this.input.min) || 0;
          const current = Number(this.input.value) || 0;
          const next = btn.name === 'plus' ? current + 1 : Math.max(min, current - 1);
          if (next === current) return;
          this.input.value = next;
          this.input.dispatchEvent(new Event('change', { bubbles: true }));
        })
      );
    }
  }
  customElements.define('quantity-input', QuantityInput);

  /* ---------- Cart ---------- */
  const Cart = {
    sections() {
      return ['cart-drawer', ...[...document.querySelectorAll('cart-page')].map((el) => el.closest('.shopify-section')?.id.replace('shopify-section-', ''))].filter(Boolean);
    },
    async add(formData) {
      formData.append('sections', this.sections().join(','));
      formData.append('sections_url', window.location.pathname);
      const res = await fetch(`${theme.routes.cartAdd}.js`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: formData
      });
      const data = await res.json();
      if (!res.ok || data.status) throw data;
      return data;
    },
    async change(line, quantity) {
      return fetchJSON(`${theme.routes.cartChange}.js`, {
        method: 'POST',
        body: JSON.stringify({ line, quantity, sections: this.sections(), sections_url: window.location.pathname })
      });
    },
    async update(body) {
      return fetchJSON(`${theme.routes.cartUpdate}.js`, {
        method: 'POST',
        body: JSON.stringify({ ...body, sections: this.sections(), sections_url: window.location.pathname })
      });
    },
    async refresh() {
      const res = await fetch(`${theme.routes.root.replace(/\/$/, '')}/?sections=${this.sections().join(',')}`);
      this.render(await res.json());
    },
    render(sections) {
      if (!sections) return;
      Object.entries(sections).forEach(([id, html]) => {
        if (!html) return;
        const doc = parseHTML(html);
        if (id === 'cart-drawer') {
          // Read the count before replaceWith moves the new markup out of `doc`.
          const count = doc.querySelector('#CartDrawerTitle .caption');
          Cart.setCount(count ? Number(count.textContent.replace(/\D/g, '')) : 0);
          const next = doc.querySelector('[data-cart-drawer-inner]');
          const current = document.querySelector('[data-cart-drawer-inner]');
          if (next && current) current.replaceWith(next);
        } else {
          const next = doc.querySelector('[data-cart-page-inner]');
          const current = document.querySelector(`#shopify-section-${id} [data-cart-page-inner]`);
          if (next && current) current.replaceWith(next);
        }
      });
    },
    setCount(count) {
      document.querySelectorAll('[data-cart-count]').forEach((el) => {
        el.textContent = count;
        el.hidden = count === 0;
        el.classList.remove('is-bump');
        void el.offsetWidth;
        el.classList.add('is-bump');
      });
    },
    open(opener) {
      if (theme.cartType === 'page') { window.location.href = theme.routes.cart; return; }
      document.getElementById('CartDrawer')?.open(opener);
    }
  };
  window.TululuCart = Cart;

  class CartItems extends HTMLElement {}

  /* Delegated cart handlers (work for drawer and page, survive re-renders) */
  function cartRoot(el) { return el.closest('cart-drawer, cart-page'); }

  async function changeLine(el, line, quantity) {
    const item = el.closest('.cart-item');
    item?.classList.add('is-loading');
    try {
      const data = await Cart.change(line, quantity);
      Cart.render(data.sections);
      Cart.setCount(data.item_count);
    } catch (err) {
      showToast(err.description || err.message || theme.strings.cartError);
      item?.classList.remove('is-loading');
      Cart.refresh();
    }
  }

  document.addEventListener('change', (e) => {
    const qty = e.target.closest('[data-line-quantity]');
    if (qty && cartRoot(qty)) changeLine(qty, Number(qty.dataset.lineQuantity), Math.max(0, Number(qty.value) || 0));
    const note = e.target.closest('[data-cart-note]');
    if (note) Cart.update({ note: note.value }).catch(() => {});
  });

  document.addEventListener('click', async (e) => {
    const remove = e.target.closest('[data-line-remove]');
    if (remove && cartRoot(remove)) {
      e.preventDefault();
      changeLine(remove, Number(remove.dataset.lineRemove), 0);
      return;
    }
    const cartLink = e.target.closest('[data-cart-open]');
    if (cartLink && theme.cartType !== 'page' && !document.body.classList.contains('template-cart')) {
      e.preventDefault();
      Cart.open(cartLink);
      return;
    }
    const apply = e.target.closest('[data-discount-apply]');
    if (apply) {
      const wrap = apply.closest('cart-discount');
      const input = wrap.querySelector('[data-discount-input]');
      const error = wrap.querySelector('[data-discount-error]');
      const code = input.value.trim();
      if (!code) return;
      apply.classList.add('is-loading');
      try {
        const existing = [...document.querySelectorAll('[data-discount-remove]')].map((b) => b.dataset.discountRemove);
        const data = await Cart.update({ discount: [...new Set([...existing, code])].join(',') });
        const applied = (data.discount_codes || []).find((d) => d.code.toLowerCase() === code.toLowerCase());
        Cart.render(data.sections);
        if (applied && !applied.applicable) {
          const fresh = document.querySelectorAll('[data-discount-error]');
          fresh.forEach((el) => (el.hidden = false));
        }
      } catch (err) {
        if (error) error.hidden = false;
      } finally {
        apply.classList.remove('is-loading');
      }
      return;
    }
    const removeCode = e.target.closest('[data-discount-remove]');
    if (removeCode) {
      const remaining = [...document.querySelectorAll('cart-drawer [data-discount-remove], cart-page [data-discount-remove]')]
        .map((b) => b.dataset.discountRemove)
        .filter((c) => c !== removeCode.dataset.discountRemove);
      try {
        const data = await Cart.update({ discount: [...new Set(remaining)].join(',') });
        Cart.render(data.sections);
      } catch (err) {
        showToast(theme.strings.cartError);
      }
    }
  });

  class CartDrawer extends OverlayElement {}
  customElements.define('cart-drawer', CartDrawer);
  customElements.define('cart-page', class extends HTMLElement {});
  customElements.define('cart-discount', class extends HTMLElement {});
  customElements.define('cart-items', CartItems);

  /* ---------- Product form (main product, quick add, card quick add) ---------- */
  async function submitAddForm(form, button) {
    const errorEl = form.querySelector('[data-form-error]');
    if (errorEl) errorEl.hidden = true;
    button?.classList.add('is-loading');
    button?.setAttribute('aria-disabled', 'true');
    try {
      const data = await Cart.add(new FormData(form));
      Cart.render(data.sections);
      const modal = document.getElementById('QuickAddModal');
      if (modal && !modal.hidden) modal.close();
      await Cart.refresh();
      if (theme.cartType === 'page') {
        window.location.href = theme.routes.cart;
      } else {
        Cart.open(document.getElementById('CartIcon'));
      }
    } catch (err) {
      const message = err.description || err.message || theme.strings.cartError;
      if (errorEl) { errorEl.textContent = message; errorEl.hidden = false; }
      else showToast(message);
    } finally {
      button?.classList.remove('is-loading');
      button?.removeAttribute('aria-disabled');
    }
  }

  class ProductForm extends HTMLElement {
    connectedCallback() {
      this.form = this.querySelector('form');
      this.form.addEventListener('submit', (e) => {
        e.preventDefault();
        const button = this.querySelector('[data-add-button]');
        if (button?.getAttribute('aria-disabled') === 'true') return;
        submitAddForm(this.form, button);
      });
    }
  }
  customElements.define('product-form', ProductForm);

  document.addEventListener('submit', (e) => {
    const form = e.target.closest('[data-quick-add-form]');
    if (!form) return;
    e.preventDefault();
    submitAddForm(form, form.querySelector('button[type="submit"]'));
  });

  /* ---------- Variant selection (shared by product page & quick add) ---------- */
  function formatMoney(cents, format) {
    const value = Number(cents) / 100;
    const fmt = (n, decimals, thousands = ',', decimal = '.') => {
      const parts = n.toFixed(decimals).split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousands);
      return parts.join(decimals ? decimal : '');
    };
    return (format || '{{amount}}').replace(/\{\{\s*(\w+)\s*\}\}/, (_, key) => {
      switch (key) {
        case 'amount_no_decimals': return fmt(value, 0);
        case 'amount_with_comma_separator': return fmt(value, 2, '.', ',');
        case 'amount_no_decimals_with_comma_separator': return fmt(value, 0, '.', ',');
        case 'amount_with_apostrophe_separator': return fmt(value, 2, "'", '.');
        default: return fmt(value, 2);
      }
    });
  }

  class ProductInfo extends HTMLElement {
    connectedCallback() {
      this.picker = this.querySelector('variant-picker');
      if (!this.picker) return;
      const json = this.picker.querySelector('[data-variants]');
      this.variants = json ? JSON.parse(json.textContent) : [];
      const fmt = this.querySelector('[data-money-format]');
      this.moneyFormat = fmt ? JSON.parse(fmt.textContent) : '{{amount}}';
      this.picker.addEventListener('change', () => this.onChange());
      this.markAvailability();
    }
    selectedOptions() {
      return [...this.picker.querySelectorAll('[data-option-index]')]
        .filter((el) => el.tagName === 'SELECT' || el.tagName === 'FIELDSET')
        .map((el) => (el.tagName === 'SELECT' ? el.value : el.querySelector('input:checked')?.value));
    }
    onChange() {
      const options = this.selectedOptions();
      const variant = this.variants.find((v) => v.options.every((o, i) => o === options[i]));
      this.picker.querySelectorAll('fieldset').forEach((fs) => {
        const label = fs.querySelector('[data-selected-value]');
        const checked = fs.querySelector('input:checked');
        if (label && checked) label.textContent = `: ${checked.value}`;
      });
      this.markAvailability();
      this.update(variant);
    }
    markAvailability() {
      const selected = this.selectedOptions();
      this.picker.querySelectorAll('fieldset').forEach((fs) => {
        const index = [...this.picker.querySelectorAll('fieldset, select')].indexOf(fs);
        fs.querySelectorAll('input').forEach((input) => {
          const candidate = [...selected];
          candidate[index] = input.value;
          const available = this.variants.some((v) => v.available && v.options.every((o, i) => o === candidate[i]));
          input.classList.toggle('is-unavailable', !available);
        });
      });
    }
    update(variant) {
      const strings = theme.strings;
      const buttons = [...this.querySelectorAll('[data-add-button]')];
      const sticky = document.querySelector('[data-sticky-add]');
      const setButtons = (text, disabled) => {
        buttons.forEach((b) => {
          b.disabled = disabled;
          const label = b.querySelector('[data-add-label]') || b.querySelector('.button__label');
          if (label) label.textContent = text;
        });
        if (sticky && this.dataset.updateUrl === 'true') { sticky.disabled = disabled; sticky.textContent = text; }
      };

      const estimate = this.querySelector('delivery-estimate');
      if (!variant) { setButtons(strings.unavailable, true); estimate?.setAvailable(false); return; }
      estimate?.setAvailable(variant.available);

      this.querySelectorAll('[data-variant-id]').forEach((input) => {
        input.value = variant.id;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
      setButtons(variant.available ? strings.addToCart : strings.soldOut, !variant.available);

      this.querySelectorAll('[data-price-container]').forEach((el) => {
        el.innerHTML = this.priceHTML(variant, true, el.dataset.showSavings === 'true');
      });
      if (this.dataset.updateUrl === 'true') {
        const stickyPrice = document.querySelector('[data-sticky-price]');
        if (stickyPrice) stickyPrice.innerHTML = this.priceHTML(variant, false);
        const url = new URL(window.location.href);
        url.searchParams.set('variant', variant.id);
        window.history.replaceState({}, '', url.toString());
      }

      const inventory = this.querySelector('[data-inventory]');
      if (inventory) {
        const threshold = Number(inventory.dataset.lowThreshold) || 0;
        let cls = 'inventory--in';
        let text = inventory.dataset.inStock || 'In stock';
        if (!variant.available) { cls = 'inventory--out'; text = inventory.dataset.outOfStock || strings.soldOut; }
        else if (variant.inventory_management === 'shopify' && threshold > 0 && variant.inventory_quantity > 0 && variant.inventory_quantity <= threshold) {
          cls = 'inventory--low';
          text = (inventory.dataset.lowStock || 'Only [count] left').replace('[count]', variant.inventory_quantity);
        }
        inventory.innerHTML = `<span class="inventory ${cls}">${text}</span>`;
      }
      const sku = this.querySelector('[data-sku]');
      if (sku) sku.textContent = variant.sku || '';

      if (variant.featured_media) {
        this.querySelector('product-gallery')?.goToMedia(variant.featured_media);
      }
    }
    priceHTML(variant, large = true, savings = false) {
      const onSale = variant.compare_at_price > variant.price;
      const current = formatMoney(variant.price, this.moneyFormat);
      const cls = `price${onSale ? ' price--on-sale' : ''}${variant.available ? '' : ' price--sold-out'}${large ? ' price--large' : ''}`;
      const percent = onSale ? Math.floor(((variant.compare_at_price - variant.price) * 100) / variant.compare_at_price) : 0;
      const badge = savings && percent > 0
        ? `<span class="badge badge--sale price__save">${(theme.strings.savePercent || 'Save [percent]%').replace('[percent]', percent)}</span>`
        : '';
      return `<div class="${cls}" data-price><span class="price__current">${current}</span>${onSale ? `<s class="price__compare">${formatMoney(variant.compare_at_price, this.moneyFormat)}</s>` : ''}${badge}</div>`;
    }
  }
  customElements.define('product-info', ProductInfo);
  customElements.define('variant-picker', class extends HTMLElement {});

  /* ---------- Product gallery ---------- */
  class ProductGallery extends HTMLElement {
    connectedCallback() {
      this.track = this.querySelector('[data-gallery-track]');
      this.slides = [...this.querySelectorAll('.gallery__slide')];
      this.thumbs = [...this.querySelectorAll('[data-thumb-index]')];
      this.dots = [...this.querySelectorAll('.gallery__dot')];
      this.counter = this.querySelector('[data-gallery-current]');
      this.thumbs.forEach((t) => t.addEventListener('click', () => this.goTo(Number(t.dataset.thumbIndex))));
      this.track?.addEventListener('scroll', debounce(() => this.syncFromScroll(), 60), { passive: true });
      this.lightbox = this.querySelector('[data-lightbox]');
      this.querySelectorAll('[data-zoom-index]').forEach((btn) => btn.addEventListener('click', () => this.openZoom(btn)));
    }
    openZoom(btn) {
      if (!this.lightbox) return;
      this.lightbox.open(btn);
      const slide = this.lightbox.querySelector(`[data-zoom-slide="${btn.dataset.zoomIndex}"]`);
      const img = slide?.querySelector('img');
      if (img) img.loading = 'eager';
      requestAnimationFrame(() => slide?.scrollIntoView({ block: 'start' }));
    }
    goTo(index, smooth = true) {
      const slide = this.slides[index];
      if (!slide) return;
      if (getComputedStyle(this.track).display === 'grid') {
        slide.scrollIntoView({ behavior: smooth && !reduceMotion ? 'smooth' : 'auto', block: 'nearest' });
      } else {
        this.track.scrollTo({ left: slide.offsetLeft - this.track.offsetLeft, behavior: smooth && !reduceMotion ? 'smooth' : 'auto' });
      }
      this.setActive(index);
    }
    goToMedia(mediaId) {
      const index = this.slides.findIndex((s) => Number(s.dataset.mediaId) === Number(mediaId));
      if (index > -1) this.goTo(index);
    }
    syncFromScroll() {
      if (!this.track.clientWidth) return;
      const index = Math.round(this.track.scrollLeft / this.track.clientWidth);
      this.setActive(index);
    }
    setActive(index) {
      this.slides.forEach((s, i) => s.classList.toggle('is-active', i === index));
      this.thumbs.forEach((t, i) => {
        t.classList.toggle('is-active', i === index);
        i === index ? t.setAttribute('aria-current', 'true') : t.removeAttribute('aria-current');
      });
      this.dots.forEach((d, i) => d.classList.toggle('is-active', i === index));
      if (this.counter) this.counter.textContent = index + 1;
    }
  }
  customElements.define('product-gallery', ProductGallery);

  /* ---------- Delivery estimate (merchant-set dispatch times, shopper's local time) ---------- */
  class DeliveryEstimate extends HTMLElement {
    connectedCallback() {
      this.text = this.querySelector('[data-estimate-text]');
      this.available = this.dataset.available === 'true';
      this.render();
      this.timer = setInterval(() => this.render(), 60000);
    }
    disconnectedCallback() { clearInterval(this.timer); }
    setAvailable(available) { this.available = available; this.render(); }
    addDays(from, days) {
      const date = new Date(from);
      let added = 0;
      while (added < days) {
        date.setDate(date.getDate() + 1);
        if (this.dataset.skipSunday === 'true' && date.getDay() === 0) continue;
        added += 1;
      }
      return date;
    }
    render() {
      const min = Number(this.dataset.min) || 1;
      const max = Math.max(Number(this.dataset.max) || min, min);
      const cutoff = Number(this.dataset.cutoff);
      const now = new Date();
      const deadline = new Date(now);
      deadline.setHours(cutoff, 0, 0, 0);
      let dispatch = new Date(now);
      if (now >= deadline || (this.dataset.skipSunday === 'true' && now.getDay() === 0)) {
        dispatch = this.addDays(now, 1);
        deadline.setTime(dispatch.getTime());
        deadline.setHours(cutoff, 0, 0, 0);
      }
      const fmt = new Intl.DateTimeFormat(document.documentElement.lang || undefined, { weekday: 'short', day: 'numeric', month: 'short' });
      const mins = Math.max(1, Math.round((deadline - now) / 60000));
      const countdown = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
      const escape = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
      this.text.innerHTML = escape(this.dataset.template || '')
        .replace('[countdown]', `<strong>${countdown}</strong>`)
        .replace('[start]', `<strong>${fmt.format(this.addDays(dispatch, min))}</strong>`)
        .replace('[end]', `<strong>${fmt.format(this.addDays(dispatch, max))}</strong>`);
      this.hidden = !this.available;
    }
  }
  customElements.define('delivery-estimate', DeliveryEstimate);

  /* ---------- Gift note (sent as a line item property) ---------- */
  class GiftNote extends HTMLElement {
    connectedCallback() {
      const toggle = this.querySelector('[data-gift-toggle]');
      const panel = this.querySelector('.gift-note__panel');
      const text = this.querySelector('[data-gift-text]');
      const count = this.querySelector('[data-gift-count]');
      toggle.addEventListener('change', () => {
        panel.hidden = !toggle.checked;
        text.disabled = !toggle.checked;
        toggle.setAttribute('aria-expanded', String(toggle.checked));
        if (toggle.checked) text.focus();
      });
      text.addEventListener('input', () => { count.textContent = text.value.length; });
    }
  }
  customElements.define('gift-note', GiftNote);

  /* ---------- Recently viewed (stored in the shopper's browser) ---------- */
  class RecentlyViewed extends HTMLElement {
    async connectedCallback() {
      const key = 'tululu:recent';
      const current = this.dataset.current;
      let list = [];
      try { list = JSON.parse(localStorage.getItem(key)) || []; } catch (e) { /* storage unavailable */ }
      const others = list.filter((h) => h !== current).slice(0, Number(this.dataset.limit) || 4);
      try { localStorage.setItem(key, JSON.stringify([current, ...list.filter((h) => h !== current)].slice(0, 12))); } catch (e) { /* storage unavailable */ }
      if (!others.length) return;
      const root = theme.routes.root.replace(/\/$/, '');
      const cards = await Promise.all(others.map(async (handle) => {
        try {
          const res = await fetch(`${root}/products/${handle}?view=card`);
          return res.ok ? await res.text() : null;
        } catch (e) { return null; }
      }));
      const valid = cards.filter((html) => html && html.trim());
      if (!valid.length) return;
      this.querySelector('[data-recently-viewed-grid]').innerHTML = valid.map((html) => `<li class="product-grid__item">${html}</li>`).join('');
      this.hidden = false;
      Wishlist.sync();
    }
  }
  customElements.define('recently-viewed', RecentlyViewed);

  /* ---------- Quick add modal ---------- */
  class QuickAddModal extends OverlayElement {
    async load(url, opener) {
      const content = this.querySelector('[data-modal-content]');
      content.innerHTML = '<div class="modal__loading"><span class="button__spinner" style="display:block;position:static"></span></div>';
      this.open(opener);
      try {
        const res = await fetch(`${url}${url.includes('?') ? '&' : '?'}view=quick-add`);
        const doc = parseHTML(await res.text());
        const info = doc.querySelector('product-info');
        content.innerHTML = '';
        if (info) content.appendChild(document.importNode(info, true));
        content.querySelectorAll('script[type="application/json"]').forEach(() => {});
      } catch (err) {
        content.innerHTML = `<p>${theme.strings.cartError}</p>`;
      }
    }
  }
  customElements.define('quick-add-modal', QuickAddModal);

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-quick-view]');
    if (!btn) return;
    e.preventDefault();
    document.getElementById('QuickAddModal')?.load(btn.dataset.quickView, btn);
  });

  /* ---------- Wishlist (stored in the shopper's browser) ---------- */
  const Wishlist = {
    key: 'tululu:wishlist',
    get() {
      try { return JSON.parse(localStorage.getItem(this.key)) || []; } catch (e) { return []; }
    },
    set(list) {
      try { localStorage.setItem(this.key, JSON.stringify(list)); } catch (e) { /* storage unavailable */ }
      this.sync();
    },
    toggle(handle) {
      const list = this.get();
      const i = list.indexOf(handle);
      if (i > -1) list.splice(i, 1); else list.unshift(handle);
      this.set(list);
      return i === -1;
    },
    sync() {
      const list = this.get();
      document.querySelectorAll('wishlist-button').forEach((el) => el.render(list));
      document.querySelectorAll('[data-wishlist-count]').forEach((el) => {
        el.textContent = list.length;
        el.hidden = list.length === 0;
      });
    }
  };

  class WishlistButton extends HTMLElement {
    connectedCallback() {
      this.button = this.querySelector('button');
      this.button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const added = Wishlist.toggle(this.dataset.handle);
        this.button.classList.add('is-animating');
        setTimeout(() => this.button.classList.remove('is-animating'), 400);
        showToast(added ? this.button.dataset.labelRemove.replace(/remove from/i, 'Saved to') : 'Removed from wishlist');
      });
      this.render(Wishlist.get());
    }
    render(list) {
      const active = list.includes(this.dataset.handle);
      this.button.setAttribute('aria-pressed', String(active));
      this.button.setAttribute('aria-label', active ? this.button.dataset.labelRemove : this.button.dataset.labelAdd);
    }
  }
  customElements.define('wishlist-button', WishlistButton);

  class WishlistPage extends HTMLElement {
    async connectedCallback() {
      const grid = this.querySelector('[data-wishlist-grid]');
      const empty = this.querySelector('[data-wishlist-empty]');
      const handles = Wishlist.get();
      if (!handles.length) { empty.hidden = false; grid.removeAttribute('aria-busy'); return; }
      const root = theme.routes.root.replace(/\/$/, '');
      const cards = await Promise.all(handles.map(async (handle) => {
        try {
          const res = await fetch(`${root}/products/${handle}?view=card`);
          if (!res.ok) return null;
          return await res.text();
        } catch (e) { return null; }
      }));
      const valid = cards.filter(Boolean);
      grid.innerHTML = valid.map((html) => `<li class="product-grid__item">${html}</li>`).join('');
      grid.removeAttribute('aria-busy');
      empty.hidden = valid.length > 0;
    }
  }
  customElements.define('wishlist-page', WishlistPage);

  /* ---------- Product recommendations ---------- */
  class ProductRecommendations extends HTMLElement {
    connectedCallback() {
      const load = async () => {
        try {
          const res = await fetch(this.dataset.url);
          const doc = parseHTML(await res.text());
          const next = doc.querySelector('product-recommendations');
          if (next && next.innerHTML.trim()) { this.innerHTML = next.innerHTML; revealAll(this); }
        } catch (e) { /* recommendations are optional */ }
      };
      new IntersectionObserver((entries, obs) => {
        if (entries[0].isIntersecting) { obs.disconnect(); load(); }
      }, { rootMargin: '0px 0px 400px 0px' }).observe(this);
    }
  }
  customElements.define('product-recommendations', ProductRecommendations);

  /* ---------- Share ---------- */
  class ShareButton extends HTMLElement {
    connectedCallback() {
      this.querySelector('button').addEventListener('click', async () => {
        const data = { title: this.dataset.title, url: this.dataset.url };
        if (navigator.share) { try { await navigator.share(data); } catch (e) { /* cancelled */ } return; }
        try { await navigator.clipboard.writeText(data.url); showToast(theme.strings.linkCopied || 'Link copied'); } catch (e) { window.prompt('Copy link', data.url); }
      });
    }
  }
  customElements.define('share-button', ShareButton);

  /* ---------- Reveal on scroll ---------- */
  function revealAll(scope = document) {
    const items = scope.querySelectorAll('.reveal:not(.is-revealed)');
    if (reduceMotion || !('IntersectionObserver' in window)) { items.forEach((el) => el.classList.add('is-revealed')); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { entry.target.classList.add('is-revealed'); io.unobserve(entry.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    items.forEach((el) => io.observe(el));
  }

  /* ---------- Customer addresses: country/province ---------- */
  function initAddressForms() {
    document.querySelectorAll('[data-address-country]').forEach((country) => {
      const wrap = country.closest('[data-address-country-wrap]');
      const province = wrap.querySelector('[data-address-province]');
      const provinceWrap = wrap.querySelector('[data-province-wrap]');
      if (country.dataset.default) country.value = country.dataset.default;
      const fill = () => {
        const option = country.options[country.selectedIndex];
        const provinces = option ? JSON.parse(option.dataset.provinces || '[]') : [];
        provinceWrap.hidden = provinces.length === 0;
        province.innerHTML = provinces.map(([value, label]) => `<option value="${value}">${label}</option>`).join('');
        if (province.dataset.default) province.value = province.dataset.default;
      };
      country.addEventListener('change', () => { province.dataset.default = ''; fill(); });
      fill();
    });
    document.querySelectorAll('form[data-confirm]').forEach((form) =>
      form.addEventListener('submit', (e) => { if (!window.confirm(form.dataset.confirm)) e.preventDefault(); })
    );
  }

  /* ---------- Init ---------- */
  function init() {
    Wishlist.sync();
    revealAll();
    initAddressForms();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  document.addEventListener('shopify:section:load', (e) => { revealAll(e.target); Wishlist.sync(); });
  window.TululuTheme = { revealAll, showToast, Wishlist, formatMoney };
})();
