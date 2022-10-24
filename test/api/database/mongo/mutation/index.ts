import testBulkUpsert from './bulkUpsert';
import testUpdateGitIgnore from './updateGitIgnore';
import testUpdateTime from './updateTime';
import testCases from 'cases-of-test';
import { describe } from 'vitest';

const testMutation = () => {
    describe('Mutation', () => {
        testCases({
            tests: [[testBulkUpsert], [testUpdateGitIgnore], [testUpdateTime]],
        });
    });
};

export default testMutation;
