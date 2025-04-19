import { getItem, updateItem, deleteItem } from '../../../lib/api';

export async function get({ params }) {
  const { id } = params;
  const item = await getItem(id);
  
  if (item) {
    return new Response(JSON.stringify(item), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
  
  return new Response(JSON.stringify({ error: "Item not found" }), {
    status: 404,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

export async function put({ params, request }) {
  const { id } = params;
  try {
    const data = await request.json();
    const updated = await updateItem(id, data);
    
    if (updated) {
      return new Response(JSON.stringify(updated), {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    
    return new Response(JSON.stringify({ error: "Item not found or update failed" }), {
      status: 404,
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

export async function del({ params }) {
  const { id } = params;
  const success = await deleteItem(id);
  
  if (success) {
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
  
  return new Response(JSON.stringify({ error: "Item not found or delete failed" }), {
    status: 404,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}