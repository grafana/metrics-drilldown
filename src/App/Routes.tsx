import React, { lazy, useContext } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { ROUTES } from '../constants';
import { MetricsContext } from './useTrail';

export const Wingman = lazy(() => import('../pages/TrailWingman'));

// For /trail links, redirect to /drilldown with the same search params
const TrailRedirect = () => {
  const location = useLocation();
  return <Navigate to={`${ROUTES.Drilldown}${location.search}`} replace />;
};

export const AppRoutes = () => {
  const { trail } = useContext(MetricsContext);

  return (
    <Routes>
      <Route path={ROUTES.Drilldown} element={<Wingman trail={trail} />} />
      <Route path={ROUTES.Trail} element={<TrailRedirect />} />
      {/* catch-all route */}
      <Route path="*" element={<Navigate to={ROUTES.Drilldown} replace />} />
    </Routes>
  );
};
