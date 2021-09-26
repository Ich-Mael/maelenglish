window.addEventListener('scroll', function(){
    const nav = document.querySelector('nav');
    const logo = document.querySelector('.logo');
    const afro = document.querySelector('.afro');
    const topLink = document.querySelector('.top-link');
    const hk = document.querySelector('.hk');
    const user = document.querySelector('#user');

    logo.classList.toggle('logo-display', window.scrollY > 100);
    nav.classList.toggle('nav-display', window.scrollY > 110);
    nav.classList.toggle('bg-dark', window.scrollY > 0);
    nav.classList.toggle('navbar-dark', window.scrollY > 0);
    nav.classList.toggle('navbar-light', window.scrollY === 0);
    nav.classList.toggle('bg-light', window.scrollY === 0);

    topLink.classList.toggle('top-btn-display', window.scrollY > 200);


    afro.classList.toggle('afro-shadow', window.scrollY > 0);
    hk.classList.toggle('hk-shadow', window.scrollY > 0);
    user.classList.toggle('user-shadow', window.scrollY > 0);

});

