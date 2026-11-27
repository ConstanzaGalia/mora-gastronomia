'use client'

import { useState } from 'react';

type PrintLabelButtonProps = {
  dinerId: string
  dinerName: string
  dinerSurname: string
  sector?: string
  company: string
  companyId: string
  date: string
  shift?: 'MORNING' | 'AFTERNOON' | null
}

export function PrintLabelButton({
  dinerId,
  dinerName,
  dinerSurname,
  sector,
  company,
  companyId,
  date,
  shift
}: PrintLabelButtonProps) {
  const [printing, setPrinting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  
  async function handlePrint() {
    setPrinting(true);
    setStatus('idle');
    
    try {
      const response = await fetch('/api/labels/print', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dinerId,
          companyId,
          date,
        }),
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Error al imprimir');
      }
      
      setStatus('success');
      setTimeout(() => setStatus('idle'), 2000);
      
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      console.error('Error:', err);
      setStatus('error');
      alert(`Error al imprimir: ${message}`);
    } finally {
      setPrinting(false);
    }
  }
  
  return (
    <button
      onClick={handlePrint}
      disabled={printing}
      className="text-button"
      title="Imprimir etiqueta"
      style={{ fontSize: '1.2rem' }}
    >
      {status === 'success' ? '✅' : printing ? '⏳' : status === 'error' ? '❌' : '🏷️'}
    </button>
  );
}
