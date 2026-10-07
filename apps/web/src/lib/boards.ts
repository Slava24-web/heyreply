/** Job boards that have their own landing page: the ones where the extension also reads statuses from "my applications". */
export const BOARD_SLUGS = ['hh', 'linkedin', 'habr', 'indeed'] as const;
export type BoardSlug = (typeof BOARD_SLUGS)[number];
export const isBoardSlug = (v: string): v is BoardSlug => (BOARD_SLUGS as readonly string[]).includes(v);
