(function () {
  "use strict";

  var scriptEl =
    document.currentScript ||
    (function () {
      var s = document.getElementsByTagName("script");
      return s[s.length - 1];
    })();

  var testMode = scriptEl.getAttribute("data-test-mode") === "true";
  var clientId = scriptEl.getAttribute("data-client-id");
  if (!testMode && !clientId) {
    console.error("[BDA] Missing data-client-id on widget script tag.");
    return;
  }

  // Derive the API base from the origin that served this script.
  var apiBase = new URL(scriptEl.src, window.location.href).origin;

  // In test mode we hit the authenticated /widget-test/* routes (same
  // request/response shapes as the public /widget/* routes) so a logged-in
  // business owner can safely try the real widget without creating a real
  // lead or sending a real email.
  function api(path) {
    return apiBase + "/api" + (testMode ? path.replace(/^\/widget\//, "/widget-test/") : path);
  }

  function notifyParent(type, detail) {
    if (!testMode || window.parent === window) return;
    try {
      window.parent.postMessage({ source: "bda-widget-test", type: type, detail: detail || null }, "*");
    } catch (e) {
      /* ignore cross-origin postMessage failures */
    }
  }

  var NAVY = "#1e3a5f";

  var config = {
    businessName: "Business Development Agent",
    greeting: "Answer a few quick questions and we'll prepare an estimate.",
    primaryColor: NAVY,
    font: "inter",
    position: "bottom-right",
    enabled: true,
    budgetRanges: null,
  };

  var DISCLAIMER =
    "This quote is a preliminary estimate based on the information provided. It is not a final service agreement. Final pricing may change after review, inspection, measurement, material confirmation, or changes to project scope.";

  // Fallback only — the server supplies dynamic ranges built from the
  // business's pricing profile via /widget/config.
  var BUDGET_OPTIONS = [
    "Under $250",
    "$250-$500",
    "$500-$1,000",
    "$1,000-$2,500",
    "$2,500-$5,000",
    "$5,000+",
    "Not sure",
  ];

  function budgetOptions() {
    return Array.isArray(config.budgetRanges) && config.budgetRanges.length > 0
      ? config.budgetRanges
      : BUDGET_OPTIONS;
  }

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
    street: "",
    city: "",
    stateVal: "",
    zip: "",
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

  function text(tag, styles, content, attrs) {
    var node = el(tag, styles, attrs);
    node.textContent = content;
    return node;
  }

  function money(n) {
    if (n == null) return "";
    return "$" + Math.round(n).toLocaleString();
  }

  var FONT_STACKS = {
    inter:
      "font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;",
    system:
      "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;",
    serif: "font-family:Georgia,'Times New Roman',Times,serif;",
    rounded:
      "font-family:'Trebuchet MS','Segoe UI',Verdana,Helvetica,Arial,sans-serif;",
    mono: "font-family:'Courier New',Courier,monospace;",
  };

  function fontStack(key) {
    return FONT_STACKS[key] || FONT_STACKS.inter;
  }

  var FONT = fontStack(config.font);

  var TRANSITION = "transition:all 0.16s cubic-bezier(0.4,0,0.2,1);";

  // Injected once so we can express hover/focus states and keyframe
  // animations that inline styles alone can't express.
  var STYLE_ID = "bda-widget-styles";
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent =
      "@keyframes bda-panel-in{from{opacity:0;transform:translateY(14px) scale(0.98);}to{opacity:1;transform:translateY(0) scale(1);}}" +
      "@keyframes bda-launcher-in{from{opacity:0;transform:scale(0.9);}to{opacity:1;transform:scale(1);}}" +
      ".bda-launcher{transition:transform 0.18s cubic-bezier(0.4,0,0.2,1),box-shadow 0.18s cubic-bezier(0.4,0,0.2,1);}" +
      ".bda-launcher:hover{transform:translateY(-2px);}" +
      ".bda-panel{animation:bda-panel-in 0.22s cubic-bezier(0.16,1,0.3,1);}" +
      ".bda-primary-btn{transition:filter 0.15s ease,transform 0.1s ease;}" +
      ".bda-primary-btn:hover:not(:disabled){filter:brightness(1.08);}" +
      ".bda-primary-btn:active:not(:disabled){transform:scale(0.98);}" +
      ".bda-primary-btn:disabled{opacity:0.65;cursor:default;}" +
      ".bda-option-btn{transition:border-color 0.15s ease,background 0.15s ease,transform 0.1s ease;}" +
      ".bda-option-btn:hover{border-color:" + config.primaryColor + ";}" +
      ".bda-option-btn:active{transform:scale(0.99);}" +
      ".bda-input{transition:border-color 0.15s ease,box-shadow 0.15s ease;}" +
      ".bda-input:focus{outline:none;border-color:" + config.primaryColor + ";box-shadow:0 0 0 3px " + config.primaryColor + "26;}" +
      ".bda-back-link{transition:color 0.15s ease;}" +
      ".bda-back-link:hover{color:#334155;}" +
      ".bda-body::-webkit-scrollbar{width:6px;}" +
      ".bda-body::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:3px;}";
    document.head.appendChild(style);
  }

  function inputStyle() {
    return (
      "width:100%;box-sizing:border-box;border:1.5px solid #dde3ea;border-radius:12px;padding:12px 14px;font-size:15px;background:#f8fafc;color:#0f172a;" +
      TRANSITION +
      FONT
    );
  }

  function primaryBtn(label) {
    var b = el(
      "button",
      "width:100%;background:" +
        config.primaryColor +
        ";color:#fff;border:none;border-radius:12px;padding:14px;font-size:15px;font-weight:600;cursor:pointer;letter-spacing:0.01em;box-shadow:0 4px 14px " +
        config.primaryColor +
        "40;" +
        FONT,
      { type: "button", class: "bda-primary-btn" }
    );
    b.textContent = label;
    return b;
  }

  function backLink(onClick) {
    var b = el(
      "button",
      "background:none;border:none;color:#94a3b8;font-size:13px;font-weight:500;cursor:pointer;padding:6px 0;text-align:left;" +
        FONT,
      { type: "button", class: "bda-back-link" }
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
        (selected ? config.primaryColor + "14" : "#fff") +
        ";color:#0f172a;border-radius:12px;padding:13px 15px;font-size:14px;font-weight:" +
        (selected ? "600" : "500") +
        ";cursor:pointer;" +
        FONT,
      { type: "button", class: "bda-option-btn" }
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
      inputStyle() + "min-height:110px;resize:vertical;",
      { placeholder: "Describe the job or project\u2026", class: "bda-input" }
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
        credentials: testMode ? "include" : "same-origin",
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
      var input = el("input", inputStyle(), {
        type: "text",
        placeholder: "Your answer (optional)",
        class: "bda-input",
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
    budgetOptions().forEach(function (opt) {
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

  // Step 5: contact info + required service address + submit.
  function renderContact() {
    body.appendChild(
      stepHeader(
        "Almost done \u2014 where should we send your estimate?",
        "We need the service address to prepare your estimate."
      )
    );

    var form = el("form", "display:flex;flex-direction:column;gap:10px;");
    var nameInput = el("input", inputStyle(), {
      type: "text",
      placeholder: "Your name",
      required: "required",
      class: "bda-input",
    });
    nameInput.value = state.name;
    var emailInput = el("input", inputStyle(), {
      type: "email",
      placeholder: "Email",
      class: "bda-input",
    });
    emailInput.value = state.email;
    var phoneInput = el("input", inputStyle(), {
      type: "tel",
      placeholder: "Phone",
      class: "bda-input",
    });
    phoneInput.value = state.phone;

    var addrLabel = text(
      "p",
      "margin:4px 0 0;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#64748b;",
      "Service address (required)"
    );
    var streetInput = el("input", inputStyle(), {
      type: "text",
      placeholder: "Street address",
      required: "required",
      class: "bda-input",
    });
    streetInput.value = state.street;
    var cityInput = el("input", inputStyle(), {
      type: "text",
      placeholder: "City",
      required: "required",
      class: "bda-input",
    });
    cityInput.value = state.city;
    var row = el("div", "display:flex;gap:10px;");
    var stateInput = el("input", inputStyle() + "flex:1;", {
      type: "text",
      placeholder: "State",
      required: "required",
      class: "bda-input",
    });
    stateInput.value = state.stateVal;
    var zipInput = el("input", inputStyle() + "flex:1;", {
      type: "text",
      placeholder: "ZIP code",
      required: "required",
      class: "bda-input",
    });
    zipInput.value = state.zip;
    row.appendChild(stateInput);
    row.appendChild(zipInput);

    var submit = primaryBtn("Get my estimate");
    submit.setAttribute("type", "submit");

    form.appendChild(nameInput);
    form.appendChild(emailInput);
    form.appendChild(phoneInput);
    form.appendChild(addrLabel);
    form.appendChild(streetInput);
    form.appendChild(cityInput);
    form.appendChild(row);
    form.appendChild(submit);
    body.appendChild(form);
    body.appendChild(
      backLink(function () {
        state.name = nameInput.value;
        state.email = emailInput.value;
        state.phone = phoneInput.value;
        state.street = streetInput.value;
        state.city = cityInput.value;
        state.stateVal = stateInput.value;
        state.zip = zipInput.value;
        state.step = 4;
        renderStep();
      })
    );

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (state.busy) return;
      form.querySelectorAll("p.bda-err").forEach(function (p) { p.remove(); });
      function fail(input, msg) {
        var err = text("p", "color:#b91c1c;font-size:13px;margin:0;", msg);
        err.setAttribute("class", "bda-err");
        form.appendChild(err);
        input.focus();
      }
      if (!nameInput.value.trim()) {
        fail(nameInput, "Please enter your name.");
        return;
      }
      if (!emailInput.value.trim() && !phoneInput.value.trim()) {
        fail(emailInput, "Please provide an email or phone number so we can follow up.");
        return;
      }
      if (!streetInput.value.trim()) {
        fail(streetInput, "Please enter the street address for the service location.");
        return;
      }
      if (!cityInput.value.trim()) {
        fail(cityInput, "Please enter the city.");
        return;
      }
      if (!stateInput.value.trim()) {
        fail(stateInput, "Please enter the state.");
        return;
      }
      if (!zipInput.value.trim()) {
        fail(zipInput, "Please enter the ZIP code.");
        return;
      }
      state.name = nameInput.value.trim();
      state.email = emailInput.value.trim();
      state.phone = phoneInput.value.trim();
      state.street = streetInput.value.trim();
      state.city = cityInput.value.trim();
      state.stateVal = stateInput.value.trim();
      state.zip = zipInput.value.trim();
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
        credentials: testMode ? "include" : "same-origin",
        body: JSON.stringify({
          clientId: clientId,
          name: state.name,
          email: state.email || undefined,
          phone: state.phone || undefined,
          serviceStreet: state.street,
          serviceCity: state.city,
          serviceState: state.stateVal,
          serviceZip: state.zip,
          projectDescription: state.description,
          answers: answers,
          budget: state.budget || undefined,
          laborAssumption: state.labor || undefined,
        }),
      })
        .then(function (r) {
          if (!r.ok) {
            return r.json().then(function (errData) {
              throw new Error((errData && errData.error) || "Request failed");
            }, function () {
              throw new Error("Request failed");
            });
          }
          return r.json();
        })
        .then(function (data) {
          state.result = data;
          state.step = 6;
          renderStep();
          notifyParent("result", {
            sandboxTestId: data && data.sandboxTestId,
            message: data && data.message,
          });
        })
        .catch(function (err) {
          submit.textContent = "Get my estimate";
          submit.removeAttribute("disabled");
          form.querySelectorAll("p.bda-err").forEach(function (p) { p.remove(); });
          var msg =
            err && err.message && err.message !== "Request failed"
              ? err.message
              : null;
          var errEl = text(
            "p",
            "color:#b91c1c;font-size:13px;margin:10px 0 0;",
            msg || "Something went wrong. Please try again in a moment."
          );
          errEl.setAttribute("class", "bda-err");
          form.appendChild(errEl);
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
          ";background-image:linear-gradient(135deg," +
          config.primaryColor +
          " 0%,rgba(0,0,0,0.15) 220%);color:#fff;border-radius:16px;padding:18px;margin-bottom:12px;box-shadow:0 10px 26px " +
          config.primaryColor +
          "38;"
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

    // Preliminary-estimate disclaimer (always shown with the quote result).
    var discCard = el(
      "div",
      "background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px;margin-top:2px;"
    );
    discCard.appendChild(
      text(
        "p",
        "margin:0;font-size:11.5px;color:#64748b;line-height:1.5;",
        (data.disclaimer || DISCLAIMER)
      )
    );
    body.appendChild(discCard);

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

  var BRANDING = "Powered by Business Development Agent";
  var BRANDING_URL = "https://businessdevelopmentagent.replit.app";

  function render() {
    injectStyles();
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
        ";border:none;border-radius:18px;padding:13px 20px;font-size:15px;font-weight:600;cursor:pointer;text-align:left;box-shadow:0 10px 30px " +
        config.primaryColor +
        "45,0 2px 8px rgba(15,23,42,0.12);animation:bda-launcher-in 0.3s cubic-bezier(0.16,1,0.3,1);" +
        FONT,
      { type: "button", class: "bda-launcher" }
    );
    var launcherLabel = text(
      "span",
      "display:block;font-size:15px;font-weight:600;color:" + textColor + ";",
      "Get an estimate"
    );
    var launcherBrand = text(
      "span",
      "display:block;font-size:10.5px;font-style:italic;opacity:0.85;font-weight:400;color:" + textColor + ";cursor:default;text-decoration:none;pointer-events:none;",
      BRANDING
    );
    launcher.appendChild(launcherLabel);
    launcher.appendChild(launcherBrand);

    panel = el(
      "div",
      "display:none;flex-direction:column;width:380px;max-width:calc(100vw - 32px);height:580px;max-height:calc(100vh - 110px);background:#fff;border:1px solid rgba(15,23,42,0.06);border-radius:20px;overflow:hidden;box-shadow:0 30px 70px rgba(15,23,42,0.28),0 4px 16px rgba(15,23,42,0.08);margin-bottom:14px;",
      { class: "bda-panel" }
    );

    var header = el(
      "div",
      "background:" +
        config.primaryColor +
        ";background-image:linear-gradient(135deg," +
        config.primaryColor +
        " 0%,rgba(0,0,0,0.12) 200%);color:" +
        textColor +
        ";padding:18px 20px;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;"
    );
    var headerText = el("div", "min-width:0;");
    headerText.appendChild(
      text(
        "p",
        "margin:0;font-size:16px;font-weight:700;letter-spacing:-0.01em;color:" + textColor + ";",
        config.businessName
      )
    );
    headerText.appendChild(
      text(
        "p",
        "margin:3px 0 0;font-size:12px;font-style:italic;opacity:0.8;color:" + textColor + ";cursor:default;",
        BRANDING
      )
    );
    var headerLogoLink = el("a", "flex:none;display:block;line-height:0;", {
      href: BRANDING_URL,
      target: "_blank",
      rel: "noopener noreferrer",
      "aria-label": "Business Development Agent",
    });
    var headerLogo = el(
      "img",
      "width:28px;height:28px;border-radius:8px;display:block;",
      { src: apiBase + "/bda-logo.png", alt: "" }
    );
    headerLogoLink.appendChild(headerLogo);
    header.appendChild(headerText);
    header.appendChild(headerLogoLink);

    body = el(
      "div",
      "flex:1;overflow-y:auto;padding:20px;background:#fff;color:#0f172a;font-size:14px;line-height:1.5;",
      { class: "bda-body" }
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

  var configUrl = testMode
    ? api("/widget/config")
    : api("/widget/config?clientId=" + encodeURIComponent(clientId));

  fetch(configUrl, { credentials: testMode ? "include" : "same-origin" })
    .then(function (r) {
      if (r.ok) return r.json();
      return null;
    })
    .then(function (data) {
      if (data) {
        config.businessName = data.businessName || config.businessName;
        config.greeting = data.greeting || config.greeting;
        config.primaryColor = data.primaryColor || config.primaryColor;
        config.font = data.font || config.font;
        FONT = fontStack(config.font);
        config.position = data.position || config.position;
        config.enabled = data.enabled !== false;
        if (Array.isArray(data.budgetRanges) && data.budgetRanges.length > 0) {
          config.budgetRanges = data.budgetRanges;
        }
      }
      if (config.enabled) {
        if (document.body) render();
        else
          window.addEventListener("DOMContentLoaded", render, { once: true });
      }
      if (testMode) {
        // Test mode always opens straight into the conversation — there's
        // no launcher button to click inside the embedded preview.
        window.addEventListener("DOMContentLoaded", openTestPanel, { once: true });
        if (document.body) openTestPanel();
        // Let the dashboard restart the conversation in place (e.g. after
        // the owner saves feedback) so the very next reply reflects it.
        window.addEventListener("message", function (e) {
          if (!e.data || e.data.type !== "bda-widget-test-reset") return;
          state.step = 1;
          state.description = "";
          state.questions = [];
          state.answers = [];
          state.budget = "";
          state.labor = "";
          state.result = null;
          if (state.open) renderStep();
        });
        // Let the dashboard's styling form push draft branding into the
        // preview so color/font/greeting changes render instantly, before
        // the owner ever saves.
        window.addEventListener("message", function (e) {
          if (!e.data || e.data.type !== "bda-widget-test-style") return;
          var d = e.data.detail || {};
          if (d.primaryColor) config.primaryColor = d.primaryColor;
          if (d.font) {
            config.font = d.font;
            FONT = fontStack(config.font);
          }
          if (typeof d.greeting === "string" && d.greeting.trim()) {
            config.greeting = d.greeting;
          }
          if (d.position === "bottom-right" || d.position === "bottom-left") {
            config.position = d.position;
          }
          var wasOpen = state.open;
          if (root && root.parentNode) root.parentNode.removeChild(root);
          var oldStyle = document.getElementById(STYLE_ID);
          if (oldStyle && oldStyle.parentNode)
            oldStyle.parentNode.removeChild(oldStyle);
          state.open = false;
          render();
          if (wasOpen) openTestPanel();
        });
        // Tell the dashboard the style listener is live so it can push the
        // current (possibly unsaved) draft. Without this, a remounted
        // preview iframe would fall back to the saved server config.
        try {
          window.parent.postMessage({ type: "bda-widget-test-ready" }, "*");
        } catch (err) {
          /* Not embedded in a dashboard frame. */
        }
      }
    })
    .catch(function () {
      /* Fail silently on the host site. */
    });

  function openTestPanel() {
    if (!panel || state.open) return;
    state.open = true;
    panel.style.display = "flex";
    renderStep();
  }
})();
