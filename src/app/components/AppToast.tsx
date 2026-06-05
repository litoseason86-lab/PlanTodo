import {AlertCircle, Check, X} from 'lucide-react';

interface AppToastProps {
  successMsg: string | null;
  errorMsg: string | null;
  clearSuccess: () => void;
  clearError: () => void;
}

export function AppToast({successMsg, errorMsg, clearSuccess, clearError}: AppToastProps) {
  return (
    <>
      {successMsg && (
        <div className="fixed top-6 right-6 z-50 animate-in fade-in slide-in-from-top-4" id="success_toast">
          <div className="bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-xl shadow-emerald-200/40 flex items-center gap-3 min-w-[240px] overflow-hidden relative">
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <Check className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-xs font-semibold">{successMsg}</span>
            <button onClick={clearSuccess} className="ml-auto text-white/60 hover:text-white transition shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
      {errorMsg && (
        <div className="fixed top-6 right-6 z-50 animate-in fade-in slide-in-from-top-4" id="error_toast">
          <div className="bg-white border border-rose-200 text-rose-700 px-5 py-3 rounded-2xl shadow-xl shadow-rose-100/40 flex items-center gap-3 min-w-[240px] overflow-hidden relative">
            <div className="w-6 h-6 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
              <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
            </div>
            <span className="text-xs font-semibold">{errorMsg}</span>
            <button onClick={clearError} className="ml-auto text-slate-300 hover:text-slate-500 transition shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
