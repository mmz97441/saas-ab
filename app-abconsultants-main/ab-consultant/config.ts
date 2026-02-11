/**
 * Configuration centralisée de l'application.
 * Source unique pour les constantes partagées entre les composants.
 */

// Super Admin : utilisé pour le contrôle d'accès côté frontend.
// La source de vérité reste les Custom Claims Firebase (côté serveur).
export const SUPER_ADMIN_EMAIL = (
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPER_ADMIN_EMAIL) ||
  'nice.guillaume@gmail.com'
).toLowerCase().trim();
