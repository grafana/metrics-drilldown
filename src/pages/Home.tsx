import React, { useContext } from 'react';

import { MetricsContext } from 'App/App';

import { DataTrailsHome } from '../DataTrailsHome';

export default function Home() {
  const { goToUrlForTrail } = useContext(MetricsContext);
  const scene = new DataTrailsHome({ onTrailSelected: goToUrlForTrail });

  return <scene.Component model={scene} />;
}
