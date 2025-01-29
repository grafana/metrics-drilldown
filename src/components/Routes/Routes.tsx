import React, { lazy } from 'react';
import { Redirect, Route, Switch } from 'react-router-dom';

import { ROUTES } from '../../constants';
import { prefixRoute } from '../../utils/utils.routing';
const HomePage = lazy(() => import('../../pages/Home/Home'));
const PageWithTabs = lazy(() => import('../../pages/WithTabs/WithTabs'));
const WithDrilldown = lazy(() => import('../../pages/WithDrilldown/WithDrilldown'));
const HelloWorld = lazy(() => import('../../pages/HelloWorld/HelloWorld'));

export const Routes = () => {
  return (
    <Switch>
      <Route path={prefixRoute(`${ROUTES.WithTabs}`)} component={PageWithTabs} />
      <Route path={prefixRoute(`${ROUTES.WithDrilldown}`)} component={WithDrilldown} />
      <Route path={prefixRoute(`${ROUTES.Home}`)} component={HomePage} />
      <Route path={prefixRoute(`${ROUTES.HelloWorld}`)} component={HelloWorld} />
      <Redirect to={prefixRoute(ROUTES.Home)} />
    </Switch>
  );
};
