-- ==========================================================
-- SCRIPT DE LEMBRETES E CALENDÁRIO
-- ==========================================================

-- 1. TABELA REMINDERS
CREATE TABLE IF NOT EXISTS public.reminders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  lead_name TEXT NOT NULL,
  reminder_type TEXT NOT NULL,
  reminder_time TIMESTAMP WITH TIME ZONE NOT NULL,
  notes TEXT,
  notified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. SEGURANÇA (RLS)
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

-- 2.1 Políticas de acesso por usuário
CREATE POLICY "Reminders SELECT" ON public.reminders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Reminders INSERT" ON public.reminders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Reminders UPDATE" ON public.reminders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Reminders DELETE" ON public.reminders FOR DELETE USING (auth.uid() = user_id);
