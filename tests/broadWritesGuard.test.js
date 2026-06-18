import test from 'node:test';
import { execFileSync } from 'node:child_process';

test('broad write guard stays green', () => {
    execFileSync(process.execPath, ['scripts/check_broad_writes.js'], {
        cwd: process.cwd(),
        stdio: 'pipe',
    });
});
