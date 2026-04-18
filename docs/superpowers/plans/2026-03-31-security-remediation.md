# Security Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir todas as vulnerabilidades identificadas no relatório de auditoria de segurança, elevando a postura de segurança da aplicação de 🟠 para 🟢.

**Architecture:** Adicionar middleware SSR do Supabase para proteção de rotas e refresh de sessão; migrar autenticação client-side para uso de `getUser()` (validação server-side); introduzir schemas Zod para validação de dados antes de qualquer mutação no banco; sanitizar mensagens de erro expostas ao usuário.

**Tech Stack:** Next.js 15 (App Router), Supabase JS v2, `@supabase/ssr` (novo), Zod (novo), TypeScript

---

## Mapeamento de Arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `lib/supabase.ts` | Modificar | Adicionar validação fail-fast das env vars |
| `lib/schemas.ts` | Criar | Schemas Zod para `tasks` e `reminders` |
| `middleware.ts` | Criar | Proteção de rotas + refresh de sessão via SSR |
| `app/auth/callback/route.ts` | Criar | Handler OAuth/magic link callback |
| `app/page.tsx` | Modificar | `getSession→getUser`, validações Zod, sanitizar alerts |

---

## Task 1: Quick Win — Validação de Variáveis de Ambiente

**Tempo estimado:** 5 min
**Prioridade:** Alta (base para todas as outras tasks)

**Files:**
- Modify: `lib/supabase.ts`

- [ ] **Step 1: Ler o arquivo atual**

  Conteúdo atual de `lib/supabase.ts`:
  ```typescript
  import { createClient } from '@supabase/supabase-js'

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  export const supabase = createClient(supabaseUrl, supabaseAnonKey)
  ```

- [ ] **Step 2: Substituir pelo código com validação fail-fast**

  ```typescript
  import { createClient } from '@supabase/supabase-js'

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. ' +
      'Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local'
    )
  }

  export const supabase = createClient(supabaseUrl, supabaseAnonKey)
  ```

- [ ] **Step 3: Verificar que o build não quebra**

  ```bash
  npm run build
  ```
  Esperado: build passa sem erros.

- [ ] **Step 4: Commit**

  ```bash
  git add lib/supabase.ts
  git commit -m "fix: add fail-fast validation for Supabase env vars"
  ```

---

## Task 2: Quick Win — Corrigir Vulnerabilidades de Dependências

**Tempo estimado:** 5 min
**Prioridade:** Alta

**Files:** `package.json`, `package-lock.json`

- [ ] **Step 1: Verificar vulnerabilidades atuais**

  ```bash
  npm audit
  ```
  Esperado: exibir as 2 vulnerabilidades críticas identificadas no relatório.

- [ ] **Step 2: Aplicar correções automáticas**

  ```bash
  npm audit fix
  ```
  Esperado: vulnerabilidades corrigidas sem breaking changes.

- [ ] **Step 3: Se restarem vulnerabilidades que precisam de --force, avaliar manualmente**

  ```bash
  npm audit
  ```
  Se houver vulnerabilidades restantes que exijam `--force` (breaking change), **não aplicar automaticamente** — registrar para análise manual.

- [ ] **Step 4: Verificar build**

  ```bash
  npm run build
  ```
  Esperado: build passa.

- [ ] **Step 5: Commit**

  ```bash
  git add package.json package-lock.json
  git commit -m "fix: apply npm audit security fixes"
  ```

---

## Task 3: Instalar Dependências Novas

**Tempo estimado:** 3 min
**Prioridade:** Pré-requisito para Tasks 4 e 5

**Files:** `package.json`, `package-lock.json`

- [ ] **Step 1: Instalar `@supabase/ssr` e `zod`**

  ```bash
  npm install @supabase/ssr zod
  ```
  Esperado: ambos aparecem em `dependencies` no `package.json`.

- [ ] **Step 2: Verificar instalação**

  ```bash
  npm ls @supabase/ssr zod
  ```
  Esperado: versões listadas sem erros.

- [ ] **Step 3: Commit**

  ```bash
  git add package.json package-lock.json
  git commit -m "chore: add @supabase/ssr and zod dependencies"
  ```

---

## Task 4: [ALTA] Criar Middleware de Proteção de Rotas

**Tempo estimado:** 20 min
**Prioridade:** Máxima — resolve ACHADO #3.1

**Files:**
- Create: `middleware.ts` (raiz do projeto, ao lado de `next.config.ts`)

**Contexto:** O middleware do Next.js intercepta toda requisição antes do rendering. Com `@supabase/ssr`, ele lê e atualiza os cookies de sessão do Supabase, garantindo que tokens expirados sejam renovados automaticamente em toda navegação.

- [ ] **Step 1: Criar `middleware.ts` na raiz**

  ```typescript
  import { createServerClient } from '@supabase/ssr'
  import { NextResponse, type NextRequest } from 'next/server'

  export async function middleware(request: NextRequest) {
    let supabaseResponse = NextResponse.next({ request })

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            )
            supabaseResponse = NextResponse.next({ request })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    // Refresh session — NÃO remover este await
    await supabase.auth.getUser()

    return supabaseResponse
  }

  export const config = {
    matcher: [
      '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
  }
  ```

  > **Nota:** O matcher exclui assets estáticos. O middleware não redireciona usuários não autenticados do `/` pois essa página serve como tela de login. Caso novas rotas protegidas sejam adicionadas no futuro (ex: `/dashboard`), adicionar lógica de redirect aqui.

- [ ] **Step 2: Verificar que o middleware é reconhecido pelo Next.js**

  ```bash
  npm run dev
  ```
  No terminal, verificar que não há erros de compilação relacionados ao middleware. Acessar `http://localhost:3000` e confirmar que a aplicação funciona normalmente.

- [ ] **Step 3: Verificar que cookies de sessão são definidos**

  Abrir DevTools → Application → Cookies. Após fazer login, verificar que cookies `sb-*` aparecem (ex: `sb-access-token`, `sb-refresh-token`).

- [ ] **Step 4: Build final**

  ```bash
  npm run build
  ```
  Esperado: sem erros.

- [ ] **Step 5: Commit**

  ```bash
  git add middleware.ts
  git commit -m "feat: add Supabase SSR middleware for session refresh and route protection"
  ```

---

## Task 5: [ALTA] Migrar `getSession()` para `getUser()`

**Tempo estimado:** 10 min
**Prioridade:** Alta — resolve ACHADO #3.3

**Files:**
- Modify: `app/page.tsx` (linha 143)

**Contexto:** `getSession()` lê o token JWT do storage local **sem validar com o servidor** — um token manipulado passa sem detecção. `getUser()` faz uma chamada à API do Supabase para validar o token, garantindo que a identidade é real.

- [ ] **Step 1: Localizar o uso de `getSession()` em `app/page.tsx` (linha ~143)**

  Trecho atual:
  ```typescript
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) {
      setSession(session)
      // ...
    }
  })
  ```

- [ ] **Step 2: Substituir por `getUser()` mantendo a lógica existente**

  `getUser()` retorna `{ data: { user }, error }` em vez de `{ data: { session } }`. A sessão completa ainda está disponível via `onAuthStateChange`. A substituição deve ser:

  ```typescript
  supabase.auth.getUser().then(({ data: { user }, error }) => {
    if (user && !error) {
      // getUser() validou o token com o servidor
      // A sessão completa (com access_token) continua disponível via onAuthStateChange
      // Não é necessário setSession aqui — onAuthStateChange já faz isso
    }
  })
  ```

  > **Atenção:** Verificar se `setSession` é chamado em outro lugar (como dentro do `onAuthStateChange`). Se `onAuthStateChange` já está configurado corretamente na linha ~149, o bloco `getSession` pode ser **removido completamente** — ele era redundante e inseguro. Confirmar lendo as linhas 143–160 antes de remover.

- [ ] **Step 3: Verificar fluxo de autenticação no browser**

  ```bash
  npm run dev
  ```
  Testar: login, logout, e refresh da página. A sessão deve ser restaurada corretamente após refresh.

- [ ] **Step 4: Build**

  ```bash
  npm run build
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add app/page.tsx
  git commit -m "fix: replace getSession() with getUser() for server-validated auth"
  ```

---

## Task 6: [ALTA] Criar Schemas Zod e Aplicar nas Mutações

**Tempo estimado:** 15 min
**Prioridade:** Alta — resolve ACHADO #4.1

**Files:**
- Create: `lib/schemas.ts`
- Modify: `app/page.tsx` (linhas ~287–301, ~335–346, ~248–256)

- [ ] **Step 1: Criar `lib/schemas.ts`**

  ```typescript
  import { z } from 'zod'

  export const TaskStatus = z.enum(['backlog', 'doing', 'done', 'blocked'])

  export const taskInsertSchema = z.object({
    title: z.string().min(1, 'Título obrigatório').max(255),
    description: z.string().max(2000).optional(),
    status: TaskStatus,
    order_index: z.number().int().min(0),
    user_id: z.string().uuid(),
    priority: z.enum(['low', 'medium', 'high']),
  })

  export const taskUpdateSchema = z.object({
    title: z.string().min(1, 'Título obrigatório').max(255),
    description: z.string().max(2000).optional(),
    priority: z.enum(['low', 'medium', 'high']),
    due_date: z.string().nullable().optional(),
  })

  export const reminderInsertSchema = z.object({
    task_id: z.string().uuid(),
    user_id: z.string().uuid(),
    reminder_time: z.string().datetime({ message: 'Data/hora inválida' }),
    recurrence: z.string().optional(),
  })

  export type TaskInsert = z.infer<typeof taskInsertSchema>
  export type TaskUpdate = z.infer<typeof taskUpdateSchema>
  export type ReminderInsert = z.infer<typeof reminderInsertSchema>
  ```

- [ ] **Step 2: Importar schemas em `app/page.tsx`**

  Adicionar no topo do arquivo, junto às outras importações:
  ```typescript
  import { taskInsertSchema, taskUpdateSchema, reminderInsertSchema } from '@/lib/schemas'
  ```

- [ ] **Step 3: Aplicar validação no insert de task (~linha 287)**

  Envolver `taskToInsert` com `taskInsertSchema.safeParse()` antes do insert:
  ```typescript
  const parsed = taskInsertSchema.safeParse(taskToInsert)
  if (!parsed.success) {
    console.error('Dados inválidos:', parsed.error.flatten())
    setIsAdding(false)
    return
  }

  const { data, error } = await supabase.from('tasks').insert(parsed.data).select().single()
  ```

- [ ] **Step 4: Aplicar validação no update de task (~linha 335)**

  ```typescript
  const parsed = taskUpdateSchema.safeParse(updatePayload)
  if (!parsed.success) {
    console.error('Dados inválidos:', parsed.error.flatten())
    return
  }

  const { error } = await supabase
    .from('tasks')
    .update(parsed.data)
    .eq('id', editingTask.id)
  ```

- [ ] **Step 5: Aplicar validação no insert de reminder (~linha 248)**

  Localizar o objeto de reminder e envolvê-lo com `reminderInsertSchema.safeParse()` da mesma forma que nos steps anteriores.

- [ ] **Step 6: Verificar que TypeScript não reporta erros**

  ```bash
  npx tsc --noEmit
  ```
  Esperado: sem erros de tipo.

- [ ] **Step 7: Build**

  ```bash
  npm run build
  ```

- [ ] **Step 8: Commit**

  ```bash
  git add lib/schemas.ts app/page.tsx
  git commit -m "feat: add Zod schemas and validate all Supabase mutations"
  ```

---

## Task 7: [MÉDIA] Criar Rota de Callback de Autenticação

**Tempo estimado:** 10 min
**Prioridade:** Média — resolve ausência de `/auth/callback`

**Files:**
- Create: `app/auth/callback/route.ts`

**Contexto:** OAuth providers e magic links redirecionam para `/auth/callback` com um `code` na URL. Sem esse handler, o fluxo falha silenciosamente. Mesmo que o app use apenas email/senha hoje, essa rota é necessária para suportar providers OAuth no futuro e é parte do padrão oficial do Supabase.

- [ ] **Step 1: Criar diretório e arquivo**

  Criar `app/auth/callback/route.ts`:
  ```typescript
  import { createServerClient } from '@supabase/ssr'
  import { cookies } from 'next/headers'
  import { NextResponse } from 'next/server'
  import type { NextRequest } from 'next/server'

  export async function GET(request: NextRequest) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const next = searchParams.get('next') ?? '/'

    if (code) {
      const cookieStore = await cookies()
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() { return cookieStore.getAll() },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            },
          },
        }
      )

      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (!error) {
        return NextResponse.redirect(`${origin}${next}`)
      }
    }

    // Redirecionar para home com indicação de erro em caso de falha
    return NextResponse.redirect(`${origin}/?error=auth_callback_failed`)
  }
  ```

- [ ] **Step 2: Verificar que a rota é reconhecida**

  ```bash
  npm run dev
  ```
  Acessar `http://localhost:3000/auth/callback` no browser. Deve retornar redirect (não 404).

- [ ] **Step 3: Build**

  ```bash
  npm run build
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add app/auth/callback/route.ts
  git commit -m "feat: add /auth/callback route for OAuth and magic link flows"
  ```

---

## Task 8: [BAIXA] Sanitizar Mensagens de Erro (Higienização)

**Tempo estimado:** 5 min
**Prioridade:** Baixa — resolve ACHADO #4.5

**Files:**
- Modify: `app/page.tsx` (linhas 228, 308, 350)

**Contexto:** `alert(error.message)` vaza detalhes internos do banco (nomes de tabelas, colunas, constraints). Substituir por mensagens genéricas amigáveis ao usuário, mantendo o log técnico no `console.error`.

- [ ] **Step 1: Substituir alert na linha ~228 (signup success)**

  De:
  ```typescript
  alert("Comando de cadastro enviado com sucesso! \n\nSe a página não entrar sozinha agora, é porque o Supabase bloqueou por padrão pedindo verificação de e-mail...")
  ```
  Para (mensagem amigável, sem vazar fluxo interno):
  ```typescript
  alert("Cadastro realizado! Verifique seu e-mail para confirmar a conta.")
  ```

  > Considerar substituir os três `alert()` por um componente de toast/notificação no futuro, mas não é escopo desta task.

- [ ] **Step 2: Substituir alert na linha ~308 (erro de insert)**

  De:
  ```typescript
  alert(`Erro Supabase: ${error?.message || error?.details || JSON.stringify(error)}`)
  ```
  Para:
  ```typescript
  console.error('Erro ao criar tarefa:', error)
  alert('Não foi possível criar a tarefa. Tente novamente.')
  ```

- [ ] **Step 3: Substituir alert na linha ~350 (erro de update)**

  De:
  ```typescript
  alert('Erro ao atualizar. Voltando ao estado original.')
  ```
  Para (já é genérico, mas adicionar log técnico que estava faltando):
  ```typescript
  console.error('Erro ao atualizar tarefa:', error)
  alert('Não foi possível salvar as alterações. Tente novamente.')
  ```

- [ ] **Step 4: Build**

  ```bash
  npm run build
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add app/page.tsx
  git commit -m "fix: sanitize error messages to prevent internal data exposure"
  ```

---

## Resumo das Prioridades

| # | Task | Prioridade | Tempo | Achado Resolvido |
|---|---|---|---|---|
| 1 | Validação de env vars | Alta | 5 min | #1.6 |
| 2 | npm audit fix | Alta | 5 min | #5.1 |
| 3 | Instalar dependências | Pré-requisito | 3 min | — |
| 4 | Criar middleware.ts | **Máxima** | 20 min | #3.1 |
| 5 | getSession → getUser | Alta | 10 min | #3.3 |
| 6 | Schemas Zod | Alta | 15 min | #4.1 |
| 7 | Rota /auth/callback | Média | 10 min | — |
| 8 | Sanitizar erros | Baixa | 5 min | #4.5 |
| | **Total** | | **~73 min** | |

---

## Verificação Final

Após todas as tasks, executar:

```bash
npm run build && npm audit
```

Resultado esperado:
- Build: ✅ 0 erros
- Audit: ✅ 0 vulnerabilidades críticas

Checklist do relatório após remediação:

| Item | Antes | Depois |
|---|---|---|
| 1.6 Validação de env | ❌ | ✅ |
| 3.1 Middleware | ❌ | ✅ |
| 3.3 getUser | ❌ | ✅ |
| 4.1 Zod | ❌ | ✅ |
| 4.5 Erros sanitizados | ❌ | ✅ |
| 5.1 npm audit | ❌ | ✅ |
