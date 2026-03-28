// Synchronous local store for shopping list store filter
let selectedStores: string[] = ['metro', 'iga', 'superc', 'maxi', 'walmart'];

export const shoppingStorePreferencesService = {
  getSelectedStores(): string[] {
    return [...selectedStores];
  },

  toggleStore(storeCode: string): string[] {
    if (selectedStores.includes(storeCode)) {
      selectedStores = selectedStores.filter(s => s !== storeCode);
    } else {
      selectedStores = [...selectedStores, storeCode];
    }
    return [...selectedStores];
  },

  setStores(stores: string[]): void {
    selectedStores = [...stores];
  },
};
