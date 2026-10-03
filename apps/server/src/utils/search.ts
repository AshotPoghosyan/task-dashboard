/** Escapes `%`, `_` and `\` so user input is matched literally by Prisma's `contains` (ILIKE). */
export const escapeLike = (term: string): string => term.replace(/[\\%_]/g, '\\$&');
