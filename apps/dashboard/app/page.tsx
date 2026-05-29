export default function Home() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-muted/40 p-6 md:p-10">
      <div className="mx-auto flex w-full max-w-[480px] flex-col items-center gap-8 text-center">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            NextDoctor <span className="text-primary">Dashboard</span>
          </h1>
          <p className="text-lg text-muted-foreground">
            Sua central de diagnóstico e performance agora com Shadcn e Tailwind v4.
          </p>
        </div>
        
        <div className="flex flex-wrap justify-center gap-4">
          <a href="/projects" className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-8 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/80">
            Ver Projetos
          </a>
          <a href="/projects/new" className="inline-flex h-9 items-center justify-center rounded-lg border border-input bg-background px-8 text-sm font-medium transition-all hover:bg-muted">
            Novo Projeto
          </a>
        </div>

        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col items-start gap-2 rounded-xl border bg-card p-6 text-left shadow-sm">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            <h3 className="font-semibold">Faturamento</h3>
            <p className="text-sm text-muted-foreground line-clamp-2">Gerencie suas assinaturas e histórico de pagamentos.</p>
          </div>
          <div className="flex flex-col items-start gap-2 rounded-xl border bg-card p-6 text-left shadow-sm">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <h3 className="font-semibold">Segurança</h3>
            <p className="text-sm text-muted-foreground line-clamp-2">Configure tokens de projeto e permissões de acesso.</p>
          </div>
        </div>

        <div className="mt-8 text-sm text-muted-foreground">
          Pressione <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100">D</kbd> para alternar o tema.
        </div>
      </div>
    </div>
  );
}
