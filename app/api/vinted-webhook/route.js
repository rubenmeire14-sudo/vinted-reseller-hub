import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request) {
  try {
    const authHeader = request.headers.get('x-secret-token');
    if (authHeader !== process.env.VINTED_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, title, price, bought_at, sold_at } = body;

    if (!title || price === undefined) {
      return NextResponse.json({ error: 'Missing title or price' }, { status: 400 });
    }

    // 1. AANKOOP OPSLAAN
    if (action === 'bought') {
      const { data, error } = await supabase
        .from('inventory')
        .insert([
          {
            title: title,
            bought_price: price,
            status: 'Bought',
            bought_at: bought_at || new Date().toISOString()
          },
        ]);

      if (error) throw error;
      return NextResponse.json({ message: 'Item toegevoegd aan voorraad', data }, { status: 200 });
    }

    // 2. VERKOOP VERWERKEN
    if (action === 'sold') {
      // Zoek een match in voorraad die nog niet verkocht is
      const { data: itemMatch, error: matchError } = await supabase
        .from('inventory')
        .select('*')
        .eq('title', title)
        .neq('status', 'Sold')
        .limit(1)
        .maybeSingle();

      if (itemMatch && !matchError) {
        // Matchende aankoop gevonden -> Update naar Sold
        const { error: updateError } = await supabase
          .from('inventory')
          .update({
            sold_price: price,
            sold_at: sold_at || new Date().toISOString(),
            status: 'Sold',
          })
          .eq('id', itemMatch.id);

        if (updateError) throw updateError;
        return NextResponse.json({ message: 'Item succesvol bijgewerkt naar Sold' }, { status: 200 });
      } else {
        // Geen aankoop-match -> Sla op in unmatched_sales
        const { error: unmatchedError } = await supabase
          .from('unmatched_sales')
          .insert([
            {
              title: title,
              sold_price: price,
              sold_at: sold_at || new Date().toISOString(),
            },
          ]);

        if (unmatchedError) throw unmatchedError;
        return NextResponse.json({ message: 'Geen match gevonden, opgeslagen bij unmatched_sales' }, { status: 200 });
      }
    }

    return NextResponse.json({ error: 'Ongeldige actie' }, { status: 400 });

  } catch (err) {
    console.error('Webhook error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
