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

  var config = {
    businessName: "Business Development Agent",
    greeting: "Hi! Tell me about your project and I'll get you a quick estimate.",
    primaryColor: "#1e293b",
    position: "bottom-right",
    enabled: true,
  };

  var state = { open: false, submitting: false, done: false };

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

  function money(n) {
    if (n == null) return "";
    return "$" + Math.round(n).toLocaleString();
  }

  function render() {
    var side = config.position === "bottom-left" ? "left:24px;" : "right:24px;";

    var root = el(
      "div",
      "position:fixed;bottom:24px;" +
        side +
        "z-index:2147483000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;"
    );

    var button = el(
      "button",
      "display:flex;align-items:center;gap:8px;background:" +
        config.primaryColor +
        ";color:#fff;border:none;border-radius:9999px;padding:14px 20px;font-size:15px;font-weight:600;cursor:pointer;box-shadow:0 8px 24px rgba(15,23,42,0.28);"
    );
    button.textContent = "Get an estimate";

    var panel = el(
      "div",
      "display:none;flex-direction:column;width:360px;max-width:calc(100vw - 48px);height:520px;max-height:calc(100vh - 120px);background:#fff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 24px 60px rgba(15,23,42,0.24);margin-bottom:12px;"
    );

    var header = el(
      "div",
      "background:" +
        config.primaryColor +
        ";color:#fff;padding:16px 18px;font-size:15px;font-weight:600;"
    );
    header.textContent = config.businessName;

    var body = el(
      "div",
      "flex:1;overflow-y:auto;padding:18px;color:#0f172a;font-size:14px;line-height:1.5;"
    );

    var intro = el("p", "margin:0 0 14px;color:#475569;");
    intro.textContent = config.greeting;
    body.appendChild(intro);

    var form = el("form", "display:flex;flex-direction:column;gap:10px;");

    function field(placeholder, type, required) {
      var input = el(
        type === "textarea" ? "textarea" : "input",
        "width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:10px;padding:10px 12px;font-size:14px;font-family:inherit;" +
          (type === "textarea" ? "min-height:88px;resize:vertical;" : ""),
        { placeholder: placeholder }
      );
      if (type && type !== "textarea") input.setAttribute("type", type);
      if (required) input.setAttribute("required", "required");
      return input;
    }

    var nameInput = field("Your name", "text", true);
    var emailInput = field("Email", "email", false);
    var phoneInput = field("Phone", "tel", false);
    var descInput = field("Describe your project", "textarea", true);

    var submit = el(
      "button",
      "background:" +
        config.primaryColor +
        ";color:#fff;border:none;border-radius:10px;padding:12px;font-size:14px;font-weight:600;cursor:pointer;",
      { type: "submit" }
    );
    submit.textContent = "Send";

    form.appendChild(nameInput);
    form.appendChild(emailInput);
    form.appendChild(phoneInput);
    form.appendChild(descInput);
    form.appendChild(submit);
    body.appendChild(form);

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (state.submitting) return;
      state.submitting = true;
      submit.textContent = "Sending...";
      submit.setAttribute("disabled", "disabled");

      fetch(api("/widget/interact"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clientId: clientId,
          name: nameInput.value,
          email: emailInput.value || undefined,
          phone: phoneInput.value || undefined,
          projectDescription: descInput.value,
        }),
      })
        .then(function (r) {
          if (!r.ok) throw new Error("Request failed");
          return r.json();
        })
        .then(function (data) {
          form.style.display = "none";
          intro.style.display = "none";

          var reply = el(
            "div",
            "background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin-bottom:12px;white-space:pre-wrap;"
          );
          reply.textContent = data.message || "Thanks! We'll be in touch shortly.";
          body.appendChild(reply);

          if (
            data.estimate &&
            data.estimate.recommendedPriceLow != null &&
            data.estimate.recommendedPriceHigh != null
          ) {
            var est = el(
              "div",
              "background:" +
                config.primaryColor +
                ";color:#fff;border-radius:12px;padding:14px;font-weight:600;"
            );
            est.textContent =
              "Estimated range: " +
              money(data.estimate.recommendedPriceLow) +
              " - " +
              money(data.estimate.recommendedPriceHigh);
            body.appendChild(est);
          }
        })
        .catch(function () {
          var err = el("p", "color:#b91c1c;");
          err.textContent =
            "Something went wrong. Please try again in a moment.";
          body.appendChild(err);
        })
        .finally(function () {
          state.submitting = false;
        });
    });

    panel.appendChild(header);
    panel.appendChild(body);

    button.addEventListener("click", function () {
      state.open = !state.open;
      panel.style.display = state.open ? "flex" : "none";
      button.textContent = state.open ? "Close" : "Get an estimate";
    });

    root.appendChild(panel);
    root.appendChild(button);
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
