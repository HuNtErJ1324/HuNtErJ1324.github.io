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

        // 4b. Lite X embeds (privacy-enhanced, loaded on click)
        // Authoring stays plain markdown — paste a normal link such as
        // [my post](https://x.com/user/status/123...) and JS upgrades it
        // into a click-to-load placeholder. Without JS it remains a link.
        // No widgets.js: click swaps in a platform.twitter.com iframe, so no
        // third-party JS runs until the reader consents.
        const postScope = document.querySelector('.post-content');
        if (postScope) {
            const tweetLinks = postScope.querySelectorAll(
                'a[href*="x.com/"][href*="/status/"], a[href*="twitter.com/"][href*="/status/"]'
            );
            const validTweetIdRegex = /^\d{2,25}$/;

            tweetLinks.forEach((link) => {
                try {
                    if (link.closest('.x-container')) return;
                    const href = link.getAttribute('href') || '';
                    const match = href.match(/\/status\/(\d+)/);
                    const tweetId = match ? match[1] : '';
                    if (!tweetId || !validTweetIdRegex.test(tweetId)) return;

                    const container = document.createElement('div');
                    container.className = 'x-container';

                    const placeholder = document.createElement('div');
                    placeholder.className = 'x-placeholder';

                    const label = document.createElement('p');
                    label.className = 'x-label';
                    label.textContent = '𝕏 post — x.com';

                    const openLink = document.createElement('a');
                    openLink.setAttribute('href', href);
                    openLink.setAttribute('target', '_blank');
                    openLink.setAttribute('rel', 'noopener noreferrer');
                    openLink.className = 'x-open';
                    openLink.textContent = 'open on x.com';

                    const loadBtn = document.createElement('button');
                    loadBtn.type = 'button';
                    loadBtn.className = 'x-load';
                    loadBtn.setAttribute('aria-label', 'Load embedded X post');
                    loadBtn.textContent = '[ load post ]';
                    loadBtn.addEventListener('click', () => {
                        try {
                            const iframe = document.createElement('iframe');
                            iframe.setAttribute(
                                'src',
                                `https://platform.twitter.com/embed/Tweet.html?id=${tweetId}&dnt=true&theme=dark`
                            );
                            iframe.setAttribute('title', 'Embedded X post');
                            iframe.setAttribute('loading', 'lazy');
                            iframe.setAttribute('referrerpolicy', 'no-referrer');
                            iframe.setAttribute('allowfullscreen', '');
                            iframe.classList.add('x-embed');
                            container.replaceChildren(iframe);
                        } catch (error) {
                            console.error('Error loading X post:', error);
                        }
                    });

                    placeholder.append(label, openLink, loadBtn);
                    container.appendChild(placeholder);
                    link.replaceWith(container);
                } catch (error) {
                    console.error('Error enhancing X link:', error);
                }
            });
        }

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
        const PAGE_ORDER = ['/', '/music/', '/blog/'];

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
            showcmd.classList.remove('flash-msg', 'err');
            if (!sticky) {
                showcmdTimer = setTimeout(() => {
                    showcmd.textContent = '';
                }, 700);
            }
        };

        const currentPageIndex = () => {
            const path = window.location.pathname;
            if (path === '/' || path.endsWith('/index.html')) return 0;
            if (path === '/music/' || path.startsWith('/music/') || path.endsWith('/music.html')) return 1;
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
                ['<kbd>/</kbd> · <kbd>n</kbd> / <kbd>N</kbd>', 'search · next / prev hit'],
                ['<kbd>:</kbd>', 'command mode'],
                ['<kbd>:</kbd><kbd>email</kbd>', 'copy email address'],
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
                case ':':
                    e.preventDefault();
                    openCommandLine('cmd');
                    break;
                case '/':
                    e.preventDefault();
                    openCommandLine('search');
                    break;
                case 'n':
                    e.preventDefault();
                    stepSearch(1);
                    break;
                case 'N':
                    e.preventDefault();
                    stepSearch(-1);
                    break;
                default:
                    break;
            }
        });

        // 7. Vim command mode (:) — an ex-style command line docked above the
        //    statusline. Bare section names jump (cross-page when needed),
        //    :email copies the contact address, :help opens the key overlay.
        //    Feedback lands in the statusline (showcmd) plus a visually-hidden
        //    live region so screen readers hear command results too.
        const CONTACT_EMAIL = 'jcjustin.chae@gmail.com';
        const SECTION_IDS = ['about', 'education', 'papers', 'projects', 'achievements'];

        let cmdline = null;
        let cmdlinePrompt = null;
        let cmdlineInput = null;
        let cmdlineMode = 'cmd';
        let commandHistory = [];
        let historyIndex = 0;
        let liveRegion = null;
        let flashTimer = null;

        // Search state (vim /, n, N, :noh)
        let searchMarks = [];
        let searchCurrent = -1;
        let lastPattern = '';
        const SEARCH_SKIP_SELECTOR = 'nav, .statusline, .cmdline, .key-help, script, style, template';

        const baseMode = () => (helpIsOpen() ? 'HELP' : 'NORMAL');

        const announce = (text) => {
            if (!liveRegion) {
                liveRegion = document.createElement('div');
                liveRegion.className = 'visually-hidden';
                liveRegion.setAttribute('aria-live', 'polite');
                document.body.appendChild(liveRegion);
            }
            liveRegion.textContent = text;
        };

        const flashStatus = (text, isError) => {
            if (!showcmd) return;
            clearTimeout(flashTimer);
            showcmd.textContent = text;
            showcmd.classList.add('flash-msg');
            showcmd.classList.toggle('err', Boolean(isError));
            announce(text);
            flashTimer = setTimeout(() => {
                showcmd.textContent = '';
                showcmd.classList.remove('flash-msg', 'err');
            }, 2600);
        };

        const flashSection = (el) => {
            el.classList.remove('section-flash');
            // Force a reflow so the animation restarts if already flashing
            void el.offsetWidth;
            el.classList.add('section-flash');
            el.addEventListener('animationend', () => {
                el.classList.remove('section-flash');
            }, { once: true });
        };

        const scrollToSection = (id) => {
            const el = document.getElementById(id);
            if (!el) return false;
            scrollToY(el.getBoundingClientRect().top + window.scrollY - 80);
            flashSection(el);
            return true;
        };

        const copyContactEmail = () => {
            const done = () => flashStatus(`copied: ${CONTACT_EMAIL}`, false);
            const fail = () => flashStatus('copy failed — clipboard unavailable', true);
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(CONTACT_EMAIL).then(done, fail);
                return;
            }
            try {
                const helper = document.createElement('textarea');
                helper.value = CONTACT_EMAIL;
                helper.setAttribute('readonly', '');
                helper.style.position = 'fixed';
                helper.style.left = '-9999px';
                document.body.appendChild(helper);
                helper.select();
                document.execCommand('copy');
                document.body.removeChild(helper);
                done();
            } catch (err) {
                fail();
            }
        };

        const goToSection = (id) => {
            if (scrollToSection(id)) return `→ #${id}`;
            if (SECTION_IDS.includes(id)) {
                window.location.href = `/index.html#${id}`;
                return `opening /index.html#${id}`;
            }
            return `E16: no such section: ${id}`;
        };

        const COMMANDS = {
            help: () => {
                toggleHelp(true);
                return null;
            },
            about: () => goToSection('about'),
            education: () => goToSection('education'),
            papers: () => goToSection('papers'),
            projects: () => goToSection('projects'),
            achievements: () => goToSection('achievements'),
            ls: () => SECTION_IDS.join('  '),
            home: () => {
                window.location.href = '/';
                return 'opening ~ ...';
            },
            music: () => {
                window.location.href = '/music/';
                return 'opening ~/violin ...';
            },
            blog: () => {
                window.location.href = '/blog/';
                return 'opening ~/blog ...';
            },
            email: () => {
                copyContactEmail();
                return null;
            },
            linkedin: () => {
                window.open('https://www.linkedin.com/in/justin-c-92403120b', '_blank', 'noopener');
                return 'opening linkedin ...';
            },
            scholar: () => {
                window.open('https://scholar.google.com/citations?user=icnjuIMAAAAJ', '_blank', 'noopener');
                return 'opening google scholar ...';
            },
            github: () => {
                window.open('https://github.com/HuNtErJ1324', '_blank', 'noopener');
                return 'opening github ...';
            },
            x: () => {
                window.open('https://x.com/HuNtEr_J1324', '_blank', 'noopener');
                return 'opening x.com ...';
            },
            twitter: () => {
                window.open('https://x.com/HuNtEr_J1324', '_blank', 'noopener');
                return 'opening x.com ...';
            },
            top: () => {
                scrollToY(0);
                return 'top';
            },
            noh: () => {
                clearSearch();
                return 'search highlight cleared';
            },
            nohlsearch: () => {
                clearSearch();
                return 'search highlight cleared';
            },
            bottom: () => {
                scrollToY(maxScrollY());
                return 'bottom';
            },
            '$': () => {
                scrollToY(maxScrollY());
                return 'bottom';
            },
            '1': () => {
                scrollToY(0);
                return 'top';
            },
            q: () => 'E37: no exit here — this is a website',
            'q!': () => 'E37: really. there is no exit.',
            wq: () => '"portfolio" 1L, 1C written (to the void)'
        };

        const runCommand = (raw) => {
            const text = raw.trim().replace(/^:+/, '');
            if (!text) return;
            commandHistory.push(text);
            historyIndex = commandHistory.length;
            const name = text.split(/\s+/)[0].toLowerCase();
            const handler = COMMANDS[name];
            if (handler) {
                const result = handler();
                if (result) flashStatus(result, /^E\d+/.test(result));
            } else {
                flashStatus(`E492: not an editor command: ${name}`, true);
            }
        };

        const completeCommand = () => {
            const value = cmdlineInput.value.trim().replace(/^:+/, '').toLowerCase();
            const names = Object.keys(COMMANDS).filter((name) => /^[a-z]+$/.test(name));
            const matches = value ? names.filter((name) => name.startsWith(value)) : names;
            if (matches.length === 1) {
                cmdlineInput.value = matches[0];
                return;
            }
            if (matches.length > 1) {
                // Fill the shared prefix, then list the candidates in the statusline
                let prefix = matches[0];
                for (const candidate of matches.slice(1)) {
                    while (!candidate.startsWith(prefix)) {
                        prefix = prefix.slice(0, -1);
                    }
                }
                cmdlineInput.value = prefix;
                flashStatus(matches.join('  '), false);
            }
        };

        const buildCommandLine = () => {
            cmdline = document.createElement('div');
            cmdline.className = 'cmdline';
            cmdline.hidden = true;

            cmdlinePrompt = document.createElement('span');
            cmdlinePrompt.className = 'cmdline-prompt';
            cmdlinePrompt.setAttribute('aria-hidden', 'true');
            cmdlinePrompt.textContent = ':';

            cmdlineInput = document.createElement('input');
            cmdlineInput.className = 'cmdline-input';
            cmdlineInput.type = 'text';
            cmdlineInput.autocomplete = 'off';
            cmdlineInput.setAttribute('spellcheck', 'false');
            cmdlineInput.setAttribute('aria-label', 'Command mode input');
            cmdlineInput.setAttribute('placeholder', 'type a command — help for options');

            const hint = document.createElement('span');
            hint.className = 'cmdline-hint';
            hint.setAttribute('aria-hidden', 'true');
            hint.textContent = 'tab complete · esc';

            cmdline.append(cmdlinePrompt, cmdlineInput, hint);
            cmdline.addEventListener('click', (e) => {
                if (e.target === cmdline) cmdlineInput.focus();
            });
            cmdlineInput.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    closeCommandLine();
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    const value = cmdlineInput.value;
                    cmdlineInput.value = '';
                    if (cmdlineMode === 'search') {
                        closeCommandLine();
                        runSearch(value.trim());
                    } else {
                        runCommand(value);
                    }
                } else if (e.key === 'ArrowUp' && cmdlineMode === 'cmd') {
                    e.preventDefault();
                    if (historyIndex > 0) {
                        historyIndex -= 1;
                        cmdlineInput.value = commandHistory[historyIndex] || '';
                    }
                } else if (e.key === 'ArrowDown' && cmdlineMode === 'cmd') {
                    e.preventDefault();
                    if (historyIndex < commandHistory.length - 1) {
                        historyIndex += 1;
                        cmdlineInput.value = commandHistory[historyIndex];
                    } else {
                        historyIndex = commandHistory.length;
                        cmdlineInput.value = '';
                    }
                } else if (e.key === 'Tab' && cmdlineMode === 'cmd') {
                    e.preventDefault();
                    completeCommand();
                }
            });
            document.body.appendChild(cmdline);
        };

        function openCommandLine(mode = 'cmd') {
            if (!cmdline) buildCommandLine();
            cmdlineMode = mode;
            const isSearch = mode === 'search';
            cmdlinePrompt.textContent = isSearch ? '/' : ':';
            cmdlineInput.setAttribute('aria-label', isSearch ? 'Search input' : 'Command mode input');
            cmdlineInput.setAttribute('placeholder', isSearch
                ? 'type to search — enter to find, esc to cancel'
                : 'type a command — help for options');
            cmdline.hidden = false;
            if (modeBlock) modeBlock.textContent = isSearch ? 'SEARCH' : 'CMD';
            cmdlineInput.focus();
        }

        function closeCommandLine() {
            if (!cmdline || cmdline.hidden) return;
            cmdline.hidden = true;
            cmdlineInput.value = '';
            if (modeBlock) modeBlock.textContent = baseMode();
        }

        // 8. Vim-style search (/) — case-insensitive substring search over the
        //    page text. Matches are wrapped in <mark class="search-hit"> (no
        //    inline styles — CSP), n/N cycle through them (:noh clears).
        const clearSearch = () => {
            searchMarks.forEach((markNode) => {
                const parent = markNode.parentNode;
                if (!parent) return;
                parent.replaceChild(document.createTextNode(markNode.textContent), markNode);
                parent.normalize();
            });
            searchMarks = [];
            searchCurrent = -1;
        };

        const performSearch = (pattern) => {
            clearSearch();
            const scope = document.querySelector('main');
            if (!scope) return;
            const needle = pattern.toLowerCase();
            const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
                acceptNode(node) {
                    if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
                    const parent = node.parentElement;
                    if (!parent || parent.closest(SEARCH_SKIP_SELECTOR)) return NodeFilter.FILTER_REJECT;
                    return NodeFilter.FILTER_ACCEPT;
                }
            });

            const textNodes = [];
            for (let node = walker.nextNode(); node; node = walker.nextNode()) {
                textNodes.push(node);
            }

            textNodes.forEach((node) => {
                const text = node.nodeValue;
                const lower = text.toLowerCase();
                const fragment = document.createDocumentFragment();
                let cursor = 0;
                let found = lower.indexOf(needle);
                let nodeHadMatch = false;
                while (found !== -1) {
                    nodeHadMatch = true;
                    if (found > cursor) {
                        fragment.appendChild(document.createTextNode(text.slice(cursor, found)));
                    }
                    const markNode = document.createElement('mark');
                    markNode.className = 'search-hit';
                    markNode.textContent = text.slice(found, found + pattern.length);
                    fragment.appendChild(markNode);
                    searchMarks.push(markNode);
                    cursor = found + pattern.length;
                    found = lower.indexOf(needle, cursor);
                }
                if (nodeHadMatch) {
                    if (cursor < text.length) {
                        fragment.appendChild(document.createTextNode(text.slice(cursor)));
                    }
                    node.parentNode.replaceChild(fragment, node);
                }
            });
        };

        const gotoMatch = (index) => {
            if (!searchMarks.length) return null;
            const wrapped = (index + searchMarks.length) % searchMarks.length;
            searchCurrent = wrapped;
            searchMarks.forEach((markNode) => markNode.classList.remove('current'));
            const markNode = searchMarks[wrapped];
            markNode.classList.add('current');
            // Reveal the hit even if it sits in a collapsed abstract or an
            // unrevealed section
            const details = markNode.closest('details');
            if (details && !details.open) details.open = true;
            const section = markNode.closest('section');
            if (section) section.classList.add('reveal-visible');
            scrollToY(markNode.getBoundingClientRect().top + window.scrollY - window.innerHeight / 2);
            return `${wrapped + 1}/${searchMarks.length}`;
        };

        const runSearch = (rawPattern) => {
            const pattern = rawPattern || lastPattern;
            if (!pattern) return;
            lastPattern = pattern;
            performSearch(pattern);
            if (!searchMarks.length) {
                flashStatus(`E486: pattern not found: ${pattern}`, true);
                return;
            }
            flashStatus(gotoMatch(0) || '');
        };

        const stepSearch = (direction) => {
            if (!searchMarks.length) {
                if (lastPattern) {
                    runSearch('');
                } else {
                    flashStatus('E35: no previous search pattern', true);
                }
                return;
            }
            flashStatus(gotoMatch(searchCurrent + direction) || '');
        };

        // Flash the target panel when arriving via a URL hash (e.g. /index.html#papers)
        if (window.location.hash) {
            const hashed = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
            if (hashed && hashed.tagName === 'SECTION') flashSection(hashed);
        }

        // 9. Blog post enhancements: Prime Intellect-style annotated trace
        //    walkthroughs + copy buttons on code blocks. Authors tag fenced
        //    code blocks with a kramdown IAL ({:.tool-call} on the line after
        //    the fence); JS wraps them in collapsible <details> panels with a
        //    typed label and a running step number. Everything degrades to a
        //    normal code block without JS.
        const postContent = document.querySelector('.post-content');
        if (postContent) {
            const TRACE_TYPES = {
                'tool-call': { label: 'tool call', open: true, numbered: true },
                'tool-output': { label: 'tool output', open: true, numbered: true },
                'annotation': { label: 'annotation', open: true, numbered: true },
                'reasoning': { label: 'reasoning', open: false, numbered: true },
                'bibtex': { label: 'bibtex', open: true, numbered: false }
            };

            const traceTypeOf = (element) => {
                if (!element || !element.classList) return null;
                for (const type of Object.keys(TRACE_TYPES)) {
                    if (element.classList.contains(type)) return type;
                }
                return null;
            };

            let traceStep = 0;

            // Collect code blocks and prose annotation paragraphs, then process
            // them in document order so step numbers interleave correctly
            const traceItems = [];
            postContent.querySelectorAll('pre').forEach((pre) => {
                // kramdown lands IAL classes on the block, its parent wrapper
                // (div.language-x.highlighter-rouge), or the grandparent —
                // probe all three so the convention survives renderer changes.
                const type = traceTypeOf(pre)
                    || traceTypeOf(pre.parentElement)
                    || traceTypeOf(pre.parentElement && pre.parentElement.parentElement);
                traceItems.push({ element: pre, type, isCode: true });
            });
            postContent.querySelectorAll('.post-content > .annotation, .post-content .annotation').forEach((block) => {
                traceItems.push({ element: block, type: 'annotation', isCode: false });
            });
            traceItems.sort((a, b) => (
                a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
            ));

            traceItems.forEach(({ element, type, isCode }) => {
                // Copy affordance: wrap every code block so the button can
                // overlay it without polluting the copied text
                let wrap;
                if (isCode) {
                    wrap = document.createElement('div');
                    wrap.className = 'code-block';
                    element.replaceWith(wrap);
                    wrap.appendChild(element);

                    const copyBtn = document.createElement('button');
                    copyBtn.type = 'button';
                    copyBtn.className = 'code-copy';
                    copyBtn.textContent = '[copy]';
                    copyBtn.setAttribute('aria-label', 'Copy code to clipboard');
                    copyBtn.addEventListener('click', () => {
                        const text = element.innerText;
                        const done = () => {
                            copyBtn.textContent = '[copied]';
                            copyBtn.classList.add('copied');
                            announce('code block copied to clipboard');
                            window.setTimeout(() => {
                                copyBtn.textContent = '[copy]';
                                copyBtn.classList.remove('copied');
                            }, 1600);
                        };
                        if (navigator.clipboard && navigator.clipboard.writeText) {
                            navigator.clipboard.writeText(text).then(done, () => {
                                copyBtn.textContent = '[failed]';
                                copyBtn.classList.add('err');
                                window.setTimeout(() => {
                                    copyBtn.textContent = '[copy]';
                                    copyBtn.classList.remove('err');
                                }, 1600);
                            });
                        }
                    });
                    wrap.appendChild(copyBtn);
                } else {
                    wrap = element;
                }

                if (!type) return;
                const config = TRACE_TYPES[type];
                const details = document.createElement('details');
                details.className = `trace-block tb-${type}`;
                if (config.open) details.open = true;

                const summary = document.createElement('summary');
                if (config.numbered) {
                    traceStep += 1;
                    const stepSpan = document.createElement('span');
                    stepSpan.className = 'trace-step';
                    stepSpan.textContent = `step ${traceStep}`;
                    summary.appendChild(stepSpan);
                }
                const labelSpan = document.createElement('span');
                labelSpan.className = 'trace-label';
                labelSpan.textContent = config.label;
                summary.appendChild(labelSpan);

                wrap.replaceWith(details);
                details.append(summary, wrap);
            });
        }
    } catch (error) {
        console.error('Error initializing site scripts:', error);
    }
});
