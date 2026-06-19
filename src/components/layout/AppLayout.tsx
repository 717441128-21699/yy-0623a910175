import { Outlet } from 'react-router-dom';
import TopNav from './TopNav';

export default function AppLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <TopNav />
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <Outlet />
        </div>
      </main>
      <footer className="border-t border-ink-200 bg-white/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between text-xs text-ink-500">
          <span className="font-song">墨音 · 让你的文字被听见</span>
          <span>所有数据仅保存在本地浏览器</span>
        </div>
      </footer>
    </div>
  );
}
