/**
 * Utility type that converts a string to snake_case format
 * @example SnakeCase<'Some String'> -> "some_string"
 */
export type SnakeCase<S extends string> = S extends `${infer T}${infer U}`
  ? `${T extends Capitalize<T> ? Lowercase<T> : T}${SnakeCaseInner<U>}`
  : S;

type SnakeCaseInner<S extends string> = S extends `${infer T}${infer U}`
  ? T extends ' '
    ? `_${SnakeCaseInner<U>}`
    : T extends Capitalize<T>
    ? `${Lowercase<T>}${SnakeCaseInner<U>}`
    : `${T}${SnakeCaseInner<U>}`
  : S;
