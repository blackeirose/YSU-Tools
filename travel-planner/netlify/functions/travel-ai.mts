import type { Config } from "@netlify/functions";
import { geminiHandler } from "../../src/server/gemini";
declare const Netlify: { env: { get(name: string): string | undefined } };
export default async (request: Request) => geminiHandler(request, (key) => Netlify.env.get(key));
export const config: Config = { path: "/travel-planner/api/ai" };
