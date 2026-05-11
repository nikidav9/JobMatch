import { createClient } from '@supabase/supabase-js';
import { dispatch } from '../../lib/db-dispatch';

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  'https://bbiqmkeysalwdonlnylb.supabase.co';
const SUPABASE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJiaXFta2V5c2Fsd2RvbmxueWxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MTI5NTIsImV4cCI6MjA5MzM4ODk1Mn0.HHYjTdjdP6lN-GosNfGypts6Kg-2CYyoMPMTnLfdfJQ';

export async function POST(request: Request): Promise<Response> {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  const { fn, args = [] } = await request.json() as { fn: string; args?: unknown[] };
  if (!fn) {
    return Response.json({ error: 'Missing fn' }, { status: 400, headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  try {
    const data = await dispatch(supabase, fn, args);
    return Response.json({ data }, { headers: corsHeaders });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[api/db]', fn, msg);
    return Response.json({ error: msg }, { status: 500, headers: corsHeaders });
  }
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
