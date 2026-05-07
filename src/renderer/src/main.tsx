import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/geist-mono/latin-500.css";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import { Toaster } from "@/components/ui/sonner";
import { App } from "./App";
import { IconProvider } from "./lib/icon-context";
import { ShapeProvider } from "./lib/shape-context";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ShapeProvider defaultShape="rounded">
      <IconProvider defaultLibrary="lucide">
        <App />
        <Toaster position="bottom-right" offset={{ right: 34, bottom: 30 }} richColors closeButton />
      </IconProvider>
    </ShapeProvider>
  </React.StrictMode>,
);
