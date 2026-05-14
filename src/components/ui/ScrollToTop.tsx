import { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

export default function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.scrollY > 300) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', toggleVisibility);
    return () => window.removeEventListener('scroll', toggleVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  if (!isVisible) return null;

  return (
    <button
      onClick={scrollToTop}
      className="fixed bottom-20 right-4 p-3 rounded-full shadow-lg z-50 transition-all hover:-translate-y-1 hover:shadow-xl cursor-pointer border-none flex items-center justify-center animate-in fade-in zoom-in duration-300"
      style={{
        backgroundColor: 'var(--color-primary)',
        color: 'white',
      }}
      aria-label="回到顶部"
    >
      <ArrowUp size={20} strokeWidth={2.5} />
    </button>
  );
}
