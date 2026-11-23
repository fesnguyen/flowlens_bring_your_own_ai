import { Filter, FilterConditions, ForgeKvsAPIError, kvs } from '@forge/kvs';
import type { InvestigationStore, RecordValue } from './investigation_storage';

const entityName = 'investigation-record';

/** Compare the directory or preference revision in the same transaction as all writes. */
export const forgeStorage: InvestigationStore = {
  get: <T extends object>(key: string) => kvs.entity<RecordValue<T>>(entityName).get(key),
  async commit(key, expected, changes) {
    const conditions = new Filter<RecordValue<object>>().and(
      'revision', expected === null ? FilterConditions.notExists() : FilterConditions.equalTo(expected),
    );
    const transaction = kvs.transact();
    for (const change of changes) {
      if ('delete' in change) transaction.delete(change.key, { entityName });
      else transaction.set(change.key, change.value, {
        entityName,
        ...(change.key === key && { conditions }),
      });
    }
    try {
      await transaction.execute();
      return true;
    } catch (error) {
      // Retry only a rejected transaction with a changed guard. A transport or server failure
      // can have an unknown outcome, so callers must reload before attempting another import.
      if (error instanceof ForgeKvsAPIError && [400, 409].includes(error.responseDetails.status)) {
        const current = await kvs.entity<RecordValue<object>>(entityName).get(key);
        if ((current?.revision ?? null) !== expected) return false;
      }
      throw error;
    }
  },
};
