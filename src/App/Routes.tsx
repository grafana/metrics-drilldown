import React, { lazy, useContext } from 'react';
import { Navigate, Route, Routes as ReactRoutes } from 'react-router-dom-v5-compat';

import { ROUTES } from '../constants';
import { MetricsContext } from './App';

const HomePage = lazy(() => import('../pages/Home'));
const TrailPage = lazy(() => import('../pages/Trail'));
const Wingman = lazy(() => import('../pages/TrailWingman'));

export const AppRoutes = () => {
  const { trail } = useContext(MetricsContext);

  return (
    <ReactRoutes>
      <Route path={ROUTES.Home} element={<HomePage />} />
      <Route path={ROUTES.Trail} element={<TrailPage trail={trail} />} />
      <Route path={ROUTES.TrailWithSidebar} element={<Wingman trail={trail} />} />
      {/* catch-all route */}
      <Route path="*" element={<Navigate to={ROUTES.Home} replace />} />
    </ReactRoutes>
  );
};
