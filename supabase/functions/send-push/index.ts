import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SB_URL')!,
      Deno.env.get('SB_SERVICE_ROLE_KEY')!
    );

    const { metro_station, title, vacancy_id } = await req.json();

    const { data: workers } = await supabase
      .from('jm_users')
      .select('push_token')
      .eq('role', 'worker')
      .eq('metro_station', metro_station)
      .not('push_token', 'is', null);

    if (!workers || workers.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tokens = workers.map((w: any) => w.push_token).filter(Boolean);

    const messages = tokens.map((token: string) => ({
      to: token,
      title: '🆕 Новая смена рядом с вами!',
      body: title,
      data: { vacancy_id },
      sound: 'default',
    }));

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });

    return new Response(JSON.stringify({ sent: tokens.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
