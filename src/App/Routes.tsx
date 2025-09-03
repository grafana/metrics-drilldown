import React, { lazy } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { ROUTES } from '../constants';
import { useMetricsAppContext } from './MetricsAppContext';

export const Wingman = lazy(() => import('../pages/TrailWingman'));

// For /trail links, redirect to /drilldown with the same search params
const TrailRedirect = () => {
  const location = useLocation();
  return <Navigate to={`${ROUTES.Drilldown}${location.search}`} replace />;
};

export const AppRoutes = () => {
  const { trail } = useMetricsAppContext();

  return (
    <Routes>
      <Route path={ROUTES.Drilldown} element={<Wingman trail={trail} />} />
      <Route path={ROUTES.Trail} element={<TrailRedirect />} />
      {/* catch-all route */}
      <Route path="*" element={<Navigate to={ROUTES.Drilldown} replace />} />
    </Routes>
  );
};
