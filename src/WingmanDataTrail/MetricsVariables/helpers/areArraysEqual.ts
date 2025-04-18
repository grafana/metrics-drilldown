import { isEqual } from 'lodash';

export const areArraysEqual = (array1: any[], array2: any[]) =>
  array1.length === array2.length && isEqual(array1, array2);
