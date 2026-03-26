'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { 
  LayoutDashboard, 
  Kanban, 
  Plus, 
  Moon, 
  Sun, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  MoreVertical,
  Trash2,
  ChevronRight,
  TrendingUp,
  Package,
  Users,
  DollarSign
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---

type TaskStatus = 'A Fazer' | 'Em Progresso' | 'Concluído';

interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: 'Baixa' | 'Média' | 'Alta';
  category: 'Estoque' | 'Financeiro' | 'Marketing' | 'Operacional';
  date: string;
}

// --- Mock Data ---

const INITIAL_TASKS: Task[] = [
  {
    id: '1',
    title: 'Reposição de estoque de bebidas',
    description: 'Fazer pedido de refrigerantes e águas para o final de semana.',
    status: 'A Fazer',
    priority: 'Alta',
    category: 'Estoque',
    date: '2026-03-27',
  },
  {
    id: '2',
    title: 'Conferência de validade - Prateleira 3',
    description: 'Verificar produtos da seção de laticínios.',
    status: 'Em Progresso',
    priority: 'Média',
    category: 'Operacional',
    date: '2026-03-26',
  },
  {
    id: '3',
    title: 'Pagamento fornecedor de hortifruti',
    description: 'Transferência via PIX para o Sr. Carlos.',
    status: 'Concluído',
    priority: 'Alta',
    category: 'Financeiro',
    date: '2026-03-25',
  },
  {
    id: '4',
    title: 'Postagem Instagram: Promoção de Páscoa',
    description: 'Criar arte no Canva e postar nos stories.',
    status: 'A Fazer',
    priority: 'Média',
    category: 'Marketing',
    date: '2026-03-28',
  },
  {
    id: '5',
    title: 'Limpeza do depósito',
    description: 'Organizar caixas vazias e varrer o chão.',
    status: 'Em Progresso',
    priority: 'Baixa',
    category: 'Operacional',
    date: '2026-03-26',
  },
  {
    id: '6',
    title: 'Fechamento de caixa mensal',
    description: 'Reunir notas fiscais e enviar para o contador.',
    status: 'A Fazer',
    priority: 'Alta',
    category: 'Financeiro',
    date: '2026-03-31',
  }
];

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
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'kanban'>('dashboard');
  const [isThinking, setIsThinking] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', description: '', category: 'Operacional' as any });

  // --- Logic ---

  const stats = useMemo(() => {
    const todo = tasks.filter(t => t.status === 'A Fazer').length;
    const doing = tasks.filter(t => t.status === 'Em Progresso').length;
    const done = tasks.filter(t => t.status === 'Concluído').length;
    
    const byCategory = tasks.reduce((acc: any, task) => {
      acc[task.category] = (acc[task.category] || 0) + 1;
      return acc;
    }, {});

    const chartData = [
      { name: 'A Fazer', total: todo },
      { name: 'Em Progresso', total: doing },
      { name: 'Concluído', total: done },
    ];

    const pieData = Object.keys(byCategory).map(cat => ({
      name: cat,
      value: byCategory[cat]
    }));

    return { todo, doing, done, chartData, pieData, total: tasks.length };
  }, [tasks]);

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title) return;

    setIsThinking(true);
    
    // Simulate AI processing
    setTimeout(() => {
      const task: Task = {
        id: Math.random().toString(36).substr(2, 9),
        title: newTask.title,
        description: newTask.description || 'Tarefa gerada automaticamente.',
        status: 'A Fazer',
        priority: 'Média',
        category: newTask.category,
        date: new Date().toISOString().split('T')[0],
      };
      setTasks(prev => [task, ...prev]);
      setNewTask({ title: '', description: '', category: 'Operacional' });
      setIsThinking(false);
    }, 2000);
  };

  const moveTask = (id: string, newStatus: TaskStatus) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t));
  };

  const deleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  return (
    <div className={`${isDarkMode ? 'dark' : ''} min-h-screen transition-colors duration-300`}>
      <div className="bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 min-h-screen font-sans">
        
        {/* --- Header --- */}
        <header className="sticky top-0 z-50 bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-zinc-900 dark:bg-white rounded-lg flex items-center justify-center">
                <LayoutDashboard className="w-5 h-5 text-white dark:text-black" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight">GestãoPro Lojista</h1>
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">Organize seu comércio</p>
              </div>
            </div>

            <nav className="hidden md:flex items-center gap-1 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl">
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
                Pipeline Kanban
              </button>
            </nav>

            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
              >
                {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center overflow-hidden border border-zinc-300 dark:border-zinc-700 relative">
                <Image 
                  src="https://picsum.photos/seed/shopkeeper/100/100" 
                  alt="User" 
                  fill
                  className="object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          
          {/* --- Input Section --- */}
          <section className="mb-12">
            <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-zinc-100 dark:bg-zinc-800/50 rounded-full -mr-32 -mt-32 blur-3xl opacity-50"></div>
              
              <div className="relative">
                <h2 className="text-2xl font-bold mb-2">O que temos para hoje?</h2>
                <p className="text-zinc-500 dark:text-zinc-400 mb-6">Descreva sua tarefa e nossa IA ajudará a organizar seu pipeline.</p>
                
                <form onSubmit={handleAddTask} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <input 
                        type="text" 
                        placeholder="Ex: Fazer pedido de reposição de laticínios..."
                        className="w-full px-4 py-3 bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white transition-all"
                        value={newTask.title}
                        onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                      />
                    </div>
                    <select 
                      className="px-4 py-3 bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none"
                      value={newTask.category}
                      onChange={(e) => setNewTask({...newTask, category: e.target.value as any})}
                    >
                      <option value="Estoque">Estoque</option>
                      <option value="Financeiro">Financeiro</option>
                      <option value="Marketing">Marketing</option>
                      <option value="Operacional">Operacional</option>
                    </select>
                  </div>
                  <textarea 
                    placeholder="Detalhes adicionais (opcional)..."
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none h-24 resize-none"
                    value={newTask.description}
                    onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                  ></textarea>
                  
                  <button 
                    disabled={isThinking || !newTask.title}
                    className="w-full md:w-auto px-8 py-3 bg-zinc-900 dark:bg-white text-white dark:text-black font-bold rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isThinking ? (
                      <>
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                        Processando...
                      </>
                    ) : (
                      <>
                        <Plus className="w-5 h-5" />
                        Adicionar Tarefa
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          </section>

          {/* --- Content Tabs --- */}
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' ? (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard title="Total de Tarefas" value={stats.total} icon={Kanban} color="bg-zinc-900 dark:bg-zinc-700" />
                  <StatCard title="A Fazer" value={stats.todo} icon={Clock} color="bg-blue-500" />
                  <StatCard title="Em Progresso" value={stats.doing} icon={TrendingUp} color="bg-amber-500" />
                  <StatCard title="Concluídas" value={stats.done} icon={CheckCircle2} color="bg-emerald-500" />
                </div>

                {/* Charts Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-blue-500" />
                      Status das Tarefas
                    </h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats.chartData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#333' : '#eee'} />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: isDarkMode ? '#888' : '#666', fontSize: 12}} />
                          <YAxis axisLine={false} tickLine={false} tick={{fill: isDarkMode ? '#888' : '#666', fontSize: 12}} />
                          <Tooltip 
                            contentStyle={{backgroundColor: isDarkMode ? '#18181b' : '#fff', border: 'none', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}}
                            itemStyle={{color: isDarkMode ? '#fff' : '#000'}}
                          />
                          <Bar dataKey="total" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={40} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                      <Package className="w-5 h-5 text-emerald-500" />
                      Distribuição por Categoria
                    </h3>
                    <div className="h-64 flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={stats.pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {stats.pieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{backgroundColor: isDarkMode ? '#18181b' : '#fff', border: 'none', borderRadius: '12px'}}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex flex-col gap-2 ml-4">
                        {stats.pieData.map((entry, index) => (
                          <div key={entry.name} className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{backgroundColor: COLORS[index % COLORS.length]}}></div>
                            <span className="text-xs text-zinc-500">{entry.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="kanban"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="grid grid-cols-1 md:grid-cols-3 gap-6"
              >
                {(['A Fazer', 'Em Progresso', 'Concluído'] as TaskStatus[]).map(status => (
                  <div key={status} className="flex flex-col gap-4">
                    <div className="flex items-center justify-between px-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-zinc-900 dark:text-white">{status}</h3>
                        <span className="bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-[10px] px-2 py-0.5 rounded-full font-bold">
                          {tasks.filter(t => t.status === status).length}
                        </span>
                      </div>
                      <button className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-md">
                        <MoreVertical className="w-4 h-4 text-zinc-400" />
                      </button>
                    </div>

                    <div className="flex flex-col gap-3 min-h-[500px] bg-zinc-100/50 dark:bg-zinc-900/30 p-3 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800">
                      {tasks.filter(t => t.status === status).map(task => (
                        <motion.div 
                          layout
                          key={task.id}
                          className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm group relative"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                              task.category === 'Estoque' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' :
                              task.category === 'Financeiro' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' :
                              task.category === 'Marketing' ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' :
                              'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                            }`}>
                              {task.category}
                            </span>
                            <div className="flex items-center gap-1">
                              <button 
                                onClick={() => deleteTask(task.id)}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-500 rounded-md transition-all"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          
                          <h4 className="font-bold text-sm mb-1">{task.title}</h4>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 mb-4">{task.description}</p>
                          
                          <div className="flex items-center justify-between mt-auto">
                            <div className="flex items-center gap-1.5 text-zinc-400">
                              <Clock className="w-3 h-3" />
                              <span className="text-[10px] font-medium">{task.date}</span>
                            </div>
                            
                            <div className="flex items-center gap-1">
                              {status !== 'A Fazer' && (
                                <button 
                                  onClick={() => moveTask(task.id, status === 'Concluído' ? 'Em Progresso' : 'A Fazer')}
                                  className="p-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                                >
                                  <ChevronRight className="w-3.5 h-3.5 rotate-180" />
                                </button>
                              )}
                              {status !== 'Concluído' && (
                                <button 
                                  onClick={() => moveTask(task.id, status === 'A Fazer' ? 'Em Progresso' : 'Concluído')}
                                  className="p-1.5 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-lg hover:opacity-80 transition-colors"
                                >
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                      
                      {tasks.filter(t => t.status === status).length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
                          <AlertCircle className="w-8 h-8 mb-2 opacity-20" />
                          <p className="text-xs font-medium opacity-50">Nenhuma tarefa aqui</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* --- Footer --- */}
        <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-zinc-200 dark:border-zinc-800 mt-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2 opacity-50">
              <div className="w-6 h-6 bg-zinc-900 dark:bg-white rounded flex items-center justify-center">
                <LayoutDashboard className="w-4 h-4 text-white dark:text-black" />
              </div>
              <span className="text-sm font-bold">GestãoPro Lojista</span>
            </div>
            <p className="text-xs text-zinc-500">© 2026 GestãoPro - O braço direito do pequeno lojista brasileiro.</p>
            <div className="flex items-center gap-4">
              <a href="#" className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white underline underline-offset-4">Privacidade</a>
              <a href="#" className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white underline underline-offset-4">Termos</a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
