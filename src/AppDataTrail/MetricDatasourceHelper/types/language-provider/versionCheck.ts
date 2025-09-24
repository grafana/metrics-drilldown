import { isPrometheusDatasourceV11_6_x } from './v11-6-x';
import { isPrometheusDatasourceV12_0_0 } from './v12-0-0';
import { isPrometheusDatasourceV12_1_0Plus } from './v12-1-0-plus';

export const languageProviderVersionIs = {
  '11.6.x': isPrometheusDatasourceV11_6_x,
  '12.0.0': isPrometheusDatasourceV12_0_0,
  '12.1.0-plus': isPrometheusDatasourceV12_1_0Plus,
};
