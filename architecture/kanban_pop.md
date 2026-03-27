# POP: Kanban Board (Gestão de Estado)

## 🎯 Objetivo
Visualizar e transitar tarefas através dos 4 estados obrigatórios (`backlog`, `todo`, `doing`, `done`) respeitando a persistência no Supabase via Drag and Drop.

## 📥 Entradas
- Sessão ativa do usuário (`auth.uid()`).
- Fetch de `tasks` da API (Supabase).

## ⚙️ Lógica de Execução (Frontend)
1. **Load:** Buscar tarefas do Supabase no mount do componente principal.
2. **Render:** Distribuir tarefas em colunas mapeadas através do campo `status`. Retenção do estado local.
3. **Move (Drag End):**
   - **Intra-coluna:** Recalcular `order_index` baseado na nova posição.
   - **Inter-coluna:** Atualizar `status` para o destino e reordenar.
   - **Optimistic UI:** A tela (state) se atualiza imediatamente. A requisição ao Supabase ocorre em Background (Ferramenta). Se falhar, reverte a tela e avisa o usuário.

## 🧰 Estrutura de Componentes Necessários
- `KanbanBoard`: Contexto geral do drag and drop.
- `Column`: Zona de drop com título e badge de contagem.
- `TaskCard`: Elemento draggable, mostrando título, data e ações básicas.
- `AddModal`: Modal para inserção inicial (obrigatoriamente envia para 'backlog' ou 'todo').

## ⚠️ Casos de Borda
- Rollback visual obrigatório se a chamada API (Supabase UPDATE) falhar.
- Bloqueio de Drag se estiver ocorrendo resync.
