/**
 * Home hero carousel (Swiper 8, fade). Slides 2–4 load their background image
 * only after the page has loaded, so the first slide stays the LCP image.
 */
(function () {
  var root = document.querySelector('#hero .hero-swiper');
  if (!root || typeof Swiper === 'undefined') return;

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function loadLazyBackgrounds() {
    root.querySelectorAll('.hero-slide__bg[data-bg]').forEach(function (el) {
      el.style.backgroundImage = 'url("' + el.getAttribute('data-bg') + '")';
      el.removeAttribute('data-bg');
    });
  }
  if (document.readyState === 'complete') loadLazyBackgrounds();
  else window.addEventListener('load', loadLazyBackgrounds);

  new Swiper(root, {
    effect: 'fade',
    fadeEffect: { crossFade: true },
    speed: reduceMotion ? 0 : 900,
    rewind: true,
    grabCursor: true,
    // Slides change every 5 s. No pauseOnMouseEnter: the hero fills the screen,
    // so the pointer is almost always over it and the carousel would never move.
    // Autoplay also runs under prefers-reduced-motion (instant switch, no zoom/fade).
    autoplay: {
      delay: 5000,
      disableOnInteraction: false
    },
    keyboard: { enabled: true, onlyInViewport: true },
    navigation: {
      prevEl: '#hero .hero-nav--prev',
      nextEl: '#hero .hero-nav--next'
    },
    pagination: {
      el: '#hero .hero-pagination',
      clickable: true
    },
    a11y: {
      prevSlideMessage: 'Diapositive précédente',
      nextSlideMessage: 'Diapositive suivante',
      paginationBulletMessage: 'Aller à la diapositive {{index}}',
      slideLabelMessage: '{{index}} / {{slidesLength}}'
    },
    on: {
      // A slide that starts loading before window.load (user clicks early) still gets its image
      slideChangeTransitionStart: loadLazyBackgrounds
    }
  });
})();
