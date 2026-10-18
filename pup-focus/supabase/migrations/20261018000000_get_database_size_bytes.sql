-- Function to return combined PostgreSQL database tables + Supabase Storage buckets size in bytes
CREATE OR REPLACE FUNCTION public.get_database_size_bytes()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage, pg_temp
AS $$
DECLARE
  v_db_bytes bigint := 0;
  v_bucket_bytes bigint := 0;
BEGIN
  SELECT pg_database_size(current_database()) INTO v_db_bytes;

  BEGIN
    SELECT COALESCE(
      SUM(
        COALESCE(
          NULLIF(regexp_replace(metadata->>'size', '[^0-9]', '', 'g'), '')::bigint,
          NULLIF(regexp_replace(metadata->>'contentLength', '[^0-9]', '', 'g'), '')::bigint,
          0
        )
      ),
      0
    )::bigint
    INTO v_bucket_bytes
    FROM storage.objects;
  EXCEPTION WHEN OTHERS THEN
    v_bucket_bytes := 0;
  END;

  RETURN COALESCE(v_db_bytes, 0) + COALESCE(v_bucket_bytes, 0);
END;
$$;

-- Detailed breakdown of all database tables and all storage buckets
CREATE OR REPLACE FUNCTION public.get_storage_capacity_breakdown()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage, pg_temp
AS $$
DECLARE
  v_db_bytes bigint := 0;
  v_tables_bytes bigint := 0;
  v_table_count integer := 0;
  v_bucket_bytes bigint := 0;
  v_bucket_count integer := 0;
  v_object_count integer := 0;
BEGIN
  SELECT pg_database_size(current_database()) INTO v_db_bytes;

  SELECT
    COALESCE(SUM(pg_total_relation_size(c.oid)), 0)::bigint,
    COUNT(*)::integer
  INTO v_tables_bytes, v_table_count
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind IN ('r', 'p', 'm')
    AND n.nspname = 'public';

  BEGIN
    SELECT COUNT(*)::integer INTO v_bucket_count FROM storage.buckets;

    SELECT
      COALESCE(
        SUM(
          COALESCE(
            NULLIF(regexp_replace(metadata->>'size', '[^0-9]', '', 'g'), '')::bigint,
            NULLIF(regexp_replace(metadata->>'contentLength', '[^0-9]', '', 'g'), '')::bigint,
            0
          )
        ),
        0
      )::bigint,
      COUNT(*)::integer
    INTO v_bucket_bytes, v_object_count
    FROM storage.objects;
  EXCEPTION WHEN OTHERS THEN
    v_bucket_count := 0;
    v_bucket_bytes := 0;
    v_object_count := 0;
  END;

  RETURN jsonb_build_object(
    'dbBytes', COALESCE(v_db_bytes, 0),
    'tablesBytes', COALESCE(v_tables_bytes, 0),
    'tableCount', COALESCE(v_table_count, 0),
    'bucketBytes', COALESCE(v_bucket_bytes, 0),
    'bucketCount', COALESCE(v_bucket_count, 0),
    'objectCount', COALESCE(v_object_count, 0),
    'totalBytes', COALESCE(v_db_bytes, 0) + COALESCE(v_bucket_bytes, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_database_size_bytes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_database_size_bytes() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_storage_capacity_breakdown() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_storage_capacity_breakdown() TO authenticated, service_role;


