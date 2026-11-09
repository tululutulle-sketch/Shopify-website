/* TULULU — collection & search filtering, sorting and load more (Section Rendering API) */
(() => {
  if (customElements.get('facet-filters')) return;

  const parse = (html) => new DOMParser().parseFromString(html, 'text/html');

  class FacetFilters extends HTMLElement {
    connectedCallback() {
      this.sectionId = this.dataset.sectionId;
      this.layout = this.closest('[data-collection-layout]');
      this.bind();
    }

    bind() {
      this.form = this.querySelector('[data-facets-form]');
      this.drawer = this.querySelector('[data-facets-drawer]');
      this.addEventListener('change', this.onChange);
      this.addEventListener('input', this.onInput);
      this.addEventListener('click', this.onClick);
      this.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.closeDrawer(); });
      this.layout?.addEventListener('click', (e) => {
        const link = e.target.closest('[data-load-more]');
        if (link) { e.preventDefault(); this.loadMore(link); }
        const clear = e.target.closest('.empty-state [data-facet-link]');
        if (clear) { e.preventDefault(); this.render(new URL(clear.href, location.origin).search.slice(1)); }
      });
    }

    onChange = (e) => {
      if (e.target.type === 'number') return;
      if (e.target.closest('[data-facets-form]') || e.target.name === 'sort_by') this.submit();
    };

    onInput = (e) => {
      if (e.target.type !== 'number') return;
      clearTimeout(this.priceTimer);
      this.priceTimer = setTimeout(() => this.submit(), 600);
    };

    onClick = (e) => {
      if (e.target.closest('[data-facets-open]')) this.openDrawer(e.target.closest('[data-facets-open]'));
      if (e.target.closest('[data-facets-close]')) this.closeDrawer();
      const link = e.target.closest('[data-facet-link]');
      if (link) {
        e.preventDefault();
        this.render(new URL(link.href, location.origin).search.slice(1));
      }
    };

    openDrawer(btn) {
      this.opener = btn;
      this.drawer.classList.add('is-open');
      btn.setAttribute('aria-expanded', 'true');
      document.body.classList.add('is-locked');
      this.drawer.querySelector('summary, input, button')?.focus();
    }

    closeDrawer() {
      if (!this.drawer?.classList.contains('is-open')) return;
      this.drawer.classList.remove('is-open');
      document.body.classList.remove('is-locked');
      this.opener?.setAttribute('aria-expanded', 'false');
      this.opener?.focus();
    }

    submit() {
      const params = new URLSearchParams(new FormData(this.form));
      const sort = this.querySelector('[name="sort_by"]');
      if (sort) params.set('sort_by', sort.value);
      // Drop empty price fields so they don't count as active filters.
      [...params.keys()].forEach((key) => { if (params.get(key) === '') params.delete(key); });
      this.render(params.toString());
    }

    async render(search) {
      const grid = this.layout.querySelector('[data-product-grid-container]');
      grid.classList.add('is-loading');
      const params = new URLSearchParams(search);
      params.delete('page');
      const query = params.toString();
      const openIds = [...this.querySelectorAll('details[open]')].map((d) => d.id);
      const drawerOpen = this.drawer?.classList.contains('is-open');
      try {
        const res = await fetch(`${location.pathname}?${query}${query ? '&' : ''}section_id=${this.sectionId}`);
        const doc = parse(await res.text());
        const nextFacets = doc.querySelector('facet-filters');
        const nextGrid = doc.querySelector('[data-product-grid-container]');
        if (nextGrid) grid.replaceWith(nextGrid);
        if (nextFacets) {
          this.innerHTML = nextFacets.innerHTML;
          this.form = this.querySelector('[data-facets-form]');
          this.drawer = this.querySelector('[data-facets-drawer]');
          this.querySelectorAll('details').forEach((d) => { if (openIds.includes(d.id)) d.open = true; });
          if (drawerOpen && this.drawer) this.drawer.classList.add('is-open');
        }
        history.replaceState({}, '', `${location.pathname}${query ? `?${query}` : ''}`);
        window.TululuTheme?.revealAll(this.layout);
        window.TululuTheme?.Wishlist.sync();
      } catch (err) {
        location.search = query;
      }
    }

    async loadMore(link) {
      link.classList.add('is-loading');
      try {
        const url = new URL(link.href, location.origin);
        url.searchParams.set('section_id', this.sectionId);
        const doc = parse(await (await fetch(url)).text());
        const items = doc.querySelectorAll('[data-product-grid] > li');
        const grid = this.layout.querySelector('[data-product-grid]');
        items.forEach((li) => grid.appendChild(li));
        const nextPagination = doc.querySelector('[data-pagination]');
        const pagination = this.layout.querySelector('[data-pagination]');
        if (nextPagination) pagination.replaceWith(nextPagination); else pagination.remove();
        window.TululuTheme?.Wishlist.sync();
        items[0]?.querySelector('a')?.focus({ preventScroll: true });
      } catch (err) {
        location.href = link.href;
      }
    }
  }

  customElements.define('facet-filters', FacetFilters);
})();
