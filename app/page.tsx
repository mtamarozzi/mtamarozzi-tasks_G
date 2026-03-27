'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import {
  LayoutDashboard, Kanban, Plus, Moon, Sun, CheckCircle2,
  Clock, AlertCircle, MoreVertical, Trash2, ChevronRight,
  TrendingUp, Package, LogOut, Loader2
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '@/lib/supabase';

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
}

const STATUS_MAP: Record<TaskStatus, string> = {
  backlog: 'Backlog',
  todo: 'A Fazer',
  doing: 'Em Progresso',
  done: 'Concluído'
};

const COLUMNS: TaskStatus[] = ['backlog', 'todo', 'doing', 'done'];
const COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444'];

// --- Components ---
const StatCard = ({ title, value, icon: Icon, color }: any) => (
  <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
    <div className="flex items-center justify-between mb-4">
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{title}</span>
    </div>
    <div className="text-2xl font-bold text-zinc-900 dark:text-white">{value}</div>
  </div>
);

export default function PlannerApp() {
  const [session, setSession] = useState<any>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  // Auth Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // App State
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'kanban'>('dashboard');
  const [newTask, setNewTask] = useState({ title: '', description: '' });
  const [isAdding, setIsAdding] = useState(false);

  // --- Auth & Initial Fetch ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoadingSession(false);
      if (session) fetchTasks(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchTasks(session.user.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchTasks = async (userId: string) => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('order_index', { ascending: true });

    if (data) setTasks(data);
    else if (error) console.error(error);
  };

  const handleLogin = async (e: React.FormEvent, isSignUp = false) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    const { error } = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setAuthError(error.message);
    } else if (isSignUp) {
      alert("Comando de cadastro enviado com sucesso! \\n\\nSe a página não entrar sozinha agora, é porque o Supabase bloqueou por padrão pedindo verificação de e-mail.\\n\\nPara desbloquear o modo de desenvolvedor fácil: Abra o seu Supabase > Authentication > Providers > Email > Desmarque a opção 'Confirm email' e salve.");
    }
    setAuthLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setTasks([]);
  };

  // --- Task Logic ---
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title || !session) return;
    setIsAdding(true);

    const maxOrder = tasks
      .filter(t => t.status === 'backlog')
      .reduce((max, t) => Math.max(max, t.order_index), -1);

    const taskToInsert = {
      title: newTask.title,
      description: newTask.description,
      status: 'backlog' as TaskStatus,
      order_index: maxOrder + 1,
      user_id: session.user.id
    };

    // Optimistic Update
    const tempId = Math.random().toString();
    setTasks(prev => [...prev, { ...taskToInsert, id: tempId, due_date: null }]);
    setNewTask({ title: '', description: '' });

    const { data, error } = await supabase.from('tasks').insert(taskToInsert).select().single();

    if (data) {
      setTasks(prev => prev.map(t => t.id === tempId ? data : t));
    } else {
      setTasks(prev => prev.filter(t => t.id !== tempId)); // Rollback
      console.error('Insert error:', error);
      alert(`Erro Supabase: ${error?.message || error?.details || JSON.stringify(error)}`);
    }
    setIsAdding(false);
  };

  const deleteTask = async (id: string) => {
    const backup = [...tasks];
    setTasks(prev => prev.filter(t => t.id !== id)); // Optimistic delete

    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) setTasks(backup); // Rollback
  };

  const onDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result;

    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

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

  // --- Derived Stats ---
  const stats = useMemo(() => {
    const backlog = tasks.filter(t => t.status === 'backlog').length;
    const todo = tasks.filter(t => t.status === 'todo').length;
    const doing = tasks.filter(t => t.status === 'doing').length;
    const done = tasks.filter(t => t.status === 'done').length;

    const chartData = [
      { name: 'Backlog', total: backlog },
      { name: 'A Fazer', total: todo },
      { name: 'Em Progresso', total: doing },
      { name: 'Concluído', total: done },
    ];

    const pieData = chartData.filter(d => d.total > 0).map(d => ({ name: d.name, value: d.total }));

    return { backlog, todo, doing, done, chartData, pieData, total: tasks.length };
  }, [tasks]);

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
            <h1 className="text-2xl font-bold dark:text-white">GestãoPro Lojista</h1>
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
      <div className="bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 min-h-screen font-sans">

        {/* --- Header --- */}
        <header className="sticky top-0 z-50 bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
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

            <nav className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'dashboard' ? 'bg-white dark:bg-zinc-800 shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-500 hover:text-zinc-700'}`}
              >
                Dashboard
              </button>
              <button
                onClick={() => setActiveTab('kanban')}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'kanban' ? 'bg-white dark:bg-zinc-800 shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-500 hover:text-zinc-700'}`}
              >
                Kanban
              </button>
            </nav>

            <div className="flex items-center gap-3">
              <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">
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
          <section className="mb-12">
            <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-zinc-100 dark:bg-zinc-800/50 rounded-full -mr-32 -mt-32 blur-3xl opacity-50 pointer-events-none"></div>

              <div className="relative z-10">
                <h2 className="text-xl md:text-2xl font-bold mb-2">Adicionar Nova Tarefa</h2>
                <form onSubmit={handleAddTask} className="flex flex-col md:flex-row gap-4 mt-6">
                  <div className="flex-1 space-y-4">
                    <input
                      type="text"
                      placeholder="Título da tarefa..."
                      className="w-full px-4 py-3 bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white transition-all"
                      value={newTask.title}
                      onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                    />
                    <input
                      type="text"
                      placeholder="Descrição (opcional)..."
                      className="w-full px-4 py-3 bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white transition-all"
                      value={newTask.description}
                      onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                    />
                  </div>
                  <button
                    disabled={isAdding || !newTask.title}
                    className="md:w-48 px-8 py-3 bg-zinc-900 dark:bg-white text-white dark:text-black font-bold rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 h-[120px]"
                  >
                    {isAdding ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Plus className="w-5 h-5" /> Adicionar</>}
                  </button>
                </form>
              </div>
            </div>
          </section>

          {/* --- Content Tabs --- */}
          {activeTab === 'dashboard' ? (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard title="Backlog" value={stats.backlog} icon={Clock} color="bg-zinc-500" />
                <StatCard title="A Fazer" value={stats.todo} icon={Package} color="bg-blue-500" />
                <StatCard title="Fazendo" value={stats.doing} icon={TrendingUp} color="bg-amber-500" />
                <StatCard title="Concluídas" value={stats.done} icon={CheckCircle2} color="bg-emerald-500" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
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
          ) : (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500 overflow-x-auto pb-4">
              <DragDropContext onDragEnd={onDragEnd}>
                <div className="flex gap-6 min-w-max">
                  {COLUMNS.map((status) => {
                    const columnTasks = tasks.filter(t => t.status === status).sort((a, b) => a.order_index - b.order_index);

                    return (
                      <div key={status} className="w-80 flex flex-col flex-shrink-0">
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
                              className={`flex flex-col gap-3 min-h-[500px] bg-zinc-100/50 dark:bg-zinc-900/30 p-2.5 rounded-2xl border transition-colors ${snapshot.isDraggingOver ? 'border-zinc-300 dark:border-zinc-700 bg-zinc-200/50 dark:bg-zinc-800/50' : 'border-dashed border-zinc-200 dark:border-zinc-800'
                                }`}
                            >
                              {columnTasks.map((task, index) => (
                                <Draggable key={task.id} draggableId={task.id} index={index}>
                                  {(provided, snapshot) => (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      {...provided.dragHandleProps}
                                      className={`bg-white dark:bg-zinc-900 p-4 rounded-xl shadow-sm border group relative ${snapshot.isDragging ? 'shadow-xl border-blue-500 rotate-2 z-50' : 'border-zinc-200 dark:border-zinc-800'
                                        }`}
                                    >
                                      <div className="flex items-start justify-between mb-2">
                                        <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 pr-6 leading-tight">{task.title}</h4>
                                        <button
                                          onClick={() => deleteTask(task.id)}
                                          className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-500 rounded-md transition-all"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>

                                      {task.description && (
                                        <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-3 mb-3">
                                          {task.description}
                                        </p>
                                      )}

                                      <div className="flex items-center justify-between mt-auto opacity-60">
                                        <div className="flex items-center gap-1 text-zinc-500 text-[10px] font-medium font-mono bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">
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
  );
}
