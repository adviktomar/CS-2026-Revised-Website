(() => {
    const slider = document.querySelector('.morph-slider');
    if (!slider) return;

    const slides = Array.from(slider.querySelectorAll('.morph-slide'));
    const caption = slider.querySelector('.morph-slider-caption');
    const dotsWrap = slider.querySelector('.morph-slider-indicators');
    let activeIndex = 0;
    let autoplayTimer;
    let pointerStart = null;
    const captions = ['Escape \u2014 Scene 1', 'Escape \u2014 Scene 2', 'Escape \u2014 Scene 3', 'Escape \u2014 Scene 4'];

    function showSlide(index) {
        activeIndex = (index + slides.length) % slides.length;
        slides.forEach((slide, i) => {
            const active = i === activeIndex;
            slide.classList.toggle('is-active', active);
            slide.setAttribute('aria-hidden', String(!active));
        });
        Array.from(dotsWrap.children).forEach((dot, i) => {
            const active = i === activeIndex;
            dot.classList.toggle('is-active', active);
            dot.setAttribute('aria-pressed', String(active));
        });
        caption.textContent = captions[activeIndex] || `Escape — Scene ${activeIndex + 1}`;
    }

    function resetAutoplay() {
        clearInterval(autoplayTimer);
        autoplayTimer = setInterval(() => {
            if (!slider.matches(':hover') && !document.hidden) showSlide(activeIndex + 1);
        }, 4000);
    }

    slides.forEach((slide, index) => {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'morph-slider-dot';
        dot.setAttribute('aria-label', `Show screenshot ${index + 1}`);
        dot.setAttribute('aria-pressed', 'false');
        dot.addEventListener('click', () => { showSlide(index); resetAutoplay(); });
        dotsWrap.appendChild(dot);
        slide.addEventListener('error', () => {
            console.error(`Could not load the product screenshot: ${slide.getAttribute('src')}`);
        });
    });

    slider.querySelectorAll('[data-direction]').forEach(button => {
        button.addEventListener('click', () => {
            showSlide(activeIndex + Number(button.dataset.direction));
            resetAutoplay();
        });
    });

    slider.addEventListener('keydown', event => {
        if (event.key === 'ArrowRight') showSlide(activeIndex + 1);
        if (event.key === 'ArrowLeft') showSlide(activeIndex - 1);
    });
    slider.addEventListener('pointerdown', event => { pointerStart = event.clientX; });
    slider.addEventListener('pointerup', event => {
        if (pointerStart === null) return;
        const distance = event.clientX - pointerStart;
        if (Math.abs(distance) > 45) showSlide(activeIndex + (distance < 0 ? 1 : -1));
        pointerStart = null;
    });
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) resetAutoplay();
        else clearInterval(autoplayTimer);
    });

    showSlide(0);
    resetAutoplay();
})();
