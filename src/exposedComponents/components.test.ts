import { plugin } from '../module';
import pluginJson from '../plugin.json';
import { exposedComponentConfigs } from './components';

const describeConfig = ({ id, title, description }: { id: string; title: string; description?: string }) => ({
  id,
  title,
  description,
});

describe('exposed component registration', () => {
  it('registers each declared component once, with matching manifest metadata', () => {
    const declared = exposedComponentConfigs.map(describeConfig);
    const registered = plugin.exposedComponentConfigs.map(describeConfig);

    expect(new Set(declared.map(({ id }) => id)).size).toBe(declared.length);
    expect(registered).toHaveLength(declared.length);
    expect(registered).toEqual(expect.arrayContaining(declared));
    expect(pluginJson.extensions.exposedComponents).toHaveLength(declared.length);
    expect(pluginJson.extensions.exposedComponents).toEqual(expect.arrayContaining(declared));
  });
});
