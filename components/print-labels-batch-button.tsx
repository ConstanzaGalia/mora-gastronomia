'use client'

import { useState } from 'react';

type LabelData = {
  nombre: string
  apellido: string
  sector?: string
  empresa: string
  fecha: string
  turno?: 'MORNING' | 'AFTERNOON' | null
}

type PrintLabelsBatchButtonProps = {
  labels: LabelData[]
  companyName: string
  date: string
}

export function PrintLabelsBatchButton({
  labels,
  companyName,
  date
}: PrintLabelsBatchButtonProps) {
  const [printing, setPrinting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  
  async function handlePrintAll() {
    if (labels.length === 0) {
      alert('No hay comensales para imprimir');
      return;
    }
    
    const confirmed = confirm(
      `¿Imprimir ${labels.length} etiqueta${labels.length === 1 ? '' : 's'} para ${companyName}?`
    );
    
    if (!confirmed) return;
    
    setPrinting(true);
    setProgress(`Imprimiendo 0/${labels.length}...`);
    
    try {
      const response = await fetch('/api/labels/print-batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ labels }),
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Error al imprimir');
      }
      
      setProgress(`Completado: ${result.stats.success}/${result.stats.total}`);
      
      if (result.stats.errors > 0) {
        alert(
          `Impresión completada con errores:\n` +
          `Exitosas: ${result.stats.success}\n` +
          `Errores: ${result.stats.errors}`
        );
      } else {
        alert(`¡${result.stats.success} etiquetas impresas correctamente! 🎉`);
      }
      
      setTimeout(() => {
        setProgress(null);
        setPrinting(false);
      }, 3000);
      
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      console.error('Error:', err);
      alert(`Error al imprimir: ${message}`);
      setProgress(null);
      setPrinting(false);
    }
  }
  
  return (
    <div style={{ display: 'inline-block' }}>
      <button
        onClick={handlePrintAll}
        disabled={printing || labels.length === 0}
        className="primary-button"
        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
      >
        <span>🏷️</span>
        <span>
          {printing 
            ? progress || 'Imprimiendo...' 
            : `Imprimir Etiquetas (${labels.length})`}
        </span>
      </button>
    </div>
  );
}
