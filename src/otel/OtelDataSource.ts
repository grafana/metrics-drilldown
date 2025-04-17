// import {
//   FieldType,
//   LoadingState,
//   RawTimeRange,
//   type DataQueryRequest,
//   type DataQueryResponse,
//   type DataSourceApi,
//   type LegacyMetricFindQueryOptions,
//   type MetricFindValue,
//   type TestDataSourceResponse,
// } from '@grafana/data';
// import { getDataSourceSrv } from '@grafana/runtime';
// import { RuntimeDataSource, sceneGraph, type DataSourceVariable, type SceneObject } from '@grafana/scenes';

// import {
//   VAR_DATASOURCE,
//   VAR_DATASOURCE_EXPR,
//   VAR_FILTERS,
//   VAR_FILTERS_EXPR,
//   VAR_OTEL_RESOURCES,
//   VAR_OTEL_RESOURCES_EXPR,
// } from 'shared';
// import { MetricsWithLabelValueDataSource } from 'WingmanDataTrail/GroupBy/MetricsWithLabelValue/MetricsWithLabelValueDataSource';
// import { isPrometheusRule } from 'WingmanDataTrail/helpers/isPrometheusRule';

// import { totalOtelResources } from './api';
// import { getOtelResourcesObject } from './util';
// import { isAdHocFiltersVariable } from '../utils/utils.variables';

// import type { PrometheusDatasource } from '@grafana/prometheus';

// export const NULL_GROUP_BY_VALUE = '(none)';

// /**
//  * Builds an array of Prometheus matchers from filters, jobs, and instances
//  * @param varFilters The filters variable
//  * @param jobs Array of job names
//  * @param instances Array of instance names
//  * @returns Array of matcher strings in the form {label="value", label2="value2"}
//  */
// function buildMatchers(varFilters: any, jobs: string[] = [], instances: string[] = []): string[] {
//   const MAX_MATCHER_LENGTH = 1990;
//   const matchers: string[] = [];

//   // Helper function to build a matcher string
//   const buildMatcherString = (label: string, values: string[]): string => {
//     if (values.length === 0) {
//       return '';
//     }
//     return `${label}=~"${values.join('|')}"`;
//   };

//   // Helper function to add a matcher to the array, creating a new one if needed
//   const addToMatchers = (matcherPart: string) => {
//     if (matcherPart === '') {
//       return;
//     }

//     if (matchers.length === 0) {
//       // Start a new matcher
//       matchers.push(`{${matcherPart}}`);
//     } else {
//       // Check if adding to the last matcher would exceed the limit
//       const lastMatcher = matchers[matchers.length - 1];
//       const newMatcher = lastMatcher.slice(0, -1) + `, ${matcherPart}}`;

//       if (newMatcher.length <= MAX_MATCHER_LENGTH) {
//         // Update the last matcher
//         matchers[matchers.length - 1] = newMatcher;
//       } else {
//         // Start a new matcher
//         matchers.push(`{${matcherPart}}`);
//       }
//     }
//   };

//   // Process filters first
//   if (isAdHocFiltersVariable(varFilters) && varFilters.state.filters) {
//     const filters = varFilters.state.filters;
//     for (const filter of filters) {
//       if (filter.key && filter.value) {
//         const matcherPart = buildMatcherString(filter.key, [filter.value]);
//         addToMatchers(matcherPart);
//       }
//     }
//   }

//   // Process jobs
//   if (jobs && jobs.length > 0) {
//     let currentJobBatch: string[] = [];

//     for (const job of jobs) {
//       currentJobBatch.push(job);
//       const matcherPart = buildMatcherString('job', currentJobBatch);

//       // Check if adding this batch would exceed the limit
//       const lastMatcher = matchers[matchers.length - 1] || '';
//       const newMatcher = lastMatcher ? lastMatcher.slice(0, -1) + `, ${matcherPart}}` : `{${matcherPart}}`;

//       if (newMatcher.length > MAX_MATCHER_LENGTH) {
//         // If we have a batch, add it to matchers
//         if (currentJobBatch.length > 1) {
//           addToMatchers(buildMatcherString('job', currentJobBatch.slice(0, -1)));
//           currentJobBatch = [job];
//         } else {
//           // Single job is too long, skip it
//           currentJobBatch = [];
//         }
//       }
//     }

//     // Add any remaining jobs
//     if (currentJobBatch.length > 0) {
//       addToMatchers(buildMatcherString('job', currentJobBatch));
//     }
//   }

//   // Process instances
//   if (instances && instances.length > 0) {
//     let currentInstanceBatch: string[] = [];

//     for (const instance of instances) {
//       currentInstanceBatch.push(instance);
//       const matcherPart = buildMatcherString('instance', currentInstanceBatch);

//       // Check if adding this batch would exceed the limit
//       const lastMatcher = matchers[matchers.length - 1] || '';
//       const newMatcher = lastMatcher ? lastMatcher.slice(0, -1) + `, ${matcherPart}}` : `{${matcherPart}}`;

//       if (newMatcher.length > MAX_MATCHER_LENGTH) {
//         // If we have a batch, add it to matchers
//         if (currentInstanceBatch.length > 1) {
//           addToMatchers(buildMatcherString('instance', currentInstanceBatch.slice(0, -1)));
//           currentInstanceBatch = [instance];
//         } else {
//           // Single instance is too long, skip it
//           currentInstanceBatch = [];
//         }
//       }
//     }

//     // Add any remaining instances
//     if (currentInstanceBatch.length > 0) {
//       addToMatchers(buildMatcherString('instance', currentInstanceBatch));
//     }
//   }

//   return matchers;
// }

// export class OtelDataSource extends RuntimeDataSource {
//   static uid = 'grafana-prometheus-otel-datasource';

//   constructor() {
//     super(OtelDataSource.uid, OtelDataSource.uid);
//   }

//   async query(request: DataQueryRequest): Promise<DataQueryResponse> {
//     return {
//       state: LoadingState.Done,
//       data: [
//         {
//           name: 'Labels',
//           fields: [
//             {
//               name: null,
//               type: FieldType.other,
//               values: [],
//               config: {},
//             },
//           ],
//           length: 0,
//         },
//       ],
//     };
//   }

//   async metricFindQuery(query: string, options: LegacyMetricFindQueryOptions): Promise<MetricFindValue[]> {
//     const sceneObject = options.scopedVars?.__sceneObject?.valueOf() as SceneObject;
//     const timeRange = sceneGraph.getTimeRange(sceneObject).state.value;
//     const datasourceUid = sceneGraph.interpolate(sceneObject, VAR_DATASOURCE_EXPR);
//     // const timeRange: RawTimeRange | undefined = sceneObject.state.$timeRange?.state;
//     const otelResourcesVariable = sceneGraph.lookupVariable(VAR_OTEL_RESOURCES, sceneObject);
//     const otelResourcesExpression = sceneGraph.interpolate(sceneObject, VAR_OTEL_RESOURCES_EXPR, {});
//     const filterExpression = sceneGraph.interpolate(sceneObject, VAR_FILTERS_EXPR, {});
//     const otelResourcesObject = getOtelResourcesObject(sceneObject);
//     const { jobs, instances } = await totalOtelResources(datasourceUid, timeRange, otelResourcesObject.filters);

//     const varFilters = sceneGraph.lookupVariable(VAR_FILTERS, sceneObject);

//     // Build matchers array
//     const matchers = buildMatchers(varFilters, jobs, instances);

//     // Use the matchers array for the query
//     // const matcher = matchers.length > 0 ? matchers.join('|') : '';

//     const ds = (await OtelDataSource.getPrometheusDataSource(sceneObject)) as PrometheusDatasource;
//     if (!ds) {
//       return [];
//     }

//     let metricsList: string[] = [];

//     let removeRules = query.startsWith('removeRules');

//     // Iterate over the matchers and fetch metrics for each matcher, creating a new collection that uses Promise.all
//     if (matchers.length > 0) {
//       // Create an array of promises for each matcher
//       const metricPromises = matchers.map(async (matcher) => {
//         try {
//           if (ds.languageProvider.fetchLabelValues.length === 2) {
//             // @ts-ignore: Ignoring type error due to breaking change in fetchLabelValues signature
//             return await ds.languageProvider.fetchSeriesValuesWithMatch(timeRange, '__name__', matcher);
//           } else {
//             return await ds.languageProvider.fetchSeriesValuesWithMatch('__name__', matcher);
//           }
//         } catch (error) {
//           console.error(`Error fetching metrics for matcher ${matcher}:`, error);
//           return [];
//         }
//       });

//       // Wait for all promises to resolve
//       const results = await Promise.all(metricPromises);

//       // Flatten the results into a single array of metrics
//       metricsList = results.flat();
//       debugger;
//       // Remove duplicates
//       metricsList = [...new Set(metricsList)];
//     } else {
//       // If no matchers, use an empty string as the matcher
//       const matcher = '';
//       if (ds.languageProvider.fetchLabelValues.length === 2) {
//         // @ts-ignore: Ignoring type error due to breaking change in fetchLabelValues signature
//         metricsList = await ds.languageProvider.fetchSeriesValuesWithMatch(timeRange, '__name__', matcher);
//       } else {
//         metricsList = await ds.languageProvider.fetchSeriesValuesWithMatch('__name__', matcher);
//       }
//     }

//     if (removeRules) {
//       metricsList = metricsList.filter((metricName) => !isPrometheusRule(metricName));
//     }
//     return metricsList.map((metricName) => ({ value: metricName, text: metricName }));
//   }

//   static async getPrometheusDataSource(sceneObject: SceneObject): Promise<DataSourceApi | undefined> {
//     try {
//       const dsVariable = sceneGraph.findByKey(sceneObject, VAR_DATASOURCE) as DataSourceVariable;
//       const uid = (dsVariable?.state.value as string) ?? '';

//       return await getDataSourceSrv().get({ uid });
//     } catch (error) {
//       console.error('Error getting Prometheus data source!');
//       console.error(error);

//       return undefined;
//     }
//   }

//   async testDatasource(): Promise<TestDataSourceResponse> {
//     return {
//       status: 'success',
//       message: 'OK',
//     };
//   }
// }
