import type { Config } from "@netlify/functions";
import { exploreHandler } from "../../src/server/explore";
declare const Netlify: { env: { get(name: string): string | undefined } };
export default async (request: Request) =>
  exploreHandler(request, (key) => Netlify.env.get(key));
export const config: Config = { path: "/travel-planner/api/explore" };
