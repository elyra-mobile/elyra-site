(() => {
  const EMAIL_CAPTURE_ENDPOINT = "/api/subscribe";
  const EMAIL_CAPTURE_DELAY_MS = new URLSearchParams(window.location.search).has("previewEmailPopup")
    ? 800
    : 30000;
  const EMAIL_CAPTURE_DISMISS_DAYS = 7;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isTouchViewport = window.matchMedia(
    "(hover: none), (pointer: coarse), (max-width: 760px)"
  ).matches;
  const isSafari = /^((?!chrome|android|crios|fxios|edg|opr).)*safari/i.test(
    window.navigator.userAgent
  );
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
    const anchor =
      target.querySelector?.(".section-heading, .section-copy, .legal-hero-grid") || target;
    const header = document.querySelector(".site-header");
    const headerPosition = header ? window.getComputedStyle(header).position : "";
    const headerHeight =
      header && (headerPosition === "sticky" || headerPosition === "fixed")
        ? header.getBoundingClientRect().height
        : 0;
    const top = window.scrollY + anchor.getBoundingClientRect().top - headerHeight - 42;
    window.scrollTo({ top: Math.max(0, top), behavior: "auto" });
  };

  const scheduleHashAlign = (delay = 0) => {
    if (!window.location.hash) return;
    window.setTimeout(() => {
      window.requestAnimationFrame(alignHashTarget);
    }, delay);
  };

  const keepHashAlignedWhileMediaLoads = () => {
    if (!window.location.hash || isTouchViewport) return;
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

  const setupCopyButtons = () => {
    document.querySelectorAll("[data-copy-target]").forEach((button) => {
      button.addEventListener("click", async () => {
        const targetId = button.getAttribute("data-copy-target");
        const target = targetId ? document.getElementById(targetId) : null;
        const text = target ? target.textContent.trim() : "";
        if (!text) return;

        try {
          await navigator.clipboard.writeText(text);
          const originalLabel = button.textContent;
          button.textContent = button.getAttribute("data-copied-label") || "Copié";
          window.setTimeout(() => {
            button.textContent = originalLabel;
          }, 1800);
        } catch (error) {
          button.textContent = button.getAttribute("data-error-label") || "Copie impossible";
        }
      });
    });
  };

  const setupEmailCapture = () => {
    const popup = document.querySelector("[data-email-capture]");
    if (!popup) return;

    const form = popup.querySelector("[data-email-form]");
    const emailInput = popup.querySelector("input[type='email']");
    const closeButton = popup.querySelector("[data-email-close]");
    const status = popup.querySelector("[data-email-status]");
    const storagePrefix = popup.getAttribute("data-storage-key") || "elyra-email-capture";
    const dismissedUntilKey = `${storagePrefix}:dismissed-until`;
    const submittedKey = `${storagePrefix}:submitted`;
    let previouslyFocused = null;
    let openTimer;

    const now = () => Date.now();
    const readStorage = (key) => {
      try {
        return window.localStorage.getItem(key);
      } catch (error) {
        return null;
      }
    };
    const writeStorage = (key, value) => {
      try {
        window.localStorage.setItem(key, value);
      } catch (error) {
        // If storage is unavailable, keep the popup functional for the session.
      }
    };

    const isSuppressed = () => {
      if (readStorage(submittedKey) === "true") return true;
      const dismissedUntil = Number(readStorage(dismissedUntilKey) || 0);
      return dismissedUntil > now();
    };

    const setStatus = (message, tone = "") => {
      if (!status) return;
      status.textContent = message;
      status.dataset.tone = tone;
    };

    const closePopup = ({ persist = true } = {}) => {
      if (persist) {
        writeStorage(
          dismissedUntilKey,
          String(now() + EMAIL_CAPTURE_DISMISS_DAYS * 24 * 60 * 60 * 1000)
        );
      }

      popup.classList.remove("is-visible");
      window.setTimeout(() => {
        popup.hidden = true;
      }, reduceMotion ? 0 : 180);

      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };

    const openPopup = () => {
      if (isSuppressed()) return;
      previouslyFocused = document.activeElement;
      popup.hidden = false;
      window.requestAnimationFrame(() => {
        popup.classList.add("is-visible");
      });

      if (document.activeElement === document.body && closeButton) {
        closeButton.focus({ preventScroll: true });
      }
    };

    openTimer = window.setTimeout(openPopup, EMAIL_CAPTURE_DELAY_MS);

    closeButton?.addEventListener("click", () => closePopup());

    popup.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closePopup();
      }
    });

    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!emailInput || !emailInput.value.trim()) return;

      setStatus(form.getAttribute("data-loading-message") || "Envoi en cours...");

      try {
        const response = await fetch(EMAIL_CAPTURE_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: emailInput.value.trim(),
            language: popup.getAttribute("data-language") || "fr",
            source: "elyra-site-v11-popup",
          }),
        });

        if (!response.ok) {
          throw new Error(`Email endpoint returned ${response.status}`);
        }

        writeStorage(submittedKey, "true");
        setStatus(form.getAttribute("data-success-message") || "Merci, c'est noté.", "success");
        form.reset();
        window.setTimeout(() => closePopup({ persist: false }), 1200);
      } catch (error) {
        setStatus(form.getAttribute("data-error-message") || "Impossible d'envoyer l'email pour le moment.", "error");
      }
    });

    window.addEventListener("beforeunload", () => {
      window.clearTimeout(openTimer);
    });
  };

  const setupPremiumMotion = () => {
    const root = document.documentElement;
    let lastScrolledState = null;
    const updateScrolledState = () => {
      const nextScrolledState = window.scrollY > 10;
      if (nextScrolledState === lastScrolledState) return;
      lastScrolledState = nextScrolledState;
      document.body.classList.toggle("has-scrolled", nextScrolledState);
    };

    updateScrolledState();

    if (reduceMotion || isTouchViewport) {
      window.addEventListener("scroll", updateScrolledState, { passive: true });
      return;
    }

    root.classList.add("motion-live");

    const spotlightItems = Array.from(
      document.querySelectorAll(
        [
          ".hero-grid",
          ".nutrition-layout",
          ".story-grid",
          ".progress-layout",
          ".signature-card",
          ".release-card",
          ".feature-card",
          ".feature-showcase-card",
          ".why-item",
          ".faq-list details",
          ".final-cta-inner",
          ".email-capture-card",
        ].join(",")
      )
    );

    spotlightItems.forEach((item) => {
      item.addEventListener(
        "pointermove",
        (event) => {
          const rect = item.getBoundingClientRect();
          const x = ((event.clientX - rect.left) / rect.width) * 100;
          const y = ((event.clientY - rect.top) / rect.height) * 100;
          item.style.setProperty("--spot-x", `${x.toFixed(2)}%`);
          item.style.setProperty("--spot-y", `${y.toFixed(2)}%`);
        },
        { passive: true }
      );
    });

    const heroGrid = document.querySelector(".hero-grid");
    const heroCard = document.querySelector(".hero-product-card");
    if (heroGrid && heroCard) {
      heroGrid.addEventListener(
        "pointermove",
        (event) => {
          const rect = heroGrid.getBoundingClientRect();
          const x = (event.clientX - rect.left) / rect.width - 0.5;
          const y = (event.clientY - rect.top) / rect.height - 0.5;
          heroCard.style.setProperty("--tilt-x", `${(-y * 5).toFixed(2)}deg`);
          heroCard.style.setProperty("--tilt-y", `${(x * 7).toFixed(2)}deg`);
        },
        { passive: true }
      );

      heroGrid.addEventListener("pointerleave", () => {
        heroCard.style.setProperty("--tilt-x", "0deg");
        heroCard.style.setProperty("--tilt-y", "0deg");
      });
    }

    if (isSafari) {
      window.addEventListener("scroll", updateScrolledState, { passive: true });
      return;
    }

    const floatItems = Array.from(
      document.querySelectorAll(
        ".hero-product-card, .nutrition-device, .story-visual, .progress-phone, .signature-phone, .feature-showcase-phone, .release-media"
      )
    ).map((element, index) => ({
      element,
      depth: 6 + (index % 4) * 2,
    }));

    let motionFrame = 0;
    const updateMotion = () => {
      motionFrame = 0;
      updateScrolledState();

      if (window.innerWidth <= 760) {
        floatItems.forEach(({ element }) => {
          element.style.setProperty("--float-y", "0px");
        });
        return;
      }

      const viewportCenter = window.innerHeight / 2;
      floatItems.forEach(({ element, depth }) => {
        const rect = element.getBoundingClientRect();
        if (rect.bottom < -120 || rect.top > window.innerHeight + 120) return;
        const itemCenter = rect.top + rect.height / 2;
        const progress = (viewportCenter - itemCenter) / viewportCenter;
        const y = Math.max(-depth, Math.min(depth, progress * depth));
        element.style.setProperty("--float-y", `${y.toFixed(2)}px`);
      });
    };

    const scheduleMotion = () => {
      if (motionFrame) return;
      motionFrame = window.requestAnimationFrame(updateMotion);
    };

    window.addEventListener("scroll", scheduleMotion, { passive: true });
    window.addEventListener("resize", scheduleMotion);
    updateMotion();
  };

  setupCopyButtons();
  setupEmailCapture();
  setupPremiumMotion();

  window.addEventListener("hashchange", () => {
    keepHashAlignedWhileMediaLoads();
    scheduleHashAlign();
    if (!isTouchViewport) {
      scheduleHashAlign(240);
      scheduleHashAlign(900);
    }
  });

  window.addEventListener("load", () => {
    keepHashAlignedWhileMediaLoads();
    scheduleHashAlign();
    if (!isTouchViewport) {
      scheduleHashAlign(180);
      scheduleHashAlign(720);
      scheduleHashAlign(1600);
      scheduleHashAlign(2800);
    }
  });
})();
