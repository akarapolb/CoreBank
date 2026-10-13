package org.fabor.ledger.application;

import org.fabor.ledger.domain.AccountId;
import org.fabor.platform.tenancy.TenantId;

/**
 * Maps an account to the shard (database) that owns it. Accounts that must live together, such as all
 * accounts of one contract, share a <em>placement key</em>: the text after the last {@code '@'} in the
 * account id ({@code "fee@contract-9"} lives where {@code "contract-9"} lives).
 */
public interface ShardDirectory {
    int shardCount();

    int shardOf(TenantId tenant, AccountId account);

    static String placementKey(AccountId account) {
        String v = account.value();
        int at = v.lastIndexOf('@');
        return at < 0 ? v : v.substring(at + 1);
    }

    /** Stable hash placement. Changing {@code shardCount} moves accounts: resharding is a migration, not a config edit. */
    static ShardDirectory hashed(int shardCount) {
        if (shardCount < 1) {
            throw new IllegalArgumentException("shardCount must be >= 1");
        }
        return new ShardDirectory() {
            @Override
            public int shardCount() {
                return shardCount;
            }

            @Override
            public int shardOf(TenantId tenant, AccountId account) {
                return Math.floorMod((tenant.value() + "/" + placementKey(account)).hashCode(), shardCount);
            }
        };
    }
}
