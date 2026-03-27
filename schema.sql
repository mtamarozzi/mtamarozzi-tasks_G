-- ==========================================================
-- SCRIPT DE INICIALIZAÇÃO DO BANCO DE DADOS (SUPABASE)
-- Conforme Fase 1 (V.L.A.E.G Protocol: gemini.md)
-- ==========================================================

-- 1. EXTENSÕES
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. TABELA PROFILES (Extendendo auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. TABELA TASKS (Kanban)
CREATE TYPE task_status AS ENUM ('backlog', 'todo', 'doing', 'done');

CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status task_status DEFAULT 'backlog' NOT NULL,
  order_index INTEGER DEFAULT 0 NOT NULL,
  due_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. SEGURANÇA (ROW LEVEL SECURITY - RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- 4.1 Profiles RLS
CREATE POLICY "Profiles SELECT" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Profiles UPDATE" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 4.2 Auth Trigger (Auto-criar profile ao cadastrar)
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 4.3 Tasks RLS
CREATE POLICY "Tasks SELECT" ON public.tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Tasks INSERT" ON public.tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Tasks UPDATE" ON public.tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Tasks DELETE" ON public.tasks FOR DELETE USING (auth.uid() = user_id);
