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
    '.about-grid, .timeline-item, .edu-card, .skill-group, .project-card, .contact-card'
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

// ===== AÑO DEL FOOTER =====
document.getElementById('year').textContent = new Date().getFullYear();
