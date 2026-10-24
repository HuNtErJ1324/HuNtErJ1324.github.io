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
        //    whose comment widget should never sit invisible)
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
                    // Keep plain: links in static post cards (Tweet.astro) and in footnotes,
                    // where an X post is cited as a reference rather than embedded
                    if (link.closest('.x-container, .tweet-card, section[data-footnotes]')) return;
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

            // Late layout growth (the comment thread loading in) fires no scroll event
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
        const PAGE_ORDER = ['/', '/music/', '/blog/', '/tools/'];

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
            if (path.startsWith('/tools')) return 3;
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
        const SECTION_IDS = ['about', 'education', 'papers', 'projects', 'achievements', 'service'];

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
            service: () => goToSection('service'),
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
            tools: () => {
                window.location.href = '/tools/';
                return 'opening ~/tools ...';
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

        // 9. Comments (self-hosted Comentario): load the widget's script from the
        //    comment server once the panel nears the viewport, so readers who
        //    never scroll that far make no requests to it. Defining the
        //    <comentario-comments> element (Post.astro) renders the thread into it.
        const commentsMount = document.querySelector('.post-comments comentario-comments[data-src]');
        if (commentsMount) {
            const loadComments = () => {
                const script = document.createElement('script');
                script.src = commentsMount.dataset.src;
                script.async = true;
                // The server lives at home: say so when it can't be reached
                script.addEventListener('error', () => {
                    const note = document.createElement('p');
                    note.className = 'comments-fallback comments-down';
                    note.textContent = 'Comments are unavailable right now. Please try again later.';
                    commentsMount.after(note);
                });
                document.head.append(script);
            };

            // A link to one comment (#comentario-<id>) needs the thread right away
            const linkedComment = window.location.hash.startsWith('#comentario-');
            if (!linkedComment && 'IntersectionObserver' in window) {
                const commentsObserver = new IntersectionObserver((entries) => {
                    if (entries.some((entry) => entry.isIntersecting)) {
                        commentsObserver.disconnect();
                        loadComments();
                    }
                }, { rootMargin: '600px 0px' });
                commentsObserver.observe(commentsMount);
            } else {
                loadComments();
            }

            // 9b. Math in comments: readers write $$…$$ as in posts, inline in a
            //     sentence, display when it fills a paragraph. Comentario renders
            //     comments as Markdown on its server, which drops the backslash
            //     before punctuation (\{ \, \\ become { , \) and turns *…* into
            //     emphasis, so the TeX comes from each comment's own Markdown:
            //     fetched from the API the widget uses, or for the editor's
            //     preview, read from its text box. The rendered text is the
            //     fallback (a reader's own pending comment isn't in that list).
            //     TeX only ever goes in as textContent; MathJax (the posts'
            //     bundle, loaded the first time a comment has math) draws it.
            const MATH = /\$\$([\s\S]+?)\$\$/g;
            const commentsApi = `${new URL(commentsMount.dataset.src).origin}/api/embed/comments`;
            const markdownById = new Map();
            let markdownLoaded = null;
            let markdownFetchedAt = 0;

            const fetchMarkdown = () => {
                markdownFetchedAt = Date.now();
                markdownLoaded = fetch(commentsApi, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ host: window.location.host, path: commentsMount.getAttribute('page-id') })
                })
                    .then((response) => (response.ok ? response.json() : {}))
                    .then((data) => (data.comments || []).forEach((c) => markdownById.set(c.id, c.markdown || '')))
                    .catch(() => {});
                return markdownLoaded;
            };

            // The $$…$$ spans in Markdown, in order, skipping code (where $$ is literal)
            const sourceMath = (markdown) => [...markdown
                .replace(/^(```|~~~)[\s\S]*?^\1/gm, ' ')
                .replace(/(`+)[\s\S]*?\1/g, ' ')
                .matchAll(MATH)].map((match) => match[1]);

            // Replaces each $$…$$ in a rendered comment with a span holding its
            // TeX in MathJax's delimiters, and returns the spans. `tex` (from the
            // Markdown) wins when it lists the same number of spans.
            const markMath = (container, tex) => {
                const blocks = new Map();
                const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
                    acceptNode: (node) => (node.parentElement.closest('code, pre, .math-inline, .math-display')
                        ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT)
                });
                for (let node = walker.nextNode(); node; node = walker.nextNode()) {
                    const block = node.parentElement.closest('p, li, td, th, h1, h2, h3, h4, h5, h6') || container;
                    if (!blocks.has(block)) blocks.set(block, []);
                    blocks.get(block).push(node);
                }

                // Matches can span elements (<br>, or <em> where Markdown found *…*)
                const found = [];
                blocks.forEach((nodes) => {
                    let text = '';
                    const starts = nodes.map((node) => {
                        const start = text.length;
                        text += node.data;
                        return start;
                    });
                    const at = (offset) => {
                        let i = starts.length - 1;
                        while (i > 0 && starts[i] > offset) i--;
                        return [nodes[i], offset - starts[i]];
                    };
                    for (const match of text.matchAll(MATH)) {
                        found.push({
                            start: at(match.index),
                            end: at(match.index + match[0].length),
                            rendered: match[1],
                            display: text.trim() === match[0]
                        });
                    }
                });

                const fromSource = Array.isArray(tex) && tex.length === found.length;
                const spans = [];
                // Last first, so earlier offsets stay valid
                for (let i = found.length - 1; i >= 0; i--) {
                    const { start, end, rendered, display } = found[i];
                    const math = (fromSource ? tex[i] : rendered).trim();
                    const span = document.createElement('span');
                    span.className = display ? 'math-display' : 'math-inline';
                    span.textContent = display ? `\\[${math}\\]` : `\\(${math}\\)`;
                    const range = document.createRange();
                    range.setStart(...start);
                    range.setEnd(...end);
                    range.deleteContents();
                    range.insertNode(span);
                    spans.push(span);
                }
                return spans;
            };

            // Posts with math already load MathJax; elsewhere load the same
            // config and bundle, and typeset only what's asked for
            let mathJaxReady = null;
            const loadMathJax = () => {
                if (!mathJaxReady) {
                    const addScript = (src) => new Promise((resolve, reject) => {
                        const script = document.createElement('script');
                        script.src = src;
                        script.addEventListener('load', resolve);
                        script.addEventListener('error', reject);
                        document.head.append(script);
                    });
                    const postMathJax = document.getElementById('MathJax-script');
                    mathJaxReady = new Promise((resolve, reject) => {
                        if (window.MathJax && window.MathJax.startup && window.MathJax.startup.promise) {
                            resolve();
                        } else if (postMathJax) {
                            postMathJax.addEventListener('load', resolve);
                            postMathJax.addEventListener('error', reject);
                        } else {
                            addScript('/assets/mathjax-config.js')
                                .then(() => {
                                    window.MathJax.startup = { typeset: false };
                                    return addScript('/assets/mathjax/tex-svg.js');
                                })
                                .then(resolve, reject);
                        }
                    }).then(() => window.MathJax.startup.promise);
                }
                return mathJaxReady;
            };

            // MathJax wants one typeset at a time
            let typesetQueue = Promise.resolve();
            const typeset = (spans) => {
                typesetQueue = typesetQueue
                    .then(loadMathJax)
                    .then(() => window.MathJax.typesetPromise(spans))
                    .catch(() => {});
            };

            const commentId = (body) => {
                const link = body.parentElement.querySelector('.comentario-subtitle a[href^="#comentario-"]');
                return link ? link.getAttribute('href').slice('#comentario-'.length) : null;
            };

            let mathRunning = false;
            let mathAgain = false;
            const renderCommentMath = async () => {
                if (mathRunning) {
                    mathAgain = true;
                    return;
                }
                mathRunning = true;
                try {
                    const hasMath = (el) => el.textContent.includes('$$');
                    const bodies = [...commentsMount.querySelectorAll('.comentario-card-body')].filter(hasMath);
                    const previews = [...commentsMount.querySelectorAll('.comentario-comment-editor-preview')].filter(hasMath);
                    const spans = [];
                    if (bodies.length) {
                        // A comment newer than the list we have: fetch it again (at most every 10s)
                        const unknown = bodies.some((body) => !markdownById.has(commentId(body)));
                        await (unknown && Date.now() - markdownFetchedAt > 10000 ? fetchMarkdown() : markdownLoaded || fetchMarkdown());
                        bodies.forEach((body) => {
                            const markdown = markdownById.get(commentId(body));
                            spans.push(...markMath(body, markdown === undefined ? null : sourceMath(markdown)));
                        });
                    }
                    previews.forEach((preview) => {
                        const textarea = preview.parentElement.querySelector('textarea');
                        spans.push(...markMath(preview, textarea ? sourceMath(textarea.value) : null));
                    });
                    if (spans.length) typeset(spans);
                } finally {
                    mathRunning = false;
                }
                if (mathAgain) {
                    mathAgain = false;
                    renderCommentMath();
                }
            };

            // Comentario's sign-in dialog opens when a signed-out reader presses
            // "Add Comment"; home.css puts its no-account form first while a
            // comment is being written, so start the cursor in its name field.
            // Once faded in, the dialog focuses its close button unless focus is
            // already inside, and the login form then focuses its email field;
            // hand that back too.
            const seenDialogs = new WeakSet();
            const focusNameField = () => {
                const dialog = commentsMount.querySelector('.comentario-dialog');
                if (!dialog || seenDialogs.has(dialog) || !commentsMount.querySelector('.comentario-comment-editor')) return;
                const name = dialog.querySelector('#comentario-unregistered-name');
                if (!name) return;
                seenDialogs.add(dialog);
                name.focus({ preventScroll: true });
                const email = dialog.querySelector('#comentario-login-email');
                if (email) email.addEventListener('focus', () => name.focus({ preventScroll: true }), { once: true });
            };

            // New comments, live updates, edits and previews all arrive as DOM changes
            let commentsChanged = false;
            new MutationObserver(() => {
                focusNameField();
                if (commentsChanged) return;
                commentsChanged = true;
                requestAnimationFrame(() => {
                    commentsChanged = false;
                    renderCommentMath();
                });
            }).observe(commentsMount, { childList: true, subtree: true, characterData: true });
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

        // 11. Blog charts: crosshair + tooltip over the static SVG line charts
        //     (src/components/blog/LineChart.astro). Each SVG's data-chart
        //     payload already holds pixel positions and formatted values, so this
        //     only finds the nearest point and writes text (textContent, never
        //     markup). Full-width charts carry two SVGs (wide + compact, CSS shows
        //     one); each binds its own handlers. Focus a chart and use ←/→ to step
        //     through points; Esc hides the readout. Without JS the static chart remains.
        document.querySelectorAll('.post-content .chart .chart-svg[data-chart]').forEach((svg) => {
            const figure = svg.closest('.chart');
            const hover = svg.querySelector('.chart-hover');
            let spec;
            try {
                spec = JSON.parse(svg.dataset.chart);
            } catch (error) {
                return;
            }
            if (!hover || !spec.series || !spec.series.length) return;

            const cross = hover.querySelector('.chart-cross');
            const dots = [...hover.querySelectorAll('.chart-dot')];
            const xs = [...new Set(spec.series.flatMap((s) => s.pts.map((p) => p[0])))].sort((a, b) => a - b);
            const tip = document.createElement('div');
            tip.className = 'chart-tip';
            tip.hidden = true;
            figure.appendChild(tip);
            let index = -1;

            const nearestPoint = (pts, x) => pts.reduce((best, p) => (
                !best || Math.abs(p[0] - x) < Math.abs(best[0] - x) ? p : best
            ), null);

            const show = (i) => {
                index = Math.max(0, Math.min(xs.length - 1, i));
                const x = xs[index];
                // A series only reports a value if it has a point at this x
                // (charts can mix series sampled on different grids)
                const tolerance = 0.6;
                cross.setAttribute('x1', x);
                cross.setAttribute('x2', x);
                const rows = [];
                let xText = '';
                spec.series.forEach((s, si) => {
                    const p = nearestPoint(s.pts, x);
                    const hit = p && Math.abs(p[0] - x) <= tolerance;
                    const dot = dots[si];
                    if (dot) {
                        dot.setAttribute('cx', hit ? p[0] : -10);
                        dot.setAttribute('cy', hit ? p[1] : -10);
                    }
                    if (!hit) return;
                    xText = p[2];
                    const row = document.createElement('div');
                    row.className = 'chart-tip-row';
                    const key = document.createElement('span');
                    key.className = `chart-key key-line c-${s.color}`;
                    const value = document.createElement('strong');
                    value.textContent = p[3];
                    const name = document.createElement('span');
                    name.textContent = s.name;
                    row.append(key, value, name);
                    rows.push(row);
                });
                const head = document.createElement('div');
                head.className = 'chart-tip-x';
                head.textContent = `${spec.x} ${xText}`.trim();
                tip.replaceChildren(head, ...rows);
                tip.hidden = false;
                figure.classList.add('is-active');

                // Place the readout beside the crosshair, flipping left near the edge
                const svgBox = svg.getBoundingClientRect();
                const figureBox = figure.getBoundingClientRect();
                const px = svgBox.left - figureBox.left + (x / svg.viewBox.baseVal.width) * svgBox.width;
                const tipWidth = tip.offsetWidth;
                const right = px + 14;
                tip.style.left = `${right + tipWidth > figureBox.width ? Math.max(0, px - 14 - tipWidth) : right}px`;
                tip.style.top = `${svgBox.top - figureBox.top + 6}px`;
            };

            const hide = () => {
                tip.hidden = true;
                figure.classList.remove('is-active');
            };

            const indexAt = (clientX) => {
                const local = new DOMPoint(clientX, 0).matrixTransform(svg.getScreenCTM().inverse());
                let best = 0;
                xs.forEach((x, i) => {
                    if (Math.abs(x - local.x) < Math.abs(xs[best] - local.x)) best = i;
                });
                return best;
            };

            svg.setAttribute('tabindex', '0');
            svg.addEventListener('pointermove', (event) => show(indexAt(event.clientX)));
            svg.addEventListener('pointerdown', (event) => show(indexAt(event.clientX)));
            svg.addEventListener('pointerleave', hide);
            svg.addEventListener('focus', () => show(index < 0 ? xs.length - 1 : index));
            svg.addEventListener('blur', hide);
            svg.addEventListener('keydown', (event) => {
                if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                    event.preventDefault();
                    show(index + (event.key === 'ArrowRight' ? 1 : -1));
                } else if (event.key === 'Escape') {
                    hide();
                }
            });
        });

        // 12. Clock-driven blog animations: the self-play diagram
        //     (src/components/blog/SelfPlayAnimation.astro), the PretrainGym
        //     rollout diagram (PretrainGymLoop.astro), agent replays
        //     (AgentReplay.astro) and the terminal replay that opens the
        //     PretrainGym post (TerminalHook.astro), all marked .sp-anim.
        //     The markup already draws the whole round, so without JS or under
        //     prefers-reduced-motion nothing runs. Otherwise one clock loops over
        //     data-cycle seconds and every element follows its own times:
        //     data-on/data-off (shown), data-active="start end" (highlighted),
        //     data-travel + data-route (a packet moving along an edge's points)
        //     and data-type="start end" (text typed out in order, so wrapped
        //     lines fill one after another; .is-typing while it runs).
        //     Pause and restart only move the clock. Plays while on screen.
        //     A [data-sp="speed"] button (the replays) steps the playback
        //     speed through 0.5×, 1×, 2× and 4×; only the clock's pace changes.
        //     A .sp-scrub range input (the replays) lets readers drag the clock;
        //     with one, reduced motion still gets the figure, parked at its end
        //     state and moved only by the reader, never autoplayed.
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        document.querySelectorAll('.post-content .sp-anim').forEach((figure) => {
            const controls = figure.querySelector('.sp-controls');
            if (!controls) return;
            const scrub = controls.querySelector('.sp-scrub');
            if (reduceMotion.matches && !scrub) return;
            const toggle = controls.querySelector('[data-sp="toggle"]');
            const restart = controls.querySelector('[data-sp="restart"]');
            const speedButton = controls.querySelector('[data-sp="speed"]');
            const SPEEDS = [0.5, 1, 2, 4];
            let speed = 1;
            const fill = controls.querySelector('.sp-progress-fill');
            const clock = controls.querySelector('.sp-time');
            const cycle = parseFloat(figure.dataset.cycle) || 18;
            const span = (value) => value.split(' ').map(Number);

            const shown = [...figure.querySelectorAll('[data-on]')].map((el) => ({
                el,
                on: Number(el.dataset.on),
                off: el.dataset.off ? Number(el.dataset.off) : cycle
            }));
            // data-active may list several "start end" pairs
            const active = [...figure.querySelectorAll('[data-active]')].map((el) => {
                const times = span(el.dataset.active);
                const ranges = [];
                for (let i = 0; i + 1 < times.length; i += 2) ranges.push([times[i], times[i + 1]]);
                return { el, ranges };
            });
            const packets = [...figure.querySelectorAll('[data-travel]')].map((el) => {
                const [start, end] = span(el.dataset.travel);
                const coords = span(el.dataset.route);
                const points = [];
                for (let i = 0; i + 1 < coords.length; i += 2) points.push([coords[i], coords[i + 1]]);
                const lengths = points.slice(1).map((p, i) => Math.hypot(p[0] - points[i][0], p[1] - points[i][1]));
                const total = lengths.reduce((a, b) => a + b, 0);
                // data-ease="linear" for a playhead that tracks a time axis
                const linear = el.dataset.ease === 'linear';
                return { el, start, end, points, lengths, total, linear };
            });

            // Typing reveals characters in order (a clip-path wipe would uncover
            // every wrapped line at once); the full text is read once, here
            const typed = [...figure.querySelectorAll('[data-type]')].map((el) => {
                const [start, end] = span(el.dataset.type);
                return { el, start, end, chars: [...el.textContent], count: -1 };
            });

            const easeInOut = (p) => (p < 0.5 ? 2 * p * p : 1 - ((-2 * p + 2) ** 2) / 2);
            const pointAt = (packet, progress) => {
                let distance = progress * packet.total;
                for (let i = 0; i < packet.lengths.length; i += 1) {
                    const length = packet.lengths[i];
                    if (distance <= length || i === packet.lengths.length - 1) {
                        const fraction = length ? Math.min(1, distance / length) : 0;
                        const [x0, y0] = packet.points[i];
                        const [x1, y1] = packet.points[i + 1];
                        return [x0 + (x1 - x0) * fraction, y0 + (y1 - y0) * fraction];
                    }
                    distance -= length;
                }
                return packet.points[0];
            };

            let t = 0;
            let playing = false;
            let userPaused = false;
            let scrubbing = false;
            let resumeAfterScrub = false;
            let last = 0;
            let frame = 0;

            const render = () => {
                shown.forEach(({ el, on, off }) => el.classList.toggle('is-shown', t >= on && t < off));
                active.forEach(({ el, ranges }) => el.classList.toggle('is-active', ranges.some(([start, end]) => t >= start && t < end)));
                packets.forEach((packet) => {
                    const live = t >= packet.start && t < packet.end;
                    packet.el.classList.toggle('is-shown', live);
                    if (!live) return;
                    const progress = (t - packet.start) / (packet.end - packet.start);
                    const [x, y] = pointAt(packet, packet.linear ? progress : easeInOut(progress));
                    packet.el.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
                });
                typed.forEach((item) => {
                    const progress = Math.min(1, Math.max(0, (t - item.start) / (item.end - item.start)));
                    item.el.classList.toggle('is-typing', progress > 0 && progress < 1);
                    const count = Math.round(progress * item.chars.length);
                    if (count === item.count) return;
                    item.count = count;
                    item.el.textContent = item.chars.slice(0, count).join('');
                });
                if (fill) fill.style.transform = `scaleX(${(t / cycle).toFixed(4)})`;
                if (scrub) {
                    if (!scrubbing) scrub.value = t.toFixed(2);
                    scrub.style.setProperty('--p', (t / cycle).toFixed(4));
                }
                if (clock) {
                    // Seconds back to the figure's own units, e.g. turns of a run
                    const { offset, rate, max, unit = 'hour', digits = '1' } = clock.dataset;
                    const value = Math.min(Number(max), Math.max(0, (t - Number(offset)) / Number(rate)));
                    clock.textContent = `${unit} ${value.toFixed(Number(digits))}`;
                    if (scrub) scrub.setAttribute('aria-valuetext', clock.textContent);
                }
            };

            const tick = (now) => {
                // Cap the step so a backgrounded tab resumes where it left off
                t = (t + Math.min(0.1, (now - last) / 1000) * speed) % cycle;
                last = now;
                render();
                frame = requestAnimationFrame(tick);
            };

            const setLabel = () => {
                toggle.textContent = playing ? '[pause]' : '[play]';
                toggle.setAttribute('aria-label', playing ? 'Pause animation' : 'Play animation');
            };
            const play = () => {
                if (playing) return;
                playing = true;
                last = performance.now();
                frame = requestAnimationFrame(tick);
                setLabel();
            };
            const pause = () => {
                playing = false;
                cancelAnimationFrame(frame);
                setLabel();
            };

            toggle.addEventListener('click', () => {
                userPaused = playing;
                if (playing) pause();
                else play();
            });
            restart.addEventListener('click', () => {
                t = 0;
                render();
                userPaused = false;
                play();
            });

            if (speedButton) {
                const setSpeed = (value) => {
                    speed = value;
                    speedButton.textContent = `[speed ${value}×]`;
                    speedButton.setAttribute('aria-label', `Playback speed ${value}×; change speed`);
                };
                speedButton.addEventListener('click', () => {
                    setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]);
                });
                setSpeed(1);
            }

            if (scrub) {
                // Dragging pauses and moves the clock; letting go resumes only if
                // it was playing. The input has step="any" so the thumb glides
                // instead of snapping, which leaves keys to be handled here.
                const beginScrub = () => {
                    if (scrubbing) return;
                    scrubbing = true;
                    resumeAfterScrub = playing;
                    pause();
                    figure.classList.add('sp-scrubbing');
                };
                const seek = (value) => {
                    t = Math.min(Math.max(0, value), cycle - 0.01);
                    render();
                };
                const endScrub = () => {
                    if (!scrubbing) return;
                    scrubbing = false;
                    figure.classList.remove('sp-scrubbing');
                    render();
                    // Dropped at the very end: stay on the finished state rather
                    // than wrapping straight back to the start
                    if (resumeAfterScrub && t < cycle - 0.5) play();
                    else userPaused = true;
                };
                scrub.addEventListener('input', () => {
                    beginScrub();
                    seek(Number(scrub.value));
                });
                scrub.addEventListener('change', endScrub);
                // Arrows step 2% of the loop, Page keys 10%, Home/End jump
                const jumps = { ArrowLeft: -0.02, ArrowDown: -0.02, ArrowRight: 0.02, ArrowUp: 0.02, PageDown: -0.1, PageUp: 0.1 };
                scrub.addEventListener('keydown', (event) => {
                    let target;
                    if (event.key in jumps) target = t + jumps[event.key] * cycle;
                    else if (event.key === 'Home') target = 0;
                    else if (event.key === 'End') target = cycle;
                    else return;
                    event.preventDefault();
                    beginScrub();
                    seek(target);
                    endScrub();
                });
            }

            figure.classList.add('sp-live');
            controls.hidden = false;

            if (reduceMotion.matches) {
                // Scrubbable figure under reduced motion: show the end state
                t = cycle - 0.01;
                render();
                setLabel();
                return;
            }

            render();
            setLabel();

            if ('IntersectionObserver' in window) {
                // Play once a third of the figure is on screen; pause below that
                new IntersectionObserver((entries) => {
                    entries.forEach((entry) => {
                        const visible = entry.isIntersecting && entry.intersectionRatio >= 0.35;
                        if (visible && !userPaused) play();
                        else if (!visible) pause();
                    });
                }, { threshold: [0, 0.35] }).observe(figure);
            } else {
                play();
            }

            // Turning on reduced motion mid-read stops the clock; a figure without
            // a scrubber drops back to its static diagram
            reduceMotion.addEventListener('change', (event) => {
                if (!event.matches) return;
                pause();
                userPaused = true;
                if (scrub) return;
                figure.classList.remove('sp-live');
                controls.hidden = true;
            });
        });

        // 13. Post table of contents (Post.astro, wide screens only): mark the
        // section being read — the last heading above a line a quarter of the
        // way down the view, or the last one once the page bottoms out — and
        // keep its entry in view when the outline scrolls on its own
        const toc = document.querySelector('.post-toc');
        if (toc) {
            const box = toc.querySelector('.toc-inner');
            const nav = document.querySelector('.site-nav');
            const entries = [...toc.querySelectorAll('a[href^="#"]')]
                .map((link) => ({ link, heading: document.getElementById(decodeURIComponent(link.hash.slice(1))) }))
                .filter((entry) => entry.heading);
            let current = null;
            let tocTicking = false;

            const updateToc = () => {
                tocTicking = false;
                // Hidden below its breakpoint: nothing to mark
                if (!box || box.offsetParent === null || entries.length === 0) return;
                const line = (nav ? nav.offsetHeight : 0) + window.innerHeight * 0.25;
                const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
                let next = null;
                entries.forEach((entry) => {
                    if (entry.heading.getBoundingClientRect().top <= line) next = entry;
                });
                if (atBottom && entries[entries.length - 1].heading.getBoundingClientRect().top < window.innerHeight) {
                    next = entries[entries.length - 1];
                }
                if (next === current) return;
                if (current) current.link.removeAttribute('aria-current');
                current = next;
                if (!current) return;
                current.link.setAttribute('aria-current', 'true');
                if (box.scrollHeight > box.clientHeight) {
                    const top = current.link.offsetTop;
                    const bottom = top + current.link.offsetHeight;
                    if (top < box.scrollTop) box.scrollTop = top - 8;
                    else if (bottom > box.scrollTop + box.clientHeight) box.scrollTop = bottom - box.clientHeight + 8;
                }
            };

            const queueToc = () => {
                if (tocTicking) return;
                tocTicking = true;
                requestAnimationFrame(updateToc);
            };
            window.addEventListener('scroll', queueToc, { passive: true });
            window.addEventListener('resize', queueToc);
            updateToc();
        }

        // 14. Trace viewer (src/pages/traces/) and its links to the post.
        // The post ↔ traces row (TraceSwitch.astro): until a post is published
        // its trace pages can't name the shared draft link, so the post records
        // where it was read (this browser only) and the traces' "← blog" link
        // becomes "← the post" back there.
        document.querySelectorAll('.trace-switch[data-trace-post]').forEach((row) => {
            const key = `trace-back:${row.dataset.tracePost}`;
            try {
                if ('traceHome' in row.dataset) {
                    localStorage.setItem(key, location.pathname);
                    return;
                }
                const back = row.querySelector('[data-trace-back]');
                const saved = localStorage.getItem(key);
                if (back && saved && /^\/(blog|drafts)\/[\w-]+\/$/.test(saved)) {
                    back.href = saved;
                    back.textContent = '← the post';
                }
            } catch (error) {
                // Storage blocked (private mode, site data off): it stays "← blog"
            }
        });

        // The toolbar: focus mode hides routine tool calls and environment
        // notices, and the box jumps to a turn. A #turn-N or #e-N link that
        // focus would hide switches back to every step, so links from a post
        // always land.
        const traceLog = document.querySelector('.tv-log');
        const traceBar = document.querySelector('.tv-toolbar');
        if (traceLog && traceBar) {
            traceBar.hidden = false;
            const modeButtons = [...traceBar.querySelectorAll('[data-tv-mode]')];
            const setMode = (mode) => {
                traceLog.classList.toggle('is-focus', mode === 'focus');
                modeButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.tvMode === mode)));
            };
            modeButtons.forEach((button) => button.addEventListener('click', () => setMode(button.dataset.tvMode)));

            const showEntry = (entry) => {
                if (!entry || !traceLog.contains(entry)) return false;
                if (entry.offsetParent === null) setMode('full');
                entry.scrollIntoView({ block: 'start' });
                return true;
            };

            const jumpForm = traceBar.querySelector('.tv-jump');
            const jumpInput = jumpForm && jumpForm.querySelector('input');
            if (jumpForm && jumpInput) {
                jumpForm.addEventListener('submit', (event) => {
                    event.preventDefault();
                    const id = `turn-${parseInt(jumpInput.value, 10)}`;
                    if (showEntry(document.getElementById(id))) {
                        history.replaceState(null, '', `#${id}`);
                        jumpInput.setCustomValidity('');
                    } else {
                        jumpInput.setCustomValidity(`Pick a turn from ${jumpInput.min} to ${jumpInput.max}`);
                        jumpInput.reportValidity();
                    }
                });
                jumpInput.addEventListener('input', () => jumpInput.setCustomValidity(''));
            }

            const showHash = () => {
                if (location.hash.length > 1) showEntry(document.getElementById(decodeURIComponent(location.hash.slice(1))));
            };
            window.addEventListener('hashchange', showHash);
            showHash();
        }
    } catch (error) {
        console.error('Error initializing site scripts:', error);
    }
});
