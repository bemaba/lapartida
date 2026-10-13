


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."clock_in"() RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_entry_id UUID;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Debes iniciar sesión';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.user_id = v_user_id
          AND p.active = TRUE
    ) THEN
        RAISE EXCEPTION 'Perfil inexistente o cuenta desactivada';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.time_entries t
        WHERE t.user_id = v_user_id
          AND t.clock_out IS NULL
    ) THEN
        RAISE EXCEPTION 'Ya tienes una jornada abierta';
    END IF;

    INSERT INTO public.time_entries (user_id)
    VALUES (v_user_id)
    RETURNING id INTO v_entry_id;

    RETURN v_entry_id;
END;
$$;


ALTER FUNCTION "public"."clock_in"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."clock_out"() RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_entry_id UUID;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Debes iniciar sesión';
    END IF;

    SELECT t.id
    INTO v_entry_id
    FROM public.time_entries t
    WHERE t.user_id = v_user_id
      AND t.clock_out IS NULL
    ORDER BY t.clock_in DESC
    LIMIT 1
    FOR UPDATE;

    IF v_entry_id IS NULL THEN
        RAISE EXCEPTION 'No tienes una jornada abierta';
    END IF;

    UPDATE public.breaks
    SET ended_at = NOW()
    WHERE time_entry_id = v_entry_id
      AND ended_at IS NULL;

    UPDATE public.time_entries
    SET clock_out = NOW(),
        updated_at = NOW()
    WHERE id = v_entry_id;

    RETURN v_entry_id;
END;
$$;


ALTER FUNCTION "public"."clock_out"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."end_break"() RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_break_id UUID;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Debes iniciar sesión';
    END IF;

    SELECT b.id
    INTO v_break_id
    FROM public.breaks b
    JOIN public.time_entries t ON t.id = b.time_entry_id
    WHERE t.user_id = v_user_id
      AND t.clock_out IS NULL
      AND b.ended_at IS NULL
    ORDER BY b.started_at DESC
    LIMIT 1
    FOR UPDATE OF b;

    IF v_break_id IS NULL THEN
        RAISE EXCEPTION 'No tienes ninguna pausa abierta';
    END IF;

    UPDATE public.breaks
    SET ended_at = NOW()
    WHERE id = v_break_id;

    RETURN v_break_id;
END;
$$;


ALTER FUNCTION "public"."end_break"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    INSERT INTO public.profiles (user_id, full_name)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data ->> 'full_name', '')
    )
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE user_id = (SELECT auth.uid())
          AND role = 'admin'
          AND active = TRUE
    );
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_record_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    INSERT INTO public.audit_log (
        table_name, record_id, action, changed_by, old_data, new_data
    )
    VALUES (
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id)::TEXT,
        TG_OP,
        auth.uid(),
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE')
             THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE')
             THEN to_jsonb(NEW) ELSE NULL END
    );

    RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."log_record_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."start_break"() RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_entry_id UUID;
    v_break_id UUID;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Debes iniciar sesión';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.user_id = v_user_id
          AND p.active = TRUE
    ) THEN
        RAISE EXCEPTION 'Perfil inexistente o cuenta desactivada';
    END IF;

    SELECT t.id
    INTO v_entry_id
    FROM public.time_entries t
    WHERE t.user_id = v_user_id
      AND t.clock_out IS NULL
    ORDER BY t.clock_in DESC
    LIMIT 1
    FOR UPDATE;

    IF v_entry_id IS NULL THEN
        RAISE EXCEPTION 'No tienes una jornada abierta';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.breaks b
        WHERE b.time_entry_id = v_entry_id
          AND b.ended_at IS NULL
    ) THEN
        RAISE EXCEPTION 'Ya tienes una pausa abierta';
    END IF;

    INSERT INTO public.breaks (time_entry_id)
    VALUES (v_entry_id)
    RETURNING id INTO v_break_id;

    RETURN v_break_id;
END;
$$;


ALTER FUNCTION "public"."start_break"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."audit_log" (
    "id" bigint NOT NULL,
    "table_name" "text" NOT NULL,
    "record_id" "text" NOT NULL,
    "action" "text" NOT NULL,
    "changed_by" "uuid",
    "changed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "old_data" "jsonb",
    "new_data" "jsonb"
);


ALTER TABLE "public"."audit_log" OWNER TO "postgres";


ALTER TABLE "public"."audit_log" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."audit_log_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."breaks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "time_entry_id" "uuid" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ended_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "breaks_check" CHECK ((("ended_at" IS NULL) OR ("ended_at" >= "started_at")))
);


ALTER TABLE "public"."breaks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "user_id" "uuid" NOT NULL,
    "full_name" "text" DEFAULT ''::"text" NOT NULL,
    "role" "text" DEFAULT 'employee'::"text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'employee'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shifts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "starts_at" timestamp with time zone NOT NULL,
    "ends_at" timestamp with time zone NOT NULL,
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "shifts_check" CHECK (("ends_at" > "starts_at"))
);


ALTER TABLE "public"."shifts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."time_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "clock_in" timestamp with time zone DEFAULT "now"() NOT NULL,
    "clock_out" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "time_entries_check" CHECK ((("clock_out" IS NULL) OR ("clock_out" >= "clock_in")))
);


ALTER TABLE "public"."time_entries" OWNER TO "postgres";


ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."breaks"
    ADD CONSTRAINT "breaks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."shifts"
    ADD CONSTRAINT "shifts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."time_entries"
    ADD CONSTRAINT "time_entries_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_breaks_time_entry" ON "public"."breaks" USING "btree" ("time_entry_id");



CREATE UNIQUE INDEX "idx_one_open_break_per_entry" ON "public"."breaks" USING "btree" ("time_entry_id") WHERE ("ended_at" IS NULL);



CREATE UNIQUE INDEX "idx_one_open_entry_per_user" ON "public"."time_entries" USING "btree" ("user_id") WHERE ("clock_out" IS NULL);



CREATE INDEX "idx_time_entries_user_clock_in" ON "public"."time_entries" USING "btree" ("user_id", "clock_in" DESC);



CREATE OR REPLACE TRIGGER "audit_breaks" AFTER INSERT OR DELETE OR UPDATE ON "public"."breaks" FOR EACH ROW EXECUTE FUNCTION "public"."log_record_change"();



CREATE OR REPLACE TRIGGER "audit_shifts" AFTER INSERT OR DELETE OR UPDATE ON "public"."shifts" FOR EACH ROW EXECUTE FUNCTION "public"."log_record_change"();



CREATE OR REPLACE TRIGGER "audit_time_entries" AFTER INSERT OR DELETE OR UPDATE ON "public"."time_entries" FOR EACH ROW EXECUTE FUNCTION "public"."log_record_change"();



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."breaks"
    ADD CONSTRAINT "breaks_time_entry_id_fkey" FOREIGN KEY ("time_entry_id") REFERENCES "public"."time_entries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shifts"
    ADD CONSTRAINT "shifts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id");



ALTER TABLE ONLY "public"."shifts"
    ADD CONSTRAINT "shifts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id");



ALTER TABLE ONLY "public"."time_entries"
    ADD CONSTRAINT "time_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id");



CREATE POLICY "Admin manages profiles" ON "public"."profiles" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin manages shifts" ON "public"."shifts" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin reads audit log" ON "public"."audit_log" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Read own breaks or admin" ON "public"."breaks" FOR SELECT TO "authenticated" USING (("public"."is_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."time_entries" "t"
  WHERE (("t"."id" = "breaks"."time_entry_id") AND ("t"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "Read own entries or admin" ON "public"."time_entries" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_admin"()));



CREATE POLICY "Read own profile or admin" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_admin"()));



CREATE POLICY "Read own shifts or admin" ON "public"."shifts" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_admin"()));



ALTER TABLE "public"."audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."breaks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shifts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."time_entries" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."clock_in"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."clock_in"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."clock_in"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."clock_out"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."clock_out"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."clock_out"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."end_break"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."end_break"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."end_break"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_record_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_record_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_record_change"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."start_break"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."start_break"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."start_break"() TO "service_role";



GRANT ALL ON TABLE "public"."audit_log" TO "service_role";
GRANT SELECT ON TABLE "public"."audit_log" TO "authenticated";



GRANT ALL ON SEQUENCE "public"."audit_log_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."breaks" TO "service_role";
GRANT SELECT ON TABLE "public"."breaks" TO "authenticated";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."shifts" TO "anon";
GRANT ALL ON TABLE "public"."shifts" TO "authenticated";
GRANT ALL ON TABLE "public"."shifts" TO "service_role";



GRANT ALL ON TABLE "public"."time_entries" TO "service_role";
GRANT SELECT ON TABLE "public"."time_entries" TO "authenticated";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";








-- Recreate the auth.users trigger that provisions a profile for each new user.
-- The public-only dump does not include triggers attached to auth.users.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- BASELINE ONLY: describes the schema that already exists remotely.
-- NEVER execute this migration against the existing project with db push.
-- After review, register version 20261012000000 as already applied with migration repair.
