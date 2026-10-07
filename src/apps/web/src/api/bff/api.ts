/**
 * Where this client's API is in the BFF.
 *
 * The version is in the path, and each client asks for its own: `/api` is the
 * format the previous client reads, and `/api/v2` is this one's (0009 in
 * src/decisions, digdir/kunnskapsassistenten). A response can then be read
 * from its URL alone. `/auth` is not versioned.
 */
export const BFF_API = '/api/v2';
