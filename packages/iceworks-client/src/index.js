import React from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter as Router, Route } from 'react-router-dom';

import MainLayout from '@layouts/MainLayout/index';
import LocaleProvider from '@components/Locale';
import { ThemeProvider } from '@components/ThemeProvider';
import { store, StoreContext } from '@src/store';


import '@utils/logger';
import '@alifd/next/reset.scss';
import './global.scss';
import './variables.scss';

const App = () => {
  return (
    <StoreContext.Provider value={store}>
      <LocaleProvider>
        <ThemeProvider>
          <Router>
            <Route path="/" component={MainLayout} />
          </Router>
        </ThemeProvider>
      </LocaleProvider>
    </StoreContext.Provider>
  );
};

ReactDOM.render(<App />, document.getElementById('iceworks'));
