import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import { PasswordGate } from "./components/PasswordGate";
import { Provider } from "./components/ui/provider";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Provider>
      <PasswordGate>
        <App />
      </PasswordGate>
    </Provider>
  </React.StrictMode>,
);
