// Libellés/couleurs du suivi de livraison La Poste (côté web).
export const DELIVERY: Record<string, { label: string; color: string; icon: string }> = {
  deposited:  { label: 'Déposé',     color: '#a5b4fc', icon: '📮' },
  in_transit: { label: 'En transit', color: '#f59e0b', icon: '🚚' },
  delivered:  { label: 'Livré',      color: '#22c55e', icon: '✅' },
};
