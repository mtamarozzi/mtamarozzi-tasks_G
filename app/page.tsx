'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import {
  LayoutDashboard, Kanban, Plus, Moon, Sun, CheckCircle2,
  Clock, AlertCircle, MoreVertical, Trash2, Edit2, X, ChevronRight,
  TrendingUp, Package, LogOut, Loader2, Calendar, Search
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';

// --- Validação de Inputs (achado 4.1 do relatório de segurança) ---
const TaskStatusSchema = z.enum(['backlog', 'todo', 'doing', 'done']);
const PrioritySchema = z.enum(['low', 'medium', 'high']);

const NewTaskSchema = z.object({
  title: z.string().trim().min(1, 'Título é obrigatório').max(255, 'Título muito longo (máx 255 caracteres)'),
  description: z.string().max(10000, 'Descrição muito longa').optional().or(z.literal('')),
  priority: PrioritySchema,
  due_date: z.string().optional().or(z.literal('')),
  status: TaskStatusSchema,
});

const EditTaskSchema = z.object({
  title: z.string().trim().min(1, 'Título é obrigatório').max(255, 'Título muito longo (máx 255 caracteres)'),
  description: z.string().max(10000, 'Descrição muito longa').optional().or(z.literal('')),
  priority: PrioritySchema,
  due_date: z.string().optional().or(z.literal('')),
});

const AuthSchema = z.object({
  email: z.string().trim().email('E-mail inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
});

const NewReminderSchema = z.object({
  lead_name: z.string().trim().min(1, 'Nome do lead é obrigatório').max(255),
  type: z.string().min(1),
  time: z.string().optional().or(z.literal('')),
  notes: z.string().max(2000).optional().or(z.literal('')),
});

// Mapeia erros do Supabase para mensagens amigáveis (achado 4.5).
// Nunca expomos o erro técnico bruto (pode vazar info sensível do banco).
function friendlyAuthError(raw: string | undefined): string {
  if (!raw) return 'Não foi possível completar a operação. Tente novamente.';
  const lower = raw.toLowerCase();
  if (lower.includes('invalid login') || lower.includes('invalid credentials')) {
    return 'E-mail ou senha incorretos.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Confirme seu e-mail antes de entrar.';
  }
  if (lower.includes('already registered') || lower.includes('user already')) {
    return 'Este e-mail já está cadastrado. Faça login.';
  }
  if (lower.includes('password')) {
    return 'Senha inválida. Use pelo menos 6 caracteres.';
  }
  if (lower.includes('rate limit')) {
    return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
  }
  return 'Não foi possível completar a operação. Tente novamente.';
}

// --- Types ---
type TaskStatus = 'backlog' | 'todo' | 'doing' | 'done';

interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  order_index: number;
  due_date: string | null;
  user_id?: string;
  priority?: 'low' | 'medium' | 'high';
}

interface Reminder {
  id: string;
  user_id: string;
  lead_name: string;
  reminder_type: string;
  reminder_time: string;
  notes: string;
  notified: boolean;
  created_at: string;
}

const STATUS_MAP: Record<TaskStatus, string> = {
  backlog: 'Backlog',
  todo: 'A Fazer',
  doing: 'Em Progresso',
  done: 'Concluído'
};

const COLUMNS: TaskStatus[] = ['backlog', 'todo', 'doing', 'done'];
const COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444'];

// --- Date Helpers ---
const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const DAYS_OF_WEEK = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
const getFirstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();
const isSameDay = (date1: Date, date2: Date) => 
  date1.getDate() === date2.getDate() && 
  date1.getMonth() === date2.getMonth() && 
  date1.getFullYear() === date2.getFullYear();

// --- Components ---
const StatCard = ({ title, value, icon: Icon, color }: any) => (
  <div className="bg-white/60 dark:bg-white/10 p-4 rounded-2xl border border-white/40 dark:border-white/15 shadow-lg shadow-black/5 dark:shadow-black/40 backdrop-blur-xl">
    <div className="flex items-center justify-between mb-3">
      <div className={`p-1.5 rounded-md ${color}`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">{title}</span>
    </div>
    <div className="text-xl font-bold text-zinc-900 dark:text-white">{value}</div>
  </div>
);

export default function PlannerApp() {
  // Session state: armazena o objeto user validado pelo Auth Server (via getUser()).
  // Mantemos a forma { user: {...} } para minimizar refactor nas referências existentes a `session.user`.
  const [session, setSession] = useState<{ user: { id: string; email?: string } } | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  // Auth Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // App State
  const [tasks, setTasks] = useState<Task[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'kanban' | 'calendar'>('kanban');
  const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'medium' as 'low' | 'medium' | 'high', due_date: '', status: 'backlog' as TaskStatus });
  const [isAdding, setIsAdding] = useState(false);
  
  // Theme State Persistence
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('gestaopro-theme');
      if (savedTheme === 'dark') {
        setIsDarkMode(true);
      } else if (savedTheme === 'light') {
        setIsDarkMode(false);
      } else {
        setIsDarkMode(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
      }
    }
  }, []);

  const toggleTheme = () => {
    setIsDarkMode(prev => {
      const newTheme = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('gestaopro-theme', newTheme ? 'dark' : 'light');
      }
      return newTheme;
    });
  };

  // Edit State
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editForm, setEditForm] = useState({ title: '', description: '', priority: 'medium' as 'low' | 'medium' | 'high', due_date: '' });

  // Delete Confirmation State (protege contra cliques acidentais no botão de lixeira)
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');

  // Calendar State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | null>(null);
  const [newReminder, setNewReminder] = useState({
    lead_name: '',
    type: 'Follow-up de Lead',
    time: '',
    notes: ''
  });
  const [activeReminderAlert, setActiveReminderAlert] = useState<Reminder | null>(null);

  // --- Auth & Initial Fetch ---
  // Usamos getUser() em vez de getSession() porque getUser() revalida o token
  // contra o Auth Server do Supabase, enquanto getSession() apenas lê o cookie
  // local (achado 3.3 do relatório de segurança).
  useEffect(() => {
    let mounted = true;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!mounted) return;
      if (user) {
        setSession({ user: { id: user.id, email: user.email } });
        fetchTasks(user.id);
        fetchReminders(user.id);
      } else {
        setSession(null);
      }
      setLoadingSession(false);
    }).catch(() => {
      if (!mounted) return;
      setSession(null);
      setLoadingSession(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, _sessionFromEvent) => {
      // Em qualquer mudança de auth, revalidamos via getUser() em vez de confiar
      // no payload do evento (que vem do cookie local).
      const { data: { user } } = await supabase.auth.getUser();
      if (!mounted) return;
      if (user) {
        setSession({ user: { id: user.id, email: user.email } });
        fetchTasks(user.id);
        fetchReminders(user.id);
      } else {
        setSession(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Notification Polling
  useEffect(() => {
    const checkReminders = () => {
      if (!session || reminders.length === 0) return;
      
      const now = new Date();
      
      reminders.forEach(async (reminder) => {
        if (reminder.notified) return;
        
        const eventTime = new Date(reminder.reminder_time);
        const timeDiff = eventTime.getTime() - now.getTime();
        const minutesDiff = Math.floor(timeDiff / (1000 * 60));
        
        // Alerta quando estiver entre 4 e 5 minutos (ou se já passou um pouco mas ainda não foi notificado)
        if (minutesDiff <= 5 && minutesDiff >= 0) {
          setActiveReminderAlert(reminder);
          
          // Marcar como notificado no banco para não repetir
          await supabase
            .from('reminders')
            .update({ notified: true })
            .eq('id', reminder.id);
            
          setReminders(prev => prev.map(r => r.id === reminder.id ? { ...r, notified: true } : r));
        }
      });
    };

    const interval = setInterval(checkReminders, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, [reminders, session]);

  const fetchTasks = async (userId: string) => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('order_index', { ascending: true });

    if (data) setTasks(data);
    else if (error) console.error(error);
  };

  const fetchReminders = async (userId: string) => {
    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .eq('user_id', userId)
      .order('reminder_time', { ascending: true });

    if (data) setReminders(data);
    else if (error) console.error(error);
  };


  const handleLogin = async (e: React.FormEvent, isSignUp = false) => {
    e.preventDefault();
    setAuthError('');

    // Validação client-side antes de chamar o Supabase (achado 4.1).
    const parsed = AuthSchema.safeParse({ email, password });
    if (!parsed.success) {
      setAuthError(parsed.error.issues[0]?.message ?? 'Dados inválidos.');
      return;
    }

    setAuthLoading(true);

    const { error } = isSignUp
      ? await supabase.auth.signUp({ email: parsed.data.email, password: parsed.data.password })
      : await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });

    if (error) {
      // Mensagem amigável, sem vazar detalhes técnicos (achado 4.5).
      setAuthError(friendlyAuthError(error.message));
      // Log apenas em dev para facilitar debug.
      if (process.env.NODE_ENV !== 'production') {
        console.error('[auth]', error);
      }
    } else if (isSignUp) {
      setAuthError('Cadastro enviado! Se a confirmação por e-mail estiver ativa, verifique sua caixa de entrada.');
    }
    setAuthLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setTasks([]);
    setReminders([]);
  };

  const handleCreateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !selectedCalendarDate) return;

    // Validação Zod (achado 4.1).
    const parsed = NewReminderSchema.safeParse(newReminder);
    if (!parsed.success) {
      setToast({ message: parsed.error.issues[0]?.message ?? 'Dados inválidos.', kind: 'error' });
      return;
    }

    const [hours, minutes] = (parsed.data.time || '00:00').split(':');
    const reminderTime = new Date(selectedCalendarDate);
    reminderTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    const reminderPayload = {
      user_id: session.user.id,
      lead_name: newReminder.lead_name,
      reminder_type: newReminder.type,
      reminder_time: reminderTime.toISOString(),
      notes: newReminder.notes
    };

    const { data, error } = await supabase
      .from('reminders')
      .insert({
        user_id: session.user.id,
        lead_name: parsed.data.lead_name,
        reminder_type: parsed.data.type,
        reminder_time: reminderTime.toISOString(),
        notes: parsed.data.notes ?? '',
      })
      .select()
      .single();

    if (data) {
      setReminders(prev => [...prev, data]);
      setIsReminderModalOpen(false);
      setNewReminder({ lead_name: '', type: 'Follow-up de Lead', time: '', notes: '' });
    } else if (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[reminders.insert]', error);
      }
      setToast({ message: 'Não foi possível salvar o lembrete. Tente novamente.', kind: 'error' });
    }
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  // Toast state para mensagens de erro não-críticas (achado 4.5 — substitui alert()).
  const [toast, setToast] = useState<{ message: string; kind: 'error' | 'info' } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  // --- Task Logic ---
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;

    // Validação Zod (achado 4.1).
    const parsed = NewTaskSchema.safeParse(newTask);
    if (!parsed.success) {
      setToast({ message: parsed.error.issues[0]?.message ?? 'Dados inválidos.', kind: 'error' });
      return;
    }

    setIsAdding(true);

    const targetStatus = parsed.data.status;
    const maxOrder = tasks
      .filter(t => t.status === targetStatus)
      .reduce((max, t) => Math.max(max, t.order_index), -1);

    const taskToInsert = {
      title: parsed.data.title,
      description: parsed.data.description ?? '',
      status: targetStatus,
      order_index: maxOrder + 1,
      user_id: session.user.id,
      priority: parsed.data.priority,
    };

    // Optimistic Update
    const tempId = crypto.randomUUID();
    setTasks(prev => [...prev, { ...taskToInsert, id: tempId, due_date: parsed.data.due_date || null }]);
    setNewTask({ title: '', description: '', priority: 'medium' as 'low' | 'medium' | 'high', due_date: '', status: 'backlog' as TaskStatus });

    const { data, error } = await supabase.from('tasks').insert(taskToInsert).select().single();

    if (data) {
      setTasks(prev => prev.map(t => t.id === tempId ? data : t));
    } else {
      setTasks(prev => prev.filter(t => t.id !== tempId)); // Rollback
      if (process.env.NODE_ENV !== 'production') {
        console.error('[tasks.insert]', error);
      }
      setToast({ message: 'Não foi possível salvar a tarefa. Tente novamente.', kind: 'error' });
    }
    setIsAdding(false);
  };

  const deleteTask = async (id: string) => {
    const backup = [...tasks];
    setTasks(prev => prev.filter(t => t.id !== id)); // Optimistic delete

    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[tasks.delete]', error);
      }
      setToast({ message: 'Não foi possível excluir a tarefa. Alterações revertidas.', kind: 'error' });
      setTasks(backup); // Rollback
    }
  };

  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setEditForm({
      title: task.title,
      description: task.description || '',
      priority: task.priority || 'medium',
      due_date: task.due_date ? task.due_date.substring(0, 10) : ''
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;

    // Validação Zod (achado 4.1).
    const parsed = EditTaskSchema.safeParse(editForm);
    if (!parsed.success) {
      setToast({ message: parsed.error.issues[0]?.message ?? 'Dados inválidos.', kind: 'error' });
      return;
    }

    const updatePayload = {
      title: parsed.data.title,
      description: parsed.data.description ?? '',
      priority: parsed.data.priority,
      due_date: parsed.data.due_date || null,
    };

    const previousTasks = [...tasks];
    setTasks(prev => prev.map(t => t.id === editingTask.id ? { ...t, ...updatePayload } : t)); // Optimistic

    const { error } = await supabase
      .from('tasks')
      .update(updatePayload)
      .eq('id', editingTask.id);

    if (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[tasks.update]', error);
      }
      setToast({ message: 'Não foi possível atualizar a tarefa. Alterações revertidas.', kind: 'error' });
      setTasks(previousTasks); // Rollback
    }

    setEditingTask(null);
  };

  const onDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result;

    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;
    if (!session) return; // Guard para TypeScript (session não pode ser null aqui, mas o tipo permite)

    const sourceStatus = source.droppableId as TaskStatus;
    const destStatus = destination.droppableId as TaskStatus;

    // Build new arrays
    const sourceTasks = tasks.filter(t => t.status === sourceStatus).sort((a, b) => a.order_index - b.order_index);
    const destTasks = sourceStatus === destStatus
      ? sourceTasks
      : tasks.filter(t => t.status === destStatus).sort((a, b) => a.order_index - b.order_index);

    const taskToMove = tasks.find(t => t.id === draggableId)!;

    // Optimistic State Update
    const allOtherTasks = tasks.filter(t => t.status !== sourceStatus && t.status !== destStatus);

    sourceTasks.splice(source.index, 1);
    const modifiedTask = { ...taskToMove, status: destStatus };
    destTasks.splice(destination.index, 0, modifiedTask);

    // Recalculate order_index
    const updatedSource = sourceTasks.map((t, idx) => ({ ...t, order_index: idx }));
    const updatedDest = destTasks.map((t, idx) => ({ ...t, order_index: idx }));

    const newTasks = sourceStatus === destStatus
      ? [...allOtherTasks, ...updatedDest]
      : [...allOtherTasks, ...updatedSource, ...updatedDest];

    setTasks(newTasks); // Apply instantly

    // Real DB Update
    try {
      if (sourceStatus !== destStatus) {
        await supabase.from('tasks').update({ status: destStatus, order_index: destination.index }).eq('id', draggableId);
      }

      const updates = (sourceStatus === destStatus ? updatedDest : [...updatedSource, ...updatedDest])
        .map(t => ({
          id: t.id,
          title: t.title,
          status: t.status,
          order_index: t.order_index,
          user_id: session.user.id
        }));

      await supabase.from('tasks').upsert(updates);
    } catch (err) {
      console.error("Falha ao salvar ordem no DB", err);
      // Aqui faríamos rollback recarregando os dados reais
      fetchTasks(session.user.id);
    }
  };

  // --- Derived Stats & Filtering ---
  const filteredTasks = useMemo(() => {
    if (!searchQuery.trim()) return tasks;
    const query = searchQuery.toLowerCase();
    return tasks.filter(t => 
      t.title.toLowerCase().includes(query) || 
      (t.description && t.description.toLowerCase().includes(query))
    );
  }, [tasks, searchQuery]);

  const stats = useMemo(() => {
    const backlog = filteredTasks.filter(t => t.status === 'backlog').length;
    const todo = filteredTasks.filter(t => t.status === 'todo').length;
    const doing = filteredTasks.filter(t => t.status === 'doing').length;
    const done = filteredTasks.filter(t => t.status === 'done').length;

    const today = new Date();
    today.setHours(0,0,0,0);
    const overdue = filteredTasks.filter(t => t.due_date && t.status !== 'done' && new Date(t.due_date.substring(0, 10) + 'T00:00:00') < today).length;

    const chartData = [
      { name: 'Backlog', total: backlog },
      { name: 'A Fazer', total: todo },
      { name: 'Em Progresso', total: doing },
      { name: 'Concluído', total: done },
    ];

    const pieData = chartData.filter(d => d.total > 0).map(d => ({ name: d.name, value: d.total }));

    return { backlog, todo, doing, done, overdue, chartData, pieData, total: filteredTasks.length };
  }, [filteredTasks]);

  // --- Auth UI Wrapper ---
  if (loadingSession) {
    return <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black"><Loader2 className="w-8 h-8 animate-spin text-zinc-400" /></div>;
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black p-4">
        <div className="bg-white dark:bg-zinc-900 w-full max-w-md p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xl">
          <div className="flex items-center gap-2 mb-8 justify-center">
            <div className="w-10 h-10 bg-zinc-900 dark:bg-white rounded-lg flex items-center justify-center">
              <Kanban className="w-6 h-6 text-white dark:text-black" />
            </div>
            <h1 className="text-2xl font-bold dark:text-white">GestãoPro</h1>
          </div>

          <form className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-zinc-300">Email</label>
              <input
                type="email"
                className="w-full px-4 py-3 bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white outline-none dark:text-white"
                value={email} onChange={e => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-zinc-300">Senha</label>
              <input
                type="password"
                className="w-full px-4 py-3 bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white outline-none dark:text-white"
                value={password} onChange={e => setPassword(e.target.value)}
              />
            </div>

            {authError && <p className="text-red-500 text-sm">{authError}</p>}

            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={(e) => handleLogin(e, false)}
                disabled={authLoading}
                className="flex-1 bg-zinc-900 dark:bg-white text-white dark:text-black py-3 rounded-xl font-bold hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                Entrar
              </button>
              <button
                type="button"
                onClick={(e) => handleLogin(e, true)}
                disabled={authLoading}
                className="flex-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white py-3 rounded-xl font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors"
              >
                Criar Conta
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // --- Main App UI ---
  return (
    <div className={`${isDarkMode ? 'dark' : ''} min-h-screen transition-colors duration-300`}>
      <div className="relative bg-zinc-100 dark:bg-[#1a1625] text-zinc-900 dark:text-zinc-100 min-h-screen font-sans overflow-hidden">

        {/* --- Background Orbs (efeito glass — camada de fundo fixa) --- */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none -z-0">
          {/* Orb ciano/teal — topo esquerdo */}
          <div
            className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full opacity-60 dark:opacity-60"
            style={{
              background: 'radial-gradient(circle, rgba(34,211,238,0.6) 0%, rgba(34,211,238,0) 70%)',
              filter: 'blur(80px)',
            }}
          />
          {/* Orb âmbar — centro direito */}
          <div
            className="absolute top-1/3 -right-40 w-[700px] h-[700px] rounded-full opacity-50 dark:opacity-55"
            style={{
              background: 'radial-gradient(circle, rgba(251,146,60,0.55) 0%, rgba(251,146,60,0) 70%)',
              filter: 'blur(100px)',
            }}
          />
          {/* Orb rosa/magenta — inferior central */}
          <div
            className="absolute -bottom-40 left-1/3 w-[650px] h-[650px] rounded-full opacity-50 dark:opacity-55"
            style={{
              background: 'radial-gradient(circle, rgba(236,72,153,0.5) 0%, rgba(236,72,153,0) 70%)',
              filter: 'blur(90px)',
            }}
          />
          {/* Orb violeta — diagonal sutil (camada de profundidade) */}
          <div
            className="absolute top-1/2 left-1/4 w-[500px] h-[500px] rounded-full opacity-45 dark:opacity-45"
            style={{
              background: 'radial-gradient(circle, rgba(139,92,246,0.4) 0%, rgba(139,92,246,0) 70%)',
              filter: 'blur(70px)',
            }}
          />
        </div>

        {/* Todo o conteúdo principal fica acima dos orbes */}
        <div className="relative z-10">

        {/* --- Header --- */}
        <header className="sticky top-0 z-50 bg-white/40 dark:bg-white/10 backdrop-blur-2xl border-b border-white/40 dark:border-white/15 shadow-sm shadow-black/5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-zinc-900 dark:bg-white rounded-lg flex items-center justify-center">
                <Kanban className="w-5 h-5 text-white dark:text-black" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-lg font-bold tracking-tight">GestãoPro Kanban</h1>
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">{session.user.email}</p>
              </div>
            </div>

            <div className="flex-1 max-w-md mx-8 hidden md:block">
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-zinc-600 dark:group-focus-within:text-zinc-300 transition-colors" />
                <input
                  type="text"
                  placeholder="Pesquisar tarefas..."
                  className="w-full pl-10 pr-4 py-2 bg-white/40 dark:bg-white/10 border border-white/40 dark:border-white/15 rounded-xl text-sm focus:ring-1 focus:ring-zinc-300 dark:focus:ring-white/20 outline-none transition-all backdrop-blur-md"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <nav className="flex items-center gap-1 bg-white/40 dark:bg-white/10 p-1 rounded-xl border border-white/40 dark:border-white/15 backdrop-blur-md">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'dashboard' ? 'bg-white/80 dark:bg-white/20 shadow-sm text-zinc-900 dark:text-white backdrop-blur-md' : 'text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white'}`}
              >
                Dashboard
              </button>
              <button
                onClick={() => setActiveTab('kanban')}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'kanban' ? 'bg-white/80 dark:bg-white/20 shadow-sm text-zinc-900 dark:text-white backdrop-blur-md' : 'text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white'}`}
              >
                Kanban
              </button>
              <button
                onClick={() => setActiveTab('calendar')}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'calendar' ? 'bg-white/80 dark:bg-white/20 shadow-sm text-zinc-900 dark:text-white backdrop-blur-md' : 'text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white'}`}
              >
                Calendário
              </button>
            </nav>

            <div className="flex items-center gap-3">
              <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">
                {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <button onClick={handleLogout} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* --- Input Section --- */}
          <section className="mb-8">
            <div className="bg-white/60 dark:bg-white/10 p-5 rounded-2xl border border-white/40 dark:border-white/15 shadow-lg shadow-black/5 dark:shadow-black/40 backdrop-blur-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-zinc-100 dark:bg-zinc-800/50 rounded-full -mr-32 -mt-32 blur-3xl opacity-50 pointer-events-none"></div>

              <div className="relative z-10">
                <h2 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider mb-4">Adicionar Nova Tarefa</h2>
                <form onSubmit={handleAddTask} className="flex flex-col gap-3">
                  <div className="flex flex-col md:flex-row gap-2">
                    <input
                      type="text"
                      placeholder="Título da tarefa..."
                      className="flex-1 px-3 py-2 text-sm bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white transition-all"
                      value={newTask.title}
                      onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                    />
                    <select
                      className="px-3 py-2 text-sm bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white transition-all text-zinc-600 dark:text-zinc-300 md:w-32"
                      value={newTask.priority}
                      onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as any })}
                    >
                      <option value="low">🟢 Baixa</option>
                      <option value="medium">🟡 Média</option>
                      <option value="high">🔴 Alta</option>
                    </select>
                    <input
                      type="date"
                      className="px-3 py-2 text-sm bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white transition-all text-zinc-600 dark:text-zinc-300 md:w-40 uppercase"
                      value={newTask.due_date}
                      onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                    />
                    <button
                      disabled={isAdding || !newTask.title}
                      className="md:w-32 py-2 bg-zinc-900 dark:bg-white text-white dark:text-black text-sm font-bold rounded-lg hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> Adicionar</>}
                    </button>
                  </div>
                  <div className="flex flex-col md:flex-row gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Descrição (opcional)..."
                      className="flex-1 px-3 py-2 text-sm bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white transition-all"
                      value={newTask.description}
                      onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                    />
                    <span className="text-[10px] sm:text-xs font-bold text-red-500 uppercase tracking-tight whitespace-nowrap">Qual a fase da tarefa:</span>
                    <select
                      className={`px-3 py-2 text-sm bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white transition-all font-bold md:w-40 ${
                        newTask.status === 'done' ? 'text-emerald-500' :
                        newTask.status === 'doing' ? 'text-amber-500' :
                        newTask.status === 'todo' ? 'text-blue-500' : 
                        'text-zinc-500'
                      }`}
                      value={newTask.status}
                      onChange={(e) => setNewTask({ ...newTask, status: e.target.value as TaskStatus })}
                    >
                      <option value="backlog" className="text-zinc-500">Backlog</option>
                      <option value="todo" className="text-blue-500">A fazer</option>
                      <option value="doing" className="text-amber-500">Em progresso</option>
                      <option value="done" className="text-emerald-500">Concluído</option>
                    </select>
                  </div>
                </form>
              </div>
            </div>
          </section>

          {/* --- Content Tabs --- */}
          {activeTab === 'dashboard' ? (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <StatCard title="Backlog" value={stats.backlog} icon={Clock} color="bg-zinc-500" />
                <StatCard title="A Fazer" value={stats.todo} icon={Package} color="bg-blue-500" />
                <StatCard title="Fazendo" value={stats.doing} icon={TrendingUp} color="bg-amber-500" />
                <StatCard title="Concluídas" value={stats.done} icon={CheckCircle2} color="bg-emerald-500" />
                <StatCard title="Atrasadas" value={stats.overdue} icon={AlertCircle} color="bg-red-500" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white/60 dark:bg-white/10 p-8 rounded-3xl border border-white/40 dark:border-white/15 shadow-lg shadow-black/5 dark:shadow-black/40 backdrop-blur-xl">
                  <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-500" /> Visão Geral
                  </h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#333' : '#eee'} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: isDarkMode ? '#888' : '#666', fontSize: 12 }} />
                        <Tooltip contentStyle={{ backgroundColor: isDarkMode ? '#18181b' : '#fff', borderRadius: '12px' }} />
                        <Bar dataKey="total" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={40} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === 'calendar' ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 bg-white/60 dark:bg-white/10 p-6 rounded-3xl border border-white/40 dark:border-white/15 shadow-xl shadow-black/5 dark:shadow-black/40 backdrop-blur-xl overflow-hidden min-h-[600px]">
              <div className="flex items-center justify-between mb-8 px-4">
                <div className="flex items-center gap-4">
                  <button onClick={prevMonth} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                    <ChevronRight className="w-6 h-6 rotate-180 text-zinc-400 hover:text-zinc-900 dark:hover:text-white" />
                  </button>
                  <h2 className="text-xl font-bold min-w-[180px] text-center dark:text-white uppercase tracking-tight">
                    {MONTHS_PT[currentDate.getMonth()]} {currentDate.getFullYear()}
                  </h2>
                  <button onClick={nextMonth} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                    <ChevronRight className="w-6 h-6 text-zinc-400 hover:text-zinc-900 dark:hover:text-white" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 border-b border-zinc-100 dark:border-zinc-800 mb-2">
                {DAYS_OF_WEEK.map(day => (
                  <div key={day} className="py-2 text-center text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{day}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-px bg-zinc-100 dark:bg-zinc-800 rounded-2xl overflow-hidden border border-zinc-100 dark:border-zinc-800">
                {Array.from({ length: getFirstDayOfMonth(currentDate) }).map((_, i) => (
                  <div key={`empty-${i}`} className="bg-white dark:bg-zinc-900/50 aspect-[4/3]"></div>
                ))}
                {Array.from({ length: getDaysInMonth(currentDate) }).map((_, i) => {
                  const day = i + 1;
                  const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                  const isToday = isSameDay(date, new Date());
                  const dayReminders = reminders.filter(r => isSameDay(new Date(r.reminder_time), date));

                  return (
                    <div 
                      key={day} 
                      onClick={() => {
                        setSelectedCalendarDate(date);
                        setIsReminderModalOpen(true);
                      }}
                      className="bg-white dark:bg-zinc-900 aspect-[4/3] p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 transition-colors cursor-pointer group relative"
                    >
                      <div className="flex justify-between items-start">
                        <span className={`text-sm font-bold ${isToday ? 'bg-blue-600 text-white w-6 h-6 flex items-center justify-center rounded-full' : 'text-zinc-400 dark:text-zinc-500'}`}>
                          {day}
                        </span>
                      </div>
                      <div className="mt-1 space-y-1 overflow-y-auto max-h-[80%] pb-1 scrollbar-hide">
                        {dayReminders.map(r => (
                          <div key={r.id} className="text-[9px] font-bold px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded border border-blue-100 dark:border-blue-800/50 truncate">
                            {new Date(r.reminder_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} {r.lead_name}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500 pb-4">
              <DragDropContext onDragEnd={onDragEnd}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
                  {COLUMNS.map((status) => {
                    const columnTasks = filteredTasks.filter(t => t.status === status).sort((a, b) => a.order_index - b.order_index);

                    return (
                      <div key={status} className="flex flex-col">
                        <div className="flex items-center justify-between mb-4 px-2">
                          <h3 className="font-bold text-zinc-900 dark:text-white uppercase tracking-wider text-sm flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${status === 'done' ? 'bg-emerald-500' :
                                status === 'doing' ? 'bg-amber-500' :
                                  status === 'todo' ? 'bg-blue-500' : 'bg-zinc-500'
                              }`} />
                            {STATUS_MAP[status]}
                          </h3>
                          <span className="bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs px-2 py-0.5 rounded-full font-bold">
                            {columnTasks.length}
                          </span>
                        </div>

                        <Droppable droppableId={status}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              className={`flex flex-col gap-3 min-h-[500px] bg-white/30 dark:bg-white/10 p-2.5 rounded-2xl border transition-colors backdrop-blur-md ${snapshot.isDraggingOver ? 'border-white/60 dark:border-white/25 bg-white/50 dark:bg-white/15' : 'border-dashed border-white/40 dark:border-white/15'
                                }`}
                            >
                              {columnTasks.map((task, index) => (
                                <Draggable key={task.id} draggableId={task.id} index={index}>
                                  {(provided, snapshot) => (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      {...provided.dragHandleProps}
                                      className={`bg-white/70 dark:bg-white/15 p-4 rounded-xl shadow-md shadow-black/5 dark:shadow-black/30 border group relative backdrop-blur-xl ${snapshot.isDragging ? 'shadow-2xl border-blue-400/60 rotate-2 z-50' : (task.due_date && task.status !== 'done' && new Date(task.due_date.substring(0, 10) + 'T00:00:00') < new Date(new Date().setHours(0,0,0,0))) ? 'border-red-400/50 bg-red-50/40 dark:bg-red-900/20' : 'border-white/40 dark:border-white/20'
                                        }`}
                                    >
                                      <div className="flex flex-col gap-1.5 mb-2 relative">
                                        <div className="flex gap-1.5 flex-wrap">
                                          {task.priority && (
                                            <div className={`self-start text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                              task.priority === 'high' ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400' :
                                              task.priority === 'medium' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400' :
                                              'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400'
                                            }`}>
                                              {task.priority === 'high' ? 'Alta' : task.priority === 'medium' ? 'Média' : 'Baixa'}
                                            </div>
                                          )}
                                          {task.due_date && (
                                            <div className={`self-start text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 leading-none ${task.status !== 'done' && new Date(task.due_date.substring(0, 10) + 'T00:00:00') < new Date(new Date().setHours(0,0,0,0)) ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400 animate-pulse' : 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400'}`}>
                                              <Calendar className="w-2.5 h-2.5" />
                                              {new Date(task.due_date.substring(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                            </div>
                                          )}
                                        </div>
                                        <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 pr-12 leading-tight">{task.title}</h4>
                                        <div className="absolute right-0 top-0 opacity-0 group-hover:opacity-100 flex gap-1 transition-all">
                                          <button
                                            onClick={() => openEditModal(task)}
                                            className="p-1 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-500 rounded-md transition-all"
                                          >
                                            <Edit2 className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            onClick={() => setTaskToDelete(task)}
                                            className="p-1 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-500 rounded-md transition-all"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </div>

                                      {task.description && (
                                        <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-3 mb-3">
                                          {task.description}
                                        </p>
                                      )}

                                      <div className="flex items-center justify-between mt-auto opacity-60">
                                        <div className="flex items-center gap-1 text-zinc-500 dark:text-zinc-400 text-[10px] font-medium font-mono bg-white/60 dark:bg-white/15 px-2 py-1 rounded backdrop-blur-sm">
                                          #{task.order_index}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </Draggable>
                              ))}
                              {provided.placeholder}

                              {columnTasks.length === 0 && !snapshot.isDraggingOver && (
                                <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
                                  <AlertCircle className="w-6 h-6 mb-2 opacity-20" />
                                  <p className="text-[10px] font-medium uppercase tracking-widest opacity-50">Vazio</p>
                                </div>
                              )}
                            </div>
                          )}
                        </Droppable>
                      </div>
                    )
                  })}
                </div>
              </DragDropContext>
            </div>
          )}
        </main>
        </div>
      </div>

      {/* Edit Modal Overlay */}
      <AnimatePresence>
        {editingTask && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white/80 dark:bg-white/15 w-full max-w-lg p-6 rounded-3xl shadow-2xl border border-white/40 dark:border-white/20 backdrop-blur-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold dark:text-white uppercase tracking-wider text-sm">Editar Tarefa</h2>
                <button onClick={() => setEditingTask(null)} className="p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-zinc-600 dark:text-zinc-400">Título</label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white transition-all text-sm text-zinc-900 dark:text-zinc-100"
                    placeholder="Título da tarefa..."
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-zinc-600 dark:text-zinc-400">Descrição</label>
                  <textarea
                    rows={4}
                    className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white transition-all text-sm resize-none text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600"
                    placeholder="Descrição da tarefa..."
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-zinc-600 dark:text-zinc-400">Prioridade</label>
                  <select
                    className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white transition-all text-sm appearance-none text-zinc-900 dark:text-zinc-100"
                    value={editForm.priority}
                    onChange={(e) => setEditForm({ ...editForm, priority: e.target.value as any })}
                  >
                    <option value="low">🟢 Baixa</option>
                    <option value="medium">🟡 Média</option>
                    <option value="high">🔴 Alta</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-zinc-600 dark:text-zinc-400">Prazo de Entrega (Due Date)</label>
                  <input
                    type="date"
                    className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white transition-all text-sm text-zinc-900 dark:text-zinc-100"
                    value={editForm.due_date}
                    onChange={(e) => setEditForm({ ...editForm, due_date: e.target.value })}
                  />
                </div>
                
                <div className="flex gap-3 pt-6">
                  <button
                    type="button"
                    onClick={() => setEditingTask(null)}
                    className="flex-1 px-4 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-semibold rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={!editForm.title}
                    className="flex-1 px-4 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    Salvar Alterações
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
        {/* --- Reminder Modal --- */}
        {isReminderModalOpen && selectedCalendarDate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="bg-white/80 dark:bg-white/15 w-full max-w-md p-6 rounded-3xl shadow-2xl border border-white/40 dark:border-white/20 backdrop-blur-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="space-y-0.5">
                  <h2 className="text-xl font-bold dark:text-white">Novo lembrete</h2>
                  <p className="text-xs font-bold text-blue-500">{selectedCalendarDate.toLocaleDateString()}</p>
                </div>
                <button onClick={() => setIsReminderModalOpen(false)} className="p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateReminder} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-zinc-500 dark:text-zinc-400">Lead / Nome</label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-[#0b0f1a] border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all text-sm text-zinc-900 dark:text-white"
                    placeholder="Nome do lead"
                    value={newReminder.lead_name}
                    onChange={(e) => setNewReminder({ ...newReminder, lead_name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-zinc-500 dark:text-zinc-400">Tipo</label>
                  <select
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-[#0b0f1a] border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all text-sm text-zinc-900 dark:text-white appearance-none cursor-pointer"
                    value={newReminder.type}
                    onChange={(e) => setNewReminder({ ...newReminder, type: e.target.value })}
                  >
                    <option value="Follow-up de Lead">Follow-up de Lead</option>
                    <option value="Reunião">Reunião</option>
                    <option value="Ligação">Ligação</option>
                    <option value="Envio de Proposta">Envio de Proposta</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-zinc-500 dark:text-zinc-400">Horário (opcional)</label>
                  <input
                    type="time"
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-[#0b0f1a] border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all text-sm text-zinc-900 dark:text-white"
                    value={newReminder.time}
                    onChange={(e) => setNewReminder({ ...newReminder, time: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-zinc-500 dark:text-zinc-400">Nota</label>
                  <textarea
                    rows={3}
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-[#0b0f1a] border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all text-sm resize-none text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600"
                    placeholder="Observações..."
                    value={newReminder.notes}
                    onChange={(e) => setNewReminder({ ...newReminder, notes: e.target.value })}
                  />
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsReminderModalOpen(false)}
                    className="flex-1 px-4 py-3 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white font-bold rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
                  >
                    Salvar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* --- Delete Confirmation Modal --- */}
        {taskToDelete && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white/80 dark:bg-white/15 w-full max-w-md p-6 rounded-3xl shadow-2xl border border-white/40 dark:border-white/20 backdrop-blur-2xl"
            >
              <div className="flex items-start gap-4 mb-6">
                <div className="p-3 bg-red-50 dark:bg-red-900/30 rounded-2xl shrink-0">
                  <AlertCircle className="w-6 h-6 text-red-500" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-1">Excluir tarefa?</h2>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Esta ação não pode ser desfeita. A tarefa será removida permanentemente.
                  </p>
                </div>
              </div>

              <div className="bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 mb-6">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 line-clamp-2">
                  {taskToDelete.title}
                </p>
                {taskToDelete.description && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">
                    {taskToDelete.description}
                  </p>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setTaskToDelete(null)}
                  className="flex-1 px-4 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-semibold rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (taskToDelete) deleteTask(taskToDelete.id);
                    setTaskToDelete(null);
                  }}
                  className="flex-1 px-4 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20"
                >
                  Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

        {/* --- Reminder Auto-Alert --- */}
        <AnimatePresence>
          {activeReminderAlert && (
            <div className="fixed bottom-8 right-8 z-[100]">
              <motion.div
                initial={{ opacity: 0, x: 100, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 100, scale: 0.9 }}
                className="bg-blue-600 text-white p-6 rounded-3xl shadow-2xl w-80 border border-blue-400/30"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <Clock className="w-6 h-6 text-white" />
                  </div>
                  <button onClick={() => setActiveReminderAlert(null)} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <h3 className="text-lg font-bold mb-1">Lembrete de Compromisso</h3>
                <p className="text-blue-100 text-sm mb-4">Seu evento começa em 5 minutos!</p>
                
                <div className="space-y-2 mb-6">
                  <div className="flex justify-between text-xs border-b border-white/10 pb-2">
                    <span className="opacity-70">Lead:</span>
                    <span className="font-bold">{activeReminderAlert.lead_name}</span>
                  </div>
                  <div className="flex justify-between text-xs border-b border-white/10 pb-2">
                    <span className="opacity-70">Tipo:</span>
                    <span className="font-bold">{activeReminderAlert.reminder_type}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="opacity-70">Horário:</span>
                    <span className="font-bold">{new Date(activeReminderAlert.reminder_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>

                <button
                  onClick={() => setActiveReminderAlert(null)}
                  className="w-full py-3 bg-white text-blue-600 font-bold rounded-xl hover:bg-blue-50 transition-colors shadow-lg"
                >
                  Entendi
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* --- Toast de Mensagens (substitui alert() — achado 4.5) --- */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[120] px-5 py-3 rounded-2xl shadow-2xl border backdrop-blur-sm flex items-center gap-3 max-w-md mx-4 ${
                toast.kind === 'error'
                  ? 'bg-red-50 dark:bg-red-950/90 border-red-200 dark:border-red-900/60 text-red-900 dark:text-red-100'
                  : 'bg-zinc-50 dark:bg-zinc-900/95 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100'
              }`}
              role="status"
              aria-live="polite"
            >
              <AlertCircle className={`w-5 h-5 shrink-0 ${toast.kind === 'error' ? 'text-red-500' : 'text-zinc-500'}`} />
              <p className="text-sm font-medium flex-1">{toast.message}</p>
              <button
                onClick={() => setToast(null)}
                className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
    </div>
  );
}
