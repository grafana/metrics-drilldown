import { type DataFrame, type Field } from '@grafana/data';

interface FieldWithEntitiesNaN extends Field<any> {
  entities: {
    NaN: number[];
  };
}

/**
 * Checks if all data in the series contains only NaN values,
 * short-circuiting if any frame contains non-NaN values.
 */
export function isAllDataNaN(series: DataFrame[]): boolean {
  return series.every(isDataFrameAllNaN);
}

/**
 * Checks if all the values in the DataFrame are NaN
 */
function isDataFrameAllNaN(frame: DataFrame): boolean {
  const valuesField = frame.fields.find((field) => field.name === 'Value');

  if (!valuesField || !isFieldWithEntitiesNaN(valuesField)) {
    return false;
  }

  return valuesField.entities.NaN.length === frame.length;
}

function isFieldWithEntitiesNaN(field: Field): field is FieldWithEntitiesNaN {
  return 'entities' in field && Array.isArray((field as FieldWithEntitiesNaN).entities?.NaN);
}
