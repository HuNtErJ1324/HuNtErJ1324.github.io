document.addEventListener('DOMContentLoaded', () => {
    try {
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        // 1. Typed boot line in the banner (progressive enhancement: full text
        //    is present in the HTML for no-JS and reduced-motion visitors)
        const bootLine = document.querySelector('.boot-line');

        if (bootLine && !prefersReducedMotion) {
            const bootText = bootLine.textContent.trim();
            let charIndex = 0;

            bootLine.textContent = '';

            const typeNextChar = () => {
                if (charIndex <= bootText.length) {
                    bootLine.textContent = bootText.slice(0, charIndex);
                    charIndex += 1;
                    setTimeout(typeNextChar, 36);
                }
            };

            setTimeout(typeNextChar, 250);
        }

        // 2. Scroll Reveal Animation
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

        // 3. Active Navigation Highlighting (same-page section links only)
        const navLinks = document.querySelectorAll('nav a[href^="#"]');
        const sections = document.querySelectorAll('section[id]');

        if (sections.length > 0 && navLinks.length > 0) {
            let navTicking = false;
            let clickedId = null;
            let clickTimer = null;

            function setActive(id) {
                navLinks.forEach(link => {
                    link.classList.remove('active');
                    link.removeAttribute('aria-current');
                });
                if (id) {
                    const link = document.querySelector(`nav a[href="#${id}"]`);
                    if (link) {
                        link.classList.add('active');
                        link.setAttribute('aria-current', 'true');
                    }
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

        // 4. Lite YouTube Embeds (privacy-enhanced, loaded on click)
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
                    iframe.setAttribute('src', `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&origin=${origin}`);
                    iframe.setAttribute('frameborder', '0');
                    iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
                    iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
                    iframe.setAttribute('allowfullscreen', '');
                    iframe.setAttribute('title', 'YouTube video player');
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

        // 5. Back to Top button + statusline scroll position (vim style)
        const backToTopButton = document.getElementById('back-to-top');
        const scrollPct = document.getElementById('scroll-pct');

        if (backToTopButton || scrollPct) {
            let scrollTicking = false;

            const updateScrollUi = () => {
                if (backToTopButton) {
                    if (window.scrollY > 300) {
                        backToTopButton.classList.add('visible');
                    } else {
                        backToTopButton.classList.remove('visible');
                    }
                }

                if (scrollPct) {
                    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
                    let label;
                    if (maxScroll <= 0 || window.scrollY <= 0) {
                        label = 'TOP';
                    } else if (window.scrollY >= maxScroll - 2) {
                        label = 'BOT';
                    } else {
                        label = `${Math.round((window.scrollY / maxScroll) * 100)}%`;
                    }
                    scrollPct.textContent = label;
                }
            };

            window.addEventListener('scroll', () => {
                if (!scrollTicking) {
                    requestAnimationFrame(() => {
                        updateScrollUi();
                        scrollTicking = false;
                    });
                    scrollTicking = true;
                }
            }, { passive: true });

            updateScrollUi();

            if (backToTopButton) {
                backToTopButton.addEventListener('click', () => {
                    window.scrollTo({
                        top: 0,
                        behavior: prefersReducedMotion ? 'auto' : 'smooth'
                    });
                });
            }
        }

        // 6. Vim-style keyboard navigation (hjkl + friends)
        //    j/k line scroll, d/u half page, gg/G top/bottom,
        //    h/l previous/next page, ? toggles the :help overlay.
        const LINE_STEP = 72;
        const GG_WINDOW_MS = 600;
        const PAGE_ORDER = ['/', '/music.html', '/blog/'];

        const showcmd = document.getElementById('showcmd');
        const modeBlock = document.querySelector('.statusline-mode');
        let lastGTime = 0;
        let showcmdTimer = null;
        let helpOverlay = null;
        let lastFocused = null;

        // Eased scroller (neoscroll-style): keypresses move a target offset and
        // a rAF loop glides toward it, so held/repeated keys accumulate smoothly.
        let scrollTarget = null;
        let scrollAnimating = false;
        let lastFrameTime = null;

        const maxScrollY = () => document.documentElement.scrollHeight - window.innerHeight;

        const animateScrollStep = (timestamp) => {
            if (scrollTarget === null) {
                scrollAnimating = false;
                lastFrameTime = null;
                return;
            }
            if (lastFrameTime === null) lastFrameTime = timestamp;
            // Clamp dt so a throttled/hidden tab resumes gently instead of teleporting
            const dt = Math.min(timestamp - lastFrameTime, 100);
            lastFrameTime = timestamp;

            const current = window.scrollY;
            const diff = scrollTarget - current;
            if (Math.abs(diff) < 1) {
                window.scrollTo({ top: scrollTarget, behavior: 'instant' });
                scrollTarget = null;
                scrollAnimating = false;
                lastFrameTime = null;
                return;
            }
            // Time-based ease out (~18% of remaining distance per 60fps frame,
            // normalized by dt so it feels the same at any refresh rate)
            const factor = 1 - Math.pow(0.82, dt / 16.67);
            window.scrollTo({ top: current + diff * factor, behavior: 'instant' });
            requestAnimationFrame(animateScrollStep);
        };

        const scrollToY = (top) => {
            const clamped = Math.max(0, Math.min(maxScrollY(), top));
            if (prefersReducedMotion) {
                window.scrollTo({ top: clamped, behavior: 'auto' });
                return;
            }
            scrollTarget = clamped;
            if (!scrollAnimating) {
                scrollAnimating = true;
                lastFrameTime = null;
                requestAnimationFrame(animateScrollStep);
            }
        };

        const scrollByY = (delta) => {
            const from = scrollTarget === null ? window.scrollY : scrollTarget;
            scrollToY(from + delta);
        };

        // Manual scrolling takes back control from the animation
        ['wheel', 'touchstart'].forEach(eventName => {
            window.addEventListener(eventName, () => {
                scrollTarget = null;
            }, { passive: true });
        });

        const echoKey = (text, sticky) => {
            if (!showcmd) return;
            clearTimeout(showcmdTimer);
            showcmd.textContent = text;
            if (!sticky) {
                showcmdTimer = setTimeout(() => {
                    showcmd.textContent = '';
                }, 700);
            }
        };

        const currentPageIndex = () => {
            const path = window.location.pathname;
            if (path === '/' || path.endsWith('/index.html')) return 0;
            if (path.endsWith('/music.html')) return 1;
            if (path.startsWith('/blog')) return 2;
            return -1;
        };

        const goToPage = (offset) => {
            const index = currentPageIndex();
            if (index === -1) return;
            const next = (index + offset + PAGE_ORDER.length) % PAGE_ORDER.length;
            window.location.href = PAGE_ORDER[next];
        };

        const buildHelpOverlay = () => {
            const overlay = document.createElement('div');
            overlay.className = 'key-help';
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-modal', 'true');
            overlay.setAttribute('aria-label', 'Keyboard shortcuts');
            overlay.hidden = true;

            const rows = [
                ['<kbd>j</kbd> / <kbd>k</kbd>', 'scroll down / up'],
                ['<kbd>d</kbd> / <kbd>u</kbd>', 'half page down / up'],
                ['<kbd>g</kbd><kbd>g</kbd> / <kbd>G</kbd>', 'top / bottom'],
                ['<kbd>h</kbd> / <kbd>l</kbd>', 'previous / next page'],
                ['<kbd>?</kbd>', 'toggle this help'],
                ['<kbd>Esc</kbd>', 'close']
            ];

            const panel = document.createElement('div');
            panel.className = 'key-help-panel';
            panel.setAttribute('tabindex', '-1');
            panel.innerHTML = `
                <p class="key-help-title">help keys.txt</p>
                ${rows.map(([keys, desc]) => `<div class="key-row"><span class="keys">${keys}</span><span class="key-desc">${desc}</span></div>`).join('')}
            `;

            overlay.appendChild(panel);
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) toggleHelp(false);
            });
            document.body.appendChild(overlay);
            return overlay;
        };

        const helpIsOpen = () => helpOverlay && !helpOverlay.hidden;

        const toggleHelp = (open) => {
            if (!helpOverlay) helpOverlay = buildHelpOverlay();
            const shouldOpen = open !== undefined ? open : helpOverlay.hidden;
            helpOverlay.hidden = !shouldOpen;
            if (modeBlock) modeBlock.textContent = shouldOpen ? 'HELP' : 'NORMAL';
            if (shouldOpen) {
                lastFocused = document.activeElement;
                helpOverlay.querySelector('.key-help-panel').focus();
            } else if (lastFocused && typeof lastFocused.focus === 'function') {
                lastFocused.focus();
            }
        };

        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey || e.altKey) return;

            const target = e.target;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;

            if (helpIsOpen()) {
                if (e.key === 'Escape' || e.key === '?' || e.key === 'q') {
                    e.preventDefault();
                    toggleHelp(false);
                }
                return;
            }

            switch (e.key) {
                case 'j':
                    e.preventDefault();
                    scrollByY(LINE_STEP);
                    echoKey('j');
                    break;
                case 'k':
                    e.preventDefault();
                    scrollByY(-LINE_STEP);
                    echoKey('k');
                    break;
                case 'd':
                    e.preventDefault();
                    scrollByY(window.innerHeight / 2);
                    echoKey('d');
                    break;
                case 'u':
                    e.preventDefault();
                    scrollByY(-window.innerHeight / 2);
                    echoKey('u');
                    break;
                case 'g': {
                    e.preventDefault();
                    const now = Date.now();
                    if (now - lastGTime < GG_WINDOW_MS) {
                        lastGTime = 0;
                        scrollToY(0);
                        echoKey('gg');
                    } else {
                        lastGTime = now;
                        echoKey('g', true);
                    }
                    break;
                }
                case 'G':
                    e.preventDefault();
                    scrollToY(maxScrollY());
                    echoKey('G');
                    break;
                case 'h':
                    e.preventDefault();
                    echoKey('h');
                    goToPage(-1);
                    break;
                case 'l':
                    e.preventDefault();
                    echoKey('l');
                    goToPage(1);
                    break;
                case '?':
                    e.preventDefault();
                    toggleHelp(true);
                    break;
                default:
                    break;
            }
        });
    } catch (error) {
        console.error('Error initializing site scripts:', error);
    }
});
