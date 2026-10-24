// Type-only stand-in so the offline test build compiles without the real SDK installed.
export class GoogleGenAI { constructor(_o: { apiKey: string }) {} models = { generateContent: async (_a: unknown): Promise<{ text: string }> => ({ text: '' }) }; }
