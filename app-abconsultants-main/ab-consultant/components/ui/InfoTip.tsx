
import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle } from 'lucide-react';

const InfoTip: React.FC<{ text: string }> = ({ text }) => {
    const [show, setShow] = useState(false);
    const ref = useRef<HTMLSpanElement>(null);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const handleEnter = () => {
        if (ref.current) {
            const rect = ref.current.getBoundingClientRect();
            setPos({ x: rect.left + rect.width / 2, y: rect.top });
        }
        setShow(true);
    };
    return (
        <span ref={ref} className="inline-flex ml-1 cursor-help"
              onMouseEnter={handleEnter} onMouseLeave={() => setShow(false)}
              onClick={(e) => e.stopPropagation()}>
            <HelpCircle className="w-3 h-3 text-slate-400 hover:text-brand-500 transition-colors" />
            {show && createPortal(
                <span
                    className="fixed z-[9999] w-56 px-3 py-2 rounded-lg bg-slate-800 text-white text-[11px] leading-relaxed font-normal normal-case tracking-normal shadow-xl pointer-events-none whitespace-pre-line"
                    style={{ left: pos.x, top: pos.y - 8, transform: 'translate(-50%, -100%)' }}
                >
                    {text}
                    <span className="absolute left-1/2 -translate-x-1/2 top-full -mt-1 w-2 h-2 bg-slate-800 rotate-45" />
                </span>,
                document.body
            )}
        </span>
    );
};

export default InfoTip;

export const getPerfColor = (p: number) => {
    if (p >= 110) return { text: 'text-emerald-700', bg: 'bg-emerald-100', bar: '#059669' };
    if (p >= 100) return { text: 'text-lime-700', bg: 'bg-lime-100', bar: '#65a30d' };
    if (p >= 95) return { text: 'text-amber-600', bg: 'bg-amber-100', bar: '#d97706' };
    if (p >= 85) return { text: 'text-orange-600', bg: 'bg-orange-100', bar: '#ea580c' };
    return { text: 'text-red-600', bg: 'bg-red-100', bar: '#dc2626' };
};
