document.addEventListener('DOMContentLoaded', () => {
    // 1. Scroll Reveal Animation
    const revealElements = document.querySelectorAll('section');
    
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

    // 2. Active Navigation Highlighting
    const navLinks = document.querySelectorAll('nav a');
    const sections = document.querySelectorAll('section');

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

    // 3. Lite YouTube Embeds (Lazy Loading)
    const videoPlaceholders = document.querySelectorAll('.video-placeholder');

    videoPlaceholders.forEach(placeholder => {
        placeholder.addEventListener('click', function() {
            const videoId = this.dataset.videoId;
            const iframe = document.createElement('iframe');
            
            iframe.setAttribute('src', `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`);
            iframe.setAttribute('frameborder', '0');
            iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
            iframe.setAttribute('allowfullscreen', '');
            iframe.classList.add('youtube-video');
            
            const parent = this.parentElement;
            parent.innerHTML = '';
            parent.appendChild(iframe);
        });
    });

    // 4. Back to Top Button
    const backToTopButton = document.getElementById('back-to-top');
    
    if (backToTopButton) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 300) {
                backToTopButton.classList.add('visible');
            } else {
                backToTopButton.classList.remove('visible');
            }
        });

        backToTopButton.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }
});
