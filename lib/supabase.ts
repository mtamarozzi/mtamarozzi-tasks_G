import { createClient } from '@supabase/supabase-js'

// Validação fail-fast das variáveis de ambiente (achado 1.6 do relatório de segurança).
// Se uma das chaves não estiver presente, falha imediatamente com mensagem clara
// em vez de deixar o app inicializar com cliente inválido e falhar silenciosamente nas queries.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl) {
  throw new Error(
    'Variável de ambiente NEXT_PUBLIC_SUPABASE_URL não está configurada. ' +
    'Defina-a em .env.local (desenvolvimento) ou nas variáveis de ambiente da Vercel (produção).'
  )
}

if (!supabaseAnonKey) {
  throw new Error(
    'Variável de ambiente NEXT_PUBLIC_SUPABASE_ANON_KEY não está configurada. ' +
    'Defina-a em .env.local (desenvolvimento) ou nas variáveis de ambiente da Vercel (produção).'
  )
}

// Validação leve do formato da URL para evitar problemas silenciosos com valores placeholder.
try {
  const url = new URL(supabaseUrl)
  if (!url.hostname.includes('supabase.co') && !url.hostname.includes('localhost')) {
    console.warn(
      `[supabase] URL "${supabaseUrl}" não parece ser uma URL válida do Supabase. ` +
      'Verifique se você copiou o valor correto do painel do projeto.'
    )
  }
} catch {
  throw new Error(
    `NEXT_PUBLIC_SUPABASE_URL "${supabaseUrl}" não é uma URL válida.`
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
