document.addEventListener('DOMContentLoaded', () => {
    try {
        // 1. Scroll Reveal Animation
        const revealElements = document.querySelectorAll('section');

        if (revealElements.length > 0 && 'IntersectionObserver' in window) {
            const revealObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('reveal-visible');
                    }
                });
            }, {
                threshold: 0.15
            });

            revealElements.forEach(element => {
                element.classList.add('reveal-hidden');
                revealObserver.observe(element);
            });
        } else if (revealElements.length > 0) {
            // Fallback: show all sections immediately if IntersectionObserver not available
            revealElements.forEach(element => {
                element.classList.add('reveal-visible');
            });
        }

        // 2. Active Navigation Highlighting
        const navLinks = document.querySelectorAll('nav a[href^="#"]');
        const sections = document.querySelectorAll('section[id]');

        if (sections.length > 0 && navLinks.length > 0) {
            let navTicking = false;
            let clickedId = null;
            let clickTimer = null;

            function setActive(id) {
                navLinks.forEach(link => link.classList.remove('active'));
                if (id) {
                    const link = document.querySelector(`nav a[href="#${id}"]`);
                    if (link) link.classList.add('active');
                }
            }

            function getScrollActiveId() {
                // Pick the last section whose top has scrolled past the offset
                const offset = 80;
                let current = null;
                for (const section of sections) {
                    if (section.getBoundingClientRect().top <= offset) {
                        current = section.getAttribute('id');
                    }
                }
                return current;
            }

            function updateActiveNav() {
                if (clickedId) return;
                setActive(getScrollActiveId());
            }

            // When a nav link is clicked, lock highlighting to that section
            navLinks.forEach(link => {
                link.addEventListener('click', () => {
                    const href = link.getAttribute('href');
                    if (!href || !href.startsWith('#')) return;
                    clickedId = href.slice(1);
                    setActive(clickedId);

                    // Release lock after scroll settles
                    clearTimeout(clickTimer);
                    clickTimer = setTimeout(() => {
                        clickedId = null;
                        updateActiveNav();
                    }, 800);
                });
            });

            window.addEventListener('scroll', () => {
                if (!navTicking) {
                    requestAnimationFrame(() => {
                        updateActiveNav();
                        navTicking = false;
                    });
                    navTicking = true;
                }
            }, { passive: true });

            updateActiveNav();
        }

        // 3. Lite YouTube Embeds (Lazy Loading)
        const videoPlaceholders = document.querySelectorAll('.video-placeholder');

        // Regex to validate YouTube video IDs (11 characters, alphanumeric, dash, underscore)
        const validVideoIdRegex = /^[a-zA-Z0-9_-]{11}$/;

        videoPlaceholders.forEach(placeholder => {
            placeholder.addEventListener('click', (e) => {
                try {
                    const target = e.currentTarget;
                    const videoId = target.dataset.videoId;

                    // Validate videoId before using it
                    if (!videoId || !validVideoIdRegex.test(videoId)) {
                        console.warn('Invalid YouTube video ID:', videoId);
                        return;
                    }

                    const iframe = document.createElement('iframe');

                    const origin = window.location.origin;
                    iframe.setAttribute('src', `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&origin=${origin}`);
                    iframe.setAttribute('frameborder', '0');
                    iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
                    iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
                    iframe.setAttribute('allowfullscreen', '');
                    iframe.classList.add('youtube-video');

                    const parent = target.parentElement;
                    if (parent) {
                        parent.replaceChildren(iframe);
                    }
                } catch (error) {
                    console.error('Error loading YouTube video:', error);
                }
            });
        });

        // 4. Back to Top Button
        const backToTopButton = document.getElementById('back-to-top');

        if (backToTopButton) {
            let scrollTicking = false;

            window.addEventListener('scroll', () => {
                if (!scrollTicking) {
                    requestAnimationFrame(() => {
                        if (window.scrollY > 300) {
                            backToTopButton.classList.add('visible');
                        } else {
                            backToTopButton.classList.remove('visible');
                        }
                        scrollTicking = false;
                    });
                    scrollTicking = true;
                }
            }, { passive: true });

            backToTopButton.addEventListener('click', () => {
                window.scrollTo({
                    top: 0,
                    behavior: 'smooth'
                });
            });
        }
    } catch (error) {
        console.error('Error initializing site scripts:', error);
    }
});
