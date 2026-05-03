// Centralized RevenueCat / subscription error → French user-facing message.
// Used by the paywall screens (index, menu, shopping) AND the dedicated
// subscription page so they all show consistent wording for the same error.
export function mapSubscriptionError(error: any): string {
  if (error?.noOfferings) {
    return 'Aucun forfait disponible pour le moment. Réessayez plus tard.';
  }
  const code = error?.code || error?.userInfo?.readable_error_code;
  if (code === 'PRODUCT_NOT_AVAILABLE_FOR_PURCHASE' || code === 'PURCHASE_NOT_ALLOWED_ERROR') {
    return "Ce forfait n'est pas disponible pour le moment. Réessayez plus tard.";
  }
  if (code === 'NETWORK_ERROR') {
    return 'Problème de connexion. Vérifiez votre internet et réessayez.';
  }
  if (code === 'STORE_PROBLEM_ERROR' || code === 'PAYMENT_PENDING_ERROR') {
    return "Problème avec l'App Store. Réessayez dans quelques minutes.";
  }
  if (error?.message) return error.message;
  return "Impossible de démarrer l'essai. Veuillez réessayer.";
}
