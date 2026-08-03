import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SECRET_TOKEN = process.env.WEBHOOK_SECRET_TOKEN || 'MijnGeheimeToken123!';

export async function POST(req) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || authHeader !== `Bearer ${SECRET_TOKEN}`) {
      return NextResponse.json({ error: 'Unauthorized payload' }, { status: 401 });
    }

    const body = await req.json();
    const { type, title, bought_price, sold_price, date } = body;

    if (!type || !title) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (type === 'bought') {
      const { error } = await supabase.from('inventory').insert([
        {
          original_title: title,
          bought_price: bought_price || 0,
          status: 'Bought',
          date_bought: date || new Date().toISOString()
        }
      ]);

      if (error) throw error;
      return NextResponse.json({ success: true, message: 'Bought item saved' });
    }

    if (type === 'sold') {
      const { data: matches, error: searchError } = await supabase
        .from('inventory')
        .select('*')
        .eq('status', 'Listed')
        .or(`seo_title.ilike.%${title}%,original_title.ilike.%${title}%`);

      if (searchError) throw searchError;

      if (matches && matches.length === 1) {
        const itemToUpdate = matches[0];
        const { error: updateError } = await supabase
          .from('inventory')
          .update({
            status: 'Sold',
            sold_price: sold_price || 0,
            date_sold: date || new Date().toISOString()
          })
          .eq('id', itemToUpdate.id);

        if (updateError) throw updateError;
        return NextResponse.json({ success: true, message: 'Item matched and updated to Sold' });
      }

      const { error: unmatchedError } = await supabase
        .from('unmatched_sales')
        .insert([
          {
            raw_title: title,
            sold_price: sold_price || 0,
            status: 'Pending',
            date_sold: date || new Date().toISOString()
          }
        ]);

      if (unmatchedError) throw unmatchedError;
      return NextResponse.json({ success: true, message: 'Logged into unmatched_sales' });
    }

    return NextResponse.json({ error: 'Invalid event type' }, { status: 400 });

  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
