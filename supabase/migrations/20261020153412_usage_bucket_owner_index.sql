-- Account deletion should find its operational counters without a table scan.
create index usage_buckets_owner on binder_private.usage_buckets(owner_id);
