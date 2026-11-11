import { SceneReactObject, type SceneObject } from '@grafana/scenes';
import { render, screen } from '@testing-library/react';
import React from 'react';

import { MetricSceneRoot } from './MetricSceneRoot';

const contextWindow = window as Window & { __grafanaSceneContext?: SceneObject };

test.each([
  [0, 1],
  [1, 0],
])('mounting A/B and unmounting %i then %i never changes the host scene context', (first, second) => {
  const previous = contextWindow.__grafanaSceneContext;
  const host = new SceneReactObject({ reactNode: <div>Host</div> });
  contextWindow.__grafanaSceneContext = host;
  const roots = ['A', 'B'].map(
    (name) => new MetricSceneRoot({ body: new SceneReactObject({ reactNode: <div>{name}</div> }) })
  );
  const mounted = roots.map((root) => render(<root.Component model={root} />));
  try {
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(roots.every((root) => root.isActive)).toBe(true);
    expect(contextWindow.__grafanaSceneContext).toBe(host);
    mounted[first].unmount();
    expect(roots[first].isActive).toBe(false);
    expect(contextWindow.__grafanaSceneContext).toBe(host);
    mounted[second].unmount();
    expect(roots[second].isActive).toBe(false);
    expect(contextWindow.__grafanaSceneContext).toBe(host);
  } finally {
    mounted.forEach(({ unmount }) => unmount());
    contextWindow.__grafanaSceneContext = previous;
  }
});
