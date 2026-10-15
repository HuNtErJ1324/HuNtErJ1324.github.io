document.addEventListener('DOMContentLoaded', () => {
    try {
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        // Clipboard: the async API where available, else (or if it is refused)
        // the legacy execCommand route through an off-screen textarea
        const copyWithTextarea = (text) => {
            const previousFocus = document.activeElement;
            const helper = document.createElement('textarea');
            helper.value = text;
            helper.setAttribute('readonly', '');
            helper.className = 'visually-hidden';
            // Pinned to the viewport so focusing it never scrolls the page
            helper.style.position = 'fixed';
            helper.style.top = '0';
            document.body.appendChild(helper);
            helper.focus({ preventScroll: true });
            helper.select();
            const copied = document.execCommand('copy');
            helper.remove();
            if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
            if (!copied) throw new Error('copy command failed');
        };

        const copyText = (text) => {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                return navigator.clipboard.writeText(text).catch(() => copyWithTextarea(text));
            }
            return new Promise((resolve) => {
                copyWithTextarea(text);
                resolve();
            });
        };

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

        // 2. Scroll Reveal Animation for the page's panels (not sections nested
        //    in post content, such as footnotes, and not the comments panel,
        //    whose giscus iframe should never sit invisible)
        const revealElements = document.querySelectorAll('main > section:not(.post-comments)');

        if (revealElements.length > 0 && 'IntersectionObserver' in window) {
            const revealObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('reveal-visible');
                        revealObserver.unobserve(entry.target);
                    }
                });
            }, {
                // Reveal once a panel's top clears the bottom 10% of the viewport.
                // A margin rather than a visibility ratio, so panels taller than
                // the screen still reveal.
                rootMargin: '0px 0px -10% 0px'
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

        // 3. Lite YouTube Embeds (privacy-enhanced, loaded on click)
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

                    const origin = encodeURIComponent(window.location.origin);
                    const videoTitle = target.dataset.videoTitle;
                    iframe.setAttribute('src', `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&origin=${origin}`);
                    iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
                    iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
                    iframe.setAttribute('allowfullscreen', '');
                    iframe.setAttribute('title', videoTitle ? `YouTube video player: ${videoTitle}` : 'YouTube video player');
                    iframe.classList.add('youtube-video');

                    const parent = target.parentElement;
                    if (parent) {
                        parent.replaceChildren(iframe);
                        // The play button is gone; keep keyboard focus on the player
                        iframe.focus();
                    }
                } catch (error) {
                    console.error('Error loading YouTube video:', error);
                }
            });
        });

        // 3b. Lite X embeds (privacy-enhanced, loaded on click)
        // Authoring stays plain markdown — put a normal post link such as
        // https://x.com/user/status/123... (or [my post](...)) in a paragraph
        // of its own and JS upgrades it into a click-to-load placeholder.
        // Links inside a sentence stay links. Without JS it remains a link.
        // No widgets.js: click swaps in a platform.twitter.com iframe, so no
        // third-party JS runs until the reader consents.
        const postScope = document.querySelector('.post-content');
        if (postScope) {
            const X_HOSTS = new Set(['x.com', 'www.x.com', 'mobile.x.com', 'twitter.com', 'www.twitter.com', 'mobile.twitter.com']);

            const tweetIdOf = (link) => {
                let url;
                try {
                    url = new URL(link.href);
                } catch (error) {
                    return null;
                }
                if (!X_HOSTS.has(url.hostname)) return null;
                const match = url.pathname.match(/\/status\/(\d{2,25})(?:\/|$)/);
                return match ? match[1] : null;
            };

            // The paragraph the link stands alone in, if any
            const ownParagraph = (link) => {
                const parent = link.parentElement;
                if (!parent || parent.tagName !== 'P') return null;
                const alone = Array.from(parent.childNodes).every((node) => (
                    node === link || (node.nodeType === Node.TEXT_NODE && !node.textContent.trim())
                ));
                return alone ? parent : null;
            };

            postScope.querySelectorAll('a[href]').forEach((link) => {
                try {
                    if (link.closest('.x-container')) return;
                    const tweetId = tweetIdOf(link);
                    const paragraph = tweetId ? ownParagraph(link) : null;
                    if (!paragraph) return;
                    const href = link.getAttribute('href');

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
                    paragraph.replaceWith(container);
                } catch (error) {
                    console.error('Error enhancing X link:', error);
                }
            });
        }

        // 4. Back to Top button + statusline scroll position (vim style)
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

            // Late layout growth (the giscus iframe resizes itself) fires no scroll event
            if ('ResizeObserver' in window) {
                new ResizeObserver(() => requestAnimationFrame(updateScrollUi)).observe(document.body);
            }

            if (backToTopButton) {
                backToTopButton.addEventListener('click', () => {
                    window.scrollTo({
                        top: 0,
                        behavior: prefersReducedMotion ? 'auto' : 'smooth'
                    });
                });
            }
        }

        // 5. Vim-style keyboard navigation (hjkl + friends)
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
            // Time-based ease out (~18% of remaining distance per 60fps frame,
            // normalized by dt so it feels the same at any refresh rate)
            const factor = 1 - Math.pow(0.82, dt / 16.67);
            const step = diff * factor;
            // Snap once a step drops below a pixel: sub-pixel steps round back to
            // the same scroll offset and would otherwise loop forever
            if (Math.abs(diff) < 1 || Math.abs(step) < 1) {
                window.scrollTo({ top: scrollTarget, behavior: 'instant' });
                scrollTarget = null;
                scrollAnimating = false;
                lastFrameTime = null;
                return;
            }
            window.scrollTo({ top: current + step, behavior: 'instant' });
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
            if (path.startsWith('/blog')) return 2;
            if (path.startsWith('/music')) return 1;
            if (path === '/' || path === '/index.html') return 0;
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

            // {x} marks a key cap; everything else is plain text
            const rows = [
                ['{j} / {k}', 'scroll down / up'],
                ['{d} / {u}', 'half page down / up'],
                ['{g}{g} / {G}', 'top / bottom'],
                ['{h} / {l}', 'previous / next page'],
                ['{/} · {n} / {N}', 'search · next / prev hit'],
                ['{:}', 'command mode'],
                ['{:}{email}', 'copy email address'],
                ['{?}', 'toggle this help'],
                ['{Esc}', 'close']
            ];

            const panel = document.createElement('div');
            panel.className = 'key-help-panel';
            panel.setAttribute('tabindex', '-1');

            const title = document.createElement('p');
            title.className = 'key-help-title';
            title.textContent = 'help keys.txt';
            panel.appendChild(title);

            rows.forEach(([keys, desc]) => {
                const row = document.createElement('div');
                row.className = 'key-row';
                const keysCell = document.createElement('span');
                keysCell.className = 'keys';
                keys.split(/(\{[^}]+\})/).filter(Boolean).forEach((part) => {
                    if (/^\{[^}]+\}$/.test(part)) {
                        const kbd = document.createElement('kbd');
                        kbd.textContent = part.slice(1, -1);
                        keysCell.appendChild(kbd);
                    } else {
                        keysCell.appendChild(document.createTextNode(part));
                    }
                });
                const descCell = document.createElement('span');
                descCell.className = 'key-desc';
                descCell.textContent = desc;
                row.append(keysCell, descCell);
                panel.appendChild(row);
            });

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
            if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;

            const target = e.target;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return;

            if (helpIsOpen()) {
                if (e.key === 'Escape' || e.key === '?' || e.key === 'q') {
                    e.preventDefault();
                    toggleHelp(false);
                } else if (e.key === 'Tab') {
                    // Modal dialog: keep focus on the panel
                    e.preventDefault();
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

        // 6. Vim command mode (:) — an ex-style command line docked above the
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

        // Search state (vim /, n, N, :noh)
        let searchMarks = [];
        let searchCurrent = -1;
        let lastPattern = '';
        const SEARCH_SKIP_SELECTOR = 'nav, .statusline, .cmdline, .key-help, script, style, template, noscript, button, svg, mjx-container, .visually-hidden';

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
            clearTimeout(showcmdTimer);
            showcmd.textContent = text;
            showcmd.classList.add('flash-msg');
            showcmd.classList.toggle('err', Boolean(isError));
            announce(text);
            showcmdTimer = setTimeout(() => {
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

        // Document offset from layout, so a panel's pending reveal transform
        // (translateY) doesn't skew the jump
        const pageTop = (el) => {
            let top = 0;
            for (let node = el; node; node = node.offsetParent) top += node.offsetTop;
            return top;
        };

        const scrollToSection = (id) => {
            const el = document.getElementById(id);
            if (!el) return false;
            scrollToY(pageTop(el) - 80);
            flashSection(el);
            return true;
        };

        const copyContactEmail = () => {
            copyText(CONTACT_EMAIL).then(
                () => flashStatus(`copied: ${CONTACT_EMAIL}`, false),
                () => flashStatus('copy failed — clipboard unavailable', true)
            );
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
            cv: () => {
                window.open('/assets/justin_chae_cv.pdf', '_blank', 'noopener');
                return 'opening cv ...';
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
            if (commandHistory[commandHistory.length - 1] !== text) commandHistory.push(text);
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
            // Clicks on the bar's prompt/hint keep focus in the input
            cmdline.addEventListener('mousedown', (e) => {
                if (e.target !== cmdlineInput) {
                    e.preventDefault();
                    cmdlineInput.focus();
                }
            });
            // Clicking elsewhere on the page leaves command mode (switching
            // windows does not)
            cmdlineInput.addEventListener('blur', () => {
                if (document.hasFocus()) closeCommandLine();
            });
            cmdlineInput.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    closeCommandLine();
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    // Like vim, Enter runs the line and returns to normal mode
                    const value = cmdlineInput.value;
                    const mode = cmdlineMode;
                    closeCommandLine();
                    if (mode === 'search') {
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
            historyIndex = commandHistory.length;
            cmdline.hidden = false;
            if (modeBlock) modeBlock.textContent = isSearch ? 'SEARCH' : 'CMD';
            cmdlineInput.focus();
        }

        function closeCommandLine() {
            if (!cmdline || cmdline.hidden) return;
            cmdline.hidden = true;
            // Hand focus back now: browsers only move it off a hidden element on
            // the next frame, and keys pressed before then would be swallowed
            if (document.activeElement === cmdlineInput) cmdlineInput.blur();
            cmdlineInput.value = '';
            if (modeBlock) modeBlock.textContent = baseMode();
        }

        // 7. Vim-style search (/) — case-insensitive substring search over the
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
            let hashId = window.location.hash.slice(1);
            try {
                hashId = decodeURIComponent(hashId);
            } catch (error) {
                // Malformed escape: look the raw fragment up instead
            }
            const hashed = document.getElementById(hashId);
            if (hashed && hashed.tagName === 'SECTION') flashSection(hashed);
        }

        // 8. Blog post enhancements: Prime Intellect-style annotated trace
        //    walkthroughs + copy buttons on code blocks. Authors wrap code or
        //    prose in :::tool-call / :::tool-output / ... containers
        //    (remarkTraceDirectives puts the class on the wrapper); JS wraps
        //    each container in a collapsible <details> panel with a typed label
        //    and a running step number. Everything degrades to normal code
        //    blocks and paragraphs without JS.
        const postContent = document.querySelector('.post-content');
        if (postContent) {
            const TRACE_TYPES = {
                'tool-call': { label: 'tool call', open: true, numbered: true },
                'tool-output': { label: 'tool output', open: true, numbered: true },
                'annotation': { label: 'annotation', open: true, numbered: true },
                'reasoning': { label: 'reasoning', open: false, numbered: true },
                'bibtex': { label: 'bibtex', open: true, numbered: false }
            };

            const traceTypeOf = (element) => (
                Object.keys(TRACE_TYPES).find((type) => element.classList.contains(type)) || null
            );

            // Copy affordance: wrap every code block so the button can overlay
            // it without polluting the copied text
            postContent.querySelectorAll('pre').forEach((pre) => {
                const wrap = document.createElement('div');
                wrap.className = 'code-block';
                pre.replaceWith(wrap);
                wrap.appendChild(pre);

                const copyBtn = document.createElement('button');
                copyBtn.type = 'button';
                copyBtn.className = 'code-copy';
                copyBtn.textContent = '[copy]';
                copyBtn.setAttribute('aria-label', 'Copy code to clipboard');

                let resetTimer = null;
                const showResult = (label, className) => {
                    clearTimeout(resetTimer);
                    copyBtn.textContent = label;
                    copyBtn.classList.remove('copied', 'err');
                    copyBtn.classList.add(className);
                    resetTimer = window.setTimeout(() => {
                        copyBtn.textContent = '[copy]';
                        copyBtn.classList.remove(className);
                    }, 1600);
                };

                copyBtn.addEventListener('click', () => {
                    copyText(pre.innerText).then(() => {
                        showResult('[copied]', 'copied');
                        announce('code block copied to clipboard');
                    }, () => {
                        showResult('[failed]', 'err');
                        announce('copy failed');
                    });
                });
                wrap.appendChild(copyBtn);
            });

            // Panels in document order, so step numbers interleave correctly
            // across code and prose
            let traceStep = 0;
            const containers = Object.keys(TRACE_TYPES).map((type) => `.${type}`).join(', ');
            postContent.querySelectorAll(containers).forEach((container) => {
                const type = traceTypeOf(container);
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

                // A lone code block sits flush in the panel; anything else
                // (prose, or prose mixed with code) gets padded like a well
                const onlyCode = container.children.length === 1
                    && container.firstElementChild.classList.contains('code-block');
                if (!onlyCode) container.classList.add('trace-prose');

                container.replaceWith(details);
                details.append(summary, container);
            });
        }

        // 9. Comments (giscus): inject giscus's client script once the comments
        //    panel nears the viewport, so readers who never scroll that far make
        //    no third-party requests. Config lives in data-* on .giscus
        //    (Post.astro); client.js renders its iframe into that element.
        const giscusMount = document.querySelector('.post-comments .giscus');
        if (giscusMount) {
            const loadGiscus = () => {
                const script = document.createElement('script');
                script.src = 'https://giscus.app/client.js';
                script.async = true;
                script.crossOrigin = 'anonymous';
                // client.js reads its config from its own <script> element
                Object.assign(script.dataset, giscusMount.dataset);
                giscusMount.after(script);
            };

            // Back from giscus's GitHub sign-in (?giscus=<session>): load right away so
            // client.js stores the session and strips it from the address bar
            const returningFromSignIn = new URLSearchParams(window.location.search).has('giscus');
            if (returningFromSignIn && 'ResizeObserver' in window) {
                // The #giscus-thread anchor is reached while the mount is still empty;
                // once giscus sizes its iframe, bring the panel into view (unless the
                // reader has already started scrolling)
                let readerScrolled = false;
                ['wheel', 'touchstart', 'keydown'].forEach((eventName) => {
                    window.addEventListener(eventName, () => {
                        readerScrolled = true;
                    }, { once: true, passive: true });
                });
                const returnObserver = new ResizeObserver(() => {
                    if (giscusMount.offsetHeight === 0) return;
                    returnObserver.disconnect();
                    if (!readerScrolled) giscusMount.closest('section').scrollIntoView({ block: 'start' });
                });
                returnObserver.observe(giscusMount);
            }
            if (!returningFromSignIn && 'IntersectionObserver' in window) {
                const giscusObserver = new IntersectionObserver((entries) => {
                    if (entries.some((entry) => entry.isIntersecting)) {
                        giscusObserver.disconnect();
                        loadGiscus();
                    }
                }, { rootMargin: '600px 0px' });
                giscusObserver.observe(giscusMount);
            } else {
                loadGiscus();
            }
        }

        // 10. 404 page: echo the path that was actually requested
        const errPath = document.querySelector('.error-page .err-path');
        if (errPath) {
            let requested = window.location.pathname;
            try {
                requested = decodeURIComponent(requested);
            } catch (error) {
                // Malformed escape: show the raw path
            }
            errPath.textContent = requested;
        }
    } catch (error) {
        console.error('Error initializing site scripts:', error);
    }
});
