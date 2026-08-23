import { isCloudConfigured } from './supabaseClient';
import * as cloud from './cloudNotesStore';
import * as local from './localNotesStore';

function api() {
  return isCloudConfigured() ? cloud : local;
}

export const listNotes = (...args: Parameters<typeof local.listNotes>) =>
  api().listNotes(...args);
export const getNote = (...args: Parameters<typeof local.getNote>) =>
  api().getNote(...args);
export const createNote = (...args: Parameters<typeof local.createNote>) =>
  api().createNote(...args);
export const updateNote = (...args: Parameters<typeof local.updateNote>) =>
  api().updateNote(...args);
export const softDeleteNotes = (
  ...args: Parameters<typeof local.softDeleteNotes>
) => api().softDeleteNotes(...args);
export const restoreNotes = (...args: Parameters<typeof local.restoreNotes>) =>
  api().restoreNotes(...args);
export const purgeNotes = (...args: Parameters<typeof local.purgeNotes>) =>
  api().purgeNotes(...args);
export const purgeSoftDeletedNotes = (
  ...args: Parameters<typeof local.purgeSoftDeletedNotes>
) => api().purgeSoftDeletedNotes(...args);
export const deleteNote = (...args: Parameters<typeof local.deleteNote>) =>
  api().deleteNote(...args);
export const addImage = (...args: Parameters<typeof local.addImage>) =>
  api().addImage(...args);
export const removeImage = (...args: Parameters<typeof local.removeImage>) =>
  api().removeImage(...args);
export const reorderImages = (
  ...args: Parameters<typeof local.reorderImages>
) => api().reorderImages(...args);
export const listLabels = (...args: Parameters<typeof local.listLabels>) =>
  api().listLabels(...args);
export const createLabel = (...args: Parameters<typeof local.createLabel>) =>
  api().createLabel(...args);
export const deleteLabel = (...args: Parameters<typeof local.deleteLabel>) =>
  api().deleteLabel(...args);
export const setNoteLabels = (
  ...args: Parameters<typeof local.setNoteLabels>
) => api().setNoteLabels(...args);
export const listReactionsForNote = (
  ...args: Parameters<typeof local.listReactionsForNote>
) => api().listReactionsForNote(...args);
export const listAllReactions = (
  ...args: Parameters<typeof local.listAllReactions>
) => api().listAllReactions(...args);
export const toggleReaction = (
  ...args: Parameters<typeof local.toggleReaction>
) => api().toggleReaction(...args);
export const listCartItems = (
  ...args: Parameters<typeof local.listCartItems>
) => api().listCartItems(...args);
export const addToCart = (...args: Parameters<typeof local.addToCart>) =>
  api().addToCart(...args);
export const setCartQuantity = (
  ...args: Parameters<typeof local.setCartQuantity>
) => api().setCartQuantity(...args);
export const removeFromCart = (
  ...args: Parameters<typeof local.removeFromCart>
) => api().removeFromCart(...args);
export const clearCart = (...args: Parameters<typeof local.clearCart>) =>
  api().clearCart(...args);
export const cartUnitCount = local.cartUnitCount;
