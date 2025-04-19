import { getAllItems, createItem } from '../../../lib/api';

export async function get() {
  const items = await getAllItems();
  return new Response(JSON.stringify(items), {
    status: 200,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

export async function post({ request }) {
  try {
    const data = await request.json();
    const newItem = await createItem(data);
    
    if (newItem) {
      return new Response(JSON.stringify(newItem), {
        status: 201,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    
    return new Response(JSON.stringify({ error: "Failed to create item" }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}