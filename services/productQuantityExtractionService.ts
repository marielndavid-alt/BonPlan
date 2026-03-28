export const extractProductQuantity = (name: string) => {
  const match = name.match(/(\d+(?:\.\d+)?)\s*(g|kg|ml|l|oz|lb)/i);
  if (match) return { quantity: parseFloat(match[1]), unit: match[2].toLowerCase() };
  return { quantity: 1, unit: 'unité' };
};
