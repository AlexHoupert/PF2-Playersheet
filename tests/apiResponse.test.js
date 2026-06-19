import test from 'node:test';
import assert from 'node:assert/strict';
import { readJsonApiResponse } from '../src/shared/utils/apiResponse.js';

const makeResponse = ({ ok = true, status = 200, statusText = 'OK', body = '' } = {}) => ({
    ok,
    status,
    statusText,
    text: async () => body,
});

test('readJsonApiResponse returns parsed JSON for successful responses', async () => {
    const data = await readJsonApiResponse(makeResponse({ body: '{"success":true}' }), 'Save spell');
    assert.deepEqual(data, { success: true });
});

test('readJsonApiResponse reports non-JSON page text clearly', async () => {
    await assert.rejects(
        () => readJsonApiResponse(makeResponse({ body: 'The page could not be found' }), 'Save spell'),
        /Save spell returned non-JSON response \(200 OK\): The page could not be found/
    );
});

test('readJsonApiResponse preserves JSON error messages', async () => {
    await assert.rejects(
        () => readJsonApiResponse(makeResponse({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
            body: '{"error":"File save failed"}',
        }), 'Save spell'),
        /Save spell failed: File save failed/
    );
});
