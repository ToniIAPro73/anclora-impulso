-- Marker read by the test guard. Production databases do not carry it.
DO $$
BEGIN
  EXECUTE format('ALTER DATABASE %I SET anclora.test_marker = %L', current_database(), 'impulso-test-v1');
END $$;
