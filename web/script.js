// ===== TEMA (claro / oscuro) =====
// El tema inicial se aplica en un script del <head> para evitar el parpadeo.
const root = document.documentElement;
const themeToggle = document.getElementById('themeToggle');
const themeIcon = themeToggle.querySelector('.theme-icon');

function getSavedTheme() {
    try {
        return localStorage.getItem('theme');
    } catch (e) {
        return null;
    }
}

function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
    themeToggle.setAttribute('aria-label', theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
}

applyTheme(root.getAttribute('data-theme') || 'light');

themeToggle.addEventListener('click', () => {
    const newTheme = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
    try {
        localStorage.setItem('theme', newTheme);
    } catch (e) {
        // Si el navegador bloquea el almacenamiento, el tema igual cambia.
    }
});

// Si la persona no eligió un tema, seguir la preferencia del sistema
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!getSavedTheme()) {
        applyTheme(e.matches ? 'dark' : 'light');
    }
});

// ===== MENÚ MÓVIL =====
const menuToggle = document.getElementById('menuToggle');
const navLinks = document.getElementById('navLinks');

function setMenu(open) {
    navLinks.classList.toggle('open', open);
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
}

menuToggle.addEventListener('click', () => {
    setMenu(menuToggle.getAttribute('aria-expanded') !== 'true');
});

// Cerrar el menú al elegir una sección o al presionar Escape
navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => setMenu(false));
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setMenu(false);
});

// ===== SECCIÓN ACTIVA EN LA NAVBAR =====
const navAnchors = navLinks.querySelectorAll('a');
const sections = document.querySelectorAll('main section[id]');

const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            navAnchors.forEach(a => {
                a.classList.toggle('active', a.getAttribute('href') === '#' + entry.target.id);
            });
        }
    });
}, { rootMargin: '-45% 0px -50% 0px' });

sections.forEach(section => sectionObserver.observe(section));

// ===== ANIMACIÓN DE APARICIÓN =====
const revealTargets = document.querySelectorAll(
    '.about-grid, .timeline-item, .edu-card, .skill-group, .carousel, .contact-card'
);

const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
        }
    });
}, { threshold: 0.12 });

revealTargets.forEach(el => {
    el.classList.add('reveal');
    revealObserver.observe(el);
});

// ===== CARRUSEL DE PROYECTOS =====
const track = document.getElementById('projectsTrack');

if (track) {
    const cards = Array.from(track.querySelectorAll('.project-card'));
    const prevBtn = document.getElementById('projectsPrev');
    const nextBtn = document.getElementById('projectsNext');
    const dotsBox = document.getElementById('projectsDots');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    // Distancia entre el inicio de una tarjeta y la siguiente
    const step = () => (cards.length > 1 ? cards[1].offsetLeft - cards[0].offsetLeft : track.clientWidth);
    const maxScroll = () => track.scrollWidth - track.clientWidth;
    // Cantidad de posiciones posibles (según cuántas tarjetas entran en pantalla)
    const positions = () => Math.max(1, Math.round(maxScroll() / step()) + 1);
    const currentIndex = () => Math.min(positions() - 1, Math.round(track.scrollLeft / step()));

    function goTo(index) {
        const i = Math.max(0, Math.min(index, positions() - 1));
        track.scrollTo({ left: i * step(), behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    }

    function buildDots() {
        dotsBox.innerHTML = '';
        for (let i = 0; i < positions(); i++) {
            const dot = document.createElement('button');
            dot.type = 'button';
            dot.className = 'carousel-dot';
            dot.setAttribute('aria-label', 'Ir al proyecto ' + (i + 1));
            dot.addEventListener('click', () => goTo(i));
            dotsBox.appendChild(dot);
        }
        update();
    }

    function update() {
        const i = currentIndex();
        prevBtn.disabled = track.scrollLeft <= 2;
        nextBtn.disabled = track.scrollLeft >= maxScroll() - 2;
        dotsBox.querySelectorAll('.carousel-dot').forEach((dot, n) => {
            dot.setAttribute('aria-current', String(n === i));
        });
    }

    prevBtn.addEventListener('click', () => goTo(currentIndex() - 1));
    nextBtn.addEventListener('click', () => goTo(currentIndex() + 1));

    // Flechas del teclado cuando el carrusel tiene el foco
    track.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') { e.preventDefault(); goTo(currentIndex() + 1); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(currentIndex() - 1); }
    });

    let ticking = false;
    track.addEventListener('scroll', () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => { update(); ticking = false; });
    }, { passive: true });

    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(buildDots, 150);
    });

    buildDots();
}

// ===== AÑO DEL FOOTER =====
document.getElementById('year').textContent = new Date().getFullYear();
