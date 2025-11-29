
document.addEventListener("DOMContentLoaded", function () {
    "use strict";

    /***************************
    register gsap plugins
    ***************************/
    gsap.registerPlugin(ScrollTrigger);

    /***************************
    preloader
    ***************************/
    var timeline = gsap.timeline();

    timeline.to(".fn-preloader-animation", {
        opacity: 1,
    });

    timeline.fromTo(
        ".fn-animation-1 .fn-h3", {
        y: "30px",
        opacity: 0
    }, {
        y: "0px",
        opacity: 1,
        stagger: 0.4
    },
    );

    timeline.to(".fn-animation-1 .fn-h3", {
        opacity: 0,
        y: '-30',
    }, "+=.3");

    timeline.fromTo(".fn-reveal-box", 0.1, {
        opacity: 0,
    }, {
        opacity: 1,
        x: '-30',
    });

    timeline.to(".fn-reveal-box", 0.45, {
        width: "100%",
        x: 0,
    }, "+=.1");
    timeline.to(".fn-reveal-box", {
        right: "0"
    });
    timeline.to(".fn-reveal-box", 0.3, {
        width: "0%"
    });
    timeline.fromTo(".fn-animation-2 .fn-h3", {
        opacity: 0,
    }, {
        opacity: 1,
    }, "-=.5");
    timeline.to(".fn-animation-2 .fn-h3", 0.6, {
        opacity: 0,
        y: '-30'
    }, "+=.5");
    timeline.to(".fn-preloader", 0.8, {
        opacity: 0,
        ease: 'sine',
        onComplete: function () {
            const preloader = document.querySelector('.fn-preloader');
            if (preloader) {
                preloader.classList.add("fn-hidden");
            }
            // Refresh ScrollTrigger after preloader completes
            ScrollTrigger.refresh();
        },
    }, "+=.2");

    /***************************
    anchor scroll
    ***************************/
    document.addEventListener('click', function (event) {
        const targetLink = event.target.closest('a[href^="#"]');
        if (!targetLink) return;

        const href = targetLink.getAttribute('href');

        // Skip if href is just "#" or empty
        if (!href || href === '#' || href === '#!') {
            return;
        }

        event.preventDefault();

        const targetElement = document.querySelector(href);

        // Check if target element exists
        if (!targetElement) {
            return;
        }

        let offset = 0;
        if (window.innerWidth < 1200) {
            offset = 90;
        }

        // Use window.scrollTo with behavior smooth or GSAP for better control
        // Using GSAP ScrollTo plugin would be ideal if loaded, but standard behavior is fine too
        // Since we have GSAP, let's use it for consistency if we want, but window.scrollTo is native

        const elementPosition = targetElement.getBoundingClientRect().top + window.scrollY;
        const offsetPosition = elementPosition - offset;

        window.scrollTo({
            top: offsetPosition,
            behavior: "smooth"
        });
    });

    /***************************
    append
    ***************************/
    // Helper to append clones
    function appendClones(sourceSelector, targetSelector) {
        const sources = document.querySelectorAll(sourceSelector);
        const targets = document.querySelectorAll(targetSelector);

        if (sources.length === 0 || targets.length === 0) return;

        targets.forEach(target => {
            sources.forEach(source => {
                target.appendChild(source.cloneNode(true));
            });
        });
    }

    appendClones(".fn-arrow", ".fn-arrow-place");
    appendClones(".fn-dodecahedron", ".fn-animation");
    appendClones(".fn-lines", ".fn-lines-place");

    // Special case for active menu item
    const activeMenuItem = document.querySelector(".fn-main-menu ul li.fn-active > a");
    const currentPageTarget = document.querySelector(".fn-current-page");
    if (activeMenuItem && currentPageTarget) {
        currentPageTarget.appendChild(activeMenuItem.cloneNode(true));
    }

    /***************************
    back to top
    ***************************/
    const btt = document.querySelector(".fn-back-to-top .fn-link");

    if (btt) {
        gsap.set(btt, {
            x: -30,
            opacity: 0,
        });

        gsap.to(btt, {
            x: 0,
            opacity: 1,
            ease: 'sine',
            scrollTrigger: {
                trigger: "body",
                start: "top -40%",
                end: "top -40%",
                toggleActions: "play none reverse none"
            }
        });
    }

    /***************************
     menu
    ***************************/
    const menuBtn = document.querySelector('.fn-menu-btn');
    const menu = document.querySelector('.fn-menu');
    const menuFrame = document.querySelector('.fn-menu-frame');

    if (menuBtn) {
        menuBtn.addEventListener("click", function () {
            // Toggle class on all menu buttons (there might be cloned ones)
            document.querySelectorAll('.fn-menu-btn').forEach(btn => {
                btn.classList.toggle('fn-active');
            });

            if (menu) menu.classList.toggle('fn-active');
            if (menuFrame) menuFrame.classList.toggle('fn-active');
        });
    }

    /***************************
    main menu
    ***************************/
    const menuLinks = document.querySelectorAll('.fn-has-children > a');

    menuLinks.forEach(link => {
        link.addEventListener('click', function (e) {
            // Prevent default if it's just a toggle
            e.preventDefault();

            // Remove active class from all other submenus and links
            document.querySelectorAll('.fn-has-children ul').forEach(ul => ul.classList.remove('fn-active'));
            document.querySelectorAll('.fn-has-children > a').forEach(a => {
                if (a !== this) a.classList.remove('fn-active');
            });

            // Toggle current
            this.classList.toggle('fn-active');
            const nextUl = this.nextElementSibling;
            if (nextUl) {
                nextUl.classList.toggle('fn-active');
            }
        });
    });

    /***************************
    progressbar
    ***************************/
    gsap.to('.fn-progress', {
        height: '100%',
        ease: 'sine',
        scrollTrigger: {
            scrub: 0.3
        }
    });

    /***************************
    scroll animations
    ***************************/

    // Set initial state for all .fn-up elements immediately to prevent flash
    gsap.set(".fn-up", {
        opacity: 0,
        y: 40,
        scale: 0.98,
        willChange: "transform, opacity"
    });

    // Initialize scroll animations - only run once
    let scrollAnimationsInitialized = false;

    function initScrollAnimations() {
        if (scrollAnimationsInitialized) return;
        scrollAnimationsInitialized = true;

        const appearance = document.querySelectorAll(".fn-up");

        appearance.forEach((section, index) => {
            gsap.fromTo(section, {
                opacity: 0,
                y: 40,
                scale: 0.98
            }, {
                opacity: 1,
                y: 0,
                scale: 1,
                duration: 1,
                ease: 'power2.out',
                scrollTrigger: {
                    trigger: section,
                    start: "top 90%",
                    end: "bottom 35%",
                    toggleActions: 'play none none reverse',
                    markers: false,
                    id: 'fn-up-' + index,
                    invalidateOnRefresh: true
                }
            });
        });

        ScrollTrigger.refresh();
    }

    // Initialize after a short delay to ensure preloader doesn't interfere
    setTimeout(initScrollAnimations, 300);

    const scaleImage = document.querySelectorAll(".fn-scale");

    scaleImage.forEach((section) => {
        var value1 = section.dataset.value1 || 1; // Default fallback
        var value2 = section.dataset.value2 || 1.2;

        gsap.fromTo(section, {
            ease: 'sine',
            scale: value1,

        }, {
            scale: value2,
            scrollTrigger: {
                trigger: section,
                scrub: true,
                toggleActions: 'play none none reverse',
            }
        });
    });

    const parallaxImage = document.querySelectorAll(".fn-parallax");

    if (window.innerWidth > 960) {
        parallaxImage.forEach((section) => {
            var value1 = section.dataset.value1 || 0;
            var value2 = section.dataset.value2 || 0;

            gsap.fromTo(section, {
                ease: 'sine',
                y: value1,

            }, {
                y: value2,
                scrollTrigger: {
                    trigger: section,
                    scrub: true,
                    toggleActions: 'play none none reverse',
                }
            });
        });
    }

    const rotate = document.querySelectorAll(".fn-rotate");

    rotate.forEach((section) => {
        var value = section.dataset.value || 360;
        gsap.fromTo(section, {
            ease: 'sine',
            rotate: 0,

        }, {
            rotate: value,
            scrollTrigger: {
                trigger: section,
                scrub: true,
                toggleActions: 'play none none reverse',
            }
        });
    });

});
