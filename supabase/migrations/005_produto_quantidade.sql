-- Migration 005: Add stock quantity fields to produtos
-- Run with: node migrate.js

ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS quantidade_disponivel NUMERIC,
  ADD COLUMN IF NOT EXISTS unidade_quantidade TEXT;

-- Update the updated_at trigger so it fires when stock changes
-- (already exists from 001; nothing extra needed)
