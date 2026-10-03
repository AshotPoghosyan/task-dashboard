import { z } from 'zod';
import { api, ApiError } from './client';

afterEach(() => vi.unstubAllGlobals());

describe('api', () => {
  it('throws ApiError (not SyntaxError) for a non-JSON error body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<html>Bad Gateway</html>', { status: 502 })),
    );
    await expect(api('/x', { schema: z.unknown() })).rejects.toMatchObject({
      status: 502,
      code: 'HTTP_ERROR',
    });
    await expect(api('/x', { schema: z.unknown() })).rejects.toBeInstanceOf(ApiError);
  });
});
