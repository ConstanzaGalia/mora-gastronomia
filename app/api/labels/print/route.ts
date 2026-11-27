import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireSession, assertRole } from '@/lib/session';

const PRINT_WORKER_URL = process.env.PRINT_WORKER_URL || 'http://localhost:3001';

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    assertRole(session, ['COMPANY_ADMIN', 'ORG_ADMIN', 'SPACE_ADMIN', 'SCOPED']);
    
    const { dinerId, companyId, date } = await request.json();
    
    // Validaciones
    if (!dinerId || !companyId || !date) {
      return NextResponse.json(
        { success: false, error: 'Faltan parámetros requeridos' },
        { status: 400 }
      );
    }
    
    const supabase = await createClient();
    
    // Obtener datos del comensal
    const { data: profile } = await supabase
      .from('profiles')
      .select('nombre, apellido, dni')
      .eq('id', dinerId)
      .maybeSingle();
    
    if (!profile) {
      return NextResponse.json(
        { success: false, error: 'Comensal no encontrado' },
        { status: 404 }
      );
    }
    
    // Obtener sector
    const { data: membership } = await supabase
      .from('memberships')
      .select('sector_id, company_sectors(name)')
      .eq('user_id', dinerId)
      .eq('company_id', companyId)
      .maybeSingle();
    
    const sector = membership?.company_sectors as { name?: string } | null;
    
    // Obtener empresa
    const { data: company } = await supabase
      .from('companies')
      .select('nombre_comercial')
      .eq('id', companyId)
      .maybeSingle();
    
    if (!company) {
      return NextResponse.json(
        { success: false, error: 'Empresa no encontrada' },
        { status: 404 }
      );
    }
    
    // Obtener turno (si existe elección para ese día)
    const { data: selection } = await supabase
      .from('v_selection_details')
      .select('meal_shift')
      .eq('employee_id', dinerId)
      .eq('service_date', date)
      .eq('company_id', companyId)
      .maybeSingle();
    
    // Enviar a print worker
    const response = await fetch(`${PRINT_WORKER_URL}/print`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        nombre: profile.nombre,
        apellido: profile.apellido,
        sector: sector?.name,
        empresa: company.nombre_comercial,
        fecha: date,
        turno: selection?.meal_shift,
      }),
    });
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Error al imprimir');
    }
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error('Error al imprimir etiqueta:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido' 
      },
      { status: 500 }
    );
  }
}
