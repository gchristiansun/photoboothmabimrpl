import React, { useEffect } from 'react';
import PhotoStripComposer from './components/PhotoStripComponent';

export default function App() {
  useEffect(() => {
    // Mencegah zoom via keyboard (Ctrl + / Ctrl - / =)
    const handleZoom = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '-' || e.key === '=')) {
        e.preventDefault();
      }
    };

    // Mencegah zoom via scroll + Ctrl
    const handleWheel = (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleZoom);
    window.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      window.removeEventListener('keydown', handleZoom);
      window.removeEventListener('wheel', handleWheel);
    };
  }, []);

  return (
    <div className="app-root">
      {/* <header className="app-header flex w-full justify-center fixed top-0 mb-10 mt-10 ml-0 mr-0">
        <h1 className='-translate-x-50'>Photobooth Mabim</h1>
      </header> */}
      <main className="app-main">
        <PhotoStripComposer />
      </main>
    </div>
  );
}
