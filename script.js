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
        const navLinks = document.querySelectorAll('nav a');
        const sections = document.querySelectorAll('section[id]');

        if (sections.length > 0 && navLinks.length > 0 && 'IntersectionObserver' in window) {
            const navObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        // Remove active class from all links
                        navLinks.forEach(link => link.classList.remove('active'));
                        
                        // Add active class to corresponding link
                        const id = entry.target.getAttribute('id');
                        if (id) {
                            const activeLink = document.querySelector(`nav a[href="#${id}"]`);
                            if (activeLink) {
                                activeLink.classList.add('active');
                            }
                        }
                    }
                });
            }, {
                threshold: 0.5 // Trigger when 50% of section is visible
            });

            sections.forEach(section => {
                navObserver.observe(section);
            });
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
                        parent.innerHTML = '';
                        parent.appendChild(iframe);
                    }
                } catch (error) {
                    console.error('Error loading YouTube video:', error);
                }
            });
        });

        // 4. Back to Top Button
        const backToTopButton = document.getElementById('back-to-top');
        
        if (backToTopButton) {
            // Use passive listener for better scroll performance
            window.addEventListener('scroll', () => {
                try {
                    if (window.scrollY > 300) {
                        backToTopButton.classList.add('visible');
                    } else {
                        backToTopButton.classList.remove('visible');
                    }
                } catch (error) {
                    console.error('Error handling scroll:', error);
                }
            }, { passive: true });

            backToTopButton.addEventListener('click', () => {
                try {
                    window.scrollTo({
                        top: 0,
                        behavior: 'smooth'
                    });
                } catch (error) {
                    console.error('Error scrolling to top:', error);
                }
            });
        }
    } catch (error) {
        console.error('Error initializing site scripts:', error);
    }
});
