import { NavLink } from 'react-router-dom';
import { BookOpen, Mic, Volume2 } from 'lucide-react';
import { useAppStore, selectUnassignedCount } from '@/store/useAppStore';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  {
    path: '/import',
    label: '章节导入',
    desc: '粘贴正文，智能分段',
    icon: BookOpen,
    step: 1,
  },
  {
    path: '/dubbing',
    label: '角色配音',
    desc: '标记角色，调节参数',
    icon: Mic,
    step: 2,
  },
  {
    path: '/export',
    label: '试听导出',
    desc: '连续播放，导出文件',
    icon: Volume2,
    step: 3,
  },
];

export default function TopNav() {
  const unassigned = useAppStore(selectUnassignedCount);
  const chapters = useAppStore((s) => s.chapters);
  const hasContent = chapters.length > 0;

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/80 border-b border-ink-200">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between gap-8">
          <div className="flex items-center gap-3">
            <div className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-midnight-600 to-ink-500 flex items-center justify-center shadow-card">
              <span className="font-song font-bold text-white text-xl">墨</span>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-ink-400 border-2 border-white" />
            </div>
            <div>
              <h1 className="font-song font-semibold text-lg text-midnight-800 leading-tight">
                墨音
              </h1>
              <p className="text-xs text-ink-500 leading-tight">网文听书试音工具</p>
            </div>
          </div>

          <nav className="flex-1">
            <ul className="flex items-center justify-center gap-1 bg-ink-50/80 rounded-full p-1.5 border border-ink-200 shadow-inner max-w-2xl mx-auto">
              {NAV_ITEMS.map((item, i) => {
                const Icon = item.icon;
                const showAlert = item.step === 2 && unassigned > 0 && hasContent;
                return (
                  <li key={item.path} className="flex-1 relative">
                    {i > 0 && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-px bg-ink-300 z-0" />
                    )}
                    <NavLink
                      to={item.path}
                      className={({ isActive }) =>
                        cn(
                          'relative z-10 group flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-full transition-all duration-300',
                          isActive
                            ? 'bg-gradient-to-r from-midnight-600 to-midnight-700 text-white shadow-paper'
                            : 'text-ink-600 hover:text-midnight-700 hover:bg-white/60'
                        )
                      }
                    >
                      <div
                        className={cn(
                          'flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold border transition-all',
                          'group-hover:scale-110'
                        )}
                      >
                        {item.step}
                      </div>
                      <Icon size={17} strokeWidth={2} />
                      <span className="font-medium text-sm">{item.label}</span>
                      {showAlert && (
                        <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-role-villain text-white text-[10px] font-bold shadow-sm animate-pulse-soft">
                          {unassigned > 99 ? '99+' : unassigned}
                        </span>
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="text-right min-w-[140px]">
            {hasContent ? (
              <div>
                <p className="text-xs text-ink-500">
                  已导入 <span className="font-semibold text-midnight-700">{chapters.length}</span> 章
                </p>
                <p className="text-xs text-ink-500">
                  共{' '}
                  <span className="font-semibold text-midnight-700">
                    {chapters
                      .reduce((a, c) => a + c.wordCount, 0)
                      .toLocaleString('zh-CN')}
                  </span>{' '}
                  字
                </p>
              </div>
            ) : (
              <p className="text-xs text-ink-400 italic">尚未导入章节</p>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
