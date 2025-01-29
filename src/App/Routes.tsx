import React, { lazy } from 'react';
import { Route, Switch } from 'react-router-dom';

import { ROUTES } from '../constants';
import { prefixRoute } from '../utils/utils.routing';
const HomePage = lazy(() => import('../pages/Pages'));

export const Routes = () => {
  return (
    <Switch>
      <Route path={prefixRoute(ROUTES.Home)} component={HomePage} />
      <Route path={prefixRoute(ROUTES.Trail)} component={HomePage} />
    </Switch>
  );
};
