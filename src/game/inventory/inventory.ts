import type { InventorySlot, InventoryState } from '../types';
import { itemDef } from '../../data/items';

export function createInventory(size: number): InventoryState {
  return { size, slots: new Array<InventorySlot | null>(size).fill(null) };
}

export function cloneInventory(inv: InventoryState): InventoryState {
  return { size: inv.size, slots: inv.slots.map((s) => (s ? { ...s } : null)) };
}

export function resizeInventory(inv: InventoryState, size: number): InventoryState {
  const slots = inv.slots.slice(0, size);
  while (slots.length < size) slots.push(null);
  return { size, slots };
}

export function countItem(inv: InventoryState, itemId: string): number {
  return inv.slots.reduce((total, slot) => (slot?.id === itemId ? total + slot.qty : total), 0);
}

export function freeSlots(inv: InventoryState): number {
  return inv.slots.reduce((n, slot) => (slot ? n : n + 1), 0);
}

export interface AddResult {
  inventory: InventoryState;
  added: number;
  /** True when at least one unit could not fit. */
  overflow: boolean;
}

/** Adds items respecting stack limits. Returns a new inventory. */
export function addItem(inv: InventoryState, itemId: string, qty: number): AddResult {
  const def = itemDef(itemId);
  const next = cloneInventory(inv);
  let remaining = Math.max(0, Math.floor(qty));

  // Top up existing stacks first.
  for (const slot of next.slots) {
    if (remaining <= 0) break;
    if (slot && slot.id === itemId && slot.qty < def.stackLimit) {
      const room = def.stackLimit - slot.qty;
      const moved = Math.min(room, remaining);
      slot.qty += moved;
      remaining -= moved;
    }
  }
  // Then fill empty slots.
  for (let i = 0; i < next.slots.length && remaining > 0; i += 1) {
    if (next.slots[i]) continue;
    const moved = Math.min(def.stackLimit, remaining);
    next.slots[i] = { id: itemId, qty: moved };
    remaining -= moved;
  }

  return { inventory: next, added: Math.floor(qty) - remaining, overflow: remaining > 0 };
}

/** Removes up to `qty`; returns how much was actually removed. */
export function removeItem(inv: InventoryState, itemId: string, qty: number): { inventory: InventoryState; removed: number } {
  const next = cloneInventory(inv);
  let remaining = Math.max(0, Math.floor(qty));
  for (let i = next.slots.length - 1; i >= 0 && remaining > 0; i -= 1) {
    const slot = next.slots[i];
    if (!slot || slot.id !== itemId) continue;
    const taken = Math.min(slot.qty, remaining);
    slot.qty -= taken;
    remaining -= taken;
    if (slot.qty <= 0) next.slots[i] = null;
  }
  return { inventory: next, removed: Math.floor(qty) - remaining };
}

export function hasItems(inv: InventoryState, cost: Record<string, number>): boolean {
  return Object.entries(cost).every(([id, qty]) => countItem(inv, id) >= qty);
}

export function missingItems(inv: InventoryState, cost: Record<string, number>): Record<string, number> {
  const missing: Record<string, number> = {};
  for (const [id, qty] of Object.entries(cost)) {
    const deficit = qty - countItem(inv, id);
    if (deficit > 0) missing[id] = deficit;
  }
  return missing;
}

/** Removes a whole recipe/placement cost atomically (validated first). */
export function consumeItems(inv: InventoryState, cost: Record<string, number>): InventoryState | null {
  if (!hasItems(inv, cost)) return null;
  let next = inv;
  for (const [id, qty] of Object.entries(cost)) {
    next = removeItem(next, id, qty).inventory;
  }
  return next;
}

/** How many times a cost can be paid by the current inventory. */
export function craftableCount(inv: InventoryState, cost: Record<string, number>): number {
  let max = Infinity;
  for (const [id, qty] of Object.entries(cost)) {
    max = Math.min(max, Math.floor(countItem(inv, id) / qty));
  }
  return max === Infinity ? 0 : max;
}

export function sortedSlots(inv: InventoryState): (InventorySlot | null)[] {
  const filled = inv.slots.filter((s): s is InventorySlot => s !== null);
  filled.sort((a, b) => {
    const da = itemDef(a.id);
    const db = itemDef(b.id);
    return da.sortOrder - db.sortOrder || a.id.localeCompare(b.id);
  });
  return [...filled, ...new Array<null>(inv.size - filled.length).fill(null)];
}

export function inventoryWeight(inv: InventoryState): number {
  return inv.slots.reduce((n, s) => n + (s ? s.qty : 0), 0);
}
