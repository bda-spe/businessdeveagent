import { createRoot } from "react-dom/client";
import { setBaseUrl } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";

// Frontend (GitHub Pages) and backend (Render) are on different origins now —
// on Replit they were same-origin via path-based routing, so this was never
// needed. Unset means requests stay relative (useful for local dev via Vite's
// proxy, if one is ever added).
setBaseUrl(import.meta.env.VITE_API_BASE_URL || null);

createRoot(document.getElementById("root")!).render(<App />);
