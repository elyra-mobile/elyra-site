(() => {
  // TODO: replace this with your Brevo or MailerLite form/API endpoint.
  const EMAIL_CAPTURE_ENDPOINT = "https://REPLACE_WITH_BREVO_OR_MAILERLITE_ENDPOINT";
  const EMAIL_CAPTURE_ENDPOINT_PLACEHOLDER = "REPLACE_WITH_BREVO_OR_MAILERLITE_ENDPOINT";
  const EMAIL_CAPTURE_DELAY_MS = new URLSearchParams(window.location.search).has("previewEmailPopup")
    ? 800
    : 30000;
  const EMAIL_CAPTURE_DISMISS_DAYS = 7;
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

      if (EMAIL_CAPTURE_ENDPOINT.includes(EMAIL_CAPTURE_ENDPOINT_PLACEHOLDER)) {
        setStatus(form.getAttribute("data-missing-endpoint-message") || "Endpoint email à configurer.", "error");
        return;
      }

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

  setupCopyButtons();
  setupEmailCapture();

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
