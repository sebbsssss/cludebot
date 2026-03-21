import { motion, AnimatePresence } from 'framer-motion';
import { X, TrendingDown } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
}

const COMPARISONS = [
  { provider: 'Clude', model: 'qwen3-5-9b', cost: 'Free', note: 'Private, zero retention' },
  { provider: 'Clude', model: 'llama-3.3-70b', cost: '~$0.0002/msg', note: 'Private, zero retention' },
  { provider: 'Clude', model: 'deepseek-v3.2', cost: '~$0.0002/msg', note: 'Private, zero retention' },
  { provider: 'OpenAI', model: 'GPT-5.4', cost: '~$0.005/msg', note: 'Direct API pricing' },
  { provider: 'Anthropic', model: 'Claude Opus 4.6', cost: '~$0.05/msg', note: 'Direct API pricing' },
];

export function CostComparison({ open, onClose }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          className="absolute bottom-full mb-2 right-0 w-80 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl z-50 p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5 text-[11px] text-white font-medium">
              <TrendingDown className="h-3.5 w-3.5 text-green-400" /> Cost Comparison
            </div>
            <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="space-y-1.5">
            {COMPARISONS.map((c, i) => (
              <div key={i} className={`flex items-center justify-between text-[10px] py-1 ${
                c.provider === 'Clude' ? 'text-zinc-300' : 'text-zinc-500'
              }`}>
                <div>
                  <span className="font-medium">{c.model}</span>
                  <span className="text-zinc-600 ml-1.5">{c.note}</span>
                </div>
                <span className={c.provider === 'Clude' ? 'text-green-400 font-medium' : ''}>{c.cost}</span>
              </div>
            ))}
          </div>

          <div className="mt-3 pt-2 border-t border-zinc-800 text-[9px] text-zinc-500">
            Private models: up to 250x cheaper. Zero data retention. Your prompts are never stored.
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
