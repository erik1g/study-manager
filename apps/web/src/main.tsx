import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { setUiText } from "@study/ui";
import { App } from "./App";
import { t } from "./i18n";
import { initAuth } from "./lib/auth";
import { applyTheme, storedTheme } from "./lib/theme";
import "@study/ui/styles.css";
import "./base.css";
import "./app.css";

applyTheme(storedTheme());
setUiText({ ...t.ui, mainNav: t.nav.main });
await initAuth();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
