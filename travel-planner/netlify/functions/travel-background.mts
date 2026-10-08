import type { Config } from "@netlify/functions";
import { startBackground } from "../../src/server/background";
declare const Netlify: { env: { get(name: string): string | undefined } };
export default async (request: Request) => startBackground(request, (name) => Netlify.env.get(name));
export const config: Config = { background: true, path: "/travel-planner/api/background/start" };
