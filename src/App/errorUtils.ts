import { isObject } from '@grafana/data';

function isObjectWithStringProperty<T extends Record<string, unknown>>(
  object: T,
  propertyName: keyof T
): object is T & { [propertyName]: string } {
  return isObject(object) && propertyName in object && typeof object[propertyName] === 'string';
}

export function ensureErrorObject(error: any, defaultMessage: string): Error {
  if (error instanceof Error) {
    return error;
  }
  if (typeof error === 'string') {
    return new Error(error);
  }
  if (isObjectWithStringProperty(error, 'message')) {
    return new Error(error.message);
  }
  return new Error(defaultMessage);
}
