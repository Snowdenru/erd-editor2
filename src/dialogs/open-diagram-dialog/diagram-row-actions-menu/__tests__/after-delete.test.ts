import { describe, expect, it } from 'vitest';
import { shouldLeaveAfterDelete } from '../after-delete';

describe('shouldLeaveAfterDelete', () => {
    it('удалена текущая схема', () => {
        expect(
            shouldLeaveAfterDelete({
                deletedId: 'a',
                currentId: 'a',
                totalBefore: 3,
            })
        ).toBe(true);
    });
    it('удалена единственная схема', () => {
        expect(
            shouldLeaveAfterDelete({
                deletedId: 'a',
                currentId: 'b',
                totalBefore: 1,
            })
        ).toBe(true);
    });
    it('удалена другая схема при нескольких', () => {
        expect(
            shouldLeaveAfterDelete({
                deletedId: 'a',
                currentId: 'b',
                totalBefore: 3,
            })
        ).toBe(false);
    });
});
