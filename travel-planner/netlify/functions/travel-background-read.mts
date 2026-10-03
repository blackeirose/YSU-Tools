import type { Config } from "@netlify/functions";
import { readBackground } from "../../src/server/background";
declare const Netlify: { env: { get(name: string): string | undefined } };
export default async (request: Request) => readBackground(request, (name) => Netlify.env.get(name));
export const config: Config = { path: "/travel-planner/api/background/status" };
