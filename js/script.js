/* Portfolio - Central Script 
dynamic, navbar, smooth scrolling, and mobile menu Logic
*/

document.addEventListener("DOMContentLoaded", () => {
    
    // 1. Update footer year
    const yearElement = document.getElementById("current-year");
    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }

    // 2. Initialize menu logic
    const initializeMenu = () => {
        const mobileMenuButton = document.getElementById('mobile-menu-button');
        const mobileMenu = document.getElementById('mobile-menu');

        if (mobileMenuButton && mobileMenu) {
            // Toggle menu open/close
            mobileMenuButton.addEventListener('click', () => {
                mobileMenu.classList.toggle('hidden');
            });

            // Close menu when link is clicked
            const mobileMenuLinks = mobileMenu.querySelectorAll('a');
            mobileMenuLinks.forEach(link => {
                link.addEventListener('click', () => {
                    const href = link.getAttribute('href');
                    // Hide menu if it's an anchor link or a page link
                    if (href.includes('#') || href.endsWith('.html')) {
                        mobileMenu.classList.add('hidden');
                    }
                });
            });
        }
    };

    // 3. Smooth scrolling
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href');
            if (targetId === "#") return;

            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                e.preventDefault();
                targetElement.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });
});
