/**
 * Thrown when the API returns a non-2xx response. Carries the RFC 9457 problem
 * details the API emits, so callers get the machine-readable `code` and the
 * `requestId` needed to find the matching server log line — not a bare fetch
 * rejection.
 */
export class ExerciseDBError extends Error {
    /**
     * @param {object} params
     * @param {number} params.status - HTTP status code.
     * @param {string} params.message - Human-readable message (the problem `detail` or `title`).
     * @param {string} [params.code] - Machine-readable error code (RFC 9457 extension).
     * @param {string} [params.type] - Problem type URI.
     * @param {string} [params.requestId] - Server request id for support/log correlation.
     */
    constructor({ status, message, code, type, requestId }: {
        status: number;
        message: string;
        code?: string | undefined;
        type?: string | undefined;
        requestId?: string | undefined;
    });
    status: number;
    code: string | undefined;
    type: string | undefined;
    requestId: string | undefined;
}
