import React from "react";
import "@episerver/ui-framework/dist/main.css";
import "optimizely-oui/dist/styles.css";
import { AppModel } from "./dtos";

import "./Styles/content-usage.scss";
import { Api } from "./Lib/Api";
import Router from "./Components/Router";

interface AppProps {
  model: AppModel;
}

export const App = ({ model: { moduleBaseUrl, ...endpoints } }: AppProps) => {
  Api.setEndpoints(endpoints);

  return (
    <div className="epi-content-usage">
      <Router baseUrl={moduleBaseUrl} />
    </div>
  );
};
