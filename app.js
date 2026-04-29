(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const revealItems = Array.from(document.querySelectorAll(".reveal"));
  let observer;
  let scrollTicking = false;
  let hashAlignUntil = 0;

  document.documentElement.classList.add("is-ready");
  if ("scrollRestoration" in window.history) {
    window.history.scrollRestoration = "manual";
  }

  const alignHashTarget = () => {
    if (!window.location.hash) return;
    const targetId = decodeURIComponent(window.location.hash.slice(1));
    const target = targetId ? document.getElementById(targetId) : null;
    if (!target) return;
    target.scrollIntoView({ block: "start", behavior: "auto" });
  };

  const scheduleHashAlign = (delay = 0) => {
    if (!window.location.hash) return;
    window.setTimeout(() => {
      window.requestAnimationFrame(alignHashTarget);
    }, delay);
  };

  const keepHashAlignedWhileMediaLoads = () => {
    if (!window.location.hash) return;
    hashAlignUntil = Date.now() + 3200;

    document.querySelectorAll("img").forEach((image) => {
      if (image.complete) return;
      image.addEventListener(
        "load",
        () => {
          if (Date.now() <= hashAlignUntil) {
            scheduleHashAlign(80);
          }
        },
        { once: true }
      );
    });
  };

  const reveal = (item) => {
    item.classList.add("is-visible");
    if (observer) {
      observer.unobserve(item);
    }
  };

  const revealPassedItems = () => {
    revealItems.forEach((item) => {
      if (item.classList.contains("is-visible")) return;
      const rect = item.getBoundingClientRect();
      if (rect.top < window.innerHeight * 1.25) {
        reveal(item);
      }
    });
  };

  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealItems.forEach(reveal);
  } else {
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          reveal(entry.target);
        });
      },
      {
        rootMargin: "0px 0px -4% 0px",
        threshold: 0.08,
      }
    );

    revealItems.forEach((item, index) => {
      item.style.transitionDelay = `${Math.min(index % 4, 3) * 70}ms`;
      observer.observe(item);
    });

    revealPassedItems();
    window.addEventListener(
      "scroll",
      () => {
        if (scrollTicking) return;
        scrollTicking = true;
        window.requestAnimationFrame(() => {
          revealPassedItems();
          scrollTicking = false;
        });
      },
      { passive: true }
    );
  }

  document.querySelectorAll("[data-language-link]").forEach((link) => {
    link.addEventListener("click", (event) => {
      const language = link.getAttribute("data-language-link");
      if (language) {
        localStorage.setItem("elyra-language", language);
      }

      if (reduceMotion || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      event.preventDefault();
      document.body.classList.add("is-transitioning");
      window.setTimeout(() => {
        window.location.href = link.href;
      }, 150);
    });
  });

  document.querySelectorAll("details").forEach((details) => {
    details.addEventListener("toggle", () => {
      if (!details.open) return;
      document.querySelectorAll("details[open]").forEach((openDetails) => {
        if (openDetails !== details) {
          openDetails.removeAttribute("open");
        }
      });
    });
  });

  window.addEventListener("hashchange", () => {
    keepHashAlignedWhileMediaLoads();
    scheduleHashAlign();
    scheduleHashAlign(240);
    scheduleHashAlign(900);
  });

  window.addEventListener("load", () => {
    keepHashAlignedWhileMediaLoads();
    scheduleHashAlign();
    scheduleHashAlign(180);
    scheduleHashAlign(720);
    scheduleHashAlign(1600);
    scheduleHashAlign(2800);
  });
})();
