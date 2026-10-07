/** Escapes the characters that mean something in a SQL LIKE pattern, so a search for "50%" finds "50%" and not everything. */
export const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
