import React, { lazy, useContext } from 'react';
import { Navigate, Route, Routes as ReactRoutes } from 'react-router-dom';

import { ROUTES } from '../constants';
import { MetricsContext } from './App';

const HomePage = lazy(() => import('../pages/Home'));
const TrailPage = lazy(() => import('../pages/Trail'));
const OnboardWingman = lazy(() => import('../pages/OnboardWingman'));
const Wingman = lazy(() => import('../pages/TrailWingman'));

export const AppRoutes = () => {
  const { trail } = useContext(MetricsContext);

  return (
    <ReactRoutes>
      <Route path={ROUTES.Home} element={<HomePage />} />
      <Route path={ROUTES.Trail} element={<TrailPage trail={trail} />} />
      {/* variant #1: side bar with 2 filter sections (prefixes and categories) */}
      <Route
        path={ROUTES.OnboardWithSidebar}
        element={<OnboardWingman trail={trail} variant={ROUTES.OnboardWithSidebar} />}
      />
      <Route path={ROUTES.TrailWithSidebar} element={<Wingman trail={trail} variant={ROUTES.OnboardWithSidebar} />} />
      {/* variant #2: no side bar, pills instead  */}
      <Route
        path={ROUTES.OnboardWithPills}
        element={<OnboardWingman trail={trail} variant={ROUTES.OnboardWithPills} />}
      />
      <Route path={ROUTES.TrailWithPills} element={<Wingman trail={trail} variant={ROUTES.OnboardWithPills} />} />
      {/* variant #2: side bar with prefix filters and labels breakdown  */}
      <Route
        path={ROUTES.OnboardWithLabels}
        element={<OnboardWingman trail={trail} variant={ROUTES.OnboardWithLabels} />}
      />
      <Route path={ROUTES.TrailWithLabels} element={<Wingman trail={trail} variant={ROUTES.OnboardWithLabels} />} />
      {/* catch-all route */}
      <Route path="*" element={<Navigate to={ROUTES.Home} replace />} />
    </ReactRoutes>
  );
};
