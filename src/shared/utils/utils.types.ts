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

/**
 * Utility type that extracts the type of items in a set
 * @example ItemsInSet<Set<string>> -> string
 * @example ItemsInSet<Set<number>> -> number
 * @example ItemsInSet<Set<'a' | 'b' | 'c'>> -> 'a' | 'b' | 'c'
 */
export type ItemsInSet<T extends Set<unknown>> = T extends Set<infer U> ? U : never;
