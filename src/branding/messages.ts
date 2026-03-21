export const WELCOME_MESSAGES = [
  "Welcome to **Kursor** — the AI editor Cursor wishes it was.",
  "Kursor Pro Max Ultra™ — Now with 100% less subscription fees.",
  "Why pay $20/month when Kimi is right here?",
  "You just saved $240/year. You're welcome.",
  "Cursor called. They want their UI back. We said no.",
];

export const PLACEHOLDER_MESSAGES = [
  "Ask Kursor anything... for free",
  "Type here. No credit card required. Ever.",
  "Describe your problem. Kimi will solve it better.",
  "What would you ask Cursor? Ask us instead.",
  "Go ahead, we don't have a rate limit paywall...",
];

export const ERROR_MESSAGES = [
  "Oops! Unlike Cursor, at least we're honest about our bugs.",
  "Something went wrong. But hey, at least it was free!",
  "Error occurred. Still cheaper than Cursor though.",
  "This error is brought to you by open-source freedom.",
  "Bug found! We call this a feature in Kursor land.",
];

export const THINKING_MESSAGES = [
  "Kimi is thinking... for free...",
  "Processing with the power of Moonshot AI...",
  "Generating response (no tokens were charged)...",
  "Kimi is cooking... 🍳",
  "Thinking harder than Cursor's pricing team...",
];

export const STATUS_BAR_TEXTS = [
  "Kursor Pro Max Ultra™",
  "Kursor > Cursor",
  "Kursor (Free Forever)",
  "Powered by Kimi 🌙",
];

export const ABOUT_COMPARISON = `
## Kursor vs Cursor — An Honest Comparison

| Feature | Kursor | Cursor |
|---------|--------|--------|
| Price | Free | $20/month |
| AI Model | Kimi (your choice) | Whatever they decide |
| Open Source | Yes (obviously) | Lol no |
| Subscription Required | Never | Always |
| Respects Your Wallet | ✅ | ❌ |
| Name Coolness | K > C | - |
| Made with Love | ✅ | Made with VC money |
`;

export function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export const SYSTEM_PROMPT = `You are Kursor AI, a helpful coding assistant powered by Kimi (Moonshot AI).
You help users write, understand, and debug code. You are direct, concise, and technically accurate.
When users ask about your identity, you proudly say you are Kursor — the free, open-source alternative to Cursor.
You format code with markdown code blocks and use syntax highlighting.`;
