--
-- ORVX — initial database (schema + seed data)
--
-- Generated from backend/src/db/migrations/*.sql (001-017) plus
-- `npm run seed:clean`, so it matches exactly what the application expects.
--
-- Contents:
--     17 tables, 1 trigger function, all indexes/constraints
--     12 attributes                (the FIFA-style attribute definitions)
--     10 drills + 13 attribute boosts   (the base drill catalogue)
--      2 competitions              (OVRX League, OVRX Cup — empty shells)
--      2 users + 1 coach record    (admin + Platform Evaluator)
--     17 schema_migrations rows    (so `npm run migrate` is a no-op after this)
--      0 clubs                     (the admin provisions clubs after deploy)
--
-- Load it into a fresh Railway Postgres:
--     psql "$DATABASE_PUBLIC_URL" -f backend/src/db/init.sql
--
-- >> SECURITY: the two seeded accounts use the default password committed to
-- >> this repo. Change both before exposing the deployment — see the
-- >> "Rotate the seeded passwords" note at the bottom of this file.
--

BEGIN;
--
-- PostgreSQL database dump
--



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

--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: attributes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attributes (
    id integer NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    position_group text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT attributes_position_group_check CHECK ((position_group = ANY (ARRAY['outfield'::text, 'goalkeeper'::text])))
);


--
-- Name: attributes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.attributes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: attributes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.attributes_id_seq OWNED BY public.attributes.id;


--
-- Name: club_applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.club_applications (
    id integer NOT NULL,
    club_id integer NOT NULL,
    player_id integer NOT NULL,
    message text,
    status text DEFAULT 'pending'::text NOT NULL,
    decided_by integer,
    decided_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT club_applications_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text, 'withdrawn'::text])))
);


--
-- Name: club_applications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.club_applications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: club_applications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.club_applications_id_seq OWNED BY public.club_applications.id;


--
-- Name: club_memberships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.club_memberships (
    id integer NOT NULL,
    club_id integer NOT NULL,
    player_id integer NOT NULL,
    "position" text,
    active boolean DEFAULT true NOT NULL,
    signed_at timestamp with time zone DEFAULT now() NOT NULL,
    released_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT club_memberships_position_check CHECK ((("position" IS NULL) OR ("position" = ANY (ARRAY['Attacker'::text, 'Defender'::text, 'Goalkeeper'::text]))))
);


--
-- Name: club_memberships_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.club_memberships_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: club_memberships_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.club_memberships_id_seq OWNED BY public.club_memberships.id;


--
-- Name: clubs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clubs (
    id integer NOT NULL,
    name text NOT NULL,
    crest_code text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    slot integer,
    division text,
    head_coach_id integer,
    archived boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    archived_at timestamp with time zone,
    CONSTRAINT clubs_slot_check CHECK (((slot >= 1) AND (slot <= 8)))
);


--
-- Name: clubs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.clubs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: clubs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.clubs_id_seq OWNED BY public.clubs.id;


--
-- Name: coach_applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coach_applications (
    id integer NOT NULL,
    user_id integer NOT NULL,
    full_name text NOT NULL,
    years_experience integer NOT NULL,
    license_number text,
    club_name text NOT NULL,
    squad_capacity integer DEFAULT 16 NOT NULL,
    credential_doc_url text,
    club_logo_url text,
    status text DEFAULT 'pending'::text NOT NULL,
    review_note text,
    reviewed_by integer,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT coach_applications_squad_capacity_check CHECK (((squad_capacity >= 1) AND (squad_capacity <= 16))),
    CONSTRAINT coach_applications_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'declined'::text]))),
    CONSTRAINT coach_applications_years_experience_check CHECK ((years_experience >= 0))
);


--
-- Name: coach_applications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.coach_applications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: coach_applications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.coach_applications_id_seq OWNED BY public.coach_applications.id;


--
-- Name: coaches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coaches (
    id integer NOT NULL,
    user_id integer NOT NULL,
    display_name text NOT NULL,
    years_experience integer DEFAULT 0 NOT NULL,
    license_number text,
    bio text,
    credential_doc_url text,
    avatar_url text,
    is_platform_evaluator boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT coaches_years_experience_check CHECK ((years_experience >= 0))
);


--
-- Name: coaches_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.coaches_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: coaches_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.coaches_id_seq OWNED BY public.coaches.id;


--
-- Name: competitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.competitions (
    id integer NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    season text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT competitions_type_check CHECK ((type = ANY (ARRAY['league'::text, 'knockout'::text])))
);


--
-- Name: competitions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.competitions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: competitions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.competitions_id_seq OWNED BY public.competitions.id;


--
-- Name: drill_attribute_boosts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.drill_attribute_boosts (
    id integer NOT NULL,
    drill_id integer NOT NULL,
    attribute_id integer NOT NULL,
    boost_value integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT drill_attribute_boosts_boost_value_check CHECK ((boost_value > 0))
);


--
-- Name: drill_attribute_boosts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.drill_attribute_boosts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: drill_attribute_boosts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.drill_attribute_boosts_id_seq OWNED BY public.drill_attribute_boosts.id;


--
-- Name: drill_submission_drills; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.drill_submission_drills (
    id integer CONSTRAINT session_drills_id_not_null NOT NULL,
    drill_submission_id integer CONSTRAINT session_drills_session_id_not_null NOT NULL,
    drill_id integer,
    "position" integer CONSTRAINT session_drills_position_not_null NOT NULL,
    name text CONSTRAINT session_drills_name_not_null NOT NULL,
    unit_kind text CONSTRAINT session_drills_unit_kind_not_null NOT NULL,
    sets integer CONSTRAINT session_drills_sets_not_null NOT NULL,
    reps integer CONSTRAINT session_drills_reps_not_null NOT NULL,
    boosts jsonb DEFAULT '{}'::jsonb CONSTRAINT session_drills_boosts_not_null NOT NULL,
    progress jsonb DEFAULT '[]'::jsonb CONSTRAINT session_drills_progress_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT session_drills_created_at_not_null NOT NULL,
    CONSTRAINT session_drills_position_check CHECK (("position" > 0)),
    CONSTRAINT session_drills_reps_check CHECK ((reps > 0)),
    CONSTRAINT session_drills_sets_check CHECK ((sets > 0)),
    CONSTRAINT session_drills_unit_kind_check CHECK ((unit_kind = ANY (ARRAY['reps'::text, 'secs'::text])))
);


--
-- Name: drill_submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.drill_submissions (
    id integer CONSTRAINT training_sessions_id_not_null NOT NULL,
    player_id integer CONSTRAINT training_sessions_player_id_not_null NOT NULL,
    name text CONSTRAINT training_sessions_name_not_null NOT NULL,
    focus text,
    total_time_minutes integer DEFAULT 0 CONSTRAINT training_sessions_total_time_minutes_not_null NOT NULL,
    status text DEFAULT 'active'::text CONSTRAINT training_sessions_status_not_null NOT NULL,
    video_url text,
    notes text,
    reviewer_name text,
    review_status text DEFAULT 'pending'::text CONSTRAINT training_sessions_review_status_not_null NOT NULL,
    started_at timestamp with time zone DEFAULT now() CONSTRAINT training_sessions_started_at_not_null NOT NULL,
    completed_at timestamp with time zone,
    submitted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT training_sessions_created_at_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT training_sessions_updated_at_not_null NOT NULL,
    review_feedback text,
    reviewed_at timestamp with time zone,
    reviewed_by integer,
    reviewer_coach_id integer,
    CONSTRAINT training_sessions_review_status_check CHECK ((review_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))),
    CONSTRAINT training_sessions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'completed'::text, 'submitted'::text]))),
    CONSTRAINT training_sessions_total_time_minutes_check CHECK ((total_time_minutes >= 0))
);


--
-- Name: drills; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.drills (
    id integer NOT NULL,
    name text NOT NULL,
    unit_kind text NOT NULL,
    default_sets integer NOT NULL,
    default_reps integer NOT NULL,
    seconds_per_set integer NOT NULL,
    created_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    level text DEFAULT 'Intermediate'::text NOT NULL,
    focus_label text DEFAULT ''::text NOT NULL,
    coach_display_name text,
    completions_count integer DEFAULT 0 NOT NULL,
    rating numeric(2,1) DEFAULT 0 NOT NULL,
    setup_text text DEFAULT ''::text NOT NULL,
    execution_text text DEFAULT ''::text NOT NULL,
    rule_text text DEFAULT ''::text NOT NULL,
    category text DEFAULT 'General'::text NOT NULL,
    position_group text,
    min_sets integer DEFAULT 1 NOT NULL,
    max_sets integer DEFAULT 20 NOT NULL,
    min_reps integer DEFAULT 1 NOT NULL,
    max_reps integer DEFAULT 300 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    demo_video_url text,
    CONSTRAINT chk_drills_rep_bounds CHECK ((max_reps >= min_reps)),
    CONSTRAINT chk_drills_set_bounds CHECK ((max_sets >= min_sets)),
    CONSTRAINT drills_completions_count_check CHECK ((completions_count >= 0)),
    CONSTRAINT drills_default_reps_check CHECK ((default_reps > 0)),
    CONSTRAINT drills_default_sets_check CHECK ((default_sets > 0)),
    CONSTRAINT drills_level_check CHECK ((level = ANY (ARRAY['Beginner'::text, 'Intermediate'::text, 'Elite'::text]))),
    CONSTRAINT drills_max_reps_check CHECK ((max_reps > 0)),
    CONSTRAINT drills_max_sets_check CHECK ((max_sets > 0)),
    CONSTRAINT drills_min_reps_check CHECK ((min_reps > 0)),
    CONSTRAINT drills_min_sets_check CHECK ((min_sets > 0)),
    CONSTRAINT drills_position_group_check CHECK (((position_group IS NULL) OR (position_group = ANY (ARRAY['outfield'::text, 'goalkeeper'::text, 'all'::text])))),
    CONSTRAINT drills_rating_check CHECK (((rating >= (0)::numeric) AND (rating <= (5)::numeric))),
    CONSTRAINT drills_seconds_per_set_check CHECK ((seconds_per_set > 0)),
    CONSTRAINT drills_unit_kind_check CHECK ((unit_kind = ANY (ARRAY['reps'::text, 'secs'::text])))
);


--
-- Name: drills_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.drills_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: drills_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.drills_id_seq OWNED BY public.drills.id;


--
-- Name: matches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.matches (
    id integer CONSTRAINT fixtures_id_not_null NOT NULL,
    competition_id integer CONSTRAINT fixtures_competition_id_not_null NOT NULL,
    round_label text,
    leg integer,
    home_club_id integer CONSTRAINT fixtures_home_club_id_not_null NOT NULL,
    away_club_id integer CONSTRAINT fixtures_away_club_id_not_null NOT NULL,
    home_score integer,
    away_score integer,
    status text DEFAULT 'scheduled'::text CONSTRAINT fixtures_status_not_null NOT NULL,
    scheduled_at timestamp with time zone CONSTRAINT fixtures_scheduled_at_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT fixtures_created_at_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT fixtures_updated_at_not_null NOT NULL,
    CONSTRAINT chk_matches_score_matches_status CHECK ((((status = 'played'::text) AND (home_score IS NOT NULL) AND (away_score IS NOT NULL)) OR ((status = 'scheduled'::text) AND (home_score IS NULL) AND (away_score IS NULL)))),
    CONSTRAINT fixtures_away_score_check CHECK ((away_score >= 0)),
    CONSTRAINT fixtures_check CHECK ((away_club_id <> home_club_id)),
    CONSTRAINT fixtures_home_score_check CHECK ((home_score >= 0)),
    CONSTRAINT fixtures_leg_check CHECK ((leg = ANY (ARRAY[1, 2]))),
    CONSTRAINT fixtures_status_check CHECK ((status = ANY (ARRAY['scheduled'::text, 'played'::text])))
);


--
-- Name: fixtures_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.fixtures_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: fixtures_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.fixtures_id_seq OWNED BY public.matches.id;


--
-- Name: match_goals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.match_goals (
    id integer NOT NULL,
    match_id integer NOT NULL,
    club_id integer NOT NULL,
    scorer_name text NOT NULL,
    minute integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    player_id integer,
    CONSTRAINT match_goals_minute_check CHECK (((minute IS NULL) OR ((minute >= 1) AND (minute <= 130))))
);


--
-- Name: match_goals_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.match_goals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: match_goals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.match_goals_id_seq OWNED BY public.match_goals.id;


--
-- Name: player_attributes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.player_attributes (
    id integer NOT NULL,
    player_id integer NOT NULL,
    attribute_id integer NOT NULL,
    value integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT player_attributes_value_check CHECK (((value >= 0) AND (value <= 100)))
);


--
-- Name: player_attributes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.player_attributes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: player_attributes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.player_attributes_id_seq OWNED BY public.player_attributes.id;


--
-- Name: players; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.players (
    id integer NOT NULL,
    user_id integer NOT NULL,
    "position" text NOT NULL,
    dominant_foot text NOT NULL,
    height_cm integer NOT NULL,
    weight_kg integer NOT NULL,
    overall integer NOT NULL,
    tier text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT players_dominant_foot_check CHECK ((dominant_foot = ANY (ARRAY['Left'::text, 'Right'::text, 'Both'::text]))),
    CONSTRAINT players_height_cm_check CHECK (((height_cm >= 100) AND (height_cm <= 230))),
    CONSTRAINT players_overall_check CHECK (((overall >= 0) AND (overall <= 100))),
    CONSTRAINT players_position_check CHECK (("position" = ANY (ARRAY['Attacker'::text, 'Defender'::text, 'Goalkeeper'::text]))),
    CONSTRAINT players_tier_check CHECK ((tier = ANY (ARRAY['Bronze'::text, 'Silver'::text, 'Gold'::text]))),
    CONSTRAINT players_weight_kg_check CHECK (((weight_kg >= 30) AND (weight_kg <= 150)))
);


--
-- Name: players_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.players_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: players_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.players_id_seq OWNED BY public.players.id;


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    name text NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: session_drills_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.session_drills_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: session_drills_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.session_drills_id_seq OWNED BY public.drill_submission_drills.id;


--
-- Name: training_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.training_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: training_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.training_sessions_id_seq OWNED BY public.drill_submissions.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    role text DEFAULT 'player'::text NOT NULL,
    organization text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['player'::text, 'coach'::text, 'admin'::text])))
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: attributes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attributes ALTER COLUMN id SET DEFAULT nextval('public.attributes_id_seq'::regclass);


--
-- Name: club_applications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.club_applications ALTER COLUMN id SET DEFAULT nextval('public.club_applications_id_seq'::regclass);


--
-- Name: club_memberships id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.club_memberships ALTER COLUMN id SET DEFAULT nextval('public.club_memberships_id_seq'::regclass);


--
-- Name: clubs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clubs ALTER COLUMN id SET DEFAULT nextval('public.clubs_id_seq'::regclass);


--
-- Name: coach_applications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coach_applications ALTER COLUMN id SET DEFAULT nextval('public.coach_applications_id_seq'::regclass);


--
-- Name: coaches id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coaches ALTER COLUMN id SET DEFAULT nextval('public.coaches_id_seq'::regclass);


--
-- Name: competitions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competitions ALTER COLUMN id SET DEFAULT nextval('public.competitions_id_seq'::regclass);


--
-- Name: drill_attribute_boosts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drill_attribute_boosts ALTER COLUMN id SET DEFAULT nextval('public.drill_attribute_boosts_id_seq'::regclass);


--
-- Name: drill_submission_drills id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drill_submission_drills ALTER COLUMN id SET DEFAULT nextval('public.session_drills_id_seq'::regclass);


--
-- Name: drill_submissions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drill_submissions ALTER COLUMN id SET DEFAULT nextval('public.training_sessions_id_seq'::regclass);


--
-- Name: drills id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drills ALTER COLUMN id SET DEFAULT nextval('public.drills_id_seq'::regclass);


--
-- Name: match_goals id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_goals ALTER COLUMN id SET DEFAULT nextval('public.match_goals_id_seq'::regclass);


--
-- Name: matches id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matches ALTER COLUMN id SET DEFAULT nextval('public.fixtures_id_seq'::regclass);


--
-- Name: player_attributes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_attributes ALTER COLUMN id SET DEFAULT nextval('public.player_attributes_id_seq'::regclass);


--
-- Name: players id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.players ALTER COLUMN id SET DEFAULT nextval('public.players_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: attributes; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.attributes VALUES (1, 'pace', 'Pace', 'outfield', '2026-09-09 11:07:54.248092+03');
INSERT INTO public.attributes VALUES (2, 'shooting', 'Shooting', 'outfield', '2026-09-09 11:07:54.248092+03');
INSERT INTO public.attributes VALUES (3, 'passing', 'Passing', 'outfield', '2026-09-09 11:07:54.248092+03');
INSERT INTO public.attributes VALUES (4, 'dribbling', 'Dribbling', 'outfield', '2026-09-09 11:07:54.248092+03');
INSERT INTO public.attributes VALUES (5, 'defending', 'Defending', 'outfield', '2026-09-09 11:07:54.248092+03');
INSERT INTO public.attributes VALUES (6, 'physical', 'Physical', 'outfield', '2026-09-09 11:07:54.248092+03');
INSERT INTO public.attributes VALUES (7, 'diving', 'Diving', 'goalkeeper', '2026-09-09 11:07:54.248092+03');
INSERT INTO public.attributes VALUES (8, 'handling', 'Handling', 'goalkeeper', '2026-09-09 11:07:54.248092+03');
INSERT INTO public.attributes VALUES (9, 'kicking', 'Kicking', 'goalkeeper', '2026-09-09 11:07:54.248092+03');
INSERT INTO public.attributes VALUES (10, 'reflexes', 'Reflexes', 'goalkeeper', '2026-09-09 11:07:54.248092+03');
INSERT INTO public.attributes VALUES (11, 'speed', 'Speed', 'goalkeeper', '2026-09-09 11:07:54.248092+03');
INSERT INTO public.attributes VALUES (12, 'positioning', 'Positioning', 'goalkeeper', '2026-09-09 11:07:54.248092+03');


--
-- Data for Name: club_applications; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: club_memberships; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: clubs; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: coach_applications; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: coaches; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.coaches VALUES (1, 2, 'Abdulrahman Hawamdeh', 0, NULL, NULL, NULL, NULL, true, '2026-09-09 11:07:58.943081+03', '2026-09-09 11:07:58.943081+03');


--
-- Data for Name: competitions; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.competitions VALUES (1, 'OVRX League', 'league', '2025/26', '2026-09-09 11:07:54.30858+03');
INSERT INTO public.competitions VALUES (2, 'OVRX Cup', 'knockout', '2025/26', '2026-09-09 11:07:54.30858+03');


--
-- Data for Name: drill_attribute_boosts; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.drill_attribute_boosts VALUES (1, 1, 1, 2, '2026-09-09 11:07:54.269598+03');
INSERT INTO public.drill_attribute_boosts VALUES (2, 2, 4, 2, '2026-09-09 11:07:54.269598+03');
INSERT INTO public.drill_attribute_boosts VALUES (3, 3, 6, 1, '2026-09-09 11:07:54.269598+03');
INSERT INTO public.drill_attribute_boosts VALUES (4, 3, 1, 1, '2026-09-09 11:07:54.269598+03');
INSERT INTO public.drill_attribute_boosts VALUES (5, 4, 3, 2, '2026-09-09 11:07:54.269598+03');
INSERT INTO public.drill_attribute_boosts VALUES (6, 5, 2, 2, '2026-09-09 11:07:54.269598+03');
INSERT INTO public.drill_attribute_boosts VALUES (7, 6, 4, 1, '2026-09-09 11:07:54.269598+03');
INSERT INTO public.drill_attribute_boosts VALUES (8, 6, 1, 1, '2026-09-09 11:07:54.269598+03');
INSERT INTO public.drill_attribute_boosts VALUES (9, 7, 6, 2, '2026-09-09 11:07:54.269598+03');
INSERT INTO public.drill_attribute_boosts VALUES (10, 8, 5, 2, '2026-09-09 11:07:54.269598+03');
INSERT INTO public.drill_attribute_boosts VALUES (11, 9, 3, 1, '2026-09-09 11:07:54.269598+03');
INSERT INTO public.drill_attribute_boosts VALUES (12, 9, 2, 1, '2026-09-09 11:07:54.269598+03');
INSERT INTO public.drill_attribute_boosts VALUES (13, 10, 4, 2, '2026-09-09 11:07:54.269598+03');


--
-- Data for Name: drill_submission_drills; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: drill_submissions; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: drills; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.drills VALUES (1, 'Cone Slalom Agility Weave', 'reps', 3, 5, 200, NULL, '2026-09-09 11:07:54.269598+03', '2026-09-09 11:07:58.943081+03', 'Intermediate', 'Agility & Feet', NULL, 0, 0.0, 'Eight cones, one metre apart, in a straight line. Ball at the first cone, phone on a tripod square to the run.', 'Weave the full line using both feet, turn at the end and return. Six passes without touching a cone.', 'The full run must stay in frame from first touch to final turn. Cuts void the submission.', 'General', NULL, 1, 20, 1, 300, true, NULL);
INSERT INTO public.drills VALUES (2, 'Tight-Space 1v1 Dribbling', 'reps', 4, 3, 225, NULL, '2026-09-09 11:07:54.269598+03', '2026-09-09 11:07:58.943081+03', 'Intermediate', 'Close Control', NULL, 0, 0.0, 'A 3x3 metre grid marked with cones, one ball, a passive defender inside the grid.', 'Keep the ball under control against the defender for 30-second bursts, resetting on a loss of possession.', 'The full grid must stay in frame. Log every burst, including resets.', 'General', NULL, 1, 20, 1, 300, true, NULL);
INSERT INTO public.drills VALUES (3, 'Box-to-Box Sprint Drills', 'secs', 5, 30, 120, NULL, '2026-09-09 11:07:54.269598+03', '2026-09-09 11:07:58.943081+03', 'Elite', 'Endurance & Pace', NULL, 0, 0.0, 'Two markers 40 metres apart on grass or track, camera positioned side-on to capture the full distance.', 'Sprint box-to-box at match intensity, jogging back for recovery between reps.', 'Both markers must be visible throughout. No cutting the distance short.', 'General', NULL, 1, 20, 1, 300, true, NULL);
INSERT INTO public.drills VALUES (4, 'Wall-Pass Rebound Control', 'reps', 4, 12, 150, NULL, '2026-09-09 11:07:54.269598+03', '2026-09-09 11:07:58.943081+03', 'Beginner', 'Short Passing', NULL, 0, 0.0, 'Chalk a 60cm target on a wall, stand at 8, 12 and 16 metres.', 'Ten passes from each distance, alternating feet, first touch only.', 'Target and player both in frame; the count is audible or on screen.', 'General', NULL, 1, 20, 1, 300, true, NULL);
INSERT INTO public.drills VALUES (5, 'First-Touch Finishing Volley', 'reps', 3, 8, 200, NULL, '2026-09-09 11:07:54.269598+03', '2026-09-09 11:07:58.943081+03', 'Intermediate', 'Finishing', NULL, 0, 0.0, 'Goal, six balls spread across the edge of the box, one server.', 'One-touch finishes from each position, alternating near and far post calls.', 'Goal frame visible on every strike. Ten seconds maximum between attempts.', 'General', NULL, 1, 20, 1, 300, true, NULL);
INSERT INTO public.drills VALUES (6, 'Speed Ladder Quick Feet', 'secs', 4, 20, 90, NULL, '2026-09-09 11:07:54.269598+03', '2026-09-09 11:07:58.943081+03', 'Beginner', 'Footwork Speed', NULL, 0, 0.0, 'A standard agility ladder laid flat on grass or turf, camera side-on.', 'Run the full ladder pattern at maximum tempo, resetting to the start for each rep.', 'Full ladder must stay in frame. Missed rungs restart the rep.', 'General', NULL, 1, 20, 1, 300, true, NULL);
INSERT INTO public.drills VALUES (7, 'Shielding & Shoulder Duels', 'reps', 3, 6, 180, NULL, '2026-09-09 11:07:54.269598+03', '2026-09-09 11:07:58.943081+03', 'Intermediate', 'Ball Protection', NULL, 0, 0.0, 'A five-metre channel, one attacker with the ball, one defender applying pressure from behind.', 'Shield the ball under contact for the full duration of each rep, rotating shoulders to keep the defender out.', 'Contact must stay within the channel. Log a rep only if the ball is retained for its full duration.', 'General', NULL, 1, 20, 1, 300, true, NULL);
INSERT INTO public.drills VALUES (8, 'Recovery Press & Tackle Angles', 'reps', 4, 6, 165, NULL, '2026-09-09 11:07:54.269598+03', '2026-09-09 11:07:58.943081+03', 'Intermediate', 'Positioning & Tackling', NULL, 0, 0.0, 'A ten metre channel with two cones as the gate, one attacker, one ball.', 'Jockey the attacker across the channel, force the weak side, win the ball inside the gate.', 'Full channel in frame. Six repetitions, alternating sides.', 'General', NULL, 1, 20, 1, 300, true, NULL);
INSERT INTO public.drills VALUES (9, 'Long-Range Chip Accuracy', 'reps', 3, 10, 200, NULL, '2026-09-09 11:07:54.269598+03', '2026-09-09 11:07:58.943081+03', 'Elite', 'Long Passing', NULL, 0, 0.0, 'A 1-metre target zone at 25 and 35 metres, ball on the ground at the start point.', 'Chip the target zone from each distance, alternating feet, five attempts per distance.', 'Target zone and strike point both in frame for every attempt.', 'General', NULL, 1, 20, 1, 300, true, NULL);
INSERT INTO public.drills VALUES (10, 'Cruyff Turn Repetition Set', 'reps', 4, 8, 135, NULL, '2026-09-09 11:07:54.269598+03', '2026-09-09 11:07:58.943081+03', 'Beginner', 'Turning & Feints', NULL, 0, 0.0, 'Open space with one cone marking the turn point, camera side-on to the approach and exit.', 'Approach at jogging pace, execute the turn at the cone, accelerate away on the new line.', 'The full turn — approach, contact, exit — must be visible in one continuous take.', 'General', NULL, 1, 20, 1, 300, true, NULL);


--
-- Data for Name: match_goals; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: matches; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: player_attributes; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: players; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.schema_migrations VALUES ('001_create_users.sql', '2026-09-09 11:07:54.19536+03');
INSERT INTO public.schema_migrations VALUES ('002_create_players_and_attributes.sql', '2026-09-09 11:07:54.248092+03');
INSERT INTO public.schema_migrations VALUES ('003_create_drills.sql', '2026-09-09 11:07:54.269598+03');
INSERT INTO public.schema_migrations VALUES ('004_create_training_sessions.sql', '2026-09-09 11:07:54.284056+03');
INSERT INTO public.schema_migrations VALUES ('005_extend_drills_display_fields.sql', '2026-09-09 11:07:54.298477+03');
INSERT INTO public.schema_migrations VALUES ('006_create_leagues.sql', '2026-09-09 11:07:54.30858+03');
INSERT INTO public.schema_migrations VALUES ('007_rename_to_domain_language.sql', '2026-09-09 11:07:54.329454+03');
INSERT INTO public.schema_migrations VALUES ('008_drill_submissions_review_workflow.sql', '2026-09-09 11:07:54.334204+03');
INSERT INTO public.schema_migrations VALUES ('009_create_coaches.sql', '2026-09-09 11:07:54.336229+03');
INSERT INTO public.schema_migrations VALUES ('010_expand_clubs_for_coaches.sql', '2026-09-09 11:07:54.349696+03');
INSERT INTO public.schema_migrations VALUES ('011_create_club_memberships.sql', '2026-09-09 11:07:54.354263+03');
INSERT INTO public.schema_migrations VALUES ('012_create_club_applications.sql', '2026-09-09 11:07:54.361963+03');
INSERT INTO public.schema_migrations VALUES ('013_extend_drills_for_admin.sql', '2026-09-09 11:07:54.369519+03');
INSERT INTO public.schema_migrations VALUES ('014_create_match_goals.sql', '2026-09-09 11:07:54.373976+03');
INSERT INTO public.schema_migrations VALUES ('015_admin_club_management.sql', '2026-09-09 11:07:54.378685+03');
INSERT INTO public.schema_migrations VALUES ('016_neutral_drill_authorship.sql', '2026-09-09 11:07:54.379928+03');
INSERT INTO public.schema_migrations VALUES ('017_match_goal_scorers_and_position_swap.sql', '2026-09-09 11:07:54.385688+03');


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.users VALUES (1, 'Abdullah Yaseen', 'abdullah.yaseen@orvx.app', '$2b$10$PBwJ8b55dwXwD83gaVbLK.94We5XwwER.hdPYyAr8RfkDhA6/TXTC', 'admin', NULL, '2026-09-09 11:07:58.943081+03', '2026-09-09 11:07:58.943081+03');
INSERT INTO public.users VALUES (2, 'Abdulrahman Hawamdeh', 'abdulrahman.hawamdeh@orvx.app', '$2b$10$uBVJBJSsM6f1g34NzXDI.eAHQtUhqS77L9W5CzWEtog3UVgdOuKeq', 'coach', 'Platform Evaluator', '2026-09-09 11:07:58.943081+03', '2026-09-09 11:07:58.943081+03');


--
-- Name: attributes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.attributes_id_seq', 12, true);


--
-- Name: club_applications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.club_applications_id_seq', 1, false);


--
-- Name: club_memberships_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.club_memberships_id_seq', 1, false);


--
-- Name: clubs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.clubs_id_seq', 8, true);


--
-- Name: coach_applications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.coach_applications_id_seq', 1, false);


--
-- Name: coaches_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.coaches_id_seq', 1, true);


--
-- Name: competitions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.competitions_id_seq', 2, true);


--
-- Name: drill_attribute_boosts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.drill_attribute_boosts_id_seq', 13, true);


--
-- Name: drills_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.drills_id_seq', 10, true);


--
-- Name: fixtures_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.fixtures_id_seq', 44, true);


--
-- Name: match_goals_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.match_goals_id_seq', 1, false);


--
-- Name: player_attributes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.player_attributes_id_seq', 1, false);


--
-- Name: players_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.players_id_seq', 1, false);


--
-- Name: session_drills_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.session_drills_id_seq', 1, false);


--
-- Name: training_sessions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.training_sessions_id_seq', 1, false);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 2, true);


--
-- Name: attributes attributes_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attributes
    ADD CONSTRAINT attributes_code_key UNIQUE (code);


--
-- Name: attributes attributes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attributes
    ADD CONSTRAINT attributes_pkey PRIMARY KEY (id);


--
-- Name: club_applications club_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.club_applications
    ADD CONSTRAINT club_applications_pkey PRIMARY KEY (id);


--
-- Name: club_memberships club_memberships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.club_memberships
    ADD CONSTRAINT club_memberships_pkey PRIMARY KEY (id);


--
-- Name: clubs clubs_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clubs
    ADD CONSTRAINT clubs_name_key UNIQUE (name);


--
-- Name: clubs clubs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clubs
    ADD CONSTRAINT clubs_pkey PRIMARY KEY (id);


--
-- Name: clubs clubs_slot_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clubs
    ADD CONSTRAINT clubs_slot_key UNIQUE (slot);


--
-- Name: coach_applications coach_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coach_applications
    ADD CONSTRAINT coach_applications_pkey PRIMARY KEY (id);


--
-- Name: coaches coaches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coaches
    ADD CONSTRAINT coaches_pkey PRIMARY KEY (id);


--
-- Name: coaches coaches_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coaches
    ADD CONSTRAINT coaches_user_id_key UNIQUE (user_id);


--
-- Name: competitions competitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competitions
    ADD CONSTRAINT competitions_pkey PRIMARY KEY (id);


--
-- Name: drill_attribute_boosts drill_attribute_boosts_drill_id_attribute_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drill_attribute_boosts
    ADD CONSTRAINT drill_attribute_boosts_drill_id_attribute_id_key UNIQUE (drill_id, attribute_id);


--
-- Name: drill_attribute_boosts drill_attribute_boosts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drill_attribute_boosts
    ADD CONSTRAINT drill_attribute_boosts_pkey PRIMARY KEY (id);


--
-- Name: drill_submission_drills drill_submission_drills_submission_id_position_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drill_submission_drills
    ADD CONSTRAINT drill_submission_drills_submission_id_position_key UNIQUE (drill_submission_id, "position");


--
-- Name: drills drills_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drills
    ADD CONSTRAINT drills_pkey PRIMARY KEY (id);


--
-- Name: matches fixtures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT fixtures_pkey PRIMARY KEY (id);


--
-- Name: match_goals match_goals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_goals
    ADD CONSTRAINT match_goals_pkey PRIMARY KEY (id);


--
-- Name: player_attributes player_attributes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_attributes
    ADD CONSTRAINT player_attributes_pkey PRIMARY KEY (id);


--
-- Name: player_attributes player_attributes_player_id_attribute_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_attributes
    ADD CONSTRAINT player_attributes_player_id_attribute_id_key UNIQUE (player_id, attribute_id);


--
-- Name: players players_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.players
    ADD CONSTRAINT players_pkey PRIMARY KEY (id);


--
-- Name: players players_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.players
    ADD CONSTRAINT players_user_id_key UNIQUE (user_id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (name);


--
-- Name: drill_submission_drills session_drills_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drill_submission_drills
    ADD CONSTRAINT session_drills_pkey PRIMARY KEY (id);


--
-- Name: drill_submissions training_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drill_submissions
    ADD CONSTRAINT training_sessions_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: club_applications_one_pending_per_player; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX club_applications_one_pending_per_player ON public.club_applications USING btree (player_id) WHERE (status = 'pending'::text);


--
-- Name: club_memberships_one_active_per_player; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX club_memberships_one_active_per_player ON public.club_memberships USING btree (player_id) WHERE active;


--
-- Name: coach_applications_one_pending_per_user; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX coach_applications_one_pending_per_user ON public.coach_applications USING btree (user_id) WHERE (status = 'pending'::text);


--
-- Name: drill_submissions_one_in_flight_per_player; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX drill_submissions_one_in_flight_per_player ON public.drill_submissions USING btree (player_id) WHERE (status = ANY (ARRAY['active'::text, 'completed'::text]));


--
-- Name: idx_club_memberships_club_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_club_memberships_club_active ON public.club_memberships USING btree (club_id) WHERE active;


--
-- Name: idx_match_goals_match_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_match_goals_match_id ON public.match_goals USING btree (match_id);


--
-- Name: idx_match_goals_player_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_match_goals_player_id ON public.match_goals USING btree (player_id);


--
-- Name: idx_matches_competition_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_matches_competition_id ON public.matches USING btree (competition_id);


--
-- Name: player_attributes_player_attribute_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX player_attributes_player_attribute_key ON public.player_attributes USING btree (player_id, attribute_id);


--
-- Name: club_applications club_applications_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER club_applications_set_updated_at BEFORE UPDATE ON public.club_applications FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: club_memberships club_memberships_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER club_memberships_set_updated_at BEFORE UPDATE ON public.club_memberships FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: clubs clubs_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER clubs_set_updated_at BEFORE UPDATE ON public.clubs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: coach_applications coach_applications_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER coach_applications_set_updated_at BEFORE UPDATE ON public.coach_applications FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: coaches coaches_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER coaches_set_updated_at BEFORE UPDATE ON public.coaches FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: drill_submissions drill_submissions_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER drill_submissions_set_updated_at BEFORE UPDATE ON public.drill_submissions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: drills drills_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER drills_set_updated_at BEFORE UPDATE ON public.drills FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: matches matches_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER matches_set_updated_at BEFORE UPDATE ON public.matches FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: player_attributes player_attributes_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER player_attributes_set_updated_at BEFORE UPDATE ON public.player_attributes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: players players_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER players_set_updated_at BEFORE UPDATE ON public.players FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: users users_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: club_applications club_applications_club_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.club_applications
    ADD CONSTRAINT club_applications_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;


--
-- Name: club_applications club_applications_decided_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.club_applications
    ADD CONSTRAINT club_applications_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: club_applications club_applications_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.club_applications
    ADD CONSTRAINT club_applications_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE;


--
-- Name: club_memberships club_memberships_club_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.club_memberships
    ADD CONSTRAINT club_memberships_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;


--
-- Name: club_memberships club_memberships_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.club_memberships
    ADD CONSTRAINT club_memberships_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE;


--
-- Name: clubs clubs_head_coach_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clubs
    ADD CONSTRAINT clubs_head_coach_id_fkey FOREIGN KEY (head_coach_id) REFERENCES public.coaches(id) ON DELETE SET NULL;


--
-- Name: coach_applications coach_applications_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coach_applications
    ADD CONSTRAINT coach_applications_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: coach_applications coach_applications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coach_applications
    ADD CONSTRAINT coach_applications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: coaches coaches_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coaches
    ADD CONSTRAINT coaches_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: drill_attribute_boosts drill_attribute_boosts_attribute_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drill_attribute_boosts
    ADD CONSTRAINT drill_attribute_boosts_attribute_id_fkey FOREIGN KEY (attribute_id) REFERENCES public.attributes(id) ON DELETE RESTRICT;


--
-- Name: drill_attribute_boosts drill_attribute_boosts_drill_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drill_attribute_boosts
    ADD CONSTRAINT drill_attribute_boosts_drill_id_fkey FOREIGN KEY (drill_id) REFERENCES public.drills(id) ON DELETE CASCADE;


--
-- Name: drill_submissions drill_submissions_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drill_submissions
    ADD CONSTRAINT drill_submissions_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: drill_submissions drill_submissions_reviewer_coach_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drill_submissions
    ADD CONSTRAINT drill_submissions_reviewer_coach_id_fkey FOREIGN KEY (reviewer_coach_id) REFERENCES public.coaches(id) ON DELETE SET NULL;


--
-- Name: drills drills_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drills
    ADD CONSTRAINT drills_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: matches fixtures_away_club_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT fixtures_away_club_id_fkey FOREIGN KEY (away_club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;


--
-- Name: matches fixtures_competition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT fixtures_competition_id_fkey FOREIGN KEY (competition_id) REFERENCES public.competitions(id) ON DELETE CASCADE;


--
-- Name: matches fixtures_home_club_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT fixtures_home_club_id_fkey FOREIGN KEY (home_club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;


--
-- Name: match_goals match_goals_club_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_goals
    ADD CONSTRAINT match_goals_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;


--
-- Name: match_goals match_goals_match_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_goals
    ADD CONSTRAINT match_goals_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE CASCADE;


--
-- Name: match_goals match_goals_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_goals
    ADD CONSTRAINT match_goals_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE SET NULL;


--
-- Name: player_attributes player_attributes_attribute_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_attributes
    ADD CONSTRAINT player_attributes_attribute_id_fkey FOREIGN KEY (attribute_id) REFERENCES public.attributes(id) ON DELETE RESTRICT;


--
-- Name: player_attributes player_attributes_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_attributes
    ADD CONSTRAINT player_attributes_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE;


--
-- Name: players players_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.players
    ADD CONSTRAINT players_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: drill_submission_drills session_drills_drill_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drill_submission_drills
    ADD CONSTRAINT session_drills_drill_id_fkey FOREIGN KEY (drill_id) REFERENCES public.drills(id) ON DELETE SET NULL;


--
-- Name: drill_submission_drills session_drills_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drill_submission_drills
    ADD CONSTRAINT session_drills_session_id_fkey FOREIGN KEY (drill_submission_id) REFERENCES public.drill_submissions(id) ON DELETE CASCADE;


--
-- Name: drill_submissions training_sessions_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drill_submissions
    ADD CONSTRAINT training_sessions_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--
COMMIT;

--
-- Rotate the seeded passwords
-- ---------------------------
-- The password_hash values above are bcrypt hashes of the repo's default
-- password. Generate replacements (run from backend/, bcryptjs is already a
-- dependency) and paste the output into the UPDATE below:
--
--   node -e "console.log(require('bcryptjs').hashSync(process.argv[1],10))" 'YourNewPassword'
--
-- UPDATE users SET password_hash = '<hash>' WHERE email = 'abdullah.yaseen@orvx.app';
-- UPDATE users SET password_hash = '<hash>' WHERE email = 'abdulrahman.hawamdeh@orvx.app';
--
-- Alternatively, skip this file's user rows entirely and run
-- `npm run seed:clean` against Railway with ADMIN_PASSWORD / EVALUATOR_PASSWORD
-- set in the environment.
--
