
$(function () {

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
            $('.fn-preloader').addClass("fn-hidden");
            // Refresh ScrollTrigger after preloader completes
            ScrollTrigger.refresh();
        },
    }, "+=.2");
    /***************************

    anchor scroll

    ***************************/
    $(document).on('click', 'a[href^="#"]', function (event) {
        var href = $.attr(this, 'href');
        
        // Skip if href is just "#" or empty
        if (!href || href === '#' || href === '#!') {
            return; // Let default behavior or onclick handler take over
        }

        event.preventDefault();

        var target = $(href);
        
        // Check if target element exists
        if (target.length === 0) {
            return;
        }

        var offset = 0;

        if ($(window).width() < 1200) {
            offset = 90;
        }

        $('html, body').animate({
            scrollTop: target.offset().top - offset
        }, 400);
    });
    /***************************

    append

    ***************************/
    $(document).ready(function () {
        $(".fn-arrow").clone().appendTo(".fn-arrow-place");
        $(".fn-dodecahedron").clone().appendTo(".fn-animation");
        $(".fn-lines").clone().appendTo(".fn-lines-place");
        $(".fn-main-menu ul li.fn-active > a").clone().appendTo(".fn-current-page");
    });
    /***************************

    back to top

    ***************************/
    const btt = document.querySelector(".fn-back-to-top .fn-link");

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
    /***************************

     menu

    ***************************/
    $('.fn-menu-btn').on("click", function () {
        $('.fn-menu-btn').toggleClass('fn-active');
        $('.fn-menu').toggleClass('fn-active');
        $('.fn-menu-frame').toggleClass('fn-active');
    });
    /***************************

    main menu

    ***************************/
    $('.fn-has-children a').on('click', function () {
        $('.fn-has-children ul').removeClass('fn-active');
        $('.fn-has-children a').removeClass('fn-active');
        $(this).toggleClass('fn-active');
        $(this).next().toggleClass('fn-active');
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
        var value1 = $(section).data("value-1");
        var value2 = $(section).data("value-2");
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


    if ($(window).width() > 960) {
        parallaxImage.forEach((section) => {
            var value1 = $(section).data("value-1");
            var value2 = $(section).data("value-2");
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
        var value = $(section).data("value");
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
