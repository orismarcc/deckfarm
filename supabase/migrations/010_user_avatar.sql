-- DeckFarm Migration 010: Add avatar column to users table
-- Run this in your Supabase project's SQL editor

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS avatar TEXT;

-- apelido column (added in a previous session but may be missing from initial schema)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS apelido TEXT;
