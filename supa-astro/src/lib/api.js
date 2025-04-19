import { supabase } from './supabase';

export async function getAllItems() {
  try {
    const { data, error } = await supabase
      .from('items')
      .select('*');
      
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error getting all items:', error);
    return [];
  }
}

export async function getItem(itemId) {
  try {
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('item_id', itemId)
      .single();
      
    if (error) throw error;
    return data;
  } catch (error) {
    console.error(`Error getting item ${itemId}:`, error);
    return null;
  }
}

export async function createItem(item) {
  try {
    const { data, error } = await supabase
      .from('items')
      .insert([item])
      .select()
      .single();
      
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating item:', error);
    return null;
  }
}

export async function updateItem(itemId, item) {
  try {
    const { data, error } = await supabase
      .from('items')
      .update(item)
      .eq('item_id', itemId)
      .select()
      .single();
      
    if (error) throw error;
    return data;
  } catch (error) {
    console.error(`Error updating item ${itemId}:`, error);
    return null;
  }
}

export async function deleteItem(itemId) {
  try {
    const { error } = await supabase
      .from('items')
      .delete()
      .eq('item_id', itemId);
      
    if (error) throw error;
    return true;
  } catch (error) {
    console.error(`Error deleting item ${itemId}:`, error);
    return false;
  }
}