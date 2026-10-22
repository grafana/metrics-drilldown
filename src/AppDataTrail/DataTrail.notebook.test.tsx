import { hasPermission, setDataSourceSrv, usePluginComponent } from '@grafana/runtime';
import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { EventOpenAddToNotebook } from 'shared/GmdVizPanel/components/addToNotebook/EventOpenAddToNotebook';
import {
  ADD_TO_NOTEBOOK_COMPONENT_ID,
  type AddToNotebookFormProps,
  type NotebookCapture,
} from 'shared/GmdVizPanel/components/addToNotebook/notebookCapture';

import { DataTrail } from './DataTrail';
import { MockDataSourceSrv } from '../test/mocks/datasource';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  hasPermission: jest.fn(),
  useChromeHeaderHeight: () => 0,
  usePluginComponent: jest.fn(),
}));

const notebookForm = jest.fn(({ onClose }: AddToNotebookFormProps) => <button onClick={onClose}>Finish adding</button>);

function capture(): NotebookCapture {
  return {
    panel: {
      type: 'timeseries',
      title: 'requests_total',
      targets: [{ refId: 'A', expr: 'sum(rate(requests_total{job="api"}[5m]))' }],
      datasource: { uid: 'prom-a', type: 'prometheus' },
    },
    capturedTimeRange: { from: 'now-1h', to: 'now', timeZone: 'America/Los_Angeles' },
  };
}

function exposeNotebookForm(isLoading = false, available = true) {
  jest.mocked(usePluginComponent<AddToNotebookFormProps>).mockImplementation((id) => ({
    component: id === ADD_TO_NOTEBOOK_COMPONENT_ID && available ? notebookForm : undefined,
    isLoading: id === ADD_TO_NOTEBOOK_COMPONENT_ID && isLoading,
  }));
}

function renderTrail() {
  const trail = new DataTrail({ controls: [], embeddedMini: true });
  return { trail, view: render(<DataTrail.Component model={trail} />) };
}

describe('DataTrail notebook picker', () => {
  beforeEach(() => {
    notebookForm.mockImplementation(({ onClose }) => <button onClick={onClose}>Finish adding</button>);
    exposeNotebookForm();
    jest.mocked(hasPermission).mockImplementation((action) => action === 'notebooks:write');
  });

  it.each([
    { loading: false, component: false, permission: 'notebooks:write', expected: false },
    { loading: true, component: true, permission: 'notebooks:write', expected: false },
    { loading: false, component: true, permission: 'notebooks:read', expected: false },
    { loading: false, component: true, permission: 'notebooks:write', expected: true },
    { loading: false, component: true, permission: 'notebooks:create', expected: true },
  ])('gates the action and picker with %j', ({ loading, component, permission, expected }) => {
    exposeNotebookForm(loading, component);
    jest.mocked(hasPermission).mockImplementation((action) => action === permission);
    const { trail } = renderTrail();

    expect(trail.state.isAddToNotebookAvailable).toBe(expected);
    act(() => trail.openAddToNotebookModal(capture()));
    expect(Boolean(trail.state.notebookCapture)).toBe(expected);
    expect(Boolean(screen.queryByRole('dialog'))).toBe(expected);
  });

  it('opens the host-owned modal, closes from the form and clears the snapshot', () => {
    const { trail } = renderTrail();
    act(() => trail.openAddToNotebookModal(capture()));

    expect(screen.getByRole('dialog')).toHaveTextContent('Add to notebook');
    fireEvent.click(screen.getByRole('button', { name: 'Finish adding' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trail.state.notebookCapture).toBeUndefined();

    act(() => trail.openAddToNotebookModal(capture()));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(trail.state.notebookCapture).toBeUndefined();
  });

  it('captures on open, not submit, and returns a fresh legacy panel on every build', () => {
    const { trail } = renderTrail();
    const original = capture();
    act(() => trail.openAddToNotebookModal(original));
    original.panel.targets![0].expr = 'changed_query';
    original.capturedTimeRange.from = 'now-7d';
    act(() => trail.setState({ metric: 'other_metric' }));

    const props = notebookForm.mock.calls.at(-1)![0];
    expect(props.capturedTimeRange).toEqual({ from: 'now-1h', to: 'now', timeZone: 'America/Los_Angeles' });
    expect(props.buildPanel()).toEqual(capture().panel);
    props.buildPanel().targets![0].expr = 'mutated_by_form';
    expect(props.buildPanel()).toEqual(capture().panel);
    expect(props).not.toHaveProperty('cells');
  });

  it('removes availability and discards an open capture when the extension disappears', () => {
    const { trail, view } = renderTrail();
    act(() => trail.openAddToNotebookModal(capture()));
    exposeNotebookForm(false, false);
    view.rerender(<DataTrail.Component model={trail} />);

    expect(trail.state.isAddToNotebookAvailable).toBe(false);
    expect(trail.state.notebookCapture).toBeUndefined();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('makes the action available when the exposed form finishes loading', () => {
    exposeNotebookForm(true);
    const { trail, view } = renderTrail();
    expect(trail.state.isAddToNotebookAvailable).toBe(false);

    exposeNotebookForm();
    view.rerender(<DataTrail.Component model={trail} />);
    expect(trail.state.isAddToNotebookAvailable).toBe(true);
  });

  it('refuses a stale click after permission is revoked', () => {
    const { trail, view } = renderTrail();
    jest.mocked(hasPermission).mockReturnValue(false);
    act(() => trail.openAddToNotebookModal(capture()));
    expect(trail.state.notebookCapture).toBeUndefined();
    view.rerender(<DataTrail.Component model={trail} />);
    expect(trail.state.isAddToNotebookAvailable).toBe(false);
  });

  it('opens the picker from the bubbled chart action event', () => {
    setDataSourceSrv(new MockDataSourceSrv({ prom: { uid: 'ds', type: 'prometheus' } }));
    const trail = new DataTrail({ isAddToNotebookAvailable: true });
    const deactivate = trail.activate();

    trail.publishEvent(new EventOpenAddToNotebook(capture()), true);

    expect(trail.state.notebookCapture).toEqual(capture());
    deactivate();
  });
});
