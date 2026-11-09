/* TULULU — product page: mobile sticky add to cart */
(() => {
  const sticky = document.querySelector('[data-sticky-atc]');
  const mainBuy = document.querySelector('[data-main-buy]');
  if (!sticky || !mainBuy || !('IntersectionObserver' in window)) return;

  const footer = document.querySelector('.footer');
  let buyVisible = true;
  let footerVisible = false;

  const update = () => {
    const show = !buyVisible && !footerVisible && mainBuy.getBoundingClientRect().top < 0;
    sticky.classList.toggle('is-visible', show);
    sticky.setAttribute('aria-hidden', String(!show));
    sticky.querySelectorAll('button').forEach((b) => (b.tabIndex = show ? 0 : -1));
  };

  new IntersectionObserver(([entry]) => { buyVisible = entry.isIntersecting; update(); }).observe(mainBuy);
  if (footer) new IntersectionObserver(([entry]) => { footerVisible = entry.isIntersecting; update(); }).observe(footer);
})();
