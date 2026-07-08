(function () {
  "use strict";

  var scriptEl =
    document.currentScript ||
    (function () {
      var s = document.getElementsByTagName("script");
      return s[s.length - 1];
    })();

  var clientId = scriptEl.getAttribute("data-client-id");
  if (!clientId) {
    console.error("[BDA] Missing data-client-id on widget script tag.");
    return;
  }

  // Derive the API base from the origin that served this script.
  var apiBase = new URL(scriptEl.src, window.location.href).origin;

  function api(path) {
    return apiBase + "/api" + path;
  }

  var NAVY = "#1e3a5f";

  var config = {
    businessName: "Business Development Agent",
    greeting: "Answer a few quick questions and we'll prepare an estimate.",
    primaryColor: NAVY,
    position: "bottom-right",
    enabled: true,
  };

  var BUDGET_OPTIONS = [
    "Under $250",
    "$250-$500",
    "$500-$1,000",
    "$1,000-$2,500",
    "$2,500-$5,000",
    "$5,000+",
    "Not sure",
  ];

  var LABOR_OPTIONS = [
    "Not sure",
    "1 person / small job",
    "2-3 person crew",
    "Larger crew needed",
    "Multi-day job",
  ];

  var STEP_COUNT = 6;

  var state = {
    open: false,
    step: 1,
    busy: false,
    description: "",
    questions: [],
    answers: [],
    budget: "",
    labor: "",
    name: "",
    email: "",
    phone: "",
    result: null,
  };

  function el(tag, styles, attrs) {
    var node = document.createElement(tag);
    if (styles) node.setAttribute("style", styles);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        node.setAttribute(k, attrs[k]);
      });
    }
    return node;
  }

  function text(tag, styles, content) {
    var node = el(tag, styles);
    node.textContent = content;
    return node;
  }

  function money(n) {
    if (n == null) return "";
    return "$" + Math.round(n).toLocaleString();
  }

  var FONT =
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";

  var inputStyle =
    "width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:10px;padding:11px 12px;font-size:15px;background:#fff;color:#0f172a;" +
    FONT;

  function primaryBtn(label) {
    var b = el(
      "button",
      "width:100%;background:" +
        config.primaryColor +
        ";color:#fff;border:none;border-radius:10px;padding:13px;font-size:15px;font-weight:600;cursor:pointer;" +
        FONT,
      { type: "button" }
    );
    b.textContent = label;
    return b;
  }

  function backLink(onClick) {
    var b = el(
      "button",
      "background:none;border:none;color:#64748b;font-size:13px;cursor:pointer;padding:6px 0;text-align:left;" +
        FONT,
      { type: "button" }
    );
    b.textContent = "\u2190 Back";
    b.addEventListener("click", onClick);
    return b;
  }

  function optionButton(label, selected) {
    var b = el(
      "button",
      "width:100%;box-sizing:border-box;text-align:left;border:1.5px solid " +
        (selected ? config.primaryColor : "#e2e8f0") +
        ";background:" +
        (selected ? "#f0f4f9" : "#fff") +
        ";color:#0f172a;border-radius:10px;padding:12px 14px;font-size:14px;font-weight:" +
        (selected ? "600" : "500") +
        ";cursor:pointer;" +
        FONT,
      { type: "button" }
    );
    b.textContent = label;
    return b;
  }

  var root, panel, body, launcher;

  function stepHeader(title, subtitle) {
    var wrap = el("div", "margin-bottom:14px;");
    var progress = el(
      "div",
      "display:flex;gap:4px;margin-bottom:12px;"
    );
    for (var i = 1; i <= STEP_COUNT; i++) {
      progress.appendChild(
        el(
          "div",
          "flex:1;height:4px;border-radius:2px;background:" +
            (i <= state.step ? config.primaryColor : "#e2e8f0") +
            ";"
        )
      );
    }
    wrap.appendChild(progress);
    wrap.appendChild(
      text(
        "h3",
        "margin:0 0 4px;font-size:16px;font-weight:700;color:#0f172a;",
        title
      )
    );
    if (subtitle) {
      wrap.appendChild(
        text("p", "margin:0;font-size:13px;color:#64748b;line-height:1.45;", subtitle)
      );
    }
    return wrap;
  }

  function showError(container, msg) {
    var err = text(
      "p",
      "color:#b91c1c;font-size:13px;margin:10px 0 0;",
      msg || "Something went wrong. Please try again in a moment."
    );
    container.appendChild(err);
  }

  function renderStep() {
    body.innerHTML = "";

    if (state.step === 1) renderDescribe();
    else if (state.step === 2) renderQuestions();
    else if (state.step === 3) renderBudget();
    else if (state.step === 4) renderLabor();
    else if (state.step === 5) renderContact();
    else renderResult();

    body.scrollTop = 0;
  }

  // Step 1: describe the job.
  function renderDescribe() {
    body.appendChild(
      stepHeader(
        "Tell us what you need help with",
        config.greeting
      )
    );
    var ta = el(
      "textarea",
      inputStyle + "min-height:110px;resize:vertical;",
      { placeholder: "Describe the job or project\u2026" }
    );
    ta.value = state.description;
    body.appendChild(ta);

    var btn = primaryBtn("Continue");
    btn.style.marginTop = "12px";
    var wrap = el("div");
    body.appendChild(wrap);
    wrap.appendChild(btn);

    btn.addEventListener("click", function () {
      var v = ta.value.trim();
      if (v.length < 10) {
        wrap.querySelectorAll("p").forEach(function (p) { p.remove(); });
        showError(wrap, "Please add a little more detail so we can help.");
        return;
      }
      state.description = v;
      state.busy = true;
      btn.textContent = "One moment\u2026";
      btn.setAttribute("disabled", "disabled");

      fetch(api("/widget/questions"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clientId: clientId,
          projectDescription: state.description,
        }),
      })
        .then(function (r) {
          if (!r.ok) throw new Error("Request failed");
          return r.json();
        })
        .then(function (data) {
          state.questions =
            data && Array.isArray(data.questions) && data.questions.length > 0
              ? data.questions.slice(0, 4)
              : [];
          state.answers = state.questions.map(function () {
            return "";
          });
          state.step = state.questions.length > 0 ? 2 : 3;
          renderStep();
        })
        .catch(function () {
          // If follow-ups fail, continue the flow rather than blocking the customer.
          state.questions = [];
          state.answers = [];
          state.step = 3;
          renderStep();
        })
        .finally(function () {
          state.busy = false;
        });
    });
  }

  // Step 2: AI follow-up questions.
  function renderQuestions() {
    body.appendChild(
      stepHeader(
        "A few quick questions",
        "These help us prepare a more accurate estimate."
      )
    );
    var inputs = [];
    state.questions.forEach(function (q, i) {
      var fWrap = el("div", "margin-bottom:12px;");
      fWrap.appendChild(
        text(
          "label",
          "display:block;font-size:13px;font-weight:600;color:#334155;margin-bottom:5px;",
          q
        )
      );
      var input = el("input", inputStyle, {
        type: "text",
        placeholder: "Your answer (optional)",
      });
      input.value = state.answers[i] || "";
      fWrap.appendChild(input);
      inputs.push(input);
      body.appendChild(fWrap);
    });

    var btn = primaryBtn("Continue");
    body.appendChild(btn);
    btn.addEventListener("click", function () {
      state.answers = inputs.map(function (inp) {
        return inp.value.trim();
      });
      state.step = 3;
      renderStep();
    });
    body.appendChild(
      backLink(function () {
        state.step = 1;
        renderStep();
      })
    );
  }

  // Step 3: budget.
  function renderBudget() {
    body.appendChild(
      stepHeader(
        "Do you have a target budget or range in mind?",
        "A rough idea is fine \u2014 this helps us tailor the estimate."
      )
    );
    var list = el("div", "display:flex;flex-direction:column;gap:8px;");
    BUDGET_OPTIONS.forEach(function (opt) {
      var b = optionButton(opt, state.budget === opt);
      b.addEventListener("click", function () {
        state.budget = opt;
        state.step = 4;
        renderStep();
      });
      list.appendChild(b);
    });
    body.appendChild(list);
    body.appendChild(
      backLink(function () {
        state.step = state.questions.length > 0 ? 2 : 1;
        renderStep();
      })
    );
  }

  // Step 4: labor / scope.
  function renderLabor() {
    body.appendChild(
      stepHeader(
        "Do you know roughly how many workers or how much time this may take?",
        "It's okay to guess \u2014 we'll confirm the details."
      )
    );
    var list = el("div", "display:flex;flex-direction:column;gap:8px;");
    LABOR_OPTIONS.forEach(function (opt) {
      var b = optionButton(opt, state.labor === opt);
      b.addEventListener("click", function () {
        state.labor = opt;
        state.step = 5;
        renderStep();
      });
      list.appendChild(b);
    });
    body.appendChild(list);
    body.appendChild(
      backLink(function () {
        state.step = 3;
        renderStep();
      })
    );
  }

  // Step 5: contact info + submit.
  function renderContact() {
    body.appendChild(
      stepHeader(
        "Almost done \u2014 where should we send your estimate?",
        "We'll prepare your estimate right away."
      )
    );

    var form = el("form", "display:flex;flex-direction:column;gap:10px;");
    var nameInput = el("input", inputStyle, {
      type: "text",
      placeholder: "Your name",
      required: "required",
    });
    nameInput.value = state.name;
    var emailInput = el("input", inputStyle, {
      type: "email",
      placeholder: "Email",
    });
    emailInput.value = state.email;
    var phoneInput = el("input", inputStyle, {
      type: "tel",
      placeholder: "Phone",
    });
    phoneInput.value = state.phone;

    var submit = primaryBtn("Get my estimate");
    submit.setAttribute("type", "submit");

    form.appendChild(nameInput);
    form.appendChild(emailInput);
    form.appendChild(phoneInput);
    form.appendChild(submit);
    body.appendChild(form);
    body.appendChild(
      backLink(function () {
        state.name = nameInput.value;
        state.email = emailInput.value;
        state.phone = phoneInput.value;
        state.step = 4;
        renderStep();
      })
    );

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (state.busy) return;
      if (!nameInput.value.trim()) {
        nameInput.focus();
        return;
      }
      state.name = nameInput.value.trim();
      state.email = emailInput.value.trim();
      state.phone = phoneInput.value.trim();
      state.busy = true;
      submit.textContent = "Preparing your estimate\u2026";
      submit.setAttribute("disabled", "disabled");

      var answers = [];
      state.questions.forEach(function (q, i) {
        if (state.answers[i]) {
          answers.push({ question: q, answer: state.answers[i] });
        }
      });

      fetch(api("/widget/interact"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clientId: clientId,
          name: state.name,
          email: state.email || undefined,
          phone: state.phone || undefined,
          projectDescription: state.description,
          answers: answers,
          budget: state.budget || undefined,
          laborAssumption: state.labor || undefined,
        }),
      })
        .then(function (r) {
          if (!r.ok) throw new Error("Request failed");
          return r.json();
        })
        .then(function (data) {
          state.result = data;
          state.step = 6;
          renderStep();
        })
        .catch(function () {
          submit.textContent = "Get my estimate";
          submit.removeAttribute("disabled");
          form.querySelectorAll("p").forEach(function (p) { p.remove(); });
          showError(form);
        })
        .finally(function () {
          state.busy = false;
        });
    });
  }

  function sectionCard(title) {
    var card = el(
      "div",
      "background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin-bottom:10px;"
    );
    if (title) {
      card.appendChild(
        text(
          "p",
          "margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#64748b;",
          title
        )
      );
    }
    return card;
  }

  function bulletList(items) {
    var ul = el("ul", "margin:0;padding-left:18px;color:#334155;font-size:13px;line-height:1.55;");
    items.forEach(function (it) {
      ul.appendChild(text("li", "", it));
    });
    return ul;
  }

  // Step 6: estimate result.
  function renderResult() {
    var data = state.result || {};
    var est = data.estimate || {};

    body.appendChild(
      stepHeader("Your estimate", null)
    );

    // Price range card.
    if (est.recommendedPriceLow != null && est.recommendedPriceHigh != null) {
      var priceCard = el(
        "div",
        "background:" +
          config.primaryColor +
          ";color:#fff;border-radius:12px;padding:16px;margin-bottom:10px;"
      );
      priceCard.appendChild(
        text(
          "p",
          "margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;opacity:0.75;",
          "Estimated range"
        )
      );
      priceCard.appendChild(
        text(
          "p",
          "margin:0;font-size:22px;font-weight:700;",
          money(est.recommendedPriceLow) + " \u2013 " + money(est.recommendedPriceHigh)
        )
      );
      if (
        est.confidenceScore != null &&
        est.confidenceScore >= 60 &&
        est.totalEstimate
      ) {
        priceCard.appendChild(
          text(
            "p",
            "margin:6px 0 0;font-size:13px;opacity:0.85;",
            "Estimated total: " + money(est.totalEstimate)
          )
        );
      }
      body.appendChild(priceCard);
    }

    // Agent message.
    if (data.message) {
      var msgCard = sectionCard(null);
      var msg = text(
        "p",
        "margin:0;font-size:14px;color:#0f172a;line-height:1.55;white-space:pre-wrap;",
        data.message
      );
      msgCard.appendChild(msg);
      body.appendChild(msgCard);
    }

    // Quick facts.
    var facts = [];
    if (est.estimatedLaborersNeeded) facts.push("Crew: " + est.estimatedLaborersNeeded);
    if (est.estimatedDuration) facts.push("Duration: " + est.estimatedDuration);
    if (facts.length > 0) {
      var factsCard = sectionCard("At a glance");
      factsCard.appendChild(bulletList(facts));
      body.appendChild(factsCard);
    }

    if (Array.isArray(est.assumptions) && est.assumptions.length > 0) {
      var aCard = sectionCard("Assumptions");
      aCard.appendChild(bulletList(est.assumptions));
      body.appendChild(aCard);
    }

    if (
      Array.isArray(est.whatCouldChangePrice) &&
      est.whatCouldChangePrice.length > 0
    ) {
      var cCard = sectionCard("What could change the price");
      cCard.appendChild(bulletList(est.whatCouldChangePrice));
      body.appendChild(cCard);
    }

    if (est.recommendedNextStep) {
      var nCard = sectionCard("Next step");
      nCard.appendChild(
        text(
          "p",
          "margin:0;font-size:13px;color:#334155;line-height:1.55;",
          est.recommendedNextStep
        )
      );
      body.appendChild(nCard);
    }

    body.appendChild(
      text(
        "p",
        "margin:8px 0 0;font-size:12px;color:#94a3b8;text-align:center;",
        "Thanks, " + (state.name || "friend") + "! " + config.businessName + " will follow up with you shortly."
      )
    );
  }

  // White text on dark brand colors, navy on light brand colors.
  function brandTextColor(hex) {
    var m = /^#?([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.exec(hex || "");
    if (!m) return "#ffffff";
    var h = m[1];
    if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
    var r = parseInt(h.slice(0, 2), 16);
    var g = parseInt(h.slice(2, 4), 16);
    var b = parseInt(h.slice(4, 6), 16);
    var luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6 ? "#1e3a5f" : "#ffffff";
  }

  var BRANDING = "Business Development Agent \u00A9";

  function render() {
    var side = config.position === "bottom-left" ? "left:16px;" : "right:16px;";
    var textColor = brandTextColor(config.primaryColor);

    root = el(
      "div",
      "position:fixed;bottom:16px;" + side + "z-index:2147483000;" + FONT
    );

    launcher = el(
      "button",
      "display:flex;flex-direction:column;align-items:flex-start;gap:1px;background:" +
        config.primaryColor +
        ";color:" +
        textColor +
        ";border:none;border-radius:16px;padding:12px 18px;font-size:15px;font-weight:600;cursor:pointer;text-align:left;box-shadow:0 8px 24px rgba(15,23,42,0.28);" +
        FONT,
      { type: "button" }
    );
    var launcherLabel = text(
      "span",
      "display:block;font-size:15px;font-weight:600;color:" + textColor + ";",
      "Get an estimate"
    );
    var launcherBrand = text(
      "span",
      "display:block;font-size:10.5px;font-style:italic;opacity:0.85;font-weight:400;color:" + textColor + ";",
      BRANDING
    );
    launcher.appendChild(launcherLabel);
    launcher.appendChild(launcherBrand);

    panel = el(
      "div",
      "display:none;flex-direction:column;width:370px;max-width:calc(100vw - 32px);height:560px;max-height:calc(100vh - 110px);background:#fff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 24px 60px rgba(15,23,42,0.24);margin-bottom:12px;"
    );

    var header = el(
      "div",
      "background:" +
        config.primaryColor +
        ";color:" +
        textColor +
        ";padding:14px 18px;"
    );
    header.appendChild(
      text(
        "p",
        "margin:0;font-size:15px;font-weight:700;color:" + textColor + ";",
        config.businessName
      )
    );
    header.appendChild(
      text(
        "p",
        "margin:2px 0 0;font-size:12px;font-style:italic;opacity:0.85;color:" + textColor + ";",
        BRANDING
      )
    );

    body = el(
      "div",
      "flex:1;overflow-y:auto;padding:18px;background:#fff;color:#0f172a;font-size:14px;line-height:1.5;"
    );

    panel.appendChild(header);
    panel.appendChild(body);

    launcher.addEventListener("click", function () {
      state.open = !state.open;
      panel.style.display = state.open ? "flex" : "none";
      launcherLabel.textContent = state.open ? "Close" : "Get an estimate";
      if (state.open) renderStep();
    });

    root.appendChild(panel);
    root.appendChild(launcher);
    document.body.appendChild(root);
  }

  fetch(api("/widget/config?clientId=" + encodeURIComponent(clientId)))
    .then(function (r) {
      if (r.ok) return r.json();
      return null;
    })
    .then(function (data) {
      if (data) {
        config.businessName = data.businessName || config.businessName;
        config.greeting = data.greeting || config.greeting;
        config.primaryColor = data.primaryColor || config.primaryColor;
        config.position = data.position || config.position;
        config.enabled = data.enabled !== false;
      }
      if (config.enabled) {
        if (document.body) render();
        else
          window.addEventListener("DOMContentLoaded", render, { once: true });
      }
    })
    .catch(function () {
      /* Fail silently on the host site. */
    });
})();
