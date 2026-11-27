import { NextRequest, NextResponse } from 'next/server';
import { requireSession, assertRole } from '@/lib/session';

const PRINT_WORKER_URL = process.env.PRINT_WORKER_URL || 'http://localhost:3001';

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    assertRole(session, ['COMPANY_ADMIN', 'ORG_ADMIN', 'SPACE_ADMIN', 'SCOPED']);
    
    const { labels } = await request.json();
    
    // Validaciones
    if (!Array.isArray(labels) || labels.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Debe enviar un array de etiquetas' },
        { status: 400 }
      );
    }
    
    // Validar que cada etiqueta tenga los datos necesarios
    for (const label of labels) {
      if (!label.nombre || !label.apellido || !label.empresa || !label.fecha) {
        return NextResponse.json(
          { success: false, error: 'Faltan datos en alguna etiqueta' },
          { status: 400 }
        );
      }
    }
    
    // Enviar al print worker
    const response = await fetch(`${PRINT_WORKER_URL}/print-batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ labels }),
    });
    
    const result = await response.json();
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Error al imprimir lote:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido' 
      },
      { status: 500 }
    );
  }
}
