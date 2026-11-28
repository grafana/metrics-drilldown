const ESCAPE = '\\';
const SEPARATOR = ',';

/**
 * Writes the selected values as one URL value, separated by commas like the other filters of the sidebar.
 * A comma or a backslash inside a value is escaped with a backslash, so that a value such as `a,b` stays one value.
 * A value without these characters is written as it is, so URLs that were written without escaping still read the same.
 * Values must not be empty, because an empty value is dropped when the URL value is read.
 */
export function joinUrlValues(values: string[]): string {
  return values.map((value) => value.replace(/[\\,]/g, (char) => `${ESCAPE}${char}`)).join(SEPARATOR);
}

/**
 * Reads the values of a URL value written by `joinUrlValues`. Values are kept exactly as written, with no trimming,
 * because a service name can start or end with a space. Empty values are dropped.
 * A backslash at the very end of the text has nothing to escape and is kept as a backslash.
 */
export function splitUrlValues(text: string): string[] {
  const values: string[] = [];
  let current = '';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === ESCAPE && i + 1 < text.length) {
      i++;
      current += text[i];
    } else if (char === SEPARATOR) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current);

  return values.filter((value) => value !== '');
}
