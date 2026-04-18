import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Middleware de proteção de sessão (achado 3.1 do relatório de segurança).
//
// Este middleware executa em TODAS as rotas (exceto assets estáticos) e:
//   1. Refresca cookies de sessão expirando via supabase.auth.getUser() — que
//      faz validação real contra o Auth Server (ao contrário de getSession()).
//   2. Garante que os cookies voltem sincronizados na response.
//
// A proteção "hard" de rotas específicas (redirecionar visitante anônimo para /login)
// não é aplicada aqui porque a aplicação atual é SPA e trata isso no client. Se no
// futuro forem adicionadas server components com dados sensíveis, bloquear por
// ausência de `user` neste middleware.

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Fail-safe: sem as variáveis, deixa a request passar sem criar cliente.
  // (O erro real vai aparecer no client quando ele tentar instanciar o supabase.)
  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        )
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options as any),
        )
      },
    },
  })

  // IMPORTANTE: não remova este await. A chamada a getUser() é o que valida a
  // sessão contra o Auth Server e refresca os cookies. Se remover, tokens ficam
  // stale e o achado 3.3 do relatório volta a ser exploitável.
  await supabase.auth.getUser()

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match em todas as rotas EXCETO:
     * - _next/static (assets estáticos)
     * - _next/image (otimização de imagem)
     * - favicon.ico, arquivos de imagem
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
