import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

export default function InterviewSession() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [backendUrl, setBackendUrl] = useState('');

  useEffect(() => {
    // Determine the backend base URL dynamically (removing /api if present)
    const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/api$/, '').replace(/\/$/, '');
    
    if (sessionId) {
      setBackendUrl(`${baseUrl}/index.html?session_id=${sessionId}`);
    } else {
      setBackendUrl(`${baseUrl}/index.html`);
    }
  }, [sessionId]);

  if (!backendUrl) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-lg font-semibold text-gray-700">Loading your interview session...</p>
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0, overflow: 'hidden' }}>
      <iframe 
        src={backendUrl} 
        style={{ width: '100%', height: '100%', border: 'none' }} 
        allow="camera; microphone; fullscreen; display-capture; autoplay" 
        title="Interview Session"
      />
    </div>
  );
}
